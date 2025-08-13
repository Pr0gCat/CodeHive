/**
 * 階層化結構模型管理器
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { hierarchyBroadcaster } from '@/lib/socket/server';
import {
  ModelStatus,
  type IHierarchyManager,
  type Epic,
  type Story,
  type Task,
  type Instruction,
  type EpicWithRelations,
  type StoryWithRelations,
  type TaskWithRelations,
  type InstructionWithRelations,
  type CreateEpicInput,
  type CreateStoryInput,
  type CreateTaskInput,
  type CreateInstructionInput,
  type UpdateEpicInput,
  type UpdateStoryInput,
  type UpdateTaskInput,
  type UpdateInstructionInput,
  type CreateDependencyInput,
  type EpicFilter,
  type StoryFilter,
  type TaskFilter,
  type InstructionFilter,
  type HierarchyStatistics,
  type EpicStatistics,
  type HierarchyProgress,
  type ValidationResult,
  type EpicDependency,
  type TaskDependency,
  type InstructionDependency
} from './types';

export class HierarchyManager extends EventEmitter implements IHierarchyManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
  }

  // ===== Epic 操作 =====

  async createEpic(input: CreateEpicInput): Promise<Epic> {
    try {
      const epic = await this.prisma.epic.create({
        data: {
          ...input,
          status: ModelStatus.PENDING
        }
      });

      this.emit('epic:created', epic);
      
      // 廣播即時更新
      hierarchyBroadcaster.broadcastEpicUpdate(epic.id, epic, epic.projectId);
      
      return epic;
    } catch (error) {
      this.emit('epic:error', { action: 'create', error });
      throw error;
    }
  }

  async updateEpic(id: string, input: UpdateEpicInput): Promise<Epic> {
    try {
      // 如果狀態變更為完成，更新完成時間
      if (input.status === ModelStatus.COMPLETED) {
        input = { ...input, completedAt: new Date() };
      }
      
      // 如果狀態變更為進行中且沒有開始時間，更新開始時間
      if (input.status === ModelStatus.IN_PROGRESS) {
        const existing = await this.prisma.epic.findUnique({ where: { id } });
        if (existing && !existing.startedAt) {
          input = { ...input, startedAt: new Date() };
        }
      }

      const epic = await this.prisma.epic.update({
        where: { id },
        data: input
      });

      this.emit('epic:updated', epic);
      
      // 廣播即時更新
      hierarchyBroadcaster.broadcastEpicUpdate(epic.id, epic, epic.projectId);
      
      return epic;
    } catch (error) {
      this.emit('epic:error', { action: 'update', id, error });
      throw error;
    }
  }

  async deleteEpic(id: string): Promise<boolean> {
    try {
      await this.prisma.epic.delete({ where: { id } });
      this.emit('epic:deleted', { id });
      return true;
    } catch (error) {
      this.emit('epic:error', { action: 'delete', id, error });
      throw error;
    }
  }

  async getEpic(id: string, includeRelations = false): Promise<EpicWithRelations | null> {
    try {
      const epic = await this.prisma.epic.findUnique({
        where: { id },
        include: includeRelations ? {
          stories: {
            include: {
              tasks: true
            }
          },
          dependencies: true,
          dependents: true
        } : undefined
      });

      return epic;
    } catch (error) {
      this.emit('epic:error', { action: 'get', id, error });
      throw error;
    }
  }

  async listEpics(filter?: EpicFilter): Promise<Epic[]> {
    try {
      const where: any = {};

      if (filter) {
        if (filter.projectId) where.projectId = filter.projectId;
        if (filter.status) {
          where.status = Array.isArray(filter.status) 
            ? { in: filter.status }
            : filter.status;
        }
        if (filter.priority !== undefined) {
          where.priority = Array.isArray(filter.priority)
            ? { in: filter.priority }
            : filter.priority;
        }
        if (filter.phase) where.phase = filter.phase;
        if (filter.createdBy) where.createdBy = filter.createdBy;
      }

      const epics = await this.prisma.epic.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ]
      });

      return epics;
    } catch (error) {
      this.emit('epic:error', { action: 'list', filter, error });
      throw error;
    }
  }

  // ===== Story 操作 =====

  async createStory(input: CreateStoryInput): Promise<Story> {
    try {
      const story = await this.prisma.story.create({
        data: {
          ...input,
          status: ModelStatus.PENDING
        }
      });

      // 更新 Epic 的 token 使用
      await this.updateEpicTokenUsage(input.epicId);

      this.emit('story:created', story);
      
      // 廣播即時更新
      hierarchyBroadcaster.broadcastStoryUpdate(story.id, story, story.epicId);
      
      return story;
    } catch (error) {
      this.emit('story:error', { action: 'create', error });
      throw error;
    }
  }

  async updateStory(id: string, input: UpdateStoryInput): Promise<Story> {
    try {
      // 處理狀態變更的時間戳記
      if (input.status === ModelStatus.COMPLETED) {
        input = { ...input, completedAt: new Date() };
      }
      
      if (input.status === ModelStatus.IN_PROGRESS) {
        const existing = await this.prisma.story.findUnique({ where: { id } });
        if (existing && !existing.startedAt) {
          input = { ...input, startedAt: new Date() };
        }
      }

      const story = await this.prisma.story.update({
        where: { id },
        data: input
      });

      // 更新 Epic 的 token 使用
      await this.updateEpicTokenUsage(story.epicId);

      this.emit('story:updated', story);
      return story;
    } catch (error) {
      this.emit('story:error', { action: 'update', id, error });
      throw error;
    }
  }

  async deleteStory(id: string): Promise<boolean> {
    try {
      const story = await this.prisma.story.findUnique({ where: { id } });
      if (story) {
        await this.prisma.story.delete({ where: { id } });
        
        // 更新 Epic 的 token 使用
        await this.updateEpicTokenUsage(story.epicId);
        
        this.emit('story:deleted', { id });
      }
      return true;
    } catch (error) {
      this.emit('story:error', { action: 'delete', id, error });
      throw error;
    }
  }

  async getStory(id: string, includeRelations = false): Promise<StoryWithRelations | null> {
    try {
      const story = await this.prisma.story.findUnique({
        where: { id },
        include: includeRelations ? {
          epic: true,
          tasks: {
            include: {
              instructions: true
            }
          }
        } : undefined
      });

      return story;
    } catch (error) {
      this.emit('story:error', { action: 'get', id, error });
      throw error;
    }
  }

  async listStories(filter?: StoryFilter): Promise<Story[]> {
    try {
      const where: any = {};

      if (filter) {
        if (filter.epicId) where.epicId = filter.epicId;
        if (filter.status) {
          where.status = Array.isArray(filter.status)
            ? { in: filter.status }
            : filter.status;
        }
        if (filter.priority !== undefined) {
          where.priority = Array.isArray(filter.priority)
            ? { in: filter.priority }
            : filter.priority;
        }
        if (filter.iteration !== undefined) where.iteration = filter.iteration;
      }

      const stories = await this.prisma.story.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ]
      });

      return stories;
    } catch (error) {
      this.emit('story:error', { action: 'list', filter, error });
      throw error;
    }
  }

  // ===== Task 操作 =====

  async createTask(input: CreateTaskInput): Promise<Task> {
    try {
      const task = await this.prisma.task.create({
        data: {
          ...input,
          type: input.type || 'DEV', // 預設為開發任務
          status: ModelStatus.PENDING
        }
      });

      this.emit('task:created', task);
      
      // 廣播即時更新
      hierarchyBroadcaster.broadcastTaskUpdate(task.id, task, task.storyId);
      
      return task;
    } catch (error) {
      this.emit('task:error', { action: 'create', error });
      throw error;
    }
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    try {
      // 處理狀態變更的時間戳記
      if (input.status === ModelStatus.COMPLETED) {
        input = { ...input, completedAt: new Date() };
      }
      
      if (input.status === ModelStatus.IN_PROGRESS) {
        const existing = await this.prisma.task.findUnique({ where: { id } });
        if (existing && !existing.startedAt) {
          input = { ...input, startedAt: new Date() };
        }
      }

      const task = await this.prisma.task.update({
        where: { id },
        data: input
      });

      this.emit('task:updated', task);
      return task;
    } catch (error) {
      this.emit('task:error', { action: 'update', id, error });
      throw error;
    }
  }

  async deleteTask(id: string): Promise<boolean> {
    try {
      await this.prisma.task.delete({ where: { id } });
      this.emit('task:deleted', { id });
      return true;
    } catch (error) {
      this.emit('task:error', { action: 'delete', id, error });
      throw error;
    }
  }

  async getTask(id: string, includeRelations = false): Promise<TaskWithRelations | null> {
    try {
      const task = await this.prisma.task.findUnique({
        where: { id },
        include: includeRelations ? {
          story: true,
          instructions: true,
          dependencies: true,
          dependents: true
        } : undefined
      });

      return task;
    } catch (error) {
      this.emit('task:error', { action: 'get', id, error });
      throw error;
    }
  }

  async listTasks(filter?: TaskFilter): Promise<Task[]> {
    try {
      const where: any = {};

      if (filter) {
        if (filter.storyId) where.storyId = filter.storyId;
        if (filter.type) {
          where.type = Array.isArray(filter.type)
            ? { in: filter.type }
            : filter.type;
        }
        if (filter.status) {
          where.status = Array.isArray(filter.status)
            ? { in: filter.status }
            : filter.status;
        }
        if (filter.priority !== undefined) {
          where.priority = Array.isArray(filter.priority)
            ? { in: filter.priority }
            : filter.priority;
        }
        if (filter.assignedAgent) where.assignedAgent = filter.assignedAgent;
      }

      const tasks = await this.prisma.task.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ]
      });

      return tasks;
    } catch (error) {
      this.emit('task:error', { action: 'list', filter, error });
      throw error;
    }
  }

  // ===== Instruction 操作 =====

  async createInstruction(input: CreateInstructionInput): Promise<Instruction> {
    try {
      const instruction = await this.prisma.instruction.create({
        data: {
          ...input,
          status: ModelStatus.PENDING
        }
      });

      this.emit('instruction:created', instruction);
      
      // 廣播即時更新
      hierarchyBroadcaster.broadcastInstructionUpdate(instruction.id, instruction);
      
      return instruction;
    } catch (error) {
      this.emit('instruction:error', { action: 'create', error });
      throw error;
    }
  }

  async updateInstruction(id: string, input: UpdateInstructionInput): Promise<Instruction> {
    try {
      // 處理狀態變更的時間戳記
      if (input.status === ModelStatus.COMPLETED) {
        input = { ...input, completedAt: new Date() };
      }
      
      if (input.status === ModelStatus.IN_PROGRESS) {
        const existing = await this.prisma.instruction.findUnique({ where: { id } });
        if (existing && !existing.startedAt) {
          input = { ...input, startedAt: new Date() };
        }
      }

      const instruction = await this.prisma.instruction.update({
        where: { id },
        data: input
      });

      // 更新相關的 Story 和 Epic 的 token 使用
      if (input.tokenUsage) {
        await this.updateTokenUsageChain(instruction.taskId, input.tokenUsage);
      }

      this.emit('instruction:updated', instruction);
      return instruction;
    } catch (error) {
      this.emit('instruction:error', { action: 'update', id, error });
      throw error;
    }
  }

  async deleteInstruction(id: string): Promise<boolean> {
    try {
      await this.prisma.instruction.delete({ where: { id } });
      this.emit('instruction:deleted', { id });
      return true;
    } catch (error) {
      this.emit('instruction:error', { action: 'delete', id, error });
      throw error;
    }
  }

  async getInstruction(id: string, includeRelations = false): Promise<InstructionWithRelations | null> {
    try {
      const instruction = await this.prisma.instruction.findUnique({
        where: { id },
        include: includeRelations ? {
          task: true,
          dependencies: true,
          dependents: true
        } : undefined
      });

      return instruction;
    } catch (error) {
      this.emit('instruction:error', { action: 'get', id, error });
      throw error;
    }
  }

  async listInstructions(filter?: InstructionFilter): Promise<Instruction[]> {
    try {
      const where: any = {};

      if (filter) {
        if (filter.taskId) where.taskId = filter.taskId;
        if (filter.status) {
          where.status = Array.isArray(filter.status)
            ? { in: filter.status }
            : filter.status;
        }
        if (filter.executedBy) where.executedBy = filter.executedBy;
      }

      const instructions = await this.prisma.instruction.findMany({
        where,
        orderBy: { sequence: 'asc' }
      });

      return instructions;
    } catch (error) {
      this.emit('instruction:error', { action: 'list', filter, error });
      throw error;
    }
  }

  // ===== 依賴關係操作 =====

  async createEpicDependency(input: CreateDependencyInput): Promise<EpicDependency> {
    try {
      const dependency = await this.prisma.epicDependency.create({
        data: {
          dependentEpicId: input.dependentId,
          requiredEpicId: input.requiredId,
          dependencyType: input.dependencyType || 'BLOCKS'
        }
      });

      this.emit('dependency:created', { type: 'epic', dependency });
      return dependency;
    } catch (error) {
      this.emit('dependency:error', { type: 'epic', action: 'create', error });
      throw error;
    }
  }

  async createTaskDependency(input: CreateDependencyInput): Promise<TaskDependency> {
    try {
      const dependency = await this.prisma.taskDependency.create({
        data: {
          dependentTaskId: input.dependentId,
          requiredTaskId: input.requiredId,
          dependencyType: input.dependencyType || 'BLOCKS'
        }
      });

      this.emit('dependency:created', { type: 'task', dependency });
      return dependency;
    } catch (error) {
      this.emit('dependency:error', { type: 'task', action: 'create', error });
      throw error;
    }
  }

  async createInstructionDependency(input: CreateDependencyInput): Promise<InstructionDependency> {
    try {
      const dependency = await this.prisma.instructionDependency.create({
        data: {
          dependentInstructionId: input.dependentId,
          requiredInstructionId: input.requiredId,
          dependencyType: input.dependencyType || 'SEQUENTIAL'
        }
      });

      this.emit('dependency:created', { type: 'instruction', dependency });
      return dependency;
    } catch (error) {
      this.emit('dependency:error', { type: 'instruction', action: 'create', error });
      throw error;
    }
  }

  // ===== 統計和進度 =====

  async getHierarchyStatistics(projectId: string): Promise<HierarchyStatistics> {
    try {
      const [epics, stories, tasks, instructions] = await Promise.all([
        this.prisma.epic.findMany({ where: { projectId } }),
        this.prisma.story.findMany({
          where: { epic: { projectId } }
        }),
        this.prisma.task.findMany({
          where: { story: { epic: { projectId } } }
        }),
        this.prisma.instruction.findMany({
          where: { task: { story: { epic: { projectId } } } }
        })
      ]);

      const completedEpics = epics.filter(e => e.status === ModelStatus.COMPLETED).length;
      const completedStories = stories.filter(s => s.status === ModelStatus.COMPLETED).length;
      const completedTasks = tasks.filter(t => t.status === ModelStatus.COMPLETED).length;
      const completedInstructions = instructions.filter(i => i.status === ModelStatus.COMPLETED).length;

      const totalTokenUsage = epics.reduce((sum, e) => sum + e.tokenUsage, 0);
      const storyPointsArray = stories.map(s => s.storyPoints).filter(sp => sp !== null) as number[];
      const taskTimesArray = tasks.map(t => t.actualTime).filter(t => t !== null) as number[];

      return {
        totalEpics: epics.length,
        totalStories: stories.length,
        totalTasks: tasks.length,
        totalInstructions: instructions.length,
        completedEpics,
        completedStories,
        completedTasks,
        completedInstructions,
        totalTokenUsage,
        averageStoryPoints: storyPointsArray.length > 0 
          ? storyPointsArray.reduce((sum, sp) => sum + sp, 0) / storyPointsArray.length
          : 0,
        averageTaskTime: taskTimesArray.length > 0
          ? taskTimesArray.reduce((sum, t) => sum + t, 0) / taskTimesArray.length
          : 0
      };
    } catch (error) {
      this.emit('statistics:error', { projectId, error });
      throw error;
    }
  }

  async getEpicStatistics(epicId: string): Promise<EpicStatistics> {
    try {
      const epic = await this.prisma.epic.findUnique({
        where: { id: epicId },
        include: {
          stories: {
            include: {
              tasks: {
                include: {
                  instructions: true
                }
              }
            }
          }
        }
      });

      if (!epic) {
        throw new Error(`Epic not found: ${epicId}`);
      }

      const totalStories = epic.stories.length;
      const completedStories = epic.stories.filter(s => s.status === ModelStatus.COMPLETED).length;
      
      let totalTasks = 0;
      let completedTasks = 0;
      let totalTokenUsage = epic.tokenUsage;

      epic.stories.forEach(story => {
        totalTasks += story.tasks.length;
        completedTasks += story.tasks.filter(t => t.status === ModelStatus.COMPLETED).length;
        totalTokenUsage += story.tokenUsage;
        
        story.tasks.forEach(task => {
          task.instructions.forEach(instruction => {
            totalTokenUsage += instruction.tokenUsage;
          });
        });
      });

      const progress = totalStories > 0 
        ? Math.round((completedStories / totalStories) * 100)
        : 0;

      return {
        id: epic.id,
        title: epic.title,
        totalStories,
        completedStories,
        totalTasks,
        completedTasks,
        totalTokenUsage,
        estimatedEffort: epic.estimatedEffort,
        actualEffort: epic.actualEffort,
        progress
      };
    } catch (error) {
      this.emit('statistics:error', { epicId, error });
      throw error;
    }
  }

  async getHierarchyProgress(epicId: string): Promise<HierarchyProgress> {
    try {
      const epic = await this.prisma.epic.findUnique({
        where: { id: epicId },
        include: {
          stories: {
            include: {
              tasks: {
                include: {
                  instructions: true
                }
              }
            }
          }
        }
      });

      if (!epic) {
        throw new Error(`Epic not found: ${epicId}`);
      }

      const epicProgress = this.calculateProgress(
        epic.stories.filter(s => s.status === ModelStatus.COMPLETED).length,
        epic.stories.length
      );

      const stories = epic.stories.map(story => {
        const storyProgress = this.calculateProgress(
          story.tasks.filter(t => t.status === ModelStatus.COMPLETED).length,
          story.tasks.length
        );

        const tasks = story.tasks.map(task => {
          const completedInstructions = task.instructions.filter(
            i => i.status === ModelStatus.COMPLETED
          ).length;
          const totalInstructions = task.instructions.length;
          const taskProgress = this.calculateProgress(completedInstructions, totalInstructions);

          return {
            taskId: task.id,
            taskProgress,
            completedInstructions,
            totalInstructions
          };
        });

        return {
          storyId: story.id,
          storyProgress,
          tasks
        };
      });

      return {
        epicId: epic.id,
        epicProgress,
        stories
      };
    } catch (error) {
      this.emit('progress:error', { epicId, error });
      throw error;
    }
  }

  // ===== 驗證 =====

  async validateHierarchy(epicId: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const epic = await this.getEpic(epicId, true);
      
      if (!epic) {
        errors.push(`Epic not found: ${epicId}`);
        return { isValid: false, errors, warnings };
      }

      // 驗證 Epic
      if (!epic.title) errors.push('Epic missing title');
      if (!epic.projectId) errors.push('Epic missing projectId');

      // 驗證 Stories
      if (!epic.stories || epic.stories.length === 0) {
        warnings.push('Epic has no stories');
      } else {
        for (const story of epic.stories) {
          if (!story.title) errors.push(`Story ${story.id} missing title`);
          
          // 驗證 Tasks
          if (!story.tasks || story.tasks.length === 0) {
            warnings.push(`Story ${story.id} has no tasks`);
          } else {
            for (const task of story.tasks) {
              if (!task.title) errors.push(`Task ${task.id} missing title`);
              if (!task.type) errors.push(`Task ${task.id} missing type`);
              
              // 驗證 Instructions
              if (!task.instructions || task.instructions.length === 0) {
                warnings.push(`Task ${task.id} has no instructions`);
              } else {
                const sequences = new Set<number>();
                for (const instruction of task.instructions) {
                  if (!instruction.directive) {
                    errors.push(`Instruction ${instruction.id} missing directive`);
                  }
                  if (!instruction.expectedOutcome) {
                    errors.push(`Instruction ${instruction.id} missing expectedOutcome`);
                  }
                  if (sequences.has(instruction.sequence)) {
                    errors.push(`Duplicate sequence ${instruction.sequence} in task ${task.id}`);
                  }
                  sequences.add(instruction.sequence);
                }
              }
            }
          }
        }
      }

      // 檢查循環依賴
      const hasCyclicDependency = await this.checkCyclicDependencies(epicId);
      if (hasCyclicDependency) {
        errors.push('Cyclic dependency detected in hierarchy');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      this.emit('validation:error', { epicId, error });
      throw error;
    }
  }

  // ===== 私有輔助方法 =====

  private async updateEpicTokenUsage(epicId: string): Promise<void> {
    const stories = await this.prisma.story.findMany({
      where: { epicId },
      include: {
        tasks: {
          include: {
            instructions: true
          }
        }
      }
    });

    let totalTokenUsage = 0;
    stories.forEach(story => {
      totalTokenUsage += story.tokenUsage;
      story.tasks.forEach(task => {
        task.instructions.forEach(instruction => {
          totalTokenUsage += instruction.tokenUsage;
        });
      });
    });

    await this.prisma.epic.update({
      where: { id: epicId },
      data: { tokenUsage: totalTokenUsage }
    });
  }

  private async updateTokenUsageChain(taskId: string, additionalTokens: number): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { story: true }
    });

    if (!task) return;

    // 更新 Story 的 token 使用
    await this.prisma.story.update({
      where: { id: task.storyId },
      data: {
        tokenUsage: {
          increment: additionalTokens
        }
      }
    });

    // 更新 Epic 的 token 使用
    await this.prisma.epic.update({
      where: { id: task.story.epicId },
      data: {
        tokenUsage: {
          increment: additionalTokens
        }
      }
    });
  }

  private calculateProgress(completed: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }

  private async checkCyclicDependencies(epicId: string): Promise<boolean> {
    // 簡化的循環依賴檢查
    // TODO: 實作更完整的圖遍歷算法
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = async (id: string): Promise<boolean> => {
      visited.add(id);
      recursionStack.add(id);

      const dependencies = await this.prisma.epicDependency.findMany({
        where: { dependentEpicId: id }
      });

      for (const dep of dependencies) {
        if (!visited.has(dep.requiredEpicId)) {
          if (await hasCycle(dep.requiredEpicId)) {
            return true;
          }
        } else if (recursionStack.has(dep.requiredEpicId)) {
          return true;
        }
      }

      recursionStack.delete(id);
      return false;
    };

    return await hasCycle(epicId);
  }

  /**
   * 清理資源
   */
  async cleanup(): Promise<void> {
    this.removeAllListeners();
  }
}