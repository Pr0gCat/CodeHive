import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { checkProjectOperationAccess } from '@/lib/project-access-control';

const createCardSchema = z.object({
  title: z.string().min(1, 'Card title is required'),
  description: z.string().optional(),
  status: z
    .enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'])
    .default('BACKLOG'),
  assignedAgent: z.string().optional(),
  position: z.number().optional(), // Frontend sends this but we calculate our own
  epicId: z.string().cuid().optional(), // Link to epic
  storyPoints: z.number().int().min(0).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  tddEnabled: z.boolean().default(false),
  acceptanceCriteria: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cards = await prisma.kanbanCard.findMany({
      where: { projectId: params.id },
      include: {
        epic: {
          select: {
            id: true,
            title: true,
            type: true,
            phase: true,
            mvpPriority: true,
          },
        },
        cycles: {
          select: {
            id: true,
            title: true,
            phase: true,
            status: true,
          },
          orderBy: { sequence: 'asc' },
        },
        agentTasks: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            agentTasks: true,
            queuedTasks: true,
          },
        },
      },
      orderBy: { position: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: cards,
    });
  } catch (error) {
    console.error('Error fetching cards:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cards',
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validatedData = createCardSchema.parse(body);

    // Check if project can be operated on
    const accessCheck = await checkProjectOperationAccess(params.id);

    if (!accessCheck.allowed) {
      return accessCheck.response;
    }

    // Get the next position for the card
    const lastCard = await prisma.kanbanCard.findFirst({
      where: { projectId: params.id },
      orderBy: { position: 'desc' },
    });

    const nextPosition = (lastCard?.position ?? 0) + 1;

    const card = await prisma.kanbanCard.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        status: validatedData.status,
        assignedAgent: validatedData.assignedAgent,
        projectId: params.id,
        position: nextPosition,
        epicId: validatedData.epicId,
        storyPoints: validatedData.storyPoints,
        priority: validatedData.priority,
        tddEnabled: validatedData.tddEnabled,
        acceptanceCriteria: validatedData.acceptanceCriteria,
      },
      include: {
        agentTasks: true,
        _count: {
          select: {
            agentTasks: true,
            queuedTasks: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: card,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Error creating card:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create card',
      },
      { status: 500 }
    );
  }
}
