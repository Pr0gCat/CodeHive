import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  const stream = new ReadableStream({
    async start(controller) {
      console.log(`🔗 TDD Cycles SSE connection established for project: ${projectId}`);
      
      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({ 
        type: 'connected', 
        projectId 
      })}\n\n`);

      // Send current cycles state
      try {
        const cycles = await prisma.cycle.findMany({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            tests: {
              orderBy: { createdAt: 'asc' },
            },
          },
        });

        controller.enqueue(`data: ${JSON.stringify({
          type: 'cycles_state',
          projectId,
          cycles,
        })}\n\n`);
      } catch (error) {
        console.error('Failed to get initial cycles state:', error);
      }

      // Set up database polling (optimized - only when needed)
      let lastUpdateTime = new Date().getTime();
      
      const pollInterval = setInterval(async () => {
        try {
          // Check for cycles updated since last poll
          const updatedCycles = await prisma.cycle.findMany({
            where: { 
              projectId,
              updatedAt: { 
                gte: new Date(lastUpdateTime - 1000) // 1 second buffer
              }
            },
            orderBy: { updatedAt: 'desc' },
            include: {
              tests: {
                orderBy: { createdAt: 'asc' },
              },
            },
          });

          if (updatedCycles.length > 0) {
            controller.enqueue(`data: ${JSON.stringify({
              type: 'cycles_updated',
              projectId,
              cycles: updatedCycles,
              timestamp: new Date().toISOString(),
            })}\n\n`);
            
            lastUpdateTime = new Date().getTime();
          }
        } catch (error) {
          console.error('TDD Cycles SSE polling error:', error);
          clearInterval(pollInterval);
          controller.close();
        }
      }, 2000); // Poll every 2 seconds

      // Cleanup on connection close
      const cleanup = () => {
        clearInterval(pollInterval);
        console.log(`🔌 TDD Cycles SSE connection closed for project: ${projectId}`);
      };

      request.signal?.addEventListener('abort', cleanup);
      
      return cleanup;
    },
    cancel() {
      console.log(`🔌 TDD Cycles SSE stream cancelled for project: ${projectId}`);
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