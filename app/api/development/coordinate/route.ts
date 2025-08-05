import { NextRequest, NextResponse } from 'next/server';
import { coordinationSystem } from '@/lib/agents/coordination-system';
import { getDefaultProjectId } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId: providedProjectId, action } = body;

    // Use provided project ID or get default
    const projectId = providedProjectId || (await getDefaultProjectId());

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No project available. Please create a project first.',
        },
        { status: 400 }
      );
    }

    console.log(
      `🎼 Starting development coordination for project: ${projectId}`
    );
    console.log(`Action: ${action || 'coordinate'}`);

    let result;

    switch (action) {
      case 'coordinate':
      default:
        // Main coordination workflow
        result = await coordinationSystem.coordinateProjectWork(projectId);
        break;

      case 'execute_cycle':
        // Execute a specific TDD cycle
        const { cycleId } = body;
        if (!cycleId) {
          return NextResponse.json(
            {
              success: false,
              error: 'cycleId required for execute_cycle action',
            },
            { status: 400 }
          );
        }
        result = await coordinationSystem.executeTDDCycle(cycleId);
        break;

      case 'resolve_query':
        // Handle query resolution
        const { queryId, decision } = body;
        if (!queryId || !decision) {
          return NextResponse.json(
            {
              success: false,
              error: 'queryId and decision required for resolve_query action',
            },
            { status: 400 }
          );
        }
        await coordinationSystem.handleQueryResolution(queryId, decision);
        result = { success: true, message: 'Query resolved and work resumed' };
        break;
    }

    return NextResponse.json({
      success: true,
      data: result,
      project: {
        id: projectId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in development coordination:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to coordinate development',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId =
      searchParams.get('projectId') || (await getDefaultProjectId());

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No project available. Please create a project first.',
        },
        { status: 400 }
      );
    }

    // Get current workflow state
    const workflowState =
      await coordinationSystem.coordinateProjectWork(projectId);

    return NextResponse.json({
      success: true,
      data: workflowState,
      project: {
        id: projectId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting workflow state:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get workflow state',
      },
      { status: 500 }
    );
  }
}
