import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { ProjectMetadataManager } from '@/lib/portable/metadata-manager';
import type { Story } from '@/lib/portable/schemas';
// TODO: Migrate project access control to portable format
// import { checkProjectOperationAccess } from '@/lib/project-access-control';
// import { projectLogger } from '@/lib/logging/project-logger';

const createCardSchema = z.object({
  title: z.string().min(1, 'Card title is required'),
  description: z.string().optional(),
  status: z
    .enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'])
    .default('BACKLOG'),
  assignedAgent: z.string().optional(),
  position: z.number().optional(), // Frontend sends this but we calculate our own
  epicId: z.string().optional(), // Link to epic
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
    const projectId = params.id;
    
    // Find the project
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    const project = projects.find(p => p.metadata.id === projectId);
    
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
    
    // Get stories (kanban cards)
    const stories = await metadataManager.getStories();
    const epics = await metadataManager.getEpics();
    const cycles = await metadataManager.getCycles();
    
    // Enhance stories with epic and cycle information
    const enhancedCards = stories.map(story => {
      const epic = story.epicId ? epics.find(e => e.id === story.epicId) : null;
      const storyCycles = cycles.filter(c => c.storyId === story.id);
      
      return {
        ...story,
        epic: epic ? {
          id: epic.id,
          title: epic.title,
          type: epic.type,
          phase: epic.phase,
          mvpPriority: epic.mvpPriority,
        } : null,
        cycles: storyCycles.map(c => ({
          id: c.id,
          title: c.title,
          phase: c.phase,
          status: c.status,
        })),
        agentTasks: [], // TODO: Implement agent tasks in portable format
        _count: {
          agentTasks: 0, // TODO: Count agent tasks when implemented
          queuedTasks: 0, // TODO: Count queued tasks when implemented
        },
      };
    });
    
    // Sort by position
    enhancedCards.sort((a, b) => a.position - b.position);

    return NextResponse.json({
      success: true,
      data: enhancedCards,
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
    const projectId = params.id;

    // Find the project
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    const project = projects.find(p => p.metadata.id === projectId);
    
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

    // Get the next position for the card
    const existingStories = await metadataManager.getStories();
    const lastPosition = Math.max(0, ...existingStories.map(s => s.position));
    const nextPosition = (validatedData.position ?? lastPosition) + 1;

    // Create the story/card
    const now = new Date().toISOString();
    const storyId = `story-${Date.now()}`;
    
    const story: Story = {
      id: storyId,
      epicId: validatedData.epicId,
      sprintId: undefined,
      title: validatedData.title,
      description: validatedData.description,
      status: validatedData.status,
      position: nextPosition,
      assignedAgent: validatedData.assignedAgent,
      targetBranch: undefined,
      storyPoints: validatedData.storyPoints,
      priority: validatedData.priority,
      sequence: nextPosition,
      tddEnabled: validatedData.tddEnabled,
      acceptanceCriteria: validatedData.acceptanceCriteria,
      createdAt: now,
      updatedAt: now,
      dependencies: [],
      dependents: [],
    };

    await metadataManager.saveStory(story);

    // TODO: Log the card creation when project logger is migrated
    // projectLogger.info(
    //   params.id,
    //   'kanban-card-create',
    //   `📋 New card created: "${story.title}"`,
    //   {
    //     action: 'card_created',
    //     cardId: story.id,
    //     cardTitle: story.title,
    //     updateSource: 'manual'
    //   }
    // );

    // Return enhanced card data
    const response = {
      ...story,
      agentTasks: [], // TODO: Implement agent tasks in portable format
      _count: {
        agentTasks: 0,
        queuedTasks: 0,
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
