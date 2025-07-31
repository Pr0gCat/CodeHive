import { taskEventEmitter, TaskEventData } from '@/lib/events/task-event-emitter';

describe('TaskManager Event System Integration', () => {
  beforeEach(() => {
    // Clear all listeners before each test
    taskEventEmitter.removeAllListeners();
  });

  afterEach(() => {
    // Clean up all listeners after each test
    taskEventEmitter.removeAllListeners();
  });

  it('should work with real TaskManager workflow simulation', (done) => {
    const taskId = 'workflow-test-1';
    const phases = ['init', 'process', 'complete'];
    const receivedEvents: TaskEventData[] = [];

    // Subscribe to all events for this task
    const unsubscribe = taskEventEmitter.onTaskEvent(taskId, (event: TaskEventData) => {
      receivedEvents.push(event);
      
      // Complete test after receiving task completion event
      if (event.type === 'task_completed') {
        expect(receivedEvents).toHaveLength(7); // Created + Started + 3 Phase Updates + Event + Completed
        
        // Verify event sequence
        expect(receivedEvents[0].type).toBe('task_created');
        expect(receivedEvents[1].type).toBe('task_started');
        expect(receivedEvents[2].type).toBe('phase_updated');
        expect(receivedEvents[3].type).toBe('phase_updated');
        expect(receivedEvents[4].type).toBe('phase_updated');
        expect(receivedEvents[5].type).toBe('event_created');
        expect(receivedEvents[6].type).toBe('task_completed');
        
        // Verify phase progress
        expect(receivedEvents[2].data.progress).toBe(25);
        expect(receivedEvents[3].data.progress).toBe(50);
        expect(receivedEvents[4].data.progress).toBe(100);
        
        unsubscribe();
        done();
      }
    });

    // Simulate TaskManager workflow
    // 1. Task created
    taskEventEmitter.emitTaskCreated(taskId, { type: 'PROJECT_CREATE', phases: phases.length });
    
    // 2. Task started
    taskEventEmitter.emitTaskStarted(taskId);
    
    // 3. Phase progress updates
    taskEventEmitter.emitPhaseUpdated(taskId, phases[0], 25, 'Initializing project');
    taskEventEmitter.emitPhaseUpdated(taskId, phases[1], 50, 'Processing files');
    taskEventEmitter.emitPhaseUpdated(taskId, phases[2], 100, 'Finalizing');
    
    // 4. Task event
    taskEventEmitter.emitTaskEvent(taskId, 'INFO', 'All phases completed');
    
    // 5. Task completed
    taskEventEmitter.emitTaskCompleted(taskId, { success: true, totalFiles: 42 });
  });

  it('should handle task failure workflow', (done) => {
    const taskId = 'workflow-test-2';
    const receivedEvents: TaskEventData[] = [];

    const unsubscribe = taskEventEmitter.onTaskEvent(taskId, (event: TaskEventData) => {
      receivedEvents.push(event);
      
      if (event.type === 'task_failed') {
        expect(receivedEvents).toHaveLength(4); // Created + Started + Phase Update + Failed
        
        expect(receivedEvents[0].type).toBe('task_created');
        expect(receivedEvents[1].type).toBe('task_started');
        expect(receivedEvents[2].type).toBe('phase_updated');
        expect(receivedEvents[3].type).toBe('task_failed');
        
        expect(receivedEvents[3].data).toBe('Network connection failed');
        
        unsubscribe();
        done();
      }
    });

    // Simulate failed workflow
    taskEventEmitter.emitTaskCreated(taskId, { type: 'PROJECT_IMPORT' });
    taskEventEmitter.emitTaskStarted(taskId);
    taskEventEmitter.emitPhaseUpdated(taskId, 'clone', 30, 'Cloning repository');
    taskEventEmitter.emitTaskFailed(taskId, 'Network connection failed');
  });

  it('should support multiple concurrent tasks', (done) => {
    const taskId1 = 'concurrent-1';
    const taskId2 = 'concurrent-2';
    const events1: TaskEventData[] = [];
    const events2: TaskEventData[] = [];
    let completedTasks = 0;

    const unsubscribe1 = taskEventEmitter.onTaskEvent(taskId1, (event) => {
      events1.push(event);
      if (event.type === 'task_completed') {
        completedTasks++;
        if (completedTasks === 2) {
          checkResults();
        }
      }
    });

    const unsubscribe2 = taskEventEmitter.onTaskEvent(taskId2, (event) => {
      events2.push(event);
      if (event.type === 'task_completed') {
        completedTasks++;
        if (completedTasks === 2) {
          checkResults();
        }
      }
    });

    const checkResults = () => {
      // Each task should have received its own events only
      expect(events1.every(e => e.taskId === taskId1)).toBe(true);
      expect(events2.every(e => e.taskId === taskId2)).toBe(true);
      
      expect(events1).toHaveLength(3); // Created + Started + Completed
      expect(events2).toHaveLength(3); // Created + Started + Completed
      
      unsubscribe1();
      unsubscribe2();
      done();
    };

    // Start both tasks simultaneously
    taskEventEmitter.emitTaskCreated(taskId1, { type: 'TASK1' });
    taskEventEmitter.emitTaskCreated(taskId2, { type: 'TASK2' });
    taskEventEmitter.emitTaskStarted(taskId1);
    taskEventEmitter.emitTaskStarted(taskId2);
    taskEventEmitter.emitTaskCompleted(taskId1, { result: 'task1' });
    taskEventEmitter.emitTaskCompleted(taskId2, { result: 'task2' });
  });

  it('should provide listener count debugging info', () => {
    const taskId = 'debug-test';
    
    // Initially no listeners
    const initial = taskEventEmitter.getListenerCount();
    expect(initial.task_created).toBe(0);
    
    // Add subscription
    const unsubscribe = taskEventEmitter.onTaskEvent(taskId, () => {});
    
    const afterSubscribe = taskEventEmitter.getListenerCount();
    expect(afterSubscribe.task_created).toBe(1);
    expect(afterSubscribe.task_started).toBe(1);
    expect(afterSubscribe.task_completed).toBe(1);
    expect(afterSubscribe.task_failed).toBe(1);
    expect(afterSubscribe.phase_updated).toBe(1);
    expect(afterSubscribe.event_created).toBe(1);
    
    // Remove subscription
    unsubscribe();
    
    const afterUnsubscribe = taskEventEmitter.getListenerCount();
    expect(afterUnsubscribe.task_created).toBe(0);
  });
});