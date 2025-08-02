import { prisma as db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface BacklogParams {
  params: Promise<{ id: string }>;
}

interface StoryWithEpic {
  id: string;
  title: string;
  storyPoints: number | null;
  priority: string;
  epic?: {
    id: string;
    title: string;
    type: string;
    mvpPriority: string;
  } | null;
}

export async function GET(request: NextRequest, { params }: BacklogParams) {
  try {
    const { id: projectId } = await params;

    // Get all stories not assigned to any sprint (backlog items)
    const backlogStories = await db.kanbanCard.findMany({
      where: {
        projectId,
        sprintId: null,
        status: 'BACKLOG',
      },
      include: {
        epic: {
          select: {
            id: true,
            title: true,
            type: true,
            mvpPriority: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' }, // HIGH, MEDIUM, LOW
        { position: 'asc' },
      ],
    });

    // Get epics without stories in any sprint
    const epicsWithoutSprintStories = await db.epic.findMany({
      where: {
        projectId,
        stories: {
          every: {
            sprintId: null,
          },
        },
      },
      include: {
        stories: {
          where: {
            status: 'BACKLOG',
          },
          select: {
            id: true,
            title: true,
            storyPoints: true,
            priority: true,
          },
        },
      },
    });

    return NextResponse.json({
      stories: backlogStories,
      epics: epicsWithoutSprintStories,
      totalStoryPoints: backlogStories.reduce(
        (sum: number, story: StoryWithEpic) => sum + (story.storyPoints || 0),
        0
      ),
    });
  } catch (error) {
    console.error('Error fetching backlog:', error);
    return NextResponse.json(
      { error: 'Failed to fetch backlog' },
      { status: 500 }
    );
  }
}