import { prisma as db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface SprintParams {
  params: Promise<{ id: string }>;
}

interface Story {
  id: string;
  status: string;
  storyPoints: number | null;
}

export async function GET(request: NextRequest, { params }: SprintParams) {
  try {
    const { id } = await params;

    const burndown = await db.sprintBurndown.findMany({
      where: { sprintId: id },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(burndown);
  } catch (error) {
    console.error('Error fetching burndown data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch burndown data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: SprintParams) {
  try {
    const { id: sprintId } = await params;

    // Get sprint details
    const sprint = await db.sprint.findUnique({
      where: { id: sprintId },
      include: {
        stories: true,
      },
    });

    if (!sprint) {
      return NextResponse.json(
        { error: 'Sprint not found' },
        { status: 404 }
      );
    }

    // Calculate current burndown metrics
    const completedStoryPoints = sprint.stories
      .filter((story: Story) => story.status === 'DONE')
      .reduce((sum: number, story: Story) => sum + (story.storyPoints || 0), 0);

    const remainingStoryPoints = sprint.stories
      .filter((story: Story) => story.status !== 'DONE')
      .reduce((sum: number, story: Story) => sum + (story.storyPoints || 0), 0);

    // Calculate ideal burndown
    const today = new Date();
    const sprintDuration = Math.ceil(
      (sprint.endDate.getTime() - sprint.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysElapsed = Math.ceil(
      (today.getTime() - sprint.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const dailyVelocity = sprint.commitedStoryPoints / sprintDuration;
    const idealRemainingPoints = Math.max(
      0,
      sprint.commitedStoryPoints - (dailyVelocity * daysElapsed)
    );

    // Create or update today's burndown record
    const burndown = await db.sprintBurndown.upsert({
      where: {
        sprintId_date: {
          sprintId,
          date: new Date(today.toISOString().split('T')[0]), // Normalize to date only
        },
      },
      create: {
        sprintId,
        date: new Date(today.toISOString().split('T')[0]),
        remainingStoryPoints,
        completedStoryPoints,
        idealRemainingPoints,
      },
      update: {
        remainingStoryPoints,
        completedStoryPoints,
        idealRemainingPoints,
      },
    });

    // Update sprint completed story points
    await db.sprint.update({
      where: { id: sprintId },
      data: {
        completedStoryPoints,
      },
    });

    // Update SprintEpic completed points
    const epicCompletedPoints = await db.kanbanCard.groupBy({
      by: ['epicId'],
      where: {
        sprintId,
        status: 'DONE',
        epicId: { not: null },
      },
      _sum: {
        storyPoints: true,
      },
    });

    for (const epic of epicCompletedPoints) {
      if (epic.epicId) {
        await db.sprintEpic.update({
          where: {
            sprintId_epicId: {
              sprintId,
              epicId: epic.epicId,
            },
          },
          data: {
            completedStoryPoints: epic._sum.storyPoints || 0,
          },
        });
      }
    }

    return NextResponse.json(burndown);
  } catch (error) {
    console.error('Error updating burndown data:', error);
    return NextResponse.json(
      { error: 'Failed to update burndown data' },
      { status: 500 }
    );
  }
}