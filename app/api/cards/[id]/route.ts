import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { projectLogger } from '@/lib/logging/project-logger';
import { z } from 'zod';

const updateCardSchema = z.object({
  title: z.string().min(1, 'Card title is required').optional(),
  description: z.string().optional(),
  status: z
    .enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'])
    .optional(),
  position: z.number().int().min(0).optional(),
  assignedAgent: z.string().optional(),
  epicId: z.string().cuid().optional().nullable(),
  storyPoints: z.number().int().min(0).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  tddEnabled: z.boolean().optional(),
  acceptanceCriteria: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const card = await prisma.kanbanCard.findUnique({
      where: { id: params.id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        agentTasks: {
          orderBy: { createdAt: 'desc' },
        },
        queuedTasks: {
          where: { status: 'PENDING' },
          orderBy: { priority: 'desc' },
        },
        _count: {
          select: {
            agentTasks: true,
            queuedTasks: true,
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: card,
    });
  } catch (error) {
    console.error('Error fetching card:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch card',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validatedData = updateCardSchema.parse(body);

    // If position is being updated, handle reordering
    if (validatedData.position !== undefined) {
      const card = await prisma.kanbanCard.findUnique({
        where: { id: params.id },
        select: { projectId: true, position: true },
      });

      if (!card) {
        return NextResponse.json(
          {
            success: false,
            error: 'Card not found',
          },
          { status: 404 }
        );
      }

      const oldPosition = card.position;
      const newPosition = validatedData.position;

      // Update positions of other cards
      if (newPosition > oldPosition) {
        // Moving down: decrement positions between old and new
        await prisma.kanbanCard.updateMany({
          where: {
            projectId: card.projectId,
            position: {
              gt: oldPosition,
              lte: newPosition,
            },
          },
          data: {
            position: { decrement: 1 },
          },
        });
      } else if (newPosition < oldPosition) {
        // Moving up: increment positions between new and old
        await prisma.kanbanCard.updateMany({
          where: {
            projectId: card.projectId,
            position: {
              gte: newPosition,
              lt: oldPosition,
            },
          },
          data: {
            position: { increment: 1 },
          },
        });
      }
    }

    const updatedCard = await prisma.kanbanCard.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
          },
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
    });

    // Log the card update
    const changes = Object.keys(validatedData);
    projectLogger.info(
      updatedCard.project.id,
      'kanban',
      `Card "${updatedCard.title}" updated (${changes.join(', ')})`,
      { cardId: params.id, changes: validatedData }
    );

    return NextResponse.json({
      success: true,
      data: updatedCard,
    });
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

    console.error('Error updating card:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update card',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const card = await prisma.kanbanCard.findUnique({
      where: { id: params.id },
      select: { projectId: true, position: true, title: true },
    });

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card not found',
        },
        { status: 404 }
      );
    }

    // Delete the card
    await prisma.kanbanCard.delete({
      where: { id: params.id },
    });

    // Update positions of remaining cards
    await prisma.kanbanCard.updateMany({
      where: {
        projectId: card.projectId,
        position: { gt: card.position },
      },
      data: {
        position: { decrement: 1 },
      },
    });

    // Log the card deletion
    projectLogger.info(
      card.projectId,
      'kanban',
      `Card "${card.title}" deleted`,
      { cardId: params.id }
    );

    return NextResponse.json({
      success: true,
      message: 'Card deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting card:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete card',
      },
      { status: 500 }
    );
  }
}
