import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { TDDCycleEngine } from '@/lib/tdd/cycle-engine';
import { AITDDIntegration } from '@/lib/tdd/ai-integration';

// PUT /api/cycles/[id]/execute - Execute current phase of cycle
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cycleId = params.id;

    // Get cycle with project info
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        project: true,
      },
    });

    if (!cycle) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cycle not found',
        },
        { status: 404 }
      );
    }

    if (cycle.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: `Cycle is ${cycle.status.toLowerCase()}, cannot execute`,
        },
        { status: 400 }
      );
    }

    // Initialize TDD engine
    const tddEngine = new TDDCycleEngine(cycle.projectId, cycle.project.localPath);

    // Execute current phase
    const result = await tddEngine.executePhase(cycleId);

    // Handle blocked cycles
    if (result.status === 'BLOCKED') {
      return NextResponse.json({
        success: true,
        data: {
          ...result,
          message: 'Cycle is blocked by pending queries. Please resolve them to continue.',
        },
      });
    }

    // Handle failed cycles
    if (result.status === 'FAILED') {
      return NextResponse.json({
        success: false,
        error: 'Phase execution failed, rolling back to previous phase',
        data: result,
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error executing cycle phase:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute cycle phase',
      },
      { status: 500 }
    );
  }
}