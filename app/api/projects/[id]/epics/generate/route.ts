import { NextRequest, NextResponse } from 'next/server';
import { ProjectManagerAgent } from '@/lib/project-manager';
import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { ProjectMetadataManager } from '@/lib/portable/metadata-manager';

interface GenerateEpicsParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: GenerateEpicsParams
) {
  try {
    const { id: projectId } = await params;

    // Find the project
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    const project = projects.find(p => p.metadata.id === projectId);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if project already has epics
    const metadataManager = new ProjectMetadataManager(project.path);
    const existingEpics = await metadataManager.getEpics();
    const activeEpics = existingEpics.filter(epic => epic.status === 'ACTIVE');
    
    if (activeEpics.length > 0) {
      return NextResponse.json(
        {
          error: 'Project already has epics',
          message: `This project already has ${activeEpics.length} active epic(s). Use the feature request system to add new epics.`,
          existingEpics: activeEpics.map(epic => ({
            id: epic.id,
            title: epic.title,
          })),
        },
        { status: 409 }
      );
    }

    console.log(`🚀 Starting epic generation for project: ${project.metadata.name}`);

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

    // Find the project
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    const project = projects.find(p => p.metadata.id === projectId);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get project epics and stories
    const metadataManager = new ProjectMetadataManager(project.path);
    const existingEpics = await metadataManager.getEpics();
    const activeEpics = existingEpics.filter(epic => epic.status === 'ACTIVE');
    const allStories = await metadataManager.getStories();
    
    const canGenerate = activeEpics.length === 0;
    const hasStories = allStories.length > 0;

    return NextResponse.json({
      canGenerate,
      reason: canGenerate
        ? 'No active epics found - generation available'
        : 'Project already has active epics',
      projectInfo: {
        id: project.metadata.id,
        name: project.metadata.name,
        language: project.metadata.language,
        framework: project.metadata.framework,
        activeEpicsCount: activeEpics.length,
        totalStoriesCount: allStories.length,
        hasExistingStories: hasStories,
      },
      existingEpics: activeEpics.map(epic => ({
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