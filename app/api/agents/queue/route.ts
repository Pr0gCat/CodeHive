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

export async function GET() {
  try {
    const queue = getTaskQueue();
    const status = await queue.getQueueStatus();

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get queue status',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const queue = getTaskQueue();

    switch (action) {
      case 'toggle':
        await queue.toggleQueue();
        break;
      case 'pause':
        // Legacy support - now just calls toggle if active
        await queue.pauseQueue();
        break;
      case 'resume':
        // Legacy support - now just calls toggle if paused
        await queue.resumeQueue();
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action. Use: toggle, pause, or resume',
          },
          { status: 400 }
        );
    }

    const status = await queue.getQueueStatus();
    const currentStatus = queue.getStatus();
    const actionPerformed = currentStatus === 'ACTIVE' ? 'resumed' : 'paused';

    return NextResponse.json({
      success: true,
      data: status,
      message: `Queue ${action === 'toggle' ? actionPerformed : action + 'd'} successfully`,
    });
  } catch (error) {
    console.error('Error controlling queue:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to control queue',
      },
      { status: 500 }
    );
  }
}