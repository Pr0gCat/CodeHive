import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/cycles/[id] - Get cycle details with tests and artifacts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cycleId = params.id;

    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        tests: {
          orderBy: { createdAt: 'asc' },
        },
        artifacts: {
          orderBy: { createdAt: 'desc' },
        },
        queries: {
          orderBy: { createdAt: 'desc' },
          include: {
            comments: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
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

    return NextResponse.json({
      success: true,
      data: cycle,
    });
  } catch (error) {
    console.error('Error fetching cycle:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch cycle',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/cycles/[id] - Delete cycle
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cycleId = params.id;

    // Check if cycle exists
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
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

    // Delete cycle (cascades to related records)
    await prisma.cycle.delete({
      where: { id: cycleId },
    });

    return NextResponse.json({
      success: true,
      message: 'Cycle deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting cycle:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete cycle',
      },
      { status: 500 }
    );
  }
}