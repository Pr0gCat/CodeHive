import { NextRequest, NextResponse } from 'next/server';
import { TaskQueue } from '@/lib/agents/queue';

// Global task queue instance
let taskQueue: TaskQueue | null = null;

function getTaskQueue(): TaskQueue {
  if (!taskQueue) {
    taskQueue = new TaskQueue();
  }
  return taskQueue;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const queue = getTaskQueue();
    const task = await queue.getTask(params.taskId);

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task not found',
        },
        { status: 404 }
      );
    }

    const payload = JSON.parse(task.payload);

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.taskId,
        status: task.status,
        agentType: task.agentType,
        command: payload.command,
        priority: task.priority,
        project: task.project,
        card: task.card,
        createdAt: task.createdAt,
        pausedAt: task.pausedAt,
        resumedAt: task.resumedAt,
        completedAt: task.completedAt,
        error: task.error,
      },
    });
  } catch (error) {
    console.error('Error getting task status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get task status',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const queue = getTaskQueue();
    const cancelled = await queue.cancelTask(params.taskId);

    if (!cancelled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task not found or cannot be cancelled',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Task cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling task:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel task',
      },
      { status: 500 }
    );
  }
}