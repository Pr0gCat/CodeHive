import {
  TaskEventData,
  taskEventEmitter,
} from '@/lib/events/task-event-emitter';

describe('TaskManager Event System Integration', () => {
  beforeEach(() => {
    taskEventEmitter.removeAllListeners();
  });

  it('should work with real TaskManager workflow simulation', done => {
    const taskId = 'workflow-test-1';
    const receivedEvents: TaskEventData[] = [];

    // Listen to all task events
    const eventTypes = [
      'task_created',
      'task_started',
      'phase_updated',
      'event_created',
      'task_completed',
    ];

    eventTypes.forEach(eventType => {
      taskEventEmitter.on(eventType, (event: TaskEventData) => {
        if (event.taskId === taskId) {
          receivedEvents.push(event);

          if (event.type === 'task_completed') {
            expect(receivedEvents).toHaveLength(7);
            expect(receivedEvents[0].type).toBe('task_created');
            expect(receivedEvents[1].type).toBe('task_started');
            expect(receivedEvents[2].type).toBe('phase_updated');
            expect(receivedEvents[3].type).toBe('phase_updated');
            expect(receivedEvents[4].type).toBe('phase_updated');
            expect(receivedEvents[5].type).toBe('event_created');
            expect(receivedEvents[6].type).toBe('task_completed');
            expect(receivedEvents[2].data?.progress).toBe(25);
            expect(receivedEvents[3].data?.progress).toBe(50);
            expect(receivedEvents[4].data?.progress).toBe(100);
            done();
          }
        }
      });
    });

    // Simulate task workflow
    taskEventEmitter.emitTaskCreated(taskId, { type: 'PROJECT_CREATE' });
    taskEventEmitter.emitTaskStarted(taskId);
    taskEventEmitter.emitPhaseUpdated(taskId, 'phase-1', {
      progress: 25,
      message: 'Phase 1',
    });
    taskEventEmitter.emitPhaseUpdated(taskId, 'phase-2', {
      progress: 50,
      message: 'Phase 2',
    });
    taskEventEmitter.emitPhaseUpdated(taskId, 'phase-3', {
      progress: 100,
      message: 'Phase 3',
    });
    taskEventEmitter.emitEventCreated(taskId, 'custom_event', {
      message: 'Custom event',
    });
    taskEventEmitter.emitTaskCompleted(taskId, { success: true });
  });

  it('should handle task failure workflow', done => {
    const taskId = 'workflow-test-2';
    const receivedEvents: TaskEventData[] = [];

    const eventTypes = [
      'task_created',
      'task_started',
      'phase_updated',
      'task_failed',
    ];

    eventTypes.forEach(eventType => {
      taskEventEmitter.on(eventType, (event: TaskEventData) => {
        if (event.taskId === taskId) {
          receivedEvents.push(event);

          if (event.type === 'task_failed') {
            expect(receivedEvents).toHaveLength(4);
            expect(receivedEvents[0].type).toBe('task_created');
            expect(receivedEvents[1].type).toBe('task_started');
            expect(receivedEvents[2].type).toBe('phase_updated');
            expect(receivedEvents[3].type).toBe('task_failed');
            expect(receivedEvents[3].data?.message).toBe(
              'Network connection failed'
            );
            done();
          }
        }
      });
    });

    // Simulate failed task workflow
    taskEventEmitter.emitTaskCreated(taskId, { type: 'PROJECT_CREATE' });
    taskEventEmitter.emitTaskStarted(taskId);
    taskEventEmitter.emitPhaseUpdated(taskId, 'phase-1', {
      progress: 25,
      message: 'Phase 1',
    });
    taskEventEmitter.emitTaskFailed(taskId, {
      message: 'Network connection failed',
    });
  });

  it('should support multiple concurrent tasks', done => {
    const taskId1 = 'concurrent-1';
    const taskId2 = 'concurrent-2';
    const events1: TaskEventData[] = [];
    const events2: TaskEventData[] = [];
    let completedTasks = 0;

    const checkResults = () => {
      expect(events1).toHaveLength(2);
      expect(events1[0].type).toBe('task_created');
      expect(events1[1].type).toBe('task_completed');
      expect(events1[0].taskId).toBe(taskId1);

      expect(events2).toHaveLength(2);
      expect(events2[0].type).toBe('task_created');
      expect(events2[1].type).toBe('task_completed');
      expect(events2[0].taskId).toBe(taskId2);
      done();
    };

    taskEventEmitter.on('task_created', (event: TaskEventData) => {
      if (event.taskId === taskId1) {
        events1.push(event);
      } else if (event.taskId === taskId2) {
        events2.push(event);
      }
    });

    taskEventEmitter.on('task_completed', (event: TaskEventData) => {
      if (event.taskId === taskId1) {
        events1.push(event);
        completedTasks++;
        if (completedTasks === 2) {
          checkResults();
        }
      } else if (event.taskId === taskId2) {
        events2.push(event);
        completedTasks++;
        if (completedTasks === 2) {
          checkResults();
        }
      }
    });

    // Simulate concurrent task execution
    taskEventEmitter.emitTaskCreated(taskId1, { type: 'TASK_1' });
    taskEventEmitter.emitTaskCreated(taskId2, { type: 'TASK_2' });
    taskEventEmitter.emitTaskCompleted(taskId1, { success: true });
    taskEventEmitter.emitTaskCompleted(taskId2, { success: true });
  });
});
