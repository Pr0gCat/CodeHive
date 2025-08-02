import { prisma as db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface SprintParams {
  params: Promise<{ id: string }>;
}

interface StorySummary {
  epicId: string | null;
  storyPoints: number | null;
}

export async function POST(request: NextRequest, { params }: SprintParams) {
  try {
    const { id: sprintId } = await params;
    const body = await request.json();
    const { storyIds } = body;

    if (!Array.isArray(storyIds)) {
      return NextResponse.json(
        { error: 'storyIds must be an array' },
        { status: 400 }
      );
    }

    // Verify sprint exists
    const sprint = await db.sprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint) {
      return NextResponse.json(
        { error: 'Sprint not found' },
        { status: 404 }
      );
    }

    // Update stories to assign them to this sprint
    await db.kanbanCard.updateMany({
      where: {
        id: { in: storyIds },
        projectId: sprint.projectId,
      },
      data: {
        sprintId,
        status: 'TODO', // Move from BACKLOG to TODO when added to sprint
      },
    });

    // Get all stories with epics to update sprint epic tracking
    const stories = await db.kanbanCard.findMany({
      where: {
        id: { in: storyIds },
      },
      select: {
        epicId: true,
        storyPoints: true,
      },
    });

    // Group story points by epic
    const epicPoints = stories.reduce((acc: Record<string, number>, story: StorySummary) => {
      if (story.epicId && story.storyPoints) {
        acc[story.epicId] = (acc[story.epicId] || 0) + story.storyPoints;
      }
      return acc;
    }, {} as Record<string, number>);

    // Create or update SprintEpic records
    for (const [epicId, points] of Object.entries(epicPoints)) {
      await db.sprintEpic.upsert({
        where: {
          sprintId_epicId: {
            sprintId,
            epicId,
          },
        },
        create: {
          sprintId,
          epicId,
          plannedStoryPoints: points,
        },
        update: {
          plannedStoryPoints: {
            increment: points,
          },
        },
      });
    }

    // Update sprint's committed story points
    const totalPoints = stories.reduce(
      (sum: number, story: StorySummary) => sum + (story.storyPoints || 0),
      0
    );

    const updatedSprint = await db.sprint.update({
      where: { id: sprintId },
      data: {
        commitedStoryPoints: {
          increment: totalPoints,
        },
      },
      include: {
        stories: true,
        sprintEpics: {
          include: {
            epic: true,
          },
        },
      },
    });

    return NextResponse.json(updatedSprint);
  } catch (error) {
    console.error('Error adding stories to sprint:', error);
    return NextResponse.json(
      { error: 'Failed to add stories to sprint' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: SprintParams) {
  try {
    const { id: sprintId } = await params;
    const body = await request.json();
    const { storyIds } = body;

    if (!Array.isArray(storyIds)) {
      return NextResponse.json(
        { error: 'storyIds must be an array' },
        { status: 400 }
      );
    }

    // Get stories before removing them
    const stories = await db.kanbanCard.findMany({
      where: {
        id: { in: storyIds },
        sprintId,
      },
      select: {
        epicId: true,
        storyPoints: true,
      },
    });

    // Remove stories from sprint (move back to backlog)
    await db.kanbanCard.updateMany({
      where: {
        id: { in: storyIds },
        sprintId,
      },
      data: {
        sprintId: null,
        status: 'BACKLOG',
      },
    });

    // Update SprintEpic records
    const epicPoints = stories.reduce((acc: Record<string, number>, story: StorySummary) => {
      if (story.epicId && story.storyPoints) {
        acc[story.epicId] = (acc[story.epicId] || 0) + story.storyPoints;
      }
      return acc;
    }, {} as Record<string, number>);

    for (const [epicId, points] of Object.entries(epicPoints)) {
      const sprintEpic = await db.sprintEpic.findUnique({
        where: {
          sprintId_epicId: {
            sprintId,
            epicId,
          },
        },
      });

      if (sprintEpic) {
        const newPoints = sprintEpic.plannedStoryPoints - (points as number);
        if (newPoints <= 0) {
          // Remove SprintEpic if no more stories from this epic
          await db.sprintEpic.delete({
            where: {
              sprintId_epicId: {
                sprintId,
                epicId,
              },
            },
          });
        } else {
          // Update the points
          await db.sprintEpic.update({
            where: {
              sprintId_epicId: {
                sprintId,
                epicId,
              },
            },
            data: {
              plannedStoryPoints: newPoints,
            },
          });
        }
      }
    }

    // Update sprint's committed story points
    const totalPoints = stories.reduce(
      (sum: number, story: StorySummary) => sum + (story.storyPoints || 0),
      0
    );

    const updatedSprint = await db.sprint.update({
      where: { id: sprintId },
      data: {
        commitedStoryPoints: {
          decrement: totalPoints,
        },
      },
      include: {
        stories: true,
        sprintEpics: {
          include: {
            epic: true,
          },
        },
      },
    });

    return NextResponse.json(updatedSprint);
  } catch (error) {
    console.error('Error removing stories from sprint:', error);
    return NextResponse.json(
      { error: 'Failed to remove stories from sprint' },
      { status: 500 }
    );
  }
}