import { prisma as db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface SprintParams {
  params: Promise<{ id: string }>;
}

interface Story {
  id: string;
  status: string;
}

export async function POST(request: NextRequest, { params }: SprintParams) {
  try {
    const { id } = await params;

    const sprint = await db.sprint.findUnique({
      where: { id },
      include: {
        stories: true,
      },
    });

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    if (sprint.status !== 'PLANNING') {
      return NextResponse.json(
        { error: 'Sprint is not in PLANNING status' },
        { status: 400 }
      );
    }

    // Check if there's another active sprint
    const activeSprint = await db.sprint.findFirst({
      where: {
        projectId: sprint.projectId,
        status: 'ACTIVE',
      },
    });

    if (activeSprint) {
      return NextResponse.json(
        { error: 'Another sprint is already active' },
        { status: 400 }
      );
    }

    // Update sprint status to ACTIVE
    const updatedSprint = await db.sprint.update({
      where: { id },
      data: {
        status: 'ACTIVE',
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

    // Create initial burndown data point
    await db.sprintBurndown.create({
      data: {
        sprintId: id,
        date: new Date(new Date().toISOString().split('T')[0]),
        remainingStoryPoints: sprint.commitedStoryPoints,
        completedStoryPoints: 0,
        idealRemainingPoints: sprint.commitedStoryPoints,
      },
    });

    // Create initial daily update
    await db.sprintDailyUpdate.create({
      data: {
        sprintId: id,
        date: new Date(new Date().toISOString().split('T')[0]),
        storiesInProgress: sprint.stories.filter(
          (s: Story) => s.status === 'IN_PROGRESS'
        ).length,
        storiesCompleted: 0,
        notes: 'Sprint started',
      },
    });

    return NextResponse.json(updatedSprint);
  } catch (error) {
    console.error('Error starting sprint:', error);
    return NextResponse.json(
      { error: 'Failed to start sprint' },
      { status: 500 }
    );
  }
}
