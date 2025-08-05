import { NextRequest, NextResponse } from 'next/server';
import { ProjectManagerAgent } from '@/lib/agents/project-manager';
import { prisma } from '@/lib/db';

interface GenerateEpicsParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: GenerateEpicsParams
) {
  try {
    const { id: projectId } = await params;

    // Validate project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        epics: {
          where: { status: 'ACTIVE' },
          select: { id: true, title: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if project already has epics
    if (project.epics.length > 0) {
      return NextResponse.json(
        {
          error: 'Project already has epics',
          message: `This project already has ${project.epics.length} active epic(s). Use the feature request system to add new epics.`,
          existingEpics: project.epics.map(epic => ({
            id: epic.id,
            title: epic.title,
          })),
        },
        { status: 409 }
      );
    }

    console.log(`🚀 Starting epic generation for project: ${project.name}`);

    // Initialize project manager
    const projectManager = new ProjectManagerAgent();

    // TODO: Generate epics and stories
    // const result = await projectManager.analyzeExistingProjectAndGenerateEpics(
    //   projectId
    // );

    // TODO: Implement epic generation
    return NextResponse.json(
      {
        error: 'Epic generation not implemented yet',
        details: 'This feature is still under development',
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('Epic generation endpoint error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check if epics can be generated
export async function GET(
  request: NextRequest,
  { params }: GenerateEpicsParams
) {
  try {
    const { id: projectId } = await params;

    // Check project exists and epic status
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        epics: {
          where: { status: 'ACTIVE' },
          select: { id: true, title: true },
        },
        kanbanCards: {
          select: { id: true, status: true },
        },
        _count: {
          select: {
            epics: true,
            kanbanCards: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const canGenerate = project.epics.length === 0;
    const hasStories = project.kanbanCards.length > 0;

    return NextResponse.json({
      canGenerate,
      reason: canGenerate
        ? 'No active epics found - generation available'
        : 'Project already has active epics',
      projectInfo: {
        id: project.id,
        name: project.name,
        language: project.language,
        framework: project.framework,
        activeEpicsCount: project.epics.length,
        totalStoriesCount: project._count.kanbanCards,
        hasExistingStories: hasStories,
      },
      existingEpics: project.epics.map(epic => ({
        id: epic.id,
        title: epic.title,
      })),
    });
  } catch (error) {
    console.error('Epic generation check error:', error);

    return NextResponse.json(
      {
        error: 'Failed to check epic generation status',
        details:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}