/**
 * Story Management System
 * 
 * Manages Story creation, execution, and progress tracking within Epics,
 * following Agile methodologies and user story best practices.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateStoryData {
  title: string;
  userStory?: string; // As a [user], I want [feature] so that [benefit]
  description?: string;
  acceptanceCriteria?: string;
  priority?: number; // 0=低, 1=中, 2=高, 3=緊急
  storyPoints?: number; // 1, 2, 3, 5, 8, 13, 21 (Fibonacci)
  iteration?: number; // Sprint/iteration number
  metadata?: Record<string, any>;
}

export interface UpdateStoryData {
  title?: string;
  userStory?: string;
  description?: string;
  acceptanceCriteria?: string;
  priority?: number;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'REJECTED';
  storyPoints?: number;
  iteration?: number;
  metadata?: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
}

export interface StoryWithTasks {
  id: string;
  title: string;
  userStory?: string;
  description?: string;
  acceptanceCriteria?: string;
  status: string;
  priority: number;
  storyPoints?: number;
  iteration?: number;
  tasks: {
    id: string;
    title: string;
    type: string;
    status: string;
    priority: number;
    estimatedTime?: number;
    actualTime?: number;
  }[];
  tasksSummary: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
  };
}

export interface StoryProgress {
  storyId: string;
  title: string;
  overallProgress: number; // 0-100%
  taskProgress: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    blocked: number;
  };
  estimatedCompletion?: Date;
  actualTime: number; // minutes
  estimatedTime: number; // minutes
}

export interface UserStoryTemplate {
  role: string;
  action: string;
  benefit: string;
  acceptanceCriteria: string[];
  suggestedTasks: {
    title: string;
    type: 'DEV' | 'TEST' | 'REVIEW' | 'DEPLOY' | 'DOCUMENT';
    description: string;
    estimatedTime: number; // minutes
  }[];
}

export class StoryManager {

  /**
   * Create a new story within an epic
   */
  async createStory(epicId: string, data: CreateStoryData) {
    try {
      // Validate epic exists
      const epic = await prisma.epic.findUnique({
        where: { id: epicId },
        select: { id: true, projectId: true, status: true }
      });

      if (!epic) {
        throw new Error(`Epic with ID ${epicId} not found`);
      }

      if (epic.status === 'COMPLETED') {
        throw new Error('Cannot add stories to completed epic');
      }

      const story = await prisma.story.create({
        data: {
          epicId,
          title: data.title,
          userStory: data.userStory,
          description: data.description,
          acceptanceCriteria: data.acceptanceCriteria,
          priority: data.priority ?? 1,
          storyPoints: data.storyPoints,
          iteration: data.iteration,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          status: 'PENDING'
        },
        include: {
          epic: {
            select: { id: true, title: true, projectId: true }
          },
          tasks: true
        }
      });

      // Update project story count
      await this.updateProjectStoryCount(epic.projectId);

      return story;
    } catch (error) {
      console.error('Error creating story:', error);
      throw new Error(`Failed to create story: ${(error as Error).message}`);
    }
  }

  /**
   * Update an existing story
   */
  async updateStory(storyId: string, data: UpdateStoryData) {
    try {
      const story = await prisma.story.update({
        where: { id: storyId },
        data: {
          ...data,
          metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
          updatedAt: new Date()
        },
        include: {
          epic: {
            select: { id: true, title: true, projectId: true }
          },
          tasks: true
        }
      });

      // Update project counts if status changed
      if (data.status) {
        await this.updateProjectStoryCount(story.epic.projectId);
      }

      return story;
    } catch (error) {
      console.error('Error updating story:', error);
      throw new Error(`Failed to update story: ${(error as Error).message}`);
    }
  }

  /**
   * Get story by ID with full details
   */
  async getStoryById(storyId: string): Promise<StoryWithTasks> {
    try {
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        include: {
          tasks: {
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              priority: true,
              estimatedTime: true,
              actualTime: true
            },
            orderBy: [
              { priority: 'desc' },
              { createdAt: 'asc' }
            ]
          },
          epic: {
            select: { id: true, title: true, projectId: true }
          }
        }
      });

      if (!story) {
        throw new Error(`Story with ID ${storyId} not found`);
      }

      const tasksSummary = {
        total: story.tasks.length,
        completed: story.tasks.filter(t => t.status === 'COMPLETED').length,
        inProgress: story.tasks.filter(t => t.status === 'IN_PROGRESS').length,
        blocked: story.tasks.filter(t => t.status === 'BLOCKED').length
      };

      return {
        id: story.id,
        title: story.title,
        userStory: story.userStory || undefined,
        description: story.description || undefined,
        acceptanceCriteria: story.acceptanceCriteria || undefined,
        status: story.status,
        priority: story.priority,
        storyPoints: story.storyPoints || undefined,
        iteration: story.iteration || undefined,
        tasks: story.tasks,
        tasksSummary
      };
    } catch (error) {
      console.error('Error getting story:', error);
      throw new Error(`Failed to get story: ${(error as Error).message}`);
    }
  }

  /**
   * Get all stories for an epic
   */
  async getEpicStories(
    epicId: string,
    options: {
      status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'REJECTED';
      iteration?: number;
      includeTasks?: boolean;
      orderBy?: 'priority' | 'created' | 'updated' | 'storyPoints';
    } = {}
  ) {
    try {
      const where: any = { epicId };
      
      if (options.status) {
        where.status = options.status;
      }
      
      if (options.iteration !== undefined) {
        where.iteration = options.iteration;
      }

      let orderBy: any = { createdAt: 'asc' };
      if (options.orderBy === 'priority') {
        orderBy = { priority: 'desc' };
      } else if (options.orderBy === 'updated') {
        orderBy = { updatedAt: 'desc' };
      } else if (options.orderBy === 'storyPoints') {
        orderBy = { storyPoints: 'desc' };
      }

      const stories = await prisma.story.findMany({
        where,
        orderBy,
        include: {
          tasks: options.includeTasks ? {
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              priority: true
            }
          } : false,
          _count: {
            select: { tasks: true }
          }
        }
      });

      return stories;
    } catch (error) {
      console.error('Error getting epic stories:', error);
      throw new Error(`Failed to get epic stories: ${(error as Error).message}`);
    }
  }

  /**
   * Get story progress information
   */
  async getStoryProgress(storyId: string): Promise<StoryProgress> {
    try {
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        include: {
          tasks: {
            select: {
              status: true,
              estimatedTime: true,
              actualTime: true
            }
          }
        }
      });

      if (!story) {
        throw new Error(`Story with ID ${storyId} not found`);
      }

      const taskProgress = {
        total: story.tasks.length,
        completed: story.tasks.filter(t => t.status === 'COMPLETED').length,
        inProgress: story.tasks.filter(t => t.status === 'IN_PROGRESS').length,
        pending: story.tasks.filter(t => t.status === 'PENDING').length,
        blocked: story.tasks.filter(t => t.status === 'BLOCKED').length
      };

      const overallProgress = taskProgress.total > 0 
        ? Math.round((taskProgress.completed / taskProgress.total) * 100)
        : 0;

      const estimatedTime = story.tasks.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
      const actualTime = story.tasks.reduce((sum, t) => sum + (t.actualTime || 0), 0);

      // Estimate completion based on current progress and average task time
      let estimatedCompletion: Date | undefined;
      if (taskProgress.inProgress > 0 && estimatedTime > 0) {
        const avgTaskTime = estimatedTime / taskProgress.total;
        const remainingTasks = taskProgress.total - taskProgress.completed;
        const estimatedMinutesLeft = remainingTasks * avgTaskTime;
        estimatedCompletion = new Date(Date.now() + estimatedMinutesLeft * 60 * 1000);
      }

      return {
        storyId: story.id,
        title: story.title,
        overallProgress,
        taskProgress,
        estimatedCompletion,
        actualTime,
        estimatedTime
      };
    } catch (error) {
      console.error('Error getting story progress:', error);
      throw new Error(`Failed to get story progress: ${(error as Error).message}`);
    }
  }

  /**
   * Start story execution
   */
  async startStory(storyId: string) {
    try {
      const story = await prisma.story.update({
        where: { id: storyId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date()
        },
        include: {
          epic: { select: { projectId: true } }
        }
      });

      // Update project stats
      await this.updateProjectStoryCount(story.epic.projectId);

      return story;
    } catch (error) {
      console.error('Error starting story:', error);
      throw new Error(`Failed to start story: ${(error as Error).message}`);
    }
  }

  /**
   * Complete story
   */
  async completeStory(storyId: string) {
    try {
      // Check if all tasks are completed
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        include: {
          tasks: { select: { status: true } },
          epic: { select: { projectId: true } }
        }
      });

      if (!story) {
        throw new Error(`Story with ID ${storyId} not found`);
      }

      const incompleteTasks = story.tasks.filter(t => t.status !== 'COMPLETED');
      if (incompleteTasks.length > 0) {
        throw new Error(`Cannot complete story: ${incompleteTasks.length} tasks are not completed`);
      }

      const updatedStory = await prisma.story.update({
        where: { id: storyId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      // Update project stats
      await this.updateProjectStoryCount(story.epic.projectId);

      return updatedStory;
    } catch (error) {
      console.error('Error completing story:', error);
      throw new Error(`Failed to complete story: ${(error as Error).message}`);
    }
  }

  /**
   * Generate user story from requirements
   */
  generateUserStory(
    userRole: string,
    feature: string,
    benefit: string,
    additionalDetails?: string
  ): UserStoryTemplate {
    try {
      const userStory = `As a ${userRole}, I want ${feature} so that ${benefit}`;
      
      // Generate basic acceptance criteria
      const acceptanceCriteria = [
        `Given that I am a ${userRole}`,
        `When I ${feature.toLowerCase()}`,
        `Then I should be able to ${benefit.toLowerCase()}`
      ];

      if (additionalDetails) {
        acceptanceCriteria.push(`And ${additionalDetails}`);
      }

      // Generate suggested tasks based on the feature
      const suggestedTasks = [
        {
          title: `Implement ${feature} backend logic`,
          type: 'DEV' as const,
          description: `Develop the core functionality for ${feature}`,
          estimatedTime: 240 // 4 hours
        },
        {
          title: `Create ${feature} user interface`,
          type: 'DEV' as const,
          description: `Design and implement the UI components for ${feature}`,
          estimatedTime: 180 // 3 hours
        },
        {
          title: `Write tests for ${feature}`,
          type: 'TEST' as const,
          description: `Create comprehensive tests covering the acceptance criteria`,
          estimatedTime: 120 // 2 hours
        },
        {
          title: `Code review for ${feature}`,
          type: 'REVIEW' as const,
          description: `Review code quality and adherence to standards`,
          estimatedTime: 60 // 1 hour
        },
        {
          title: `Document ${feature}`,
          type: 'DOCUMENT' as const,
          description: `Create user documentation and technical specs`,
          estimatedTime: 90 // 1.5 hours
        }
      ];

      return {
        role: userRole,
        action: feature,
        benefit,
        acceptanceCriteria,
        suggestedTasks
      };
    } catch (error) {
      console.error('Error generating user story:', error);
      throw new Error(`Failed to generate user story: ${(error as Error).message}`);
    }
  }

  /**
   * Estimate story points based on complexity factors
   */
  estimateStoryPoints(
    complexity: 'simple' | 'moderate' | 'complex',
    uncertainty: 'low' | 'medium' | 'high',
    effort: 'small' | 'medium' | 'large'
  ): number {
    try {
      // Base points by complexity
      const complexityPoints = {
        simple: 1,
        moderate: 3,
        complex: 8
      };

      // Uncertainty multiplier
      const uncertaintyMultiplier = {
        low: 1,
        medium: 1.5,
        high: 2
      };

      // Effort modifier
      const effortModifier = {
        small: 0,
        medium: 1,
        large: 3
      };

      const basePoints = complexityPoints[complexity];
      const multiplier = uncertaintyMultiplier[uncertainty];
      const modifier = effortModifier[effort];

      const estimated = Math.round(basePoints * multiplier + modifier);

      // Map to Fibonacci sequence
      const fibonacciSequence = [1, 2, 3, 5, 8, 13, 21];
      return fibonacciSequence.find(f => f >= estimated) || 21;

    } catch (error) {
      console.error('Error estimating story points:', error);
      return 3; // Default to 3 points
    }
  }

  /**
   * Get stories by iteration/sprint
   */
  async getIterationStories(
    projectId: string,
    iteration: number,
    includeProgress: boolean = true
  ) {
    try {
      const stories = await prisma.story.findMany({
        where: {
          iteration,
          epic: { projectId }
        },
        include: {
          epic: {
            select: { id: true, title: true }
          },
          tasks: includeProgress ? {
            select: {
              status: true,
              estimatedTime: true,
              actualTime: true
            }
          } : false
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ]
      });

      if (includeProgress) {
        const storiesWithProgress = await Promise.all(
          stories.map(async (story) => {
            const progress = await this.getStoryProgress(story.id);
            return { ...story, progress };
          })
        );
        return storiesWithProgress;
      }

      return stories;
    } catch (error) {
      console.error('Error getting iteration stories:', error);
      throw new Error(`Failed to get iteration stories: ${(error as Error).message}`);
    }
  }

  /**
   * Delete story and all associated tasks
   */
  async deleteStory(storyId: string) {
    try {
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        include: {
          epic: { select: { projectId: true } },
          tasks: { select: { id: true } }
        }
      });

      if (!story) {
        throw new Error(`Story with ID ${storyId} not found`);
      }

      if (story.tasks.length > 0) {
        throw new Error('Cannot delete story: has associated tasks. Delete tasks first.');
      }

      await prisma.story.delete({
        where: { id: storyId }
      });

      // Update project counts
      await this.updateProjectStoryCount(story.epic.projectId);

      return { success: true };
    } catch (error) {
      console.error('Error deleting story:', error);
      throw new Error(`Failed to delete story: ${(error as Error).message}`);
    }
  }

  /**
   * Update project story count
   */
  private async updateProjectStoryCount(projectId: string) {
    try {
      const storyCount = await prisma.story.count({
        where: {
          epic: { projectId }
        }
      });

      await prisma.projectIndex.update({
        where: { id: projectId },
        data: { storyCount }
      });
    } catch (error) {
      // Ignore errors if project doesn't exist in index
      console.warn('Could not update project story count:', error);
    }
  }
}

// Export singleton instance
export const storyManager = new StoryManager();