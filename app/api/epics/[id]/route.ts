import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { ProjectMetadataManager } from '@/lib/portable/metadata-manager';
import type { Epic } from '@/lib/portable/schemas';

// Epic update schema
const updateEpicSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  type: z.enum(['MVP', 'ENHANCEMENT', 'FEATURE', 'BUGFIX']).optional(),
  phase: z.enum(['PLANNING', 'IN_PROGRESS', 'DONE', 'CANCELLED']).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
  mvpPriority: z
    .enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'FUTURE'])
    .optional(),
  coreValue: z.string().optional(),
  estimatedStoryPoints: z.number().int().min(0).optional(),
  actualStoryPoints: z.number().int().min(0).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  sequence: z.number().int().min(0).optional(),
});

// GET /api/epics/[id] - Get epic details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const epicId = params.id;

    // Find the epic across all projects
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    
    let epic: Epic | null = null;
    let project: any = null;
    
    for (const p of projects) {
      try {
        const metadataManager = new ProjectMetadataManager(p.path);
        const foundEpic = await metadataManager.getEpic(epicId);
        if (foundEpic) {
          epic = foundEpic;
          project = p;
          break;
        }
      } catch (error) {
        // Continue searching other projects
      }
    }

    if (!epic || !project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Epic not found',
        },
        { status: 404 }
      );
    }

    // Get stories and cycles for this epic
    const metadataManager = new ProjectMetadataManager(project.path);
    const allStories = await metadataManager.getStories();
    const allCycles = await metadataManager.getCycles();
    
    const epicStories = allStories.filter(s => s.epicId === epic.id);
    
    // Enhance stories with cycles and dependencies
    const storiesWithDetails = epicStories.map(story => {
      const storyCycles = allCycles.filter(c => c.storyId === story.id);
      return {
        ...story,
        cycles: storyCycles.map(c => ({
          id: c.id,
          title: c.title,
          phase: c.phase,
          status: c.status,
        })),
        dependencies: [], // TODO: Implement story dependencies in portable format
        dependents: [], // TODO: Implement story dependencies in portable format
      };
    });

    // Calculate detailed progress
    const totalStories = storiesWithDetails.length;
    const storiesByStatus = storiesWithDetails.reduce(
      (acc, story) => {
        acc[story.status] = (acc[story.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalStoryPoints = storiesWithDetails.reduce(
      (sum, story) => sum + (story.storyPoints || 0),
      0
    );
    const completedStoryPoints = storiesWithDetails
      .filter(story => story.status === 'DONE')
      .reduce((sum, story) => sum + (story.storyPoints || 0), 0);

    // Calculate TDD cycles progress
    const totalCycles = storiesWithDetails.reduce(
      (sum, story) => sum + story.cycles.length,
      0
    );
    const completedCycles = storiesWithDetails.reduce(
      (sum, story) =>
        sum + story.cycles.filter(cycle => cycle.status === 'COMPLETED').length,
      0
    );

    const epicWithProgress = {
      ...epic,
      project: {
        id: project.metadata.id,
        name: project.metadata.name,
      },
      stories: storiesWithDetails,
      dependencies: [], // TODO: Implement epic dependencies in portable format
      dependents: [], // TODO: Implement epic dependencies in portable format
      progress: {
        stories: {
          total: totalStories,
          byStatus: storiesByStatus,
          completed: storiesByStatus.DONE || 0,
          percentage:
            totalStories > 0
              ? Math.round(((storiesByStatus.DONE || 0) / totalStories) * 100)
              : 0,
        },
        storyPoints: {
          total: totalStoryPoints,
          completed: completedStoryPoints,
          percentage:
            totalStoryPoints > 0
              ? Math.round((completedStoryPoints / totalStoryPoints) * 100)
              : 0,
        },
        cycles: {
          total: totalCycles,
          completed: completedCycles,
          percentage:
            totalCycles > 0
              ? Math.round((completedCycles / totalCycles) * 100)
              : 0,
        },
      },
    };

    return NextResponse.json({
      success: true,
      data: epicWithProgress,
    });
  } catch (error) {
    console.error('Error fetching epic:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch epic',
      },
      { status: 500 }
    );
  }
}

// PUT /api/epics/[id] - Update epic
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const epicId = params.id;
    const body = await request.json();
    const validatedData = updateEpicSchema.parse(body);

    // Find the epic across all projects
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    
    let existingEpic: Epic | null = null;
    let project: any = null;
    let metadataManager: ProjectMetadataManager | null = null;
    
    for (const p of projects) {
      try {
        const manager = new ProjectMetadataManager(p.path);
        const foundEpic = await manager.getEpic(epicId);
        if (foundEpic) {
          existingEpic = foundEpic;
          project = p;
          metadataManager = manager;
          break;
        }
      } catch (error) {
        // Continue searching other projects
      }
    }

    if (!existingEpic || !project || !metadataManager) {
      return NextResponse.json(
        {
          success: false,
          error: 'Epic not found',
        },
        { status: 404 }
      );
    }

    // Update epic with new data
    const now = new Date().toISOString();
    const updatedEpic: Epic = {
      ...existingEpic,
      ...validatedData,
      updatedAt: now,
    };

    // Set completedAt when phase changes to DONE
    if (validatedData.phase === 'DONE' && existingEpic.phase !== 'DONE') {
      updatedEpic.completedAt = now;
    } else if (validatedData.phase && validatedData.phase !== 'DONE') {
      updatedEpic.completedAt = null;
    }

    await metadataManager.saveEpic(updatedEpic);

    // Get story count for response
    const allStories = await metadataManager.getStories();
    const epicStories = allStories.filter(s => s.epicId === epicId);

    const response = {
      ...updatedEpic,
      project: {
        id: project.metadata.id,
        name: project.metadata.name,
      },
      _count: {
        stories: epicStories.length,
      },
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating epic:', error);

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
        error: error instanceof Error ? error.message : 'Failed to update epic',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/epics/[id] - Delete epic
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const epicId = params.id;

    // Find the epic across all projects
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    
    let existingEpic: Epic | null = null;
    let project: any = null;
    let metadataManager: ProjectMetadataManager | null = null;
    
    for (const p of projects) {
      try {
        const manager = new ProjectMetadataManager(p.path);
        const foundEpic = await manager.getEpic(epicId);
        if (foundEpic) {
          existingEpic = foundEpic;
          project = p;
          metadataManager = manager;
          break;
        }
      } catch (error) {
        // Continue searching other projects
      }
    }

    if (!existingEpic || !project || !metadataManager) {
      return NextResponse.json(
        {
          success: false,
          error: 'Epic not found',
        },
        { status: 404 }
      );
    }

    // Get stories associated with this epic
    const allStories = await metadataManager.getStories();
    const epicStories = allStories.filter(s => s.epicId === epicId);

    // TODO: Check epic dependencies when implemented
    // For now, we'll proceed with deletion

    // If epic has stories, unlink them (set epicId to undefined)
    if (epicStories.length > 0) {
      for (const story of epicStories) {
        const updatedStory = { ...story, epicId: undefined };
        await metadataManager.saveStory(updatedStory);
      }
    }

    // Delete the epic
    await metadataManager.deleteEpic(epicId);

    return NextResponse.json({
      success: true,
      message: 'Epic deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting epic:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete epic',
      },
      { status: 500 }
    );
  }
}
