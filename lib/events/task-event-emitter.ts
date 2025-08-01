import { EventEmitter } from 'events';

export interface TaskEventData {
  taskId: string;
  type:
    | 'task_created'
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'phase_updated'
    | 'event_created';
  timestamp: Date;
  data?: any;
}

export interface PhaseEventData {
  taskId: string;
  phaseId: string;
  progress: number;
  message?: string;
  details?: any;
}

export interface TaskEventCreatedData {
  taskId: string;
  eventType: string;
  message: string;
  details?: any;
}

class TaskEventEmitter extends EventEmitter {
  private static instance: TaskEventEmitter;

  public static getInstance(): TaskEventEmitter {
    if (!TaskEventEmitter.instance) {
      TaskEventEmitter.instance = new TaskEventEmitter();
    }
    return TaskEventEmitter.instance;
  }

  // Task lifecycle events
  emitTaskCreated(taskId: string, data?: any) {
    this.emit('task_created', {
      taskId,
      type: 'task_created',
      timestamp: new Date(),
      data,
    } as TaskEventData);
  }

  emitTaskStarted(taskId: string, data?: any) {
    this.emit('task_started', {
      taskId,
      type: 'task_started',
      timestamp: new Date(),
      data,
    } as TaskEventData);
  }

  emitTaskCompleted(taskId: string, result?: any) {
    this.emit('task_completed', {
      taskId,
      type: 'task_completed',
      timestamp: new Date(),
      data: result,
    } as TaskEventData);
  }

  emitTaskFailed(taskId: string, error?: any) {
    this.emit('task_failed', {
      taskId,
      type: 'task_failed',
      timestamp: new Date(),
      data: error,
    } as TaskEventData);
  }

  // Phase progress events
  emitPhaseUpdated(
    taskId: string,
    phaseId: string,
    progress: number,
    message?: string,
    details?: any
  ) {
    this.emit('phase_updated', {
      taskId,
      type: 'phase_updated',
      timestamp: new Date(),
      data: {
        phaseId,
        progress,
        message,
        details,
      } as PhaseEventData,
    } as TaskEventData);
  }

  // Task event creation
  emitTaskEvent(
    taskId: string,
    eventType: string,
    message: string,
    details?: any
  ) {
    this.emit('event_created', {
      taskId,
      type: 'event_created',
      timestamp: new Date(),
      data: {
        eventType,
        message,
        details,
      } as TaskEventCreatedData,
    } as TaskEventData);
  }

  // Subscribe to specific task events
  onTaskEvent(taskId: string, callback: (event: TaskEventData) => void) {
    const handler = (event: TaskEventData) => {
      if (event.taskId === taskId) {
        callback(event);
      }
    };

    // Subscribe to all event types for this task
    this.on('task_created', handler);
    this.on('task_started', handler);
    this.on('task_completed', handler);
    this.on('task_failed', handler);
    this.on('phase_updated', handler);
    this.on('event_created', handler);

    // Return cleanup function
    return () => {
      this.off('task_created', handler);
      this.off('task_started', handler);
      this.off('task_completed', handler);
      this.off('task_failed', handler);
      this.off('phase_updated', handler);
      this.off('event_created', handler);
    };
  }

  // Get current listener count for debugging
  getListenerCount(): Record<string, number> {
    return {
      task_created: this.listenerCount('task_created'),
      task_started: this.listenerCount('task_started'),
      task_completed: this.listenerCount('task_completed'),
      task_failed: this.listenerCount('task_failed'),
      phase_updated: this.listenerCount('phase_updated'),
      event_created: this.listenerCount('event_created'),
    };
  }
}

export const taskEventEmitter = TaskEventEmitter.getInstance();
