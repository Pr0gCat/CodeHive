import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { TDDCycleEngine, FeatureRequest } from '@/lib/tdd/cycle-engine';
import { checkProjectOperationAccess } from '@/lib/project-access-control';

// GET /api/projects/[id]/cycles - List project TDD cycles
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    const cycles = await prisma.cycle.findMany({
      where: { projectId },
      include: {
        tests: {
          orderBy: { createdAt: 'asc' },
        },
        artifacts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        queries: {
          where: { status: 'PENDING' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: cycles,
    });
  } catch (error) {
    console.error('Error fetching cycles:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fetch cycles',
      },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/cycles - Create new TDD cycle from feature request
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const body = await request.json();

    // Validate request
    if (
      !body.title ||
      !body.acceptanceCriteria ||
      !Array.isArray(body.acceptanceCriteria)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: title and acceptanceCriteria array',
        },
        { status: 400 }
      );
    }

    // Check if project can be operated on
    const accessCheck = await checkProjectOperationAccess(projectId);

    if (!accessCheck.allowed) {
      return accessCheck.response;
    }

    const project = accessCheck.project;

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Create feature request
    const featureRequest: FeatureRequest = {
      title: body.title,
      description: body.description,
      acceptanceCriteria: body.acceptanceCriteria,
      constraints: body.constraints,
      projectId,
    };

    // Initialize TDD engine and start cycle
    const tddEngine = new TDDCycleEngine(projectId, project.localPath || '');
    const cycle = await tddEngine.startCycle(featureRequest);

    return NextResponse.json({
      success: true,
      data: cycle,
    });
  } catch (error) {
    console.error('Error creating cycle:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create cycle',
      },
      { status: 500 }
    );
  }
}
