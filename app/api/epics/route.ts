import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { ProjectMetadataManager } from '@/lib/portable/metadata-manager';
import type { Epic } from '@/lib/portable/schemas';

// Epic creation schema - updated for portable format
const createEpicSchema = z.object({
  projectId: z.string(),
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

    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    
    let targetProjects = projects;
    if (projectId) {
      targetProjects = projects.filter(p => p.metadata.id === projectId);
      if (targetProjects.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
        });
      }
    }

    const allEpics: any[] = [];

    // Get epics from all target projects
    for (const project of targetProjects) {
      try {
        const metadataManager = new ProjectMetadataManager(project.path);
        const epics = await metadataManager.getEpics();
        const stories = await metadataManager.getStories();
        
        for (const epic of epics) {
          // Get stories for this epic
          const epicStories = stories.filter(s => s.epicId === epic.id);
          
          // Calculate progress
          const totalStories = epicStories.length;
          const completedStories = epicStories.filter(
            story => story.status === 'DONE'
          ).length;
          const totalStoryPoints = epicStories.reduce(
            (sum, story) => sum + (story.storyPoints || 0),
            0
          );
          const completedStoryPoints = epicStories
            .filter(story => story.status === 'DONE')
            .reduce((sum, story) => sum + (story.storyPoints || 0), 0);

          allEpics.push({
            ...epic,
            project: {
              id: project.metadata.id,
              name: project.metadata.name,
            },
            stories: epicStories.map(s => ({
              id: s.id,
              title: s.title,
              status: s.status,
              storyPoints: s.storyPoints,
            })),
            dependencies: [], // TODO: Implement epic dependencies in portable format
            dependents: [], // TODO: Implement epic dependencies in portable format
            _count: {
              stories: totalStories,
            },
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
          });
        }
      } catch (error) {
        console.warn(`Failed to get epics for project ${project.metadata.name}:`, error);
      }
    }

    // Sort epics by sequence and creation date
    allEpics.sort((a, b) => {
      if (a.sequence !== b.sequence) {
        return a.sequence - b.sequence;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      success: true,
      data: allEpics,
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

    // Find the target project
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    const project = projects.find(p => p.metadata.id === validatedData.projectId);

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    const metadataManager = new ProjectMetadataManager(project.path);
    
    // Create epic with portable format
    const now = new Date().toISOString();
    const epicId = `epic-${Date.now()}`;
    
    const epic: Epic = {
      id: epicId,
      projectId: validatedData.projectId,
      title: validatedData.title,
      description: validatedData.description,
      type: validatedData.type,
      phase: 'PLANNING',
      status: 'ACTIVE',
      mvpPriority: validatedData.mvpPriority,
      coreValue: validatedData.coreValue,
      estimatedStoryPoints: validatedData.estimatedStoryPoints,
      actualStoryPoints: 0,
      startDate: validatedData.startDate || null,
      dueDate: validatedData.dueDate || null,
      completedAt: null,
      sequence: validatedData.sequence,
      createdAt: now,
      updatedAt: now,
    };

    await metadataManager.saveEpic(epic);

    // Return epic with project info and count
    const response = {
      ...epic,
      project: {
        id: project.metadata.id,
        name: project.metadata.name,
      },
      _count: {
        stories: 0, // New epic has no stories yet
      },
    };

    return NextResponse.json(
      {
        success: true,
        data: response,
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
