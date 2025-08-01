import { EventEmitter } from 'events';

export interface QueueEventData {
  taskId: string;
  type:
    | 'task_queued'
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'queue_status_changed';
  timestamp: Date;
  data?: any;
}

class QueueEventEmitter extends EventEmitter {
  private static instance: QueueEventEmitter;

  public static getInstance(): QueueEventEmitter {
    if (!QueueEventEmitter.instance) {
      QueueEventEmitter.instance = new QueueEventEmitter();
    }
    return QueueEventEmitter.instance;
  }

  // Queue events
  emitTaskQueued(taskId: string, data?: any) {
    this.emit('task_queued', {
      taskId,
      type: 'task_queued',
      timestamp: new Date(),
      data,
    } as QueueEventData);
  }

  emitTaskStarted(taskId: string, data?: any) {
    this.emit('task_started', {
      taskId,
      type: 'task_started',
      timestamp: new Date(),
      data,
    } as QueueEventData);
  }

  emitTaskCompleted(taskId: string, result?: any) {
    this.emit('task_completed', {
      taskId,
      type: 'task_completed',
      timestamp: new Date(),
      data: result,
    } as QueueEventData);
  }

  emitTaskFailed(taskId: string, error?: any) {
    this.emit('task_failed', {
      taskId,
      type: 'task_failed',
      timestamp: new Date(),
      data: error,
    } as QueueEventData);
  }

  emitQueueStatusChanged(status: string, data?: any) {
    this.emit('queue_status_changed', {
      taskId: 'queue',
      type: 'queue_status_changed',
      timestamp: new Date(),
      data: { status, ...data },
    } as QueueEventData);
  }

  // Subscribe to queue events
  onQueueEvent(callback: (event: QueueEventData) => void) {
    const handler = (event: QueueEventData) => {
      callback(event);
    };

    // Subscribe to all event types
    this.on('task_queued', handler);
    this.on('task_started', handler);
    this.on('task_completed', handler);
    this.on('task_failed', handler);
    this.on('queue_status_changed', handler);

    // Return cleanup function
    return () => {
      this.off('task_queued', handler);
      this.off('task_started', handler);
      this.off('task_completed', handler);
      this.off('task_failed', handler);
      this.off('queue_status_changed', handler);
    };
  }

  // Subscribe to specific task events
  onTaskEvent(taskId: string, callback: (event: QueueEventData) => void) {
    const handler = (event: QueueEventData) => {
      if (event.taskId === taskId) {
        callback(event);
      }
    };

    this.on('task_queued', handler);
    this.on('task_started', handler);
    this.on('task_completed', handler);
    this.on('task_failed', handler);

    return () => {
      this.off('task_queued', handler);
      this.off('task_started', handler);
      this.off('task_completed', handler);
      this.off('task_failed', handler);
    };
  }

  // Trigger immediate processing (replaces polling)
  triggerProcessing() {
    this.emit('process_queue');
  }

  // Subscribe to processing triggers
  onProcessingTrigger(callback: () => void) {
    this.on('process_queue', callback);

    return () => {
      this.off('process_queue', callback);
    };
  }
}

export const queueEventEmitter = QueueEventEmitter.getInstance();
