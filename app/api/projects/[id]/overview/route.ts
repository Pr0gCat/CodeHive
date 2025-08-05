import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type {
  ProjectWithRelations,
  EpicWithRelations,
  StoryWithRelations,
  StoryWithCycles,
  ProjectStatistics,
  HierarchicalData,
  MVPPhaseProgress,
  Blocker,
  EpicBlocker,
  StoryBlocker,
  HierarchicalEpic,
  HierarchicalStory,
} from './types';
import type { MVPPhase } from '@prisma/client';

// GET /api/projects/[id]/overview - Get complete project overview with all layers
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    // Get complete project data with all relationships
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        // Epics with their stories and cycles
        epics: {
          include: {
            stories: {
              include: {
                cycles: {
                  select: {
                    id: true,
                    title: true,
                    phase: true,
                    status: true,
                  },
                },
                dependencies: {
                  include: {
                    dependsOn: {
                      select: {
                        id: true,
                        title: true,
                        status: true,
                        epicId: true,
                      },
                    },
                  },
                },
              },
              orderBy: { sequence: 'asc' },
            },
            dependencies: {
              include: {
                dependsOn: {
                  select: {
                    id: true,
                    title: true,
                    phase: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: { sequence: 'asc' },
        },
        // MVP Phases
        mvpPhases: {
          orderBy: { sequence: 'asc' },
        },
        // Standalone stories (not assigned to epics)
        kanbanCards: {
          where: { epicId: null },
          include: {
            cycles: {
              select: {
                id: true,
                title: true,
                phase: true,
                status: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
        // All cycles for overall stats
        cycles: {
          select: {
            id: true,
            phase: true,
            status: true,
            storyId: true,
          },
        },
        // Recent queries
        queries: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            type: true,
            title: true,
            urgency: true,
            createdAt: true,
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

    // Type assertion for project with all required relations
    const projectWithRelations = project as ProjectWithRelations;

    // Calculate comprehensive statistics
    const stats = calculateProjectStats(projectWithRelations);

    // Organize data by hierarchy
    const hierarchicalData = organizeHierarchicalData(projectWithRelations);

    // Calculate MVP phase progress
    const mvpPhaseProgress = calculateMVPPhaseProgress(
      projectWithRelations.mvpPhases,
      projectWithRelations.epics
    );

    // Identify blockers and risks
    const blockers = identifyBlockers(projectWithRelations.epics);

    return NextResponse.json({
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          summary: project.summary,
          status: project.status,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
        hierarchy: hierarchicalData,
        mvpPhases: mvpPhaseProgress,
        statistics: stats,
        blockers,
        recentQueries: project.queries,
      },
    });
  } catch (error) {
    console.error('Error fetching project overview:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch project overview',
      },
      { status: 500 }
    );
  }
}

function calculateProjectStats(
  project: ProjectWithRelations
): ProjectStatistics {
  const epics = project.epics || [];
  const standaloneStories = project.kanbanCards || [];
  const cycles = project.cycles || [];

  // Epic statistics
  const epicStats = {
    total: epics.length,
    byPhase: epics.reduce((acc: Record<string, number>, epic) => {
      acc[epic.phase] = (acc[epic.phase] || 0) + 1;
      return acc;
    }, {}),
    byPriority: epics.reduce((acc: Record<string, number>, epic) => {
      acc[epic.mvpPriority] = (acc[epic.mvpPriority] || 0) + 1;
      return acc;
    }, {}),
  };

  // Story statistics
  const allStories: (StoryWithRelations | StoryWithCycles)[] = [
    ...epics.flatMap(epic => epic.stories),
    ...standaloneStories,
  ];
  const storyStats = {
    total: allStories.length,
    withEpics: epics.reduce((sum, epic) => sum + epic.stories.length, 0),
    standalone: standaloneStories.length,
    byStatus: allStories.reduce((acc: Record<string, number>, story) => {
      acc[story.status] = (acc[story.status] || 0) + 1;
      return acc;
    }, {}),
    totalStoryPoints: allStories.reduce(
      (sum, story) => sum + (story.storyPoints || 0),
      0
    ),
    completedStoryPoints: allStories
      .filter(story => story.status === 'DONE')
      .reduce((sum, story) => sum + (story.storyPoints || 0), 0),
  };

  // TDD Cycle statistics
  const cycleStats = {
    total: cycles.length,
    byPhase: cycles.reduce((acc: Record<string, number>, cycle) => {
      acc[cycle.phase] = (acc[cycle.phase] || 0) + 1;
      return acc;
    }, {}),
    byStatus: cycles.reduce((acc: Record<string, number>, cycle) => {
      acc[cycle.status] = (acc[cycle.status] || 0) + 1;
      return acc;
    }, {}),
  };

  // Overall progress
  const overallProgress = {
    epics:
      epicStats.total > 0
        ? Math.round(((epicStats.byPhase.DONE || 0) / epicStats.total) * 100)
        : 0,
    stories:
      storyStats.total > 0
        ? Math.round(((storyStats.byStatus.DONE || 0) / storyStats.total) * 100)
        : 0,
    storyPoints:
      storyStats.totalStoryPoints > 0
        ? Math.round(
            (storyStats.completedStoryPoints / storyStats.totalStoryPoints) *
              100
          )
        : 0,
    cycles:
      cycleStats.total > 0
        ? Math.round(
            ((cycleStats.byStatus.COMPLETED || 0) / cycleStats.total) * 100
          )
        : 0,
  };

  return {
    epics: epicStats,
    stories: storyStats,
    cycles: cycleStats,
    progress: overallProgress,
  };
}

function organizeHierarchicalData(
  project: ProjectWithRelations
): HierarchicalData {
  return {
    epics: project.epics.map(
      (epic): HierarchicalEpic => ({
        id: epic.id,
        title: epic.title,
        type: epic.type,
        phase: epic.phase,
        status: epic.status,
        mvpPriority: epic.mvpPriority,
        progress: {
          stories: {
            total: epic.stories.length,
            completed: epic.stories.filter(s => s.status === 'DONE').length,
          },
          cycles: {
            total: epic.stories.reduce((sum, s) => sum + s.cycles.length, 0),
            completed: epic.stories.reduce(
              (sum, s) =>
                sum + s.cycles.filter(c => c.status === 'COMPLETED').length,
              0
            ),
          },
        },
        stories: epic.stories.map(
          (story): HierarchicalStory => ({
            id: story.id,
            title: story.title,
            status: story.status,
            storyPoints: story.storyPoints,
            tddEnabled: story.tddEnabled,
            cycles: story.cycles,
            hasBlockers: story.dependencies.some(
              dep => dep.dependsOn.status !== 'DONE'
            ),
          })
        ),
        dependencies: epic.dependencies,
      })
    ),
    standaloneStories: project.kanbanCards.map(story => ({
      id: story.id,
      title: story.title,
      status: story.status,
      storyPoints: story.storyPoints,
      tddEnabled: story.tddEnabled,
      cycles: story.cycles,
    })),
  };
}

function calculateMVPPhaseProgress(
  mvpPhases: MVPPhase[],
  epics: EpicWithRelations[]
): MVPPhaseProgress[] {
  return mvpPhases.map((phase): MVPPhaseProgress => {
    const coreFeatureIds = JSON.parse(phase.coreFeatures || '[]') as string[];
    const coreEpics = epics.filter(epic => coreFeatureIds.includes(epic.id));

    const totalStories = coreEpics.reduce(
      (sum, epic) => sum + epic.stories.length,
      0
    );
    const completedStories = coreEpics.reduce(
      (sum, epic) => sum + epic.stories.filter(s => s.status === 'DONE').length,
      0
    );

    return {
      ...phase,
      progress: {
        epics: {
          total: coreEpics.length,
          completed: coreEpics.filter(epic => epic.phase === 'DONE').length,
        },
        stories: {
          total: totalStories,
          completed: completedStories,
          percentage:
            totalStories > 0
              ? Math.round((completedStories / totalStories) * 100)
              : 0,
        },
      },
      coreEpics: coreEpics.map(epic => ({
        id: epic.id,
        title: epic.title,
        phase: epic.phase,
        status: epic.status,
      })),
    };
  });
}

function identifyBlockers(epics: EpicWithRelations[]): Blocker[] {
  const blockers: Blocker[] = [];

  for (const epic of epics) {
    // Check epic-level dependencies
    const blockedBy = epic.dependencies.filter(
      dep => dep.dependsOn.phase !== 'DONE'
    );
    if (blockedBy.length > 0) {
      const epicBlocker: EpicBlocker = {
        type: 'epic',
        id: epic.id,
        title: epic.title,
        blockedBy: blockedBy.map(dep => ({
          id: dep.dependsOn.id,
          title: dep.dependsOn.title,
          phase: dep.dependsOn.phase,
        })),
      };
      blockers.push(epicBlocker);
    }

    // Check story-level dependencies
    for (const story of epic.stories) {
      const storyBlockers =
        story.dependencies?.filter(dep => dep.dependsOn.status !== 'DONE') ||
        [];
      if (storyBlockers.length > 0) {
        const storyBlocker: StoryBlocker = {
          type: 'story',
          id: story.id,
          title: story.title,
          epicId: epic.id,
          epicTitle: epic.title,
          blockedBy: storyBlockers.map(dep => ({
            id: dep.dependsOn.id,
            title: dep.dependsOn.title,
            status: dep.dependsOn.status,
            epicId: dep.dependsOn.epicId,
          })),
        };
        blockers.push(storyBlocker);
      }
    }
  }

  return blockers;
}
