import {
    FeatureRequestAnalysis,
    ProjectManagerAgent,
} from '@/lib/project-manager';
import { prisma } from '@/lib/db';
import { TDDCycleEngine } from '@/lib/tdd/cycle-engine';

export interface FeatureRequestResult {
  success: boolean;
  epicId?: string;
  storyIds?: string[];
  cycleIds?: string[];
  analysis?: FeatureRequestAnalysis;
  error?: string;
  executionTime: number;
}

/**
 * Feature Request Processor - converts natural language requests into Epic/Story/Cycle structure
 */
export class FeatureRequestProcessor {
  private projectManager: ProjectManagerAgent;

  constructor() {
    this.projectManager = new ProjectManagerAgent();
  }

  /**
   * Process a complete feature request from natural language to implemented structure
   */
  async processCompleteFeatureRequest(
    request: string,
    projectId: string,
    options: {
      autoCreateCycles?: boolean;
      updateClaudeMd?: boolean;
    } = {}
  ): Promise<FeatureRequestResult> {
    const startTime = Date.now();
    const { autoCreateCycles = true, updateClaudeMd = true } = options;

    try {
      console.log(`🚀 Processing complete feature request: "${request}"`);

      // Validate project exists
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return {
          success: false,
          error: 'Project not found',
          executionTime: Date.now() - startTime,
        };
      }

      // Step 1: Analyze the feature request
      const analysis = await this.projectManager.processFeatureRequest(
        request,
        projectId
      );

      // Step 2: Create Epic from analysis
      const epicId = await this.projectManager.createEpicFromRequest(
        analysis,
        projectId
      );

      // Step 3: Break down Epic into Stories
      const storyIds = await this.projectManager.breakdownEpicToStories(
        epicId,
        analysis.stories
      );

      // Step 4: Optionally create TDD Cycles for each Story
      const cycleIds: string[] = [];
      if (autoCreateCycles) {
        for (const storyId of storyIds) {
          const story = await prisma.kanbanCard.findUnique({
            where: { id: storyId },
          });

          if (story && story.acceptanceCriteria) {
            try {
              const tddEngine = new TDDCycleEngine(
                projectId,
                project.localPath
              );
              const cycle = await tddEngine.startCycle({
                title: story.title,
                description: story.description || '',
                acceptanceCriteria: JSON.parse(story.acceptanceCriteria),
                projectId,
              });

              // Link cycle to story
              await prisma.cycle.update({
                where: { id: cycle.id },
                data: { storyId },
              });

              cycleIds.push(cycle.id);
              console.log(`Created TDD Cycle for story: ${story.title}`);
            } catch (cycleError) {
              console.error(
                `Failed to create cycle for story ${story.title}:`,
                cycleError
              );
              // Continue with other stories even if one fails
            }
          }
        }
      }

      // Step 5: Update project CLAUDE.md with new context
      if (updateClaudeMd) {
        try {
          await this.projectManager.maintainProjectClaudeMd(projectId);
        } catch (claudeError) {
          console.error('Failed to update CLAUDE.md:', claudeError);
          // Don't fail the entire process for CLAUDE.md update
        }
      }

      const executionTime = Date.now() - startTime;

      console.log(
        `🎉 Feature request processed successfully in ${executionTime}ms`
      );
      console.log(
        `📋 Created: 1 Epic, ${storyIds.length} Stories, ${cycleIds.length} Cycles`
      );

      return {
        success: true,
        epicId,
        storyIds,
        cycleIds,
        analysis,
        executionTime,
      };
    } catch (error) {
      console.error('Error processing feature request:', error);

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get the current backlog status for a project
   */
  async getProjectBacklogStatus(projectId: string): Promise<{
    activeEpics: number;
    totalStories: number;
    completedStories: number;
    activeCycles: number;
    progress: number;
  }> {
    try {
      const [epics, stories, cycles] = await Promise.all([
        prisma.epic.count({
          where: { projectId, status: 'ACTIVE' },
        }),
        prisma.kanbanCard.findMany({
          where: { projectId },
          select: { status: true },
        }),
        prisma.cycle.count({
          where: { projectId, status: 'ACTIVE' },
        }),
      ]);

      const totalStories = stories.length;
      const completedStories = stories.filter(s => s.status === 'DONE').length;
      const progress =
        totalStories > 0
          ? Math.round((completedStories / totalStories) * 100)
          : 0;

      return {
        activeEpics: epics,
        totalStories,
        completedStories,
        activeCycles: cycles,
        progress,
      };
    } catch (error) {
      console.error('Error getting backlog status:', error);
      return {
        activeEpics: 0,
        totalStories: 0,
        completedStories: 0,
        activeCycles: 0,
        progress: 0,
      };
    }
  }

  /**
   * Prioritize and reorder Epic/Story backlog based on project context
   */
  async optimizeBacklog(projectId: string): Promise<{
    reorderedEpics: number;
    reorderedStories: number;
  }> {
    try {
      console.log(`🎯 Optimizing backlog for project: ${projectId}`);

      // Get all active Epics with their Stories
      const epics = await prisma.epic.findMany({
        where: { projectId, status: 'ACTIVE' },
        include: {
          stories: {
            orderBy: { sequence: 'asc' },
          },
        },
        orderBy: { sequence: 'asc' },
      });

      let reorderedEpics = 0;
      let reorderedStories = 0;

      // Reorder Epics by MVP priority
      const priorityOrder = {
        CRITICAL: 0,
        HIGH: 1,
        MEDIUM: 2,
        LOW: 3,
        FUTURE: 4,
      };

      const sortedEpics = epics.sort((a, b) => {
        const priorityA =
          priorityOrder[a.mvpPriority as keyof typeof priorityOrder] ?? 5;
        const priorityB =
          priorityOrder[b.mvpPriority as keyof typeof priorityOrder] ?? 5;
        return priorityA - priorityB;
      });

      // Update Epic sequences
      for (let i = 0; i < sortedEpics.length; i++) {
        if (sortedEpics[i].sequence !== i) {
          await prisma.epic.update({
            where: { id: sortedEpics[i].id },
            data: { sequence: i },
          });
          reorderedEpics++;
        }

        // Reorder Stories within each Epic by priority
        const sortedStories = sortedEpics[i].stories.sort((a, b) => {
          const priorityA =
            priorityOrder[a.priority as keyof typeof priorityOrder] ?? 5;
          const priorityB =
            priorityOrder[b.priority as keyof typeof priorityOrder] ?? 5;
          return priorityA - priorityB;
        });

        // Update Story sequences
        for (let j = 0; j < sortedStories.length; j++) {
          if (sortedStories[j].sequence !== j) {
            await prisma.kanbanCard.update({
              where: { id: sortedStories[j].id },
              data: { sequence: j, position: j },
            });
            reorderedStories++;
          }
        }
      }

      console.log(
        `Backlog optimized: ${reorderedEpics} Epics, ${reorderedStories} Stories reordered`
      );

      return { reorderedEpics, reorderedStories };
    } catch (error) {
      console.error('Error optimizing backlog:', error);
      return { reorderedEpics: 0, reorderedStories: 0 };
    }
  }

  /**
   * Validate that a feature request is clear and actionable
   */
  validateFeatureRequest(request: string): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check minimum length
    if (request.length < 10) {
      issues.push('Request is too short to analyze properly');
      suggestions.push('Provide more details about what you want to achieve');
    }

    // Check for vague language
    const vagueWords = ['something', 'stuff', 'thing', 'maybe', 'possibly'];
    const hasVagueWords = vagueWords.some(word =>
      request.toLowerCase().includes(word)
    );

    if (hasVagueWords) {
      issues.push('Request contains vague language');
      suggestions.push('Be more specific about what you want to build');
    }

    // Check for action words
    const actionWords = [
      'add',
      'create',
      'build',
      'implement',
      'make',
      'develop',
      'want',
      'need',
    ];
    const hasActionWords = actionWords.some(word =>
      request.toLowerCase().includes(word)
    );

    if (!hasActionWords) {
      issues.push('Request should clearly state what you want to do');
      suggestions.push(
        'Start with words like "I want to add..." or "I need to create..."'
      );
    }

    // Check for reasonable length
    if (request.length > 500) {
      issues.push('Request is very long and might be unclear');
      suggestions.push('Try to focus on one main feature at a time');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }
}
