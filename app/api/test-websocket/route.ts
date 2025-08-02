import { taskEventEmitter } from '@/lib/events/task-event-emitter';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    console.log(`🧪 Triggering test events for task: ${taskId}`);

    // Simulate a sequence of task events
    setTimeout(() => {
      taskEventEmitter.emitTaskCreated(taskId, {
        message: 'Test task created',
      });
    }, 100);

    setTimeout(() => {
      taskEventEmitter.emitTaskStarted(taskId, {
        message: 'Test task started',
      });
    }, 500);

    setTimeout(() => {
      taskEventEmitter.emitPhaseUpdated(
        taskId,
        'test-phase-1',
        {
          progress: 25,
          message: 'Test phase 1 progress',
          details: ['Step 1 completed', 'Step 2 in progress'],
        }
      );
    }, 1000);

    setTimeout(() => {
      taskEventEmitter.emitPhaseUpdated(
        taskId,
        'test-phase-1',
        {
          progress: 75,
          message: 'Test phase 1 almost done',
        }
      );
    }, 2000);

    setTimeout(() => {
      taskEventEmitter.emitPhaseUpdated(
        taskId,
        'test-phase-1',
        {
          progress: 100,
          message: 'Test phase 1 completed',
        }
      );
    }, 3000);

    setTimeout(() => {
      taskEventEmitter.emitPhaseUpdated(
        taskId,
        'test-phase-2',
        {
          progress: 50,
          message: 'Test phase 2 in progress',
        }
      );
    }, 4000);

    setTimeout(() => {
      taskEventEmitter.emitTaskCompleted(taskId, {
        message: 'Test task completed successfully',
        result: { success: true, testData: 'Hello WebSocket!' },
      });
    }, 5000);

    return NextResponse.json({
      success: true,
      message: `Test events scheduled for task: ${taskId}`,
      taskId,
    });
  } catch (error) {
    console.error('Test WebSocket API error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger test events' },
      { status: 500 }
    );
  }
}
