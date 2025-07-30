import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Epic update schema
const updateEpicSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  type: z.enum(['MVP', 'ENHANCEMENT', 'FEATURE', 'BUGFIX']).optional(),
  phase: z.enum(['PLANNING', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
  mvpPriority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'FUTURE']).optional(),
  coreValue: z.string().optional(),
  estimatedStoryPoints: z.number().int().min(0).optional(),
  actualStoryPoints: z.number().int().min(0).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  sequence: z.number().int().min(0).optional(),
});

// GET /api/epics/[id] - Get epic details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const epicId = params.id;

    const epic = await prisma.epic.findUnique({
      where: { id: epicId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        stories: {
          include: {
            cycles: {
              select: {
                id: true,
                title: true,
                phase: true,
                status: true,
              },
            },
            dependencies: {
              include: {
                dependsOn: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                  },
                },
              },
            },
            dependents: {
              include: {
                story: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: { sequence: 'asc' },
        },
        dependencies: {
          include: {
            dependsOn: {
              select: {
                id: true,
                title: true,
                phase: true,
                status: true,
              },
            },
          },
        },
        dependents: {
          include: {
            epic: {
              select: {
                id: true,
                title: true,
                phase: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!epic) {
      return NextResponse.json(
        {
          success: false,
          error: 'Epic not found',
        },
        { status: 404 }
      );
    }

    // Calculate detailed progress
    const totalStories = epic.stories.length;
    const storiesByStatus = epic.stories.reduce((acc, story) => {
      acc[story.status] = (acc[story.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalStoryPoints = epic.stories.reduce((sum, story) => sum + (story.storyPoints || 0), 0);
    const completedStoryPoints = epic.stories
      .filter(story => story.status === 'DONE')
      .reduce((sum, story) => sum + (story.storyPoints || 0), 0);

    // Calculate TDD cycles progress
    const totalCycles = epic.stories.reduce((sum, story) => sum + story.cycles.length, 0);
    const completedCycles = epic.stories.reduce(
      (sum, story) => sum + story.cycles.filter(cycle => cycle.status === 'COMPLETED').length,
      0
    );

    const epicWithProgress = {
      ...epic,
      progress: {
        stories: {
          total: totalStories,
          byStatus: storiesByStatus,
          completed: storiesByStatus.DONE || 0,
          percentage: totalStories > 0 ? Math.round(((storiesByStatus.DONE || 0) / totalStories) * 100) : 0,
        },
        storyPoints: {
          total: totalStoryPoints,
          completed: completedStoryPoints,
          percentage: totalStoryPoints > 0 ? Math.round((completedStoryPoints / totalStoryPoints) * 100) : 0,
        },
        cycles: {
          total: totalCycles,
          completed: completedCycles,
          percentage: totalCycles > 0 ? Math.round((completedCycles / totalCycles) * 100) : 0,
        },
      },
    };

    return NextResponse.json({
      success: true,
      data: epicWithProgress,
    });
  } catch (error) {
    console.error('Error fetching epic:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch epic',
      },
      { status: 500 }
    );
  }
}

// PUT /api/epics/[id] - Update epic
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const epicId = params.id;
    const body = await request.json();
    const validatedData = updateEpicSchema.parse(body);

    // Check if epic exists
    const existingEpic = await prisma.epic.findUnique({
      where: { id: epicId },
    });

    if (!existingEpic) {
      return NextResponse.json(
        {
          success: false,
          error: 'Epic not found',
        },
        { status: 404 }
      );
    }

    // Update epic
    const updateData: any = { ...validatedData };
    
    // Handle date conversions
    if (validatedData.startDate) {
      updateData.startDate = new Date(validatedData.startDate);
    }
    if (validatedData.dueDate) {
      updateData.dueDate = new Date(validatedData.dueDate);
    }

    // Set completedAt when phase changes to DONE
    if (validatedData.phase === 'DONE' && existingEpic.phase !== 'DONE') {
      updateData.completedAt = new Date();
    } else if (validatedData.phase && validatedData.phase !== 'DONE') {
      updateData.completedAt = null;
    }

    const updatedEpic = await prisma.epic.update({
      where: { id: epicId },
      data: updateData,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            stories: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedEpic,
    });
  } catch (error) {
    console.error('Error updating epic:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input data',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update epic',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/epics/[id] - Delete epic
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const epicId = params.id;

    // Check if epic exists
    const existingEpic = await prisma.epic.findUnique({
      where: { id: epicId },
      include: {
        stories: true,
        dependencies: true,
        dependents: true,
      },
    });

    if (!existingEpic) {
      return NextResponse.json(
        {
          success: false,
          error: 'Epic not found',
        },
        { status: 404 }
      );
    }

    // Check if epic has dependencies from other epics
    if (existingEpic.dependents.length > 0) {
      const dependentTitles = existingEpic.dependents.map(dep => dep.epic);
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete epic that other epics depend on',
          details: {
            dependents: dependentTitles,
          },
        },
        { status: 400 }
      );
    }

    // If epic has stories, set their epicId to null instead of deleting them
    if (existingEpic.stories.length > 0) {
      await prisma.kanbanCard.updateMany({
        where: { epicId },
        data: { epicId: null },
      });
    }

    // Delete the epic (dependencies will be cascade deleted)
    await prisma.epic.delete({
      where: { id: epicId },
    });

    return NextResponse.json({
      success: true,
      message: 'Epic deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting epic:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete epic',
      },
      { status: 500 }
    );
  }
}