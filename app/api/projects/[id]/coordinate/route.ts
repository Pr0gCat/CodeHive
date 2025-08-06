import { NextRequest, NextResponse } from 'next/server';
import { coordinationSystem } from '@/lib/coordination/system';
import { prisma } from '@/lib/db';

interface CoordinateParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/projects/[id]/coordinate
 * Trigger autonomous project coordination and workflow management
 */
export async function POST(
  request: NextRequest,
  { params }: CoordinateParams
) {
  try {
    const { id: projectId } = await params;

    // Validate project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    console.log(`🎼 Starting autonomous coordination for project: ${project.name}`);

    // Trigger autonomous project coordination
    const workflowState = await coordinationSystem.coordinateProjectWork(projectId);

    // Return the current workflow state
    return NextResponse.json({
      success: true,
      message: `Project coordination completed for "${project.name}"`,
      data: {
        projectId,
        projectName: project.name,
        workflowState,
        coordinatedAt: new Date().toISOString(),
      },
      meta: {
        currentPhase: workflowState.currentPhase,
        activeAgents: workflowState.activeAgents,
        blockedWork: workflowState.blockedWork.length,
        pendingQueries: workflowState.pendingQueries.length,
        tokenStatus: workflowState.tokenStatus,
      },
    });

  } catch (error) {
    console.error('Project coordination error:', error);

    return NextResponse.json(
      {
        error: 'Coordination failed',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/coordinate 
 * Get current project coordination status without triggering coordination
 */
export async function GET(
  request: NextRequest,
  { params }: CoordinateParams
) {
  try {
    const { id: projectId } = await params;

    // Validate project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: {
            kanbanCards: {
              where: { status: 'BACKLOG' }
            },
            cycles: {
              where: { status: 'ACTIVE' }
            },
            queries: {
              where: { status: 'PENDING' }
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get current workflow state information
    const backlogStories = project._count.kanbanCards;
    const activeCycles = project._count.cycles;
    const pendingQueries = project._count.queries;

    // Determine coordination recommendations
    const recommendations = [];
    
    if (backlogStories > 0 && activeCycles === 0) {
      recommendations.push('Stories available in backlog - coordination can progress work to IN_PROGRESS');
    }
    
    if (activeCycles > 0) {
      recommendations.push('Active TDD cycles in progress - coordination will continue development work');
    }
    
    if (pendingQueries > 0) {
      recommendations.push('Pending queries need user input before work can continue');
    }
    
    if (backlogStories === 0 && activeCycles === 0) {
      recommendations.push('No work available - consider generating project epics or adding feature requests');
    }

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        projectName: project.name,
        currentStatus: {
          backlogStories,
          activeCycles,  
          pendingQueries,
        },
        recommendations,
        canCoordinate: backlogStories > 0 || activeCycles > 0,
        lastCoordinated: null, // Could be tracked if needed
      },
    });

  } catch (error) {
    console.error('Coordination status check error:', error);

    return NextResponse.json(
      {
        error: 'Failed to check coordination status',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}