import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// DELETE /api/epics/dependencies/[dependencyId] - Remove dependency
export async function DELETE(
  request: NextRequest,
  { params }: { params: { dependencyId: string } }
) {
  try {
    const dependencyId = params.dependencyId;

    // Check if dependency exists
    const existingDependency = await prisma.epicDependency.findUnique({
      where: { id: dependencyId },
      include: {
        epic: {
          select: {
            id: true,
            title: true,
          },
        },
        dependsOn: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!existingDependency) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dependency not found',
        },
        { status: 404 }
      );
    }

    // Delete the dependency
    await prisma.epicDependency.delete({
      where: { id: dependencyId },
    });

    return NextResponse.json({
      success: true,
      message: `Dependency removed: ${existingDependency.epic.title} no longer depends on ${existingDependency.dependsOn.title}`,
      data: {
        removed: existingDependency,
      },
    });
  } catch (error) {
    console.error('Error deleting epic dependency:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete dependency',
      },
      { status: 500 }
    );
  }
}