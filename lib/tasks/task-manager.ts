import { prisma } from '@/lib/db';

export interface TaskPhase {
  phaseId: string;
  title: string;
  description: string;
  order: number;
  estimatedDuration?: number; // milliseconds
}

export interface TaskEvent {
  type: 'PHASE_START' | 'PHASE_PROGRESS' | 'PHASE_COMPLETE' | 'FILE_PROCESSED' | 'ERROR' | 'INFO';
  message: string;
  details?: any;
  progress?: number;
}

export type TaskProgressCallback = (
  taskId: string,
  phaseId: string,
  progress: number,
  event: TaskEvent
) => Promise<void>;

export class TaskManager {
  private static instance: TaskManager;
  private progressCallbacks = new Map<string, TaskProgressCallback[]>();

  static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }

  /**
   * Create a new task execution in the database
   */
  async createTask(
    taskId: string,
    type: string,
    phases: TaskPhase[],
    options: {
      projectId?: string;
      projectName?: string;
      initiatedBy?: string;
    } = {}
  ) {
    // Create task execution record
    await prisma.taskExecution.create({
      data: {
        taskId,
        type,
        status: 'PENDING',
        progress: 0,
        totalPhases: phases.length,
        projectId: options.projectId,
        projectName: options.projectName,
        initiatedBy: options.initiatedBy,
      },
    });

    // Create phase records
    await prisma.taskPhase.createMany({
      data: phases.map((phase) => ({
        taskId,
        phaseId: phase.phaseId,
        title: phase.title,
        description: phase.description,
        order: phase.order,
        status: 'PENDING',
        progress: 0,
      })),
    });

    console.log(`📝 Created task ${taskId} with ${phases.length} phases`);
  }

  /**
   * Start a task execution
   */
  async startTask(taskId: string) {
    await prisma.taskExecution.update({
      where: { taskId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    });

    await this.emitEvent(taskId, null, {
      type: 'INFO',
      message: 'Task execution started',
      progress: 0,
    });

    console.log(`🚀 Started task ${taskId}`);
  }

  /**
   * Start a specific phase
   */
  async startPhase(taskId: string, phaseId: string) {
    const startTime = new Date();
    
    await prisma.taskPhase.update({
      where: { taskId_phaseId: { taskId, phaseId } },
      data: {
        status: 'ACTIVE',
        startedAt: startTime,
        progress: 0,
      },
    });

    // Update task's current phase
    await prisma.taskExecution.update({
      where: { taskId },
      data: {
        currentPhase: phaseId,
        lastUpdatedAt: startTime,
      },
    });

    await this.emitEvent(taskId, phaseId, {
      type: 'PHASE_START',
      message: `Started phase: ${phaseId}`,
      progress: 0,
    });

    console.log(`🔄 Started phase ${phaseId} for task ${taskId}`);
  }

  /**
   * Update phase progress with real progress value
   */
  async updatePhaseProgress(
    taskId: string,
    phaseId: string,
    progress: number,
    event: TaskEvent,
    details?: any
  ) {
    const updateTime = new Date();
    
    // Update phase progress
    await prisma.taskPhase.update({
      where: { taskId_phaseId: { taskId, phaseId } },
      data: {
        progress,
        details: details ? JSON.stringify(details) : undefined,
      },
    });

    // Calculate overall task progress
    const phases = await prisma.taskPhase.findMany({
      where: { taskId },
      orderBy: { order: 'asc' },
    });

    const totalProgress = phases.reduce((sum, phase) => sum + phase.progress, 0) / phases.length;

    // Update task progress
    await prisma.taskExecution.update({
      where: { taskId },
      data: {
        progress: totalProgress,
        lastUpdatedAt: updateTime,
      },
    });

    await this.emitEvent(taskId, phaseId, {
      ...event,
      progress,
    });

    console.log(`📊 Updated ${phaseId} progress: ${progress}% (overall: ${totalProgress.toFixed(1)}%)`);
  }

  /**
   * Complete a phase
   */
  async completePhase(taskId: string, phaseId: string, metrics?: any) {
    const completionTime = new Date();
    
    // Get phase start time to calculate duration
    const phase = await prisma.taskPhase.findUnique({
      where: { taskId_phaseId: { taskId, phaseId } },
    });

    const duration = phase?.startedAt 
      ? completionTime.getTime() - phase.startedAt.getTime()
      : null;

    await prisma.taskPhase.update({
      where: { taskId_phaseId: { taskId, phaseId } },
      data: {
        status: 'COMPLETED',
        progress: 100,
        completedAt: completionTime,
        duration,
        metrics: metrics ? JSON.stringify(metrics) : undefined,
      },
    });

    await this.emitEvent(taskId, phaseId, {
      type: 'PHASE_COMPLETE',
      message: `Completed phase: ${phaseId}`,
      progress: 100,
      details: { duration, ...metrics },
    });

    console.log(`✅ Completed phase ${phaseId} for task ${taskId} in ${duration}ms`);
  }

  /**
   * Fail a phase with error details
   */
  async failPhase(taskId: string, phaseId: string, error: string) {
    await prisma.taskPhase.update({
      where: { taskId_phaseId: { taskId, phaseId } },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
    });

    await prisma.taskExecution.update({
      where: { taskId },
      data: {
        status: 'FAILED',
        error,
        completedAt: new Date(),
      },
    });

    await this.emitEvent(taskId, phaseId, {
      type: 'ERROR',
      message: error,
      progress: 0,
    });

    console.error(`❌ Failed phase ${phaseId} for task ${taskId}: ${error}`);
  }

  /**
   * Complete entire task
   */
  async completeTask(taskId: string, result?: any) {
    const completionTime = new Date();
    
    await prisma.taskExecution.update({
      where: { taskId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        completedAt: completionTime,
        result: result ? JSON.stringify(result) : undefined,
      },
    });

    await this.emitEvent(taskId, null, {
      type: 'INFO',
      message: 'Task completed successfully',
      progress: 100,
      details: result,
    });

    console.log(`🎉 Completed task ${taskId}`);
  }

  /**
   * Subscribe to task progress updates
   */
  subscribeToProgress(taskId: string, callback: TaskProgressCallback) {
    if (!this.progressCallbacks.has(taskId)) {
      this.progressCallbacks.set(taskId, []);
    }
    this.progressCallbacks.get(taskId)!.push(callback);
  }

  /**
   * Unsubscribe from task progress updates
   */
  unsubscribeFromProgress(taskId: string, callback: TaskProgressCallback) {
    const callbacks = this.progressCallbacks.get(taskId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
      if (callbacks.length === 0) {
        this.progressCallbacks.delete(taskId);
      }
    }
  }

  /**
   * Get current task status from database
   */
  async getTaskStatus(taskId: string) {
    const task = await prisma.taskExecution.findUnique({
      where: { taskId },
      include: {
        phases: {
          orderBy: { order: 'asc' },
        },
        events: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
      },
    });

    return task;
  }

  /**
   * Emit event to subscribers and store in database
   */
  private async emitEvent(taskId: string, phaseId: string | null, event: TaskEvent) {
    // Store event in database
    await prisma.taskEvent.create({
      data: {
        taskId,
        phaseId,
        type: event.type,
        message: event.message,
        details: event.details ? JSON.stringify(event.details) : undefined,
        progress: event.progress,
      },
    });

    // Notify subscribers
    const callbacks = this.progressCallbacks.get(taskId);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          await callback(taskId, phaseId || '', event.progress || 0, event);
        } catch (error) {
          console.error('Error in progress callback:', error);
        }
      }
    }
  }

  /**
   * Clean up old completed tasks (older than 24 hours)
   */
  async cleanupOldTasks() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const deleted = await prisma.taskExecution.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'FAILED'] },
        completedAt: { lt: oneDayAgo },
      },
    });

    console.log(`🧹 Cleaned up ${deleted.count} old tasks`);
  }
}

export const taskManager = TaskManager.getInstance();