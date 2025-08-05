import { NextRequest, NextResponse } from 'next/server';
import { prisma as db } from '@/lib/db';

interface SprintParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: SprintParams) {
  try {
    const { id } = await params;

    const sprint = await db.sprint.findUnique({
      where: { id },
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
            epic: {
              include: {
                stories: {
                  where: {
                    sprintId: id,
                  },
                  select: {
                    id: true,
                    status: true,
                    storyPoints: true,
                  },
                },
              },
            },
          },
        },
        burndown: {
          orderBy: { date: 'asc' },
        },
        dailyUpdates: {
          orderBy: { date: 'desc' },
          take: 7, // Last 7 daily updates
        },
      },
    });

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    return NextResponse.json(sprint);
  } catch (error) {
    console.error('Error fetching sprint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sprint' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: SprintParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const sprint = await db.sprint.findUnique({
      where: { id },
    });

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 });
    }

    // Update sprint
    const updatedSprint = await db.sprint.update({
      where: { id },
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        completedAt:
          body.status === 'COMPLETED' && !sprint.completedAt
            ? new Date()
            : body.status !== 'COMPLETED'
              ? null
              : undefined,
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
    console.error('Error updating sprint:', error);
    return NextResponse.json(
      { error: 'Failed to update sprint' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: SprintParams) {
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

    // Check if sprint has stories
    if (sprint.stories.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete sprint with assigned stories' },
        { status: 400 }
      );
    }

    // Delete the sprint
    await db.sprint.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sprint:', error);
    return NextResponse.json(
      { error: 'Failed to delete sprint' },
      { status: 500 }
    );
  }
}
