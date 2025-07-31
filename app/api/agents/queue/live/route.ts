import { NextRequest } from 'next/server';
import { queueEventEmitter } from '@/lib/events/queue-event-emitter';
import { TaskQueue } from '@/lib/agents/queue';

const taskQueue = new TaskQueue();

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      console.log(`🔗 Agent Queue SSE connection established`);
      
      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({ 
        type: 'connected'
      })}\n\n`);

      // Send current queue status
      try {
        const status = await taskQueue.getQueueStatus();
        controller.enqueue(`data: ${JSON.stringify({
          type: 'queue_status',
          status,
        })}\n\n`);
      } catch (error) {
        console.error('Failed to get initial queue status:', error);
      }

      // Subscribe to queue events
      const unsubscribe = queueEventEmitter.onQueueEvent((event) => {
        try {
          controller.enqueue(`data: ${JSON.stringify({
            type: 'queue_event',
            event,
          })}\n\n`);
          
          console.log(`📡 Sent queue event:`, event.type);
        } catch (error) {
          console.error('Error sending queue SSE event:', error);
          cleanup();
          controller.close();
        }
      });

      // Also send periodic status updates (much less frequent)
      const statusInterval = setInterval(async () => {
        try {
          const status = await taskQueue.getQueueStatus();
          controller.enqueue(`data: ${JSON.stringify({
            type: 'queue_status',
            status,
          })}\n\n`);
        } catch (error) {
          console.error('Agent Queue SSE status error:', error);
          cleanup();
          controller.close();
        }
      }, 30000); // Every 30 seconds instead of 5

      // Cleanup function
      const cleanup = () => {
        unsubscribe();
        clearInterval(statusInterval);
        console.log(`🔌 Agent Queue SSE connection closed`);
      };

      request.signal?.addEventListener('abort', cleanup);
      
      return cleanup;
    },
    cancel() {
      console.log(`🔌 Agent Queue SSE stream cancelled`);
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