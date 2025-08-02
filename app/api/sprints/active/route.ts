import { prisma as db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface Story {
  id: string;
  status: string;
  storyPoints: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Get the active sprint for the project
    const activeSprint = await db.sprint.findFirst({
      where: {
        projectId,
        status: 'ACTIVE',
      },
      include: {
        stories: {
          include: {
            epic: {
              select: {
                id: true,
                title: true,
                type: true,
              },
            },
          },
        },
        sprintEpics: {
          include: {
            epic: true,
          },
        },
        burndown: {
          orderBy: { date: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            stories: true,
          },
        },
      },
    });

    if (!activeSprint) {
      return NextResponse.json(
        { active: false, message: 'No active sprint found' },
        { status: 200 }
      );
    }

    // Calculate sprint health metrics
    const totalStoryPoints = activeSprint.stories.reduce(
      (sum: number, story: Story) => sum + (story.storyPoints || 0),
      0
    );
    const completedStoryPoints = activeSprint.stories
      .filter((story: Story) => story.status === 'DONE')
      .reduce((sum: number, story: Story) => sum + (story.storyPoints || 0), 0);

    const daysElapsed = Math.ceil(
      (new Date().getTime() - activeSprint.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalDays = activeSprint.duration;
    const timeElapsedPercentage = Math.round((daysElapsed / totalDays) * 100);
    const workCompletedPercentage = totalStoryPoints > 0
      ? Math.round((completedStoryPoints / totalStoryPoints) * 100)
      : 0;

    // Determine sprint health
    let health = 'ON_TRACK';
    if (workCompletedPercentage < timeElapsedPercentage - 20) {
      health = 'AT_RISK';
    } else if (workCompletedPercentage < timeElapsedPercentage - 40) {
      health = 'OFF_TRACK';
    }

    return NextResponse.json({
      active: true,
      sprint: {
        ...activeSprint,
        health,
        metrics: {
          totalStoryPoints,
          completedStoryPoints,
          timeElapsedPercentage,
          workCompletedPercentage,
          daysRemaining: totalDays - daysElapsed,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching active sprint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active sprint' },
      { status: 500 }
    );
  }
}