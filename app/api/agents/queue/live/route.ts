import { TaskQueue } from '@/lib/agents/queue';
import { NextRequest } from 'next/server';

// Global task queue instance
let taskQueue: TaskQueue | null = null;

function getTaskQueue(): TaskQueue {
  if (!taskQueue) {
    taskQueue = new TaskQueue();
  }
  return taskQueue;
}

export async function GET(request: NextRequest) {
  console.log('🔗 Agent Queue SSE connection established');

  // Set up SSE headers
  const responseHeaders = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let isControllerClosed = false;

      // Send initial connection confirmation
      const sendEvent = (type: string, data: any) => {
        if (isControllerClosed) {
          return;
        }
        try {
          const event = `data: ${JSON.stringify({ type, ...data })}\n\n`;
          controller.enqueue(encoder.encode(event));
        } catch (error) {
          // Controller is closed or in an invalid state
          isControllerClosed = true;
          console.log(
            'SSE controller closed or invalid, stopping event sending'
          );
        }
      };

      // Send connection confirmation
      sendEvent('connected', { message: 'Connected to agent queue stream' });

      // Get initial queue status
      const queue = getTaskQueue();

      const sendQueueStatus = async () => {
        try {
          const status = await queue.getQueueStatus();
          sendEvent('queue_status', { status });
        } catch (error) {
          console.error('Error getting queue status for SSE:', error);
          sendEvent('error', { error: 'Failed to get queue status' });
        }
      };

      // Send initial status
      sendQueueStatus();

      // Set up periodic status updates every 5 seconds
      const statusInterval = setInterval(sendQueueStatus, 5000);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        console.log('🔌 Agent Queue SSE client disconnected');
        isControllerClosed = true;
        clearInterval(statusInterval);
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch (error) {
          // Controller might already be closed
        }
      });

      // Keep connection alive with heartbeat every 30 seconds
      const heartbeatInterval = setInterval(() => {
        if (isControllerClosed) {
          clearInterval(heartbeatInterval);
          clearInterval(statusInterval);
          return;
        }
        sendEvent('heartbeat', { timestamp: new Date().toISOString() });
      }, 30000);

      // Clean up intervals when needed
      const cleanup = () => {
        clearInterval(statusInterval);
        clearInterval(heartbeatInterval);
      };

      // Store cleanup function for when connection is aborted
      (request.signal as any)._cleanup = cleanup;
    },
  });

  return new Response(stream, {
    headers: responseHeaders,
  });
}
