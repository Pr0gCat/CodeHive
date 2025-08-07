import { TaskQueue } from '@/lib/tasks/queue';
import { QueueStatus } from '@/lib/types/agent';
import { NextRequest, NextResponse } from 'next/server';

// Global task queue instance
let taskQueue: TaskQueue | null = null;

function getTaskQueue(): TaskQueue {
  if (!taskQueue) {
    taskQueue = new TaskQueue();
  }
  return taskQueue;
}

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId');
    const queue = getTaskQueue();
    const status = await queue.getQueueStatus();

    // If projectId is provided, get project-specific limits
    if (projectId) {
      try {
        const monitorResponse = await fetch(`${request.nextUrl.origin}/api/tokens/monitor?projectId=${projectId}`);
        if (monitorResponse.ok) {
          const monitorData = await monitorResponse.json();
          if (monitorData.success && monitorData.data.project) {
            // Override rate limit status with project-specific data
            status.rateLimitStatus = {
              dailyTokens: {
                used: monitorData.data.project.usedTokens,
                limit: monitorData.data.project.budgetTokens,
                percentage: monitorData.data.project.usagePercentage,
                remaining: monitorData.data.project.remainingBudget,
              },
              minuteRequests: status.rateLimitStatus.minuteRequests, // Keep original minute requests
            };
          }
        }
      } catch (error) {
        console.warn('Failed to get project-specific limits:', error);
        // Fall back to default limits if project lookup fails
      }
    }

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
    const projectId = request.nextUrl.searchParams.get('projectId');

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
    
    // If projectId is provided, get project-specific limits (same logic as GET)
    if (projectId) {
      try {
        const monitorResponse = await fetch(`${request.nextUrl.origin}/api/tokens/monitor?projectId=${projectId}`);
        if (monitorResponse.ok) {
          const monitorData = await monitorResponse.json();
          if (monitorData.success && monitorData.data.project) {
            // Override rate limit status with project-specific data
            status.rateLimitStatus = {
              dailyTokens: {
                used: monitorData.data.project.usedTokens,
                limit: monitorData.data.project.budgetTokens,
                percentage: monitorData.data.project.usagePercentage,
                remaining: monitorData.data.project.remainingBudget,
              },
              minuteRequests: status.rateLimitStatus.minuteRequests, // Keep original minute requests
            };
          }
        }
      } catch (error) {
        console.warn('Failed to get project-specific limits:', error);
        // Fall back to default limits if project lookup fails
      }
    }

    const currentStatus = queue.getStatus();
    const actionPerformed =
      currentStatus === QueueStatus.ACTIVE ? 'resumed' : 'paused';

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
