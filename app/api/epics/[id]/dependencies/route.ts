import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Dependency creation schema
const createDependencySchema = z.object({
  dependsOnId: z.string().cuid(),
  type: z.enum(['BLOCKS', 'RELATES_TO', 'SIMILAR_TO']).default('BLOCKS'),
  description: z.string().optional(),
});

// GET /api/epics/[id]/dependencies - Get epic dependencies
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const epicId = params.id;

    // Get dependencies (what this epic depends on)
    const dependencies = await prisma.epicDependency.findMany({
      where: { epicId },
      include: {
        dependsOn: {
          select: {
            id: true,
            title: true,
            phase: true,
            status: true,
            mvpPriority: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get dependents (what depends on this epic)
    const dependents = await prisma.epicDependency.findMany({
      where: { dependsOnId: epicId },
      include: {
        epic: {
          select: {
            id: true,
            title: true,
            phase: true,
            status: true,
            mvpPriority: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        dependencies,
        dependents,
      },
    });
  } catch (error) {
    console.error('Error fetching epic dependencies:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch dependencies',
      },
      { status: 500 }
    );
  }
}

// POST /api/epics/[id]/dependencies - Add dependency
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const epicId = params.id;
    const body = await request.json();
    const validatedData = createDependencySchema.parse(body);

    // Verify both epics exist
    const [epic, dependsOnEpic] = await Promise.all([
      prisma.epic.findUnique({ where: { id: epicId } }),
      prisma.epic.findUnique({ where: { id: validatedData.dependsOnId } }),
    ]);

    if (!epic) {
      return NextResponse.json(
        {
          success: false,
          error: 'Epic not found',
        },
        { status: 404 }
      );
    }

    if (!dependsOnEpic) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dependency target epic not found',
        },
        { status: 404 }
      );
    }

    // Check for self-dependency
    if (epicId === validatedData.dependsOnId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Epic cannot depend on itself',
        },
        { status: 400 }
      );
    }

    // Check for circular dependencies
    const hasCircularDependency = await checkCircularDependency(
      validatedData.dependsOnId,
      epicId
    );

    if (hasCircularDependency) {
      return NextResponse.json(
        {
          success: false,
          error: 'Creating this dependency would cause a circular dependency',
        },
        { status: 400 }
      );
    }

    // Check if dependency already exists
    const existingDependency = await prisma.epicDependency.findUnique({
      where: {
        epicId_dependsOnId: {
          epicId,
          dependsOnId: validatedData.dependsOnId,
        },
      },
    });

    if (existingDependency) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dependency already exists',
        },
        { status: 400 }
      );
    }

    // Create dependency
    const dependency = await prisma.epicDependency.create({
      data: {
        epicId,
        ...validatedData,
      },
      include: {
        dependsOn: {
          select: {
            id: true,
            title: true,
            phase: true,
            status: true,
            mvpPriority: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: dependency,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating epic dependency:', error);

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
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create dependency',
      },
      { status: 500 }
    );
  }
}

// Helper function to detect circular dependencies
async function checkCircularDependency(
  startEpicId: string,
  targetEpicId: string
): Promise<boolean> {
  const visited = new Set<string>();
  const stack = [startEpicId];

  while (stack.length > 0) {
    const currentEpicId = stack.pop()!;

    if (currentEpicId === targetEpicId) {
      return true; // Circular dependency found
    }

    if (visited.has(currentEpicId)) {
      continue;
    }

    visited.add(currentEpicId);

    // Get all dependencies of current epic
    const dependencies = await prisma.epicDependency.findMany({
      where: { epicId: currentEpicId },
      select: { dependsOnId: true },
    });

    for (const dep of dependencies) {
      if (!visited.has(dep.dependsOnId)) {
        stack.push(dep.dependsOnId);
      }
    }
  }

  return false; // No circular dependency
}
