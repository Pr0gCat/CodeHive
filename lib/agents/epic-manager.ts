/**
 * Epic Management System
 * 
 * Provides comprehensive Epic creation, management, and coordination capabilities
 * for the AI agent to organize project development into manageable chunks.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateEpicData {
  title: string;
  description?: string;
  businessValue?: string;
  acceptanceCriteria?: string;
  priority?: number; // 0=低, 1=中, 2=高, 3=緊急
  phase?: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  estimatedEffort?: number; // 故事點
  createdBy?: string;
}

export interface UpdateEpicData {
  title?: string;
  description?: string;
  businessValue?: string;
  acceptanceCriteria?: string;
  priority?: number;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  phase?: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  estimatedEffort?: number;
  actualEffort?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface EpicSummary {
  id: string;
  title: string;
  status: string;
  priority: number;
  storyCount: number;
  completedStories: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  progressPercentage: number;
  estimatedEffort?: number;
  actualEffort?: number;
}

export interface EpicDependencyInfo {
  type: 'BLOCKS' | 'RELATES_TO';
  dependentEpicId: string;
  requiredEpicId: string;
  dependentEpicTitle: string;
  requiredEpicTitle: string;
}

export interface EpicPlanningData {
  suggestedStories: {
    title: string;
    userStory: string;
    description: string;
    acceptanceCriteria: string;
    estimatedStoryPoints: number;
  }[];
  estimatedDuration: number; // days
  suggestedIteration: number;
  dependencies: string[]; // Epic IDs this epic depends on
  risks: string[];
  recommendations: string[];
}

export class EpicManager {

  /**
   * Create a new epic for a project
   */
  async createEpic(projectId: string, data: CreateEpicData) {
    try {
      const epic = await prisma.epic.create({
        data: {
          projectId,
          title: data.title,
          description: data.description,
          businessValue: data.businessValue,
          acceptanceCriteria: data.acceptanceCriteria,
          priority: data.priority ?? 1,
          phase: data.phase || 'REQUIREMENTS',
          estimatedEffort: data.estimatedEffort,
          createdBy: data.createdBy || 'AI_AGENT',
          status: 'PENDING'
        },
        include: {
          stories: true,
          dependencies: {
            include: {
              requiredEpic: { select: { id: true, title: true } }
            }
          }
        }
      });

      // Update project epic count
      await this.updateProjectEpicCount(projectId);

      return epic;
    } catch (error) {
      console.error('Error creating epic:', error);
      throw new Error(`Failed to create epic: ${(error as Error).message}`);
    }
  }

  /**
   * Update an existing epic
   */
  async updateEpic(epicId: string, data: UpdateEpicData) {
    try {
      const epic = await prisma.epic.update({
        where: { id: epicId },
        data: {
          ...data,
          updatedAt: new Date()
        },
        include: {
          stories: true,
          dependencies: {
            include: {
              requiredEpic: { select: { id: true, title: true } }
            }
          }
        }
      });

      // Update project counts if status changed
      if (data.status) {
        await this.updateProjectEpicCount(epic.projectId);
      }

      return epic;
    } catch (error) {
      console.error('Error updating epic:', error);
      throw new Error(`Failed to update epic: ${(error as Error).message}`);
    }
  }

  /**
   * Get epic by ID with full details
   */
  async getEpicById(epicId: string) {
    try {
      const epic = await prisma.epic.findUnique({
        where: { id: epicId },
        include: {
          stories: {
            include: {
              tasks: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  type: true
                }
              }
            },
            orderBy: { priority: 'desc' }
          },
          dependencies: {
            include: {
              requiredEpic: { select: { id: true, title: true, status: true } }
            }
          },
          dependents: {
            include: {
              dependentEpic: { select: { id: true, title: true, status: true } }
            }
          }
        }
      });

      if (!epic) {
        throw new Error(`Epic with ID ${epicId} not found`);
      }

      return epic;
    } catch (error) {
      console.error('Error getting epic:', error);
      throw new Error(`Failed to get epic: ${(error as Error).message}`);
    }
  }

  /**
   * Get all epics for a project
   */
  async getProjectEpics(
    projectId: string, 
    options: {
      status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
      phase?: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
      priority?: number;
      includeStories?: boolean;
      orderBy?: 'priority' | 'created' | 'updated';
    } = {}
  ) {
    try {
      const where: any = { projectId };
      
      if (options.status) {
        where.status = options.status;
      }
      
      if (options.phase) {
        where.phase = options.phase;
      }
      
      if (options.priority !== undefined) {
        where.priority = options.priority;
      }

      let orderBy: any = { createdAt: 'desc' };
      if (options.orderBy === 'priority') {
        orderBy = { priority: 'desc' };
      } else if (options.orderBy === 'updated') {
        orderBy = { updatedAt: 'desc' };
      }

      const epics = await prisma.epic.findMany({
        where,
        orderBy,
        include: {
          stories: options.includeStories ? {
            select: {
              id: true,
              title: true,
              status: true,
              storyPoints: true,
              priority: true
            }
          } : false,
          dependencies: {
            include: {
              requiredEpic: { select: { id: true, title: true, status: true } }
            }
          },
          _count: {
            select: { stories: true }
          }
        }
      });

      return epics;
    } catch (error) {
      console.error('Error getting project epics:', error);
      throw new Error(`Failed to get project epics: ${(error as Error).message}`);
    }
  }

  /**
   * Get epic summary with progress information
   */
  async getEpicSummary(epicId: string): Promise<EpicSummary> {
    try {
      const epic = await prisma.epic.findUnique({
        where: { id: epicId },
        include: {
          stories: {
            select: {
              id: true,
              status: true,
              storyPoints: true
            }
          }
        }
      });

      if (!epic) {
        throw new Error(`Epic with ID ${epicId} not found`);
      }

      const storyCount = epic.stories.length;
      const completedStories = epic.stories.filter(s => s.status === 'COMPLETED').length;
      const totalStoryPoints = epic.stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
      const completedStoryPoints = epic.stories
        .filter(s => s.status === 'COMPLETED')
        .reduce((sum, s) => sum + (s.storyPoints || 0), 0);

      const progressPercentage = storyCount > 0 
        ? Math.round((completedStories / storyCount) * 100)
        : 0;

      return {
        id: epic.id,
        title: epic.title,
        status: epic.status,
        priority: epic.priority,
        storyCount,
        completedStories,
        totalStoryPoints,
        completedStoryPoints,
        progressPercentage,
        estimatedEffort: epic.estimatedEffort || undefined,
        actualEffort: epic.actualEffort || undefined
      };
    } catch (error) {
      console.error('Error getting epic summary:', error);
      throw new Error(`Failed to get epic summary: ${(error as Error).message}`);
    }
  }

  /**
   * Create epic dependency
   */
  async createEpicDependency(
    dependentEpicId: string, 
    requiredEpicId: string, 
    dependencyType: 'BLOCKS' | 'RELATES_TO' = 'BLOCKS'
  ) {
    try {
      // Check if dependency already exists
      const existing = await prisma.epicDependency.findUnique({
        where: {
          dependentEpicId_requiredEpicId: {
            dependentEpicId,
            requiredEpicId
          }
        }
      });

      if (existing) {
        throw new Error('Dependency already exists');
      }

      // Check for circular dependencies
      const wouldCreateCycle = await this.checkCircularDependency(dependentEpicId, requiredEpicId);
      if (wouldCreateCycle) {
        throw new Error('Cannot create dependency: would create circular dependency');
      }

      const dependency = await prisma.epicDependency.create({
        data: {
          dependentEpicId,
          requiredEpicId,
          dependencyType
        },
        include: {
          dependentEpic: { select: { id: true, title: true } },
          requiredEpic: { select: { id: true, title: true } }
        }
      });

      return dependency;
    } catch (error) {
      console.error('Error creating epic dependency:', error);
      throw new Error(`Failed to create epic dependency: ${(error as Error).message}`);
    }
  }

  /**
   * Remove epic dependency
   */
  async removeEpicDependency(dependentEpicId: string, requiredEpicId: string) {
    try {
      await prisma.epicDependency.delete({
        where: {
          dependentEpicId_requiredEpicId: {
            dependentEpicId,
            requiredEpicId
          }
        }
      });
    } catch (error) {
      console.error('Error removing epic dependency:', error);
      throw new Error(`Failed to remove epic dependency: ${(error as Error).message}`);
    }
  }

  /**
   * Get epic dependencies (both required and dependent)
   */
  async getEpicDependencies(epicId: string): Promise<{
    dependencies: EpicDependencyInfo[];
    dependents: EpicDependencyInfo[];
  }> {
    try {
      const epic = await prisma.epic.findUnique({
        where: { id: epicId },
        include: {
          dependencies: {
            include: {
              requiredEpic: { select: { id: true, title: true } }
            }
          },
          dependents: {
            include: {
              dependentEpic: { select: { id: true, title: true } }
            }
          }
        }
      });

      if (!epic) {
        throw new Error(`Epic with ID ${epicId} not found`);
      }

      const dependencies = epic.dependencies.map(dep => ({
        type: dep.dependencyType as 'BLOCKS' | 'RELATES_TO',
        dependentEpicId: dep.dependentEpicId,
        requiredEpicId: dep.requiredEpicId,
        dependentEpicTitle: epic.title,
        requiredEpicTitle: dep.requiredEpic.title
      }));

      const dependents = epic.dependents.map(dep => ({
        type: dep.dependencyType as 'BLOCKS' | 'RELATES_TO',
        dependentEpicId: dep.dependentEpicId,
        requiredEpicId: dep.requiredEpicId,
        dependentEpicTitle: dep.dependentEpic.title,
        requiredEpicTitle: epic.title
      }));

      return { dependencies, dependents };
    } catch (error) {
      console.error('Error getting epic dependencies:', error);
      throw new Error(`Failed to get epic dependencies: ${(error as Error).message}`);
    }
  }

  /**
   * Start epic execution
   */
  async startEpic(epicId: string) {
    try {
      const epic = await prisma.epic.update({
        where: { id: epicId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date()
        }
      });

      return epic;
    } catch (error) {
      console.error('Error starting epic:', error);
      throw new Error(`Failed to start epic: ${(error as Error).message}`);
    }
  }

  /**
   * Complete epic
   */
  async completeEpic(epicId: string, actualEffort?: number) {
    try {
      // Check if all stories are completed
      const epic = await prisma.epic.findUnique({
        where: { id: epicId },
        include: {
          stories: { select: { status: true } }
        }
      });

      if (!epic) {
        throw new Error(`Epic with ID ${epicId} not found`);
      }

      const incompleteStories = epic.stories.filter(s => s.status !== 'COMPLETED');
      if (incompleteStories.length > 0) {
        throw new Error(`Cannot complete epic: ${incompleteStories.length} stories are not completed`);
      }

      const updatedEpic = await prisma.epic.update({
        where: { id: epicId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          actualEffort: actualEffort || epic.actualEffort
        }
      });

      return updatedEpic;
    } catch (error) {
      console.error('Error completing epic:', error);
      throw new Error(`Failed to complete epic: ${(error as Error).message}`);
    }
  }

  /**
   * Delete epic and all associated stories/tasks
   */
  async deleteEpic(epicId: string) {
    try {
      // Check if epic has dependencies
      const dependencies = await prisma.epicDependency.findMany({
        where: {
          OR: [
            { dependentEpicId: epicId },
            { requiredEpicId: epicId }
          ]
        }
      });

      if (dependencies.length > 0) {
        throw new Error('Cannot delete epic: has dependencies. Remove dependencies first.');
      }

      // Delete epic (cascade will handle stories, tasks, instructions)
      await prisma.epic.delete({
        where: { id: epicId }
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting epic:', error);
      throw new Error(`Failed to delete epic: ${(error as Error).message}`);
    }
  }

  /**
   * Generate epic planning data based on requirements
   */
  async generateEpicPlan(
    projectId: string,
    epicTitle: string,
    businessValue: string,
    requirements: string[]
  ): Promise<EpicPlanningData> {
    try {
      // This is a placeholder for AI-generated planning
      // In a real implementation, this would use the AI service to generate comprehensive plans
      
      const suggestedStories = requirements.map((req, index) => ({
        title: `Implement ${req}`,
        userStory: `As a user, I want ${req} so that I can achieve ${businessValue}`,
        description: `Implementation of ${req} feature to support the ${epicTitle} epic`,
        acceptanceCriteria: `Given that I am a user, when I use ${req}, then I should be able to ${businessValue}`,
        estimatedStoryPoints: Math.floor(Math.random() * 8) + 1 // 1-8 story points
      }));

      const estimatedDuration = Math.ceil(suggestedStories.length * 0.5); // 0.5 days per story
      const suggestedIteration = 1; // Default to first iteration

      return {
        suggestedStories,
        estimatedDuration,
        suggestedIteration,
        dependencies: [], // Would be determined by AI analysis
        risks: [
          'Technical complexity may be higher than estimated',
          'Requirements may change during development',
          'Dependencies on external services'
        ],
        recommendations: [
          'Start with MVP features and iterate',
          'Implement comprehensive testing early',
          'Plan for user feedback integration'
        ]
      };
    } catch (error) {
      console.error('Error generating epic plan:', error);
      throw new Error(`Failed to generate epic plan: ${(error as Error).message}`);
    }
  }

  /**
   * Get epic metrics for project dashboard
   */
  async getProjectEpicMetrics(projectId: string) {
    try {
      const epics = await prisma.epic.findMany({
        where: { projectId },
        include: {
          stories: {
            select: { status: true, storyPoints: true }
          }
        }
      });

      const totalEpics = epics.length;
      const completedEpics = epics.filter(e => e.status === 'COMPLETED').length;
      const inProgressEpics = epics.filter(e => e.status === 'IN_PROGRESS').length;
      const blockedEpics = epics.filter(e => e.status === 'BLOCKED').length;

      const totalStoryPoints = epics.reduce((sum, epic) => 
        sum + epic.stories.reduce((storySum, story) => storySum + (story.storyPoints || 0), 0), 0
      );

      const completedStoryPoints = epics.reduce((sum, epic) => 
        sum + epic.stories
          .filter(story => story.status === 'COMPLETED')
          .reduce((storySum, story) => storySum + (story.storyPoints || 0), 0), 0
      );

      const progressPercentage = totalStoryPoints > 0 
        ? Math.round((completedStoryPoints / totalStoryPoints) * 100)
        : 0;

      return {
        totalEpics,
        completedEpics,
        inProgressEpics,
        blockedEpics,
        totalStoryPoints,
        completedStoryPoints,
        progressPercentage,
        averageEpicSize: totalEpics > 0 ? Math.round(totalStoryPoints / totalEpics) : 0
      };
    } catch (error) {
      console.error('Error getting project epic metrics:', error);
      throw new Error(`Failed to get project epic metrics: ${(error as Error).message}`);
    }
  }

  /**
   * Check for circular dependencies
   */
  private async checkCircularDependency(epicId: string, requiredEpicId: string): Promise<boolean> {
    const visited = new Set<string>();
    const stack = [requiredEpicId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      
      if (currentId === epicId) {
        return true; // Circular dependency found
      }

      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);

      // Get dependencies of current epic
      const dependencies = await prisma.epicDependency.findMany({
        where: { dependentEpicId: currentId },
        select: { requiredEpicId: true }
      });

      for (const dep of dependencies) {
        stack.push(dep.requiredEpicId);
      }
    }

    return false;
  }

  /**
   * Update project epic count
   */
  private async updateProjectEpicCount(projectId: string) {
    try {
      const epicCount = await prisma.epic.count({
        where: { projectId }
      });

      await prisma.projectIndex.update({
        where: { id: projectId },
        data: { epicCount }
      });
    } catch (error) {
      // Ignore errors if project doesn't exist in index
      console.warn('Could not update project epic count:', error);
    }
  }
}

// Export singleton instance
export const epicManager = new EpicManager();