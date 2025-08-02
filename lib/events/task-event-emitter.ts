import { EventEmitter } from 'events';

export interface TaskEventData {
  taskId: string;
  type: TaskEventType;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export type TaskEventType = 
  | 'task_created'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'phase_updated'
  | 'event_created';

export interface TaskEventDetails {
  taskId: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface PhaseEventDetails {
  taskId: string;
  phaseId: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export class TaskEventEmitter extends EventEmitter {
  emitTaskCreated(taskId: string, data?: Record<string, unknown>) {
    this.emit('task_created', {
      taskId,
      type: 'task_created',
      timestamp: new Date(),
      data,
    });
  }

  emitTaskStarted(taskId: string, data?: Record<string, unknown>) {
    this.emit('task_started', {
      taskId,
      type: 'task_started',
      timestamp: new Date(),
      data,
    });
  }

  emitTaskCompleted(taskId: string, result?: Record<string, unknown>) {
    this.emit('task_completed', {
      taskId,
      type: 'task_completed',
      timestamp: new Date(),
      data: result,
    });
  }

  emitTaskFailed(taskId: string, error?: Record<string, unknown>) {
    this.emit('task_failed', {
      taskId,
      type: 'task_failed',
      timestamp: new Date(),
      data: error,
    });
  }

  emitPhaseUpdated(
    taskId: string,
    phaseId: string,
    details?: Record<string, unknown>
  ) {
    this.emit('phase_updated', {
      taskId,
      type: 'phase_updated',
      timestamp: new Date(),
      data: { phaseId, ...details },
    });
  }

  emitEventCreated(
    taskId: string,
    eventType: string,
    details?: Record<string, unknown>
  ) {
    this.emit('event_created', {
      taskId,
      type: 'event_created',
      timestamp: new Date(),
      data: { eventType, ...details },
    });
  }
}

// Create singleton instance
export const taskEventEmitter = new TaskEventEmitter();
