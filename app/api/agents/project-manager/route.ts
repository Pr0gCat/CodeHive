import { NextRequest, NextResponse } from 'next/server';
import { ProjectManagerAgent } from '@/lib/agents/project-manager';
import { TaskQueue } from '@/lib/agents/queue';
import { z } from 'zod';

const analyzeProjectSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  action: z.enum(['analyze', 'generate-specs', 'recommend', 'orchestrate', 'insights', 'review']),
  cardId: z.string().optional(),
});

// Global instances
let projectManager: ProjectManagerAgent | null = null;
let taskQueue: TaskQueue | null = null;

function getProjectManager(): ProjectManagerAgent {
  if (!projectManager) {
    projectManager = new ProjectManagerAgent();
  }
  return projectManager;
}

function getTaskQueue(): TaskQueue {
  if (!taskQueue) {
    taskQueue = new TaskQueue();
  }
  return taskQueue;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = analyzeProjectSchema.parse(body);

    const manager = getProjectManager();
    const { projectId, action, cardId } = validatedData;

    switch (action) {
      case 'analyze':
        {
          const context = await manager.analyzeProject(projectId);
          return NextResponse.json({
            success: true,
            data: {
              action: 'analyze',
              context,
              message: 'Project analysis completed successfully',
            },
          });
        }

      case 'generate-specs':
        {
          const context = await manager.analyzeProject(projectId);
          const specs = await manager.generateAgentSpecs(context);
          return NextResponse.json({
            success: true,
            data: {
              action: 'generate-specs',
              specs,
              message: `Generated ${specs.length} agent specifications`,
            },
          });
        }

      case 'recommend':
        {
          const context = await manager.analyzeProject(projectId);
          const recommendations = await manager.recommendNextActions(context);
          return NextResponse.json({
            success: true,
            data: {
              action: 'recommend',
              recommendations,
              message: `Generated ${recommendations.length} recommendations`,
            },
          });
        }

      case 'orchestrate':
        {
          if (!cardId) {
            return NextResponse.json(
              {
                success: false,
                error: 'Card ID is required for orchestration',
              },
              { status: 400 }
            );
          }

          const context = await manager.analyzeProject(projectId);
          const recommendations = await manager.recommendNextActions(context);
          const taskIds = await manager.orchestrateAgents(projectId, cardId, recommendations);

          return NextResponse.json({
            success: true,
            data: {
              action: 'orchestrate',
              taskIds,
              recommendations: recommendations.slice(0, 3), // Show which were executed
              message: `Orchestrated ${taskIds.length} agents`,
            },
          });
        }

      case 'insights':
        {
          const insights = await manager.getProjectInsights(projectId);
          return NextResponse.json({
            success: true,
            data: {
              action: 'insights',
              insights,
              message: 'Project insights generated successfully',
            },
          });
        }

      case 'review':
        {
          const result = await manager.reviewProject(projectId);
          return NextResponse.json({
            success: result.success,
            data: result.success ? {
              action: 'review',
              result,
              message: result.message,
            } : undefined,
            error: result.success ? undefined : result.error,
          });
        }

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action',
          },
          { status: 400 }
        );
    }
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

    console.error('Error in project manager:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}