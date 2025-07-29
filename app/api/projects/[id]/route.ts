import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logProjectEvent } from '@/lib/logging/project-logger';
import { z } from 'zod';

const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').optional(),
  description: z.string().optional(),
  gitUrl: z.string().url().optional(),
  localPath: z.string().min(1, 'Local path is required').optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        kanbanCards: {
          orderBy: { position: 'asc' },
        },
        tokenUsage: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
        queuedTasks: {
          where: { status: 'PENDING' },
          orderBy: { priority: 'desc' },
        },
        milestones: {
          orderBy: { dueDate: 'asc' },
        },
        agentSpecs: {
          orderBy: { updatedAt: 'desc' },
        },
        _count: {
          select: {
            kanbanCards: true,
            tokenUsage: true,
            queuedTasks: true,
          },
        },
      },
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

    return NextResponse.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch project',
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
    const validatedData = updateProjectSchema.parse(body);

    const project = await prisma.project.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        kanbanCards: {
          orderBy: { position: 'asc' },
        },
        _count: {
          select: {
            kanbanCards: true,
            tokenUsage: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: project,
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

    console.error('Error updating project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update project',
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
    // Get project name before deleting for logging
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { name: true }
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    await prisma.project.delete({
      where: { id: params.id },
    });

    // Log the project deletion
    logProjectEvent.projectDeleted(params.id, project.name);

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete project',
      },
      { status: 500 }
    );
  }
}