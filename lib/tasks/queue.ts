import { canQueueTask, getProjectSettings } from '@/lib/settings/project-settings';
import { prisma, TaskStatus } from '@/lib/db';
import { queueEventEmitter } from '@/lib/events/queue-event-emitter';
import { AgentResult } from '@/lib/types/shared';
import { AgentExecutor } from '@/lib/claude-code/executor';
import { ProjectManagerAgent } from '@/lib/project-manager';
import { AgentTask, QueueStatus } from '@/lib/types/agent';

const projectManager: ProjectManagerAgent | null = null;

interface RateLimitStatus {
  dailyTokens: {
    used: number;
    limit: number;
    percentage: number;
    remaining: number;
  };
  minuteRequests: {
    used: number;
    limit: number;
    percentage: number;
    remaining: number;
  };
}

interface TaskPayload {
  command: string;
  priority: number;
  context: Record<string, unknown>;
  agentType: string;
}

export class TaskQueue {
  private executor: AgentExecutor;
  private status: QueueStatus = QueueStatus.ACTIVE;
  private processingCleanup: (() => void) | null = null;
  private isProcessing = false;
  private rateLimiter = {
    getStatus: async () => ({
      dailyTokens: { used: 0, limit: 10000, percentage: 0, remaining: 10000 },
      minuteRequests: { used: 0, limit: 100, percentage: 0, remaining: 100 }
    }),
    canProceed: async () => true,
    recordUsage: async (tokens: number) => {}
  };
  private performanceTracker = {
    recordExecution: async (agentId: string, agentType: string, result: any, complexity: string) => {}
  };

  private initialized = false;

  constructor() {
    this.executor = new AgentExecutor();
    this.setupEventDrivenProcessing();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      try {
        // Test the prisma connection
        if (!prisma) {
          throw new Error('Prisma client is not available');
        }
        await prisma.$queryRaw`SELECT 1`;
        this.initialized = true;
        console.log('✅ TaskQueue database connection verified');
      } catch (error) {
        console.error('❌ TaskQueue database connection failed:', error);
        throw new Error('Database connection required for TaskQueue operations');
      }
    }
  }

  async enqueue(task: {
    projectId: string;
    projectName?: string;
    agentType: string;
    command?: string;
    priority?: number;
    context?: Record<string, unknown>;
  }): Promise<string> {
    await this.ensureInitialized();
    
    // Check if project can queue more tasks
    const queueCheck = await canQueueTask(task.projectId);
    if (!queueCheck.allowed) {
      throw new Error(
        `Cannot queue task: ${queueCheck.reason} (${queueCheck.currentSize}/${queueCheck.maxSize})`
      );
    }

    // Get project settings to determine default priority if not specified
    const settings = await getProjectSettings(task.projectId);
    const priority =
      task.priority ||
      (settings.taskPriority === 'LOW'
        ? 1
        : settings.taskPriority === 'NORMAL'
          ? 5
          : settings.taskPriority === 'HIGH'
            ? 8
            : 10);

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const taskExecution = await prisma.taskExecution.create({
      data: {
        taskId,
        type: task.agentType,
        status: 'PENDING',
        projectId: task.projectId,
        projectName: task.projectName || 'Unknown',
        initiatedBy: 'TaskQueue',
      },
    });

    // Emit task queued event and trigger processing
    queueEventEmitter.emitTaskQueued(taskId, {
      projectId: task.projectId,
      agentType: task.agentType || 'unknown',
      priority,
    });

    // Trigger immediate processing instead of waiting for poll
    queueEventEmitter.triggerProcessing();

    console.log(`Task enqueued: ${taskId} (priority: ${priority})`);
    return taskId;
  }

  async getQueueStatus(): Promise<{
    status: QueueStatus;
    pendingTasks: number;
    activeTasks: number;
    rateLimitStatus: RateLimitStatus;
  }> {
    await this.ensureInitialized();
    
    const [pendingTasks, activeTasks] = await Promise.all([
      prisma.taskExecution.count({
        where: { status: 'PENDING' },
      }),
      prisma.taskExecution.count({
        where: { status: 'RUNNING' },
      }),
    ]);

    const rateLimitStatus = await this.rateLimiter.getStatus();

    return {
      status: this.status,
      pendingTasks,
      activeTasks,
      rateLimitStatus,
    };
  }

  async toggleQueue(): Promise<void> {
    if (this.status === QueueStatus.ACTIVE) {
      // Pause: Stop event-driven processing
      this.status = QueueStatus.PAUSED;
      queueEventEmitter.emitQueueStatusChanged(QueueStatus.PAUSED);
      console.log('Task queue paused');
    } else {
      // Resume: Activate event-driven processing and trigger immediately
      this.status = QueueStatus.ACTIVE;
      queueEventEmitter.emitQueueStatusChanged(QueueStatus.ACTIVE);
      queueEventEmitter.triggerProcessing();
      console.log('Task queue resumed');
    }
  }

  // Legacy method for backward compatibility - now just calls toggleQueue
  async pauseQueue(): Promise<void> {
    if (this.status === QueueStatus.ACTIVE) {
      await this.toggleQueue();
    }
  }

  // Legacy method for backward compatibility - now just calls toggleQueue
  async resumeQueue(): Promise<void> {
    if (this.status === QueueStatus.PAUSED) {
      await this.toggleQueue();
    }
  }

  // Getter method to check if queue is currently active
  isActive(): boolean {
    return this.status === QueueStatus.ACTIVE;
  }

  // Getter method to get current queue status
  getStatus(): QueueStatus {
    return this.status;
  }

  // Cleanup method for shutdown
  cleanup(): void {
    if (this.processingCleanup) {
      this.processingCleanup();
      this.processingCleanup = null;
    }
    console.log('Task queue cleanup completed');
  }

  private setupEventDrivenProcessing(): void {
    // Set up event-driven processing instead of polling
    this.processingCleanup = queueEventEmitter.onProcessingTrigger(async () => {
      if (this.status === QueueStatus.ACTIVE && !this.isProcessing) {
        await this.processNextTask();
      }
    });

    // Initial processing trigger
    queueEventEmitter.triggerProcessing();

    console.log('Event-driven task queue processing started');
  }

  private async processNextTask(): Promise<void> {
    if (this.isProcessing) {
      return; // Prevent concurrent processing
    }

    this.isProcessing = true;

    try {
      await this.ensureInitialized();
      
      // Check rate limits
      const canProceed = await this.rateLimiter.canProceed();
      if (!canProceed) {
        if (this.status === QueueStatus.ACTIVE) {
          console.log('Rate limit reached, pausing queue');
          await this.toggleQueue(); // Use the new toggle method
        }
        return;
      }

      // Get next pending task with highest priority
      const taskExecution = await prisma.taskExecution.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });

      if (!taskExecution) {
        return; // No tasks to process
      }

      console.log(`Processing task: ${taskExecution.taskId}`);

      // Emit task started event
      queueEventEmitter.emitTaskStarted(taskExecution.taskId, {
        projectId: taskExecution.projectId,
        agentType: taskExecution.type,
      });

      // Mark task as running and update with start time
      await prisma.taskExecution.update({
        where: { id: taskExecution.id },
        data: { 
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      // Execute the task
      const result = await this.executeTask(taskExecution);

      // Record token usage
      if (result.tokensUsed) {
        await this.rateLimiter.recordUsage(result.tokensUsed);
        await prisma.tokenUsage.create({
          data: {
            projectId: taskExecution.projectId,
            agentType: taskExecution.type,
            taskId: taskExecution.taskId,
            inputTokens: Math.floor(result.tokensUsed * 0.3), // Rough estimate
            outputTokens: Math.floor(result.tokensUsed * 0.7),
          },
        });
      }

      // Update task with result
      await prisma.taskExecution.update({
        where: { id: taskExecution.id },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          result: result.output,
          error: result.error,
          completedAt: new Date(),
          progress: 1.0,
        },
      });

      // Performance metrics tracking removed (table no longer exists)

      // Emit completion/failure event
      if (result.success) {
        queueEventEmitter.emitTaskCompleted(taskExecution.taskId, {
          success: result.success,
          output: result.output,
          executionTime: result.executionTime,
          tokensUsed: result.tokensUsed,
        });
      } else {
        queueEventEmitter.emitTaskFailed(taskExecution.taskId, {
          error: result.error,
        });
      }

      console.log(
        `Task ${taskExecution.taskId} ${result.success ? 'completed' : 'failed'}`
      );

      // Check if there are more tasks and trigger processing
      const remainingTasks = await prisma.taskExecution.count({
        where: { status: 'PENDING' },
      });

      if (remainingTasks > 0) {
        // Trigger processing for next task
        setTimeout(() => queueEventEmitter.triggerProcessing(), 100);
      }
    } catch (error) {
      console.error('Error processing task:', error);

      // Try to trigger processing again in case there are other tasks
      setTimeout(() => queueEventEmitter.triggerProcessing(), 1000);
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeTask(
    taskExecution: any
  ): Promise<AgentResult> {
    try {
      // Get project details from ProjectIndex
      const project = await prisma.projectIndex.findUnique({
        where: { id: taskExecution.projectId },
        select: {
          id: true,
          name: true,
          localPath: true,
          gitUrl: true,
        },
      });

      if (!project) {
        return {
          success: false,
          error: `Project ${taskExecution.projectId} not found`,
          executionTime: 0,
          tokensUsed: 50,
        };
      }

      // For now, return a mock successful result since we don't have the command payload
      // This should be enhanced when integrating with the actual agent execution system
      return {
        success: true,
        output: `Executed ${taskExecution.type} task for project ${project.name}`,
        executionTime: 1000,
        tokensUsed: 100,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0,
        tokensUsed: 100, // Estimated minimal usage for failed tasks
      };
    }
  }

  // Get task by ID
  async getTask(taskId: string) {
    return prisma.taskExecution.findFirst({
      where: { taskId },
    });
  }

  // Cancel a task
  async cancelTask(taskId: string): Promise<boolean> {
    try {
      const task = await prisma.taskExecution.findFirst({
        where: { taskId },
      });

      if (!task) return false;

      await prisma.taskExecution.update({
        where: { id: task.id },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}
