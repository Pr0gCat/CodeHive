import { NextRequest, NextResponse } from 'next/server';
import { TaskQueue } from '@/lib/tasks/queue';
import { z } from 'zod';

const executeAgentSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  cardId: z.string().min(1, 'Card ID is required'),
  agentType: z.string().min(1, 'Agent type is required'),
  command: z.string().min(1, 'Command is required'),
  priority: z.number().int().min(0).max(10).default(5),
  context: z.record(z.string(), z.unknown()).optional(),
});

// Global task queue instance
let taskQueue: TaskQueue | null = null;

function getTaskQueue(): TaskQueue {
  if (!taskQueue) {
    taskQueue = new TaskQueue();
  }
  return taskQueue;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = executeAgentSchema.parse(body);

    const queue = getTaskQueue();
    const taskId = await queue.enqueue({
      projectId: validatedData.projectId,
      cardId: validatedData.cardId,
      agentType: validatedData.agentType,
      command: validatedData.command,
      priority: validatedData.priority,
      context: validatedData.context,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          taskId,
          message: 'Agent task queued successfully',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Error executing agent:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute agent',
      },
      { status: 500 }
    );
  }
}
