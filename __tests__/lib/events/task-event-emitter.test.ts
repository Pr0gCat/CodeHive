import { TaskEventData, taskEventEmitter } from '@/lib/events/task-event-emitter';

describe('TaskEventEmitter', () => {
  beforeEach(() => {
    // Clear all listeners before each test
    taskEventEmitter.removeAllListeners();
  });

  it('should emit and receive task created events', done => {
    const taskId = 'test-task-1';
    const testData = { type: 'PROJECT_CREATE', phases: 3 };

    taskEventEmitter.on('task_created', (event: TaskEventData) => {
      expect(event.taskId).toBe(taskId);
      expect(event.type).toBe('task_created');
      expect(event.data).toEqual(testData);
      expect(event.timestamp).toBeInstanceOf(Date);
      done();
    });

    taskEventEmitter.emitTaskCreated(taskId, testData);
  });

  it('should emit and receive phase updated events', done => {
    const taskId = 'test-task-2';
    const phaseId = 'phase-1';
    const details = { 
      progress: 50, 
      message: 'Processing files', 
      filesProcessed: 10 
    };

    taskEventEmitter.on('phase_updated', (event: TaskEventData) => {
      expect(event.taskId).toBe(taskId);
      expect(event.type).toBe('phase_updated');
      expect(event.data.phaseId).toBe(phaseId);
      expect(event.data.progress).toBe(50);
      expect(event.data.message).toBe('Processing files');
      expect(event.data.filesProcessed).toBe(10);
      done();
    });

    taskEventEmitter.emitPhaseUpdated(taskId, phaseId, details);
  });

  it('should emit and receive task completed events', done => {
    const taskId = 'test-task-3';
    const result = { projectId: 'proj-123', success: true };

    taskEventEmitter.on('task_completed', (event: TaskEventData) => {
      expect(event.taskId).toBe(taskId);
      expect(event.type).toBe('task_completed');
      expect(event.data).toEqual(result);
      done();
    });

    taskEventEmitter.emitTaskCompleted(taskId, result);
  });

  it('should emit and receive task failed events', done => {
    const taskId = 'test-task-4';
    const error = { message: 'Connection timeout' };

    taskEventEmitter.on('task_failed', (event: TaskEventData) => {
      expect(event.taskId).toBe(taskId);
      expect(event.type).toBe('task_failed');
      expect(event.data).toEqual(error);
      done();
    });

    taskEventEmitter.emitTaskFailed(taskId, error);
  });

  it('should emit and receive event created events', done => {
    const taskId = 'test-task-5';
    const eventDetails = { 
      eventType: 'custom_event', 
      message: 'Custom event message' 
    };

    taskEventEmitter.on('event_created', (event: TaskEventData) => {
      expect(event.taskId).toBe(taskId);
      expect(event.type).toBe('event_created');
      expect(event.data.eventType).toBe('custom_event');
      expect(event.data.message).toBe('Custom event message');
      done();
    });

    taskEventEmitter.emitEventCreated(taskId, 'custom_event', eventDetails);
  });

  it('should handle multiple listeners for the same event', done => {
    const taskId = 'test-task-6';
    let listenerCount = 0;

    const listener1 = () => {
      listenerCount++;
      if (listenerCount === 2) {
        done();
      }
    };

    const listener2 = () => {
      listenerCount++;
      if (listenerCount === 2) {
        done();
      }
    };

    taskEventEmitter.on('task_created', listener1);
    taskEventEmitter.on('task_created', listener2);

    taskEventEmitter.emitTaskCreated(taskId, { test: true });

    // Clean up
    taskEventEmitter.off('task_created', listener1);
    taskEventEmitter.off('task_created', listener2);
  });

  it('should clean up listeners when removed', () => {
    const taskId = 'test-task-7';
    let eventReceived = false;

    const listener = () => {
      eventReceived = true;
    };

    taskEventEmitter.on('task_created', listener);
    taskEventEmitter.off('task_created', listener);
    taskEventEmitter.emitTaskCreated(taskId, { test: true });

    expect(eventReceived).toBe(false);
  });
});
