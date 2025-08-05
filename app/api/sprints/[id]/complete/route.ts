import { prisma as db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface SprintParams {
  params: Promise<{ id: string }>;
}

interface Story {
  id: string;
  status: string;
  storyPoints: number | null;
  epicId: string;
}

interface Sprint {
  id: string;
  projectId: string;
  completedStoryPoints: number;
}

export async function POST(request: NextRequest, { params }: SprintParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      reviewNotes,
      retrospectiveNotes,
      moveUnfinishedToBacklog = true,
    } = body;

    const sprint = await db.sprint.findUnique({
      where: { id },
      include: {
        stories: true,
      },
    });

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    if (sprint.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Sprint is not active' },
        { status: 400 }
      );
    }

    // Calculate velocity
    const completedStoryPoints = sprint.stories
      .filter(story => story.status === 'DONE')
      .reduce((sum: number, story) => sum + (story.storyPoints || 0), 0);

    // Get previous sprints to calculate average velocity
    const previousSprints = await db.sprint.findMany({
      where: {
        projectId: sprint.projectId,
        status: 'COMPLETED',
      },
      select: {
        completedStoryPoints: true,
      },
    });

    const totalVelocity = previousSprints.reduce(
      (sum: number, s) => sum + s.completedStoryPoints,
      completedStoryPoints
    );
    const averageVelocity = totalVelocity / (previousSprints.length + 1);

    // Handle unfinished stories
    if (moveUnfinishedToBacklog) {
      const unfinishedStories = sprint.stories.filter(
        story => story.status !== 'DONE'
      );

      await db.kanbanCard.updateMany({
        where: {
          id: { in: unfinishedStories.map(s => s.id) },
        },
        data: {
          sprintId: null,
          status: 'BACKLOG',
        },
      });
    }

    // Update sprint
    const updatedSprint = await db.sprint.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedStoryPoints,
        velocity: averageVelocity,
        reviewNotes,
        retrospectiveNotes,
      },
      include: {
        stories: {
          where: {
            status: 'DONE',
          },
        },
        sprintEpics: {
          include: {
            epic: true,
          },
        },
      },
    });

    // Update epic actual story points
    for (const sprintEpic of updatedSprint.sprintEpics) {
      const epicCompletedPoints = updatedSprint.stories
        .filter(story => story.epicId === sprintEpic.epicId)
        .reduce((sum: number, story) => sum + (story.storyPoints || 0), 0);

      await db.epic.update({
        where: { id: sprintEpic.epicId },
        data: {
          actualStoryPoints: {
            increment: epicCompletedPoints,
          },
        },
      });
    }

    // Create final burndown data point
    await db.sprintBurndown.create({
      data: {
        sprintId: id,
        date: new Date(new Date().toISOString().split('T')[0]),
        remainingStoryPoints: 0,
        completedStoryPoints,
        idealRemainingPoints: 0,
      },
    });

    return NextResponse.json(updatedSprint);
  } catch (error) {
    console.error('Error completing sprint:', error);
    return NextResponse.json(
      { error: 'Failed to complete sprint' },
      { status: 500 }
    );
  }
}
