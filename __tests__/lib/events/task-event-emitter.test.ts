import {
  taskEventEmitter,
  TaskEventData,
} from '@/lib/events/task-event-emitter';

describe('TaskEventEmitter', () => {
  beforeEach(() => {
    // Clean up all listeners before each test
    taskEventEmitter.removeAllListeners();
  });

  afterEach(() => {
    // Clean up all listeners after each test
    taskEventEmitter.removeAllListeners();
  });

  it('should emit and receive task created events', done => {
    const taskId = 'test-task-1';
    const testData = { type: 'PROJECT_CREATE', phases: 3 };

    const unsubscribe = taskEventEmitter.onTaskEvent(
      taskId,
      (event: TaskEventData) => {
        expect(event.taskId).toBe(taskId);
        expect(event.type).toBe('task_created');
        expect(event.data).toEqual(testData);
        expect(event.timestamp).toBeInstanceOf(Date);

        unsubscribe();
        done();
      }
    );

    taskEventEmitter.emitTaskCreated(taskId, testData);
  });

  it('should emit and receive phase updated events', done => {
    const taskId = 'test-task-2';
    const phaseId = 'phase-1';
    const progress = 50;
    const message = 'Processing files';
    const details = { filesProcessed: 10 };

    const unsubscribe = taskEventEmitter.onTaskEvent(
      taskId,
      (event: TaskEventData) => {
        expect(event.taskId).toBe(taskId);
        expect(event.type).toBe('phase_updated');
        expect(event.data.phaseId).toBe(phaseId);
        expect(event.data.progress).toBe(progress);
        expect(event.data.message).toBe(message);
        expect(event.data.details).toEqual(details);

        unsubscribe();
        done();
      }
    );

    taskEventEmitter.emitPhaseUpdated(
      taskId,
      phaseId,
      progress,
      message,
      details
    );
  });

  it('should emit and receive task completed events', done => {
    const taskId = 'test-task-3';
    const result = { projectId: 'proj-123', success: true };

    const unsubscribe = taskEventEmitter.onTaskEvent(
      taskId,
      (event: TaskEventData) => {
        expect(event.taskId).toBe(taskId);
        expect(event.type).toBe('task_completed');
        expect(event.data).toEqual(result);

        unsubscribe();
        done();
      }
    );

    taskEventEmitter.emitTaskCompleted(taskId, result);
  });

  it('should emit and receive task failed events', done => {
    const taskId = 'test-task-4';
    const error = 'Connection timeout';

    const unsubscribe = taskEventEmitter.onTaskEvent(
      taskId,
      (event: TaskEventData) => {
        expect(event.taskId).toBe(taskId);
        expect(event.type).toBe('task_failed');
        expect(event.data).toBe(error);

        unsubscribe();
        done();
      }
    );

    taskEventEmitter.emitTaskFailed(taskId, error);
  });

  it('should only receive events for subscribed task', done => {
    const taskId1 = 'test-task-5';
    const taskId2 = 'test-task-6';
    let eventCount = 0;

    const unsubscribe = taskEventEmitter.onTaskEvent(
      taskId1,
      (event: TaskEventData) => {
        expect(event.taskId).toBe(taskId1);
        eventCount++;

        if (eventCount === 1) {
          // This should be the first and only event
          setTimeout(() => {
            expect(eventCount).toBe(1);
            unsubscribe();
            done();
          }, 100);
        }
      }
    );

    // Emit event for subscribed task
    taskEventEmitter.emitTaskCreated(taskId1, { test: true });

    // Emit event for different task (should not be received)
    taskEventEmitter.emitTaskCreated(taskId2, { test: true });
  });

  it('should clean up listeners when unsubscribed', () => {
    const taskId = 'test-task-7';

    // Check initial listener count (should be 0)
    const initialCounts = taskEventEmitter.getListenerCount();
    expect(initialCounts.task_created).toBe(0);

    // Subscribe to events
    const unsubscribe = taskEventEmitter.onTaskEvent(taskId, () => {});

    // Check that listeners were added
    const afterSubscribeCounts = taskEventEmitter.getListenerCount();
    expect(afterSubscribeCounts.task_created).toBe(1);
    expect(afterSubscribeCounts.task_started).toBe(1);
    expect(afterSubscribeCounts.task_completed).toBe(1);
    expect(afterSubscribeCounts.task_failed).toBe(1);
    expect(afterSubscribeCounts.phase_updated).toBe(1);
    expect(afterSubscribeCounts.event_created).toBe(1);

    // Unsubscribe
    unsubscribe();

    // Check that listeners were removed
    const afterUnsubscribeCounts = taskEventEmitter.getListenerCount();
    expect(afterUnsubscribeCounts.task_created).toBe(0);
    expect(afterUnsubscribeCounts.task_started).toBe(0);
    expect(afterUnsubscribeCounts.task_completed).toBe(0);
    expect(afterUnsubscribeCounts.task_failed).toBe(0);
    expect(afterUnsubscribeCounts.phase_updated).toBe(0);
    expect(afterUnsubscribeCounts.event_created).toBe(0);
  });

  it('should handle multiple subscribers for the same task', done => {
    const taskId = 'test-task-8';
    let receivedCount = 0;

    const unsubscribe1 = taskEventEmitter.onTaskEvent(
      taskId,
      (event: TaskEventData) => {
        expect(event.taskId).toBe(taskId);
        receivedCount++;

        if (receivedCount === 2) {
          unsubscribe1();
          unsubscribe2();
          done();
        }
      }
    );

    const unsubscribe2 = taskEventEmitter.onTaskEvent(
      taskId,
      (event: TaskEventData) => {
        expect(event.taskId).toBe(taskId);
        receivedCount++;

        if (receivedCount === 2) {
          unsubscribe1();
          unsubscribe2();
          done();
        }
      }
    );

    taskEventEmitter.emitTaskStarted(taskId);
  });
});
