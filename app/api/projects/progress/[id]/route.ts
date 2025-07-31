import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const taskId = params.id;

  const stream = new ReadableStream({
    async start(controller) {
      console.log(`🔗 SSE connection established for task: ${taskId}`);
      
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

          // If task is already completed, send completion message
          if (task.status === 'COMPLETED') {
            controller.enqueue(`data: ${JSON.stringify({
              type: 'completed',
              taskId,
              result: task.result ? JSON.parse(task.result) : null,
            })}\n\n`);
          } else if (task.status === 'FAILED') {
            controller.enqueue(`data: ${JSON.stringify({
              type: 'error',
              taskId,
              error: task.error,
            })}\n\n`);
          }
        }
      } catch (error) {
        console.error('Failed to get initial task state:', error);
      }

      // Poll for updates
      const pollInterval = setInterval(async () => {
        try {
          // Get recent events for this task
          const recentEvents = await prisma.taskEvent.findMany({
            where: { 
              taskId,
              timestamp: { 
                gte: new Date(Date.now() - 5000) // Last 5 seconds
              }
            },
            orderBy: { timestamp: 'desc' },
            take: 10,
          });

          // Send recent events
          for (const event of recentEvents.reverse()) {
            controller.enqueue(`data: ${JSON.stringify({
              type: 'event',
              taskId,
              event: {
                ...event,
                details: event.details ? JSON.parse(event.details) : null,
              },
            })}\n\n`);
          }

          // Check if task is complete
          const task = await prisma.taskExecution.findUnique({
            where: { taskId },
            select: { status: true, result: true, error: true },
          });

          if (task?.status === 'COMPLETED') {
            controller.enqueue(`data: ${JSON.stringify({
              type: 'completed',
              taskId,
              result: task.result ? JSON.parse(task.result) : null,
            })}\n\n`);
            
            clearInterval(pollInterval);
            controller.close();
          } else if (task?.status === 'FAILED') {
            controller.enqueue(`data: ${JSON.stringify({
              type: 'error',
              taskId,
              error: task.error,
            })}\n\n`);
            
            clearInterval(pollInterval);
            controller.close();
          }
        } catch (error) {
          console.error('SSE polling error:', error);
          clearInterval(pollInterval);
          controller.close();
        }
      }, 1000); // Poll every second

      // Clean up on connection close
      const cleanup = () => {
        clearInterval(pollInterval);
        console.log(`🔌 SSE connection closed for task: ${taskId}`);
      };

      // Set up cleanup for various close scenarios
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