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

  constructor() {
    this.executor = new AgentExecutor();
    this.setupEventDrivenProcessing();
  }

  async enqueue(task: Omit<AgentTask, 'id' | 'createdAt'>): Promise<string> {
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

    const queuedTask = await prisma.queuedTask.create({
      data: {
        projectId: task.projectId,
        cardId: task.cardId,
        taskId: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agentType: task.agentType,
        payload: JSON.stringify({
          command: task.command,
          priority,
          context: task.context || {},
          agentType: task.agentType,
        }),
        priority,
        status: 'PENDING',
      },
    });

    // Emit task queued event and trigger processing
    queueEventEmitter.emitTaskQueued(queuedTask.taskId, {
      projectId: task.projectId,
      agentType: task.agentType || 'unknown',
      priority,
    });

    // Trigger immediate processing instead of waiting for poll
    queueEventEmitter.triggerProcessing();

    console.log(`Task enqueued: ${queuedTask.taskId} (priority: ${priority})`);
    return queuedTask.taskId;
  }

  async getQueueStatus(): Promise<{
    status: QueueStatus;
    pendingTasks: number;
    activeTasks: number;
    rateLimitStatus: RateLimitStatus;
  }> {
    const [pendingTasks, activeTasks] = await Promise.all([
      prisma.queuedTask.count({
        where: { status: 'PENDING' },
      }),
      prisma.agentTask.count({
        where: { status: TaskStatus.RUNNING },
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
      const queuedTask = await prisma.queuedTask.findFirst({
        where: { status: 'PENDING' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      });

      if (!queuedTask) {
        return; // No tasks to process
      }

      console.log(`Processing task: ${queuedTask.taskId}`);

      // Emit task started event
      queueEventEmitter.emitTaskStarted(queuedTask.taskId, {
        projectId: queuedTask.projectId,
        agentType: queuedTask.agentType,
      });

      // Mark task as running and create agent task record
      const payload = JSON.parse(queuedTask.payload);
      const agentTask = await prisma.agentTask.create({
        data: {
          cardId: queuedTask.cardId!,
          agentType: queuedTask.agentType,
          command: payload.command,
          status: TaskStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      // Update queued task status
      await prisma.queuedTask.update({
        where: { id: queuedTask.id },
        data: { status: 'RUNNING' },
      });

      // Execute the task
      const result = await this.executeTask(payload, queuedTask.projectId);

      // Record token usage
      if (result.tokensUsed) {
        await this.rateLimiter.recordUsage(result.tokensUsed);
        await prisma.tokenUsage.create({
          data: {
            projectId: queuedTask.projectId,
            agentType: queuedTask.agentType,
            taskId: queuedTask.taskId,
            inputTokens: Math.floor(result.tokensUsed * 0.3), // Rough estimate
            outputTokens: Math.floor(result.tokensUsed * 0.7),
          },
        });
      }

      // Update task with result
      await prisma.agentTask.update({
        where: { id: agentTask.id },
        data: {
          status: result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
          output: result.output,
          error: result.error,
          completedAt: new Date(),
        },
      });

      // Update queued task
      await prisma.queuedTask.update({
        where: { id: queuedTask.id },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          completedAt: new Date(),
          error: result.error,
        },
      });

      // Record performance metrics
      try {
        // Find or create agent specification
        const agentSpec = await prisma.agentSpecification.findFirst({
          where: {
            projectId: queuedTask.projectId,
            type: queuedTask.agentType,
          },
        });

        if (agentSpec) {
          await this.performanceTracker.recordExecution(
            agentSpec.id,
            queuedTask.agentType,
            result,
            payload.context?.complexity || 'normal'
          );
        }
      } catch (error) {
        console.error('Error recording performance metrics:', error);
      }

      // Emit completion/failure event
      if (result.success) {
        queueEventEmitter.emitTaskCompleted(queuedTask.taskId, {
          success: result.success,
          output: result.output,
          executionTime: result.executionTime,
          tokensUsed: result.tokensUsed,
        });

        // Emit failure event if needed
        if (!result.success && result.error) {
          queueEventEmitter.emitTaskFailed(queuedTask.taskId, {
            error: result.error,
          });
        }
      } else {
        queueEventEmitter.emitTaskFailed(queuedTask.taskId, {
          error: result.error,
        });
      }

      console.log(
        `Task ${queuedTask.taskId} ${result.success ? 'completed' : 'failed'}`
      );

      // Check if there are more tasks and trigger processing
      const remainingTasks = await prisma.queuedTask.count({
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
    payload: TaskPayload,
    projectId: string
  ): Promise<AgentResult> {
    try {
      // Get project details and context
      const project = await prisma.project.findUnique({
        where: { id: projectId },
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
          error: `Project ${projectId} not found`,
          executionTime: 0,
          tokensUsed: 50,
        };
      }

      // Direct execution using executor
      const result = await this.executor.execute(payload.command, {
        workingDirectory: project.localPath,
        timeout: 1800000, // 30 minutes
        maxRetries: 2,
        projectId: projectId,
        agentType: payload.agentType,
      });

      return {
        ...result,
        executionTime: result.executionTime || 0,
        tokensUsed: result.tokensUsed || 0,
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
    return prisma.queuedTask.findFirst({
      where: { taskId },
      include: {
        project: {
          select: { name: true, localPath: true },
        },
        card: {
          select: { title: true, status: true },
        },
      },
    });
  }

  // Cancel a task
  async cancelTask(taskId: string): Promise<boolean> {
    try {
      const task = await prisma.queuedTask.findFirst({
        where: { taskId },
      });

      if (!task) return false;

      await prisma.queuedTask.update({
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
