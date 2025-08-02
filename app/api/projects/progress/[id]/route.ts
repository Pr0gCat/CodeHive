import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// This endpoint now serves as a simple status check since real-time updates
// are handled via WebSocket connections
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const taskId = params.id;

  try {
    console.log(`REST API request for task status: ${taskId}`);

    // Get current task state
    const task = await prisma.taskExecution.findUnique({
      where: { taskId },
      include: {
        phases: { orderBy: { order: 'asc' } },
        events: {
          orderBy: { timestamp: 'desc' },
          take: 10, // Get last 10 events
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({
      taskId,
      task: {
        ...task,
        result: task.result ? JSON.parse(task.result) : null,
      },
    });
  } catch (error) {
    console.error('Failed to get task status:', error);
    return NextResponse.json(
      { error: 'Failed to get task status' },
      { status: 500 }
    );
  }
}
