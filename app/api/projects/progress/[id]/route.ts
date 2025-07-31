import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { taskEventEmitter, TaskEventData } from '@/lib/events/task-event-emitter';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const taskId = params.id;

  const stream = new ReadableStream({
    async start(controller) {
      console.log(`🔗 Event-driven SSE connection established for task: ${taskId}`);
      
      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({ 
        type: 'connected', 
        taskId 
      })}\n\n`);

      // Send current task state if exists
      try {
        const task = await prisma.taskExecution.findUnique({
          where: { taskId },
          include: {
            phases: { orderBy: { order: 'asc' } },
            events: { 
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
          },
        });

        if (task) {
          // Send current task status
          controller.enqueue(`data: ${JSON.stringify({
            type: 'task_status',
            taskId,
            task: {
              ...task,
              events: undefined, // Don't include events in status
            },
          })}\n\n`);

          // Send current phases
          for (const phase of task.phases) {
            console.log('📡 Sending phase:', phase);
            controller.enqueue(`data: ${JSON.stringify({
              type: 'phase_status',
              taskId,
              phase,
            })}\n\n`);
          }

          // If task is already completed, send completion message and close
          if (task.status === 'COMPLETED') {
            controller.enqueue(`data: ${JSON.stringify({
              type: 'completed',
              taskId,
              result: task.result ? JSON.parse(task.result) : null,
            })}\n\n`);
            controller.close();
            return;
          } else if (task.status === 'FAILED') {
            controller.enqueue(`data: ${JSON.stringify({
              type: 'error',
              taskId,
              error: task.error,
            })}\n\n`);
            controller.close();
            return;
          }
        }
      } catch (error) {
        console.error('Failed to get initial task state:', error);
      }

      // Set up event-driven updates instead of polling
      const eventHandler = (event: TaskEventData) => {
        try {
          // Convert TaskEventData to SSE format
          const sseMessage = {
            type: event.type,
            taskId: event.taskId,
            timestamp: event.timestamp,
            data: event.data,
          };

          controller.enqueue(`data: ${JSON.stringify(sseMessage)}\n\n`);
          console.log(`📡 Sent real-time event for task ${taskId}:`, event.type);

          // Close connection on task completion or failure
          if (event.type === 'task_completed' || event.type === 'task_failed') {
            console.log(`🏁 Task ${taskId} finished, closing SSE connection`);
            cleanup();
            controller.close();
          }
        } catch (error) {
          console.error('Error sending SSE event:', error);
          cleanup();
          controller.close();
        }
      };

      // Subscribe to events for this specific task
      const unsubscribe = taskEventEmitter.onTaskEvent(taskId, eventHandler);

      // Clean up function
      const cleanup = () => {
        unsubscribe();
        console.log(`🔌 Event-driven SSE connection closed for task: ${taskId}`);
      };

      // Set up cleanup for connection close
      request.signal?.addEventListener('abort', cleanup);
      
      return cleanup;
    },
    cancel() {
      console.log(`🔌 SSE stream cancelled for task: ${taskId}`);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}