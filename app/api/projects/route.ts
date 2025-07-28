import { NextRequest, NextResponse } from 'next/server';
import { prisma, ProjectStatus } from '@/lib/db';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  gitUrl: z.string().url().optional(),
  localPath: z.string().min(1, 'Local path is required'),
});

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
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
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch projects',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createProjectSchema.parse(body);

    const project = await prisma.project.create({
      data: {
        ...validatedData,
        status: ProjectStatus.ACTIVE,
      },
      include: {
        kanbanCards: true,
        _count: {
          select: {
            kanbanCards: true,
            tokenUsage: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: project,
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

    console.error('Error creating project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create project',
      },
      { status: 500 }
    );
  }
}