import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Epic creation schema
const createEpicSchema = z.object({
  projectId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(['MVP', 'ENHANCEMENT', 'FEATURE', 'BUGFIX']).default('FEATURE'),
  mvpPriority: z
    .enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'FUTURE'])
    .default('MEDIUM'),
  coreValue: z.string().optional(),
  estimatedStoryPoints: z.number().int().min(0).default(0),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  sequence: z.number().int().min(0).default(0),
});

// Epic update schema (currently unused but may be needed for future updates)
// const updateEpicSchema = createEpicSchema.partial().omit({ projectId: true });

// GET /api/epics - List all epics with optional project filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const whereClause = projectId ? { projectId } : {};

    const epics = await prisma.epic.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        stories: {
          select: {
            id: true,
            title: true,
            status: true,
            storyPoints: true,
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
              },
            },
          },
        },
        _count: {
          select: {
            stories: true,
          },
        },
      },
      orderBy: [{ sequence: 'asc' }, { createdAt: 'desc' }],
    });

    // Calculate progress for each epic
    const epicsWithProgress = epics.map(epic => {
      const totalStories = epic.stories.length;
      const completedStories = epic.stories.filter(
        story => story.status === 'DONE'
      ).length;
      const totalStoryPoints = epic.stories.reduce(
        (sum, story) => sum + (story.storyPoints || 0),
        0
      );
      const completedStoryPoints = epic.stories
        .filter(story => story.status === 'DONE')
        .reduce((sum, story) => sum + (story.storyPoints || 0), 0);

      return {
        ...epic,
        progress: {
          storiesCompleted: completedStories,
          storiesTotal: totalStories,
          storyPointsCompleted: completedStoryPoints,
          storyPointsTotal: totalStoryPoints,
          percentage:
            totalStories > 0
              ? Math.round((completedStories / totalStories) * 100)
              : 0,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: epicsWithProgress,
    });
  } catch (error) {
    console.error('Error fetching epics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch epics',
      },
      { status: 500 }
    );
  }
}

// POST /api/epics - Create new epic
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createEpicSchema.parse(body);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: validatedData.projectId },
    });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    // Create epic
    const epic = await prisma.epic.create({
      data: {
        ...validatedData,
        startDate: validatedData.startDate
          ? new Date(validatedData.startDate)
          : null,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
      },
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

    return NextResponse.json(
      {
        success: true,
        data: epic,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating epic:', error);

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
        error: error instanceof Error ? error.message : 'Failed to create epic',
      },
      { status: 500 }
    );
  }
}
