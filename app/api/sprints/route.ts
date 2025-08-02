import { NextRequest, NextResponse } from 'next/server';
import { prisma, ProjectStatus } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Verify project exists and is active
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.status !== ProjectStatus.ACTIVE) {
      return NextResponse.json(
        { error: 'Project is not active' },
        { status: 400 }
      );
    }

    // Get sprints with related data
    const sprints = await prisma.sprint.findMany({
      where: {
        projectId,
        ...(status && { status }),
      },
      include: {
        stories: {
          include: {
            epic: true,
          },
        },
        sprintEpics: {
          include: {
            epic: true,
          },
        },
        burndown: {
          orderBy: {
            date: 'asc',
          },
        },
        dailyUpdates: {
          orderBy: {
            date: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return NextResponse.json(sprints);
  } catch (error) {
    console.error('Error fetching sprints:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sprints' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      name,
      goal,
      startDate,
      endDate,
      duration,
      plannedStoryPoints,
    } = body;

    // Validate required fields
    if (!projectId || !name || !startDate || !endDate || !duration) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify project exists and is active
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.status !== ProjectStatus.ACTIVE) {
      return NextResponse.json(
        { error: 'Project is not active' },
        { status: 400 }
      );
    }

    // Check for overlapping sprints
    const overlappingSprint = await prisma.sprint.findFirst({
      where: {
        projectId,
        status: { in: ['PLANNING', 'ACTIVE'] },
        OR: [
          {
            AND: [
              { startDate: { lte: new Date(startDate) } },
              { endDate: { gte: new Date(startDate) } },
            ],
          },
          {
            AND: [
              { startDate: { lte: new Date(endDate) } },
              { endDate: { gte: new Date(endDate) } },
            ],
          },
        ],
      },
    });

    if (overlappingSprint) {
      return NextResponse.json(
        { error: 'Sprint dates overlap with existing sprint' },
        { status: 400 }
      );
    }

    // Create sprint
    const sprint = await prisma.sprint.create({
      data: {
        projectId,
        name,
        goal,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        duration,
        plannedStoryPoints: plannedStoryPoints || 0,
        status: 'PLANNING',
      },
      include: {
        stories: true,
        sprintEpics: true,
      },
    });

    // Create initial burndown data point
    await prisma.sprintBurndown.create({
      data: {
        sprintId: sprint.id,
        date: new Date(startDate),
        remainingStoryPoints: plannedStoryPoints || 0,
        completedStoryPoints: 0,
        idealRemainingPoints: plannedStoryPoints || 0,
      },
    });

    return NextResponse.json(sprint);
  } catch (error) {
    console.error('Error creating sprint:', error);
    return NextResponse.json(
      { error: 'Failed to create sprint' },
      { status: 500 }
    );
  }
}