/**
 * ProjectAgent 與 HierarchyManager 整合
 */

import { EventEmitter } from 'events';
import { ProjectAgent, AgentState, ProjectPhase } from './project-agent';
import { HierarchyManager } from '../models/hierarchy-manager';
import { 
  ModelStatus, 
  TaskType, 
  Priority,
  type Epic,
  type Story, 
  type Task,
  type Instruction,
  type CreateEpicInput,
  type CreateStoryInput,
  type CreateTaskInput,
  type CreateInstructionInput,
  type InstructionExecutionResult
} from '../models/types';
import { PrismaClient } from '@prisma/client';

/**
 * ProjectAgent 與階層化結構的整合器
 */
export class HierarchyIntegration extends EventEmitter {
  private projectAgent: ProjectAgent;
  private hierarchyManager: HierarchyManager;
  private currentEpicId?: string;
  private currentStoryId?: string;
  private currentTaskId?: string;
  private currentInstructionId?: string;

  constructor(projectAgent: ProjectAgent, hierarchyManager: HierarchyManager) {
    super();
    this.projectAgent = projectAgent;
    this.hierarchyManager = hierarchyManager;
    this.setupEventListeners();
  }

  /**
   * 設定事件監聽器
   */
  private setupEventListeners(): void {
    // 監聽 ProjectAgent 的階段轉換
    this.projectAgent.on('phase:transition', async ({ from, to }) => {
      await this.handlePhaseTransition(from, to);
    });

    // 監聽 ProjectAgent 的任務更新
    this.projectAgent.on('task:completed', async ({ taskId }) => {
      await this.handleTaskCompletion(taskId);
    });

    // 監聽 HierarchyManager 的事件
    this.hierarchyManager.on('instruction:updated', async (instruction: Instruction) => {
      if (instruction.status === ModelStatus.COMPLETED) {
        await this.handleInstructionCompletion(instruction);
      }
    });
  }

  /**
   * 為專案創建初始史詩
   */
  async createProjectEpic(
    projectId: string, 
    phase: ProjectPhase,
    requirements?: Record<string, any>
  ): Promise<Epic> {
    const epicData: CreateEpicInput = {
      projectId,
      title: this.generateEpicTitle(phase, requirements),
      description: this.generateEpicDescription(phase, requirements),
      businessValue: this.generateBusinessValue(phase, requirements),
      acceptanceCriteria: this.generateAcceptanceCriteria(phase, requirements),
      priority: this.determinePriority(phase),
      phase: phase,
      estimatedEffort: this.estimateEffort(phase, requirements),
      createdBy: 'ProjectAgent'
    };

    const epic = await this.hierarchyManager.createEpic(epicData);
    this.currentEpicId = epic.id;

    // 更新 ProjectAgent 的脈絡
    await this.projectAgent.updateCurrentTask(epic.id);

    this.emit('epic:created', { epic, phase, requirements });
    return epic;
  }

  /**
   * 基於對話生成故事
   */
  async generateStoriesFromConversation(
    epicId: string,
    conversationHistory: any[]
  ): Promise<Story[]> {
    const stories: Story[] = [];
    const requirements = this.extractRequirementsFromConversation(conversationHistory);

    for (const requirement of requirements) {
      const storyData: CreateStoryInput = {
        epicId,
        title: requirement.title,
        userStory: requirement.userStory,
        description: requirement.description,
        acceptanceCriteria: requirement.acceptanceCriteria,
        priority: requirement.priority || Priority.MEDIUM,
        storyPoints: this.estimateStoryPoints(requirement)
      };

      const story = await this.hierarchyManager.createStory(storyData);
      stories.push(story);
    }

    this.emit('stories:generated', { epicId, stories, requirements });
    return stories;
  }

  /**
   * 為故事生成任務
   */
  async generateTasksForStory(storyId: string): Promise<Task[]> {
    const story = await this.hierarchyManager.getStory(storyId, true);
    if (!story) throw new Error(`Story not found: ${storyId}`);

    const tasks: Task[] = [];
    const taskTemplates = this.generateTaskTemplates(story);

    for (const template of taskTemplates) {
      const taskData: CreateTaskInput = {
        storyId: story.id,
        title: template.title,
        description: template.description,
        type: template.type,
        acceptanceCriteria: template.acceptanceCriteria,
        expectedOutcome: template.expectedOutcome,
        priority: template.priority,
        estimatedTime: template.estimatedTime,
        assignedAgent: template.assignedAgent
      };

      const task = await this.hierarchyManager.createTask(taskData);
      tasks.push(task);
    }

    this.emit('tasks:generated', { storyId, tasks });
    return tasks;
  }

  /**
   * 為任務生成指令
   */
  async generateInstructionsForTask(taskId: string): Promise<Instruction[]> {
    const task = await this.hierarchyManager.getTask(taskId, true);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const instructions: Instruction[] = [];
    const instructionTemplates = this.generateInstructionTemplates(task);

    for (let i = 0; i < instructionTemplates.length; i++) {
      const template = instructionTemplates[i];
      const instructionData: CreateInstructionInput = {
        taskId: task.id,
        directive: template.directive,
        expectedOutcome: template.expectedOutcome,
        validationCriteria: template.validationCriteria,
        sequence: i + 1
      };

      const instruction = await this.hierarchyManager.createInstruction(instructionData);
      instructions.push(instruction);
    }

    this.emit('instructions:generated', { taskId, instructions });
    return instructions;
  }

  /**
   * 執行指令
   */
  async executeInstruction(instructionId: string): Promise<InstructionExecutionResult> {
    const instruction = await this.hierarchyManager.getInstruction(instructionId);
    if (!instruction) {
      throw new Error(`Instruction not found: ${instructionId}`);
    }

    this.currentInstructionId = instructionId;

    // 更新狀態為執行中
    await this.hierarchyManager.updateInstruction(instructionId, {
      status: ModelStatus.IN_PROGRESS
    });

    const startTime = Date.now();

    try {
      // 使用 ProjectAgent 執行指令
      const result = await this.projectAgent.executeInstruction(instruction);
      const executionTime = Date.now() - startTime;

      // 更新指令執行結果
      await this.hierarchyManager.updateInstruction(instructionId, {
        status: result.success ? ModelStatus.COMPLETED : ModelStatus.FAILED,
        output: result.output,
        error: result.error,
        tokenUsage: result.tokenUsage?.total || 0,
        executionTime,
        executedBy: 'ProjectAgent'
      });

      const executionResult: InstructionExecutionResult = {
        instructionId,
        success: result.success,
        output: result.output,
        error: result.error,
        tokenUsage: result.tokenUsage?.total || 0,
        executionTime,
        timestamp: new Date()
      };

      this.emit('instruction:executed', executionResult);
      return executionResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.hierarchyManager.updateInstruction(instructionId, {
        status: ModelStatus.FAILED,
        error: errorMessage,
        executionTime,
        executedBy: 'ProjectAgent'
      });

      const executionResult: InstructionExecutionResult = {
        instructionId,
        success: false,
        error: errorMessage,
        tokenUsage: 0,
        executionTime,
        timestamp: new Date()
      };

      this.emit('instruction:failed', executionResult);
      return executionResult;
    }
  }

  /**
   * 取得下一個待執行指令
   */
  async getNextInstruction(): Promise<Instruction | null> {
    if (!this.currentTaskId) return null;

    const pendingInstructions = await this.hierarchyManager.listInstructions({
      taskId: this.currentTaskId,
      status: ModelStatus.PENDING
    });

    return pendingInstructions.length > 0 ? pendingInstructions[0] : null;
  }

  /**
   * 處理階段轉換
   */
  private async handlePhaseTransition(from: ProjectPhase, to: ProjectPhase): Promise<void> {
    if (this.currentEpicId) {
      await this.hierarchyManager.updateEpic(this.currentEpicId, {
        phase: to
      });
      
      this.emit('phase:updated', { epicId: this.currentEpicId, from, to });
    }
  }

  /**
   * 處理任務完成
   */
  private async handleTaskCompletion(taskId: string): Promise<void> {
    const task = await this.hierarchyManager.getTask(taskId);
    if (task) {
      await this.hierarchyManager.updateTask(taskId, {
        status: ModelStatus.COMPLETED
      });

      // 檢查故事是否完成
      await this.checkStoryCompletion(task.storyId);
    }
  }

  /**
   * 處理指令完成
   */
  private async handleInstructionCompletion(instruction: Instruction): Promise<void> {
    // 檢查任務是否完成
    await this.checkTaskCompletion(instruction.taskId);
  }

  /**
   * 檢查任務是否完成
   */
  private async checkTaskCompletion(taskId: string): Promise<void> {
    const instructions = await this.hierarchyManager.listInstructions({ taskId });
    const completedInstructions = instructions.filter(i => i.status === ModelStatus.COMPLETED);

    if (completedInstructions.length === instructions.length && instructions.length > 0) {
      await this.hierarchyManager.updateTask(taskId, {
        status: ModelStatus.COMPLETED
      });

      const task = await this.hierarchyManager.getTask(taskId);
      if (task) {
        await this.checkStoryCompletion(task.storyId);
      }
    }
  }

  /**
   * 檢查故事是否完成
   */
  private async checkStoryCompletion(storyId: string): Promise<void> {
    const tasks = await this.hierarchyManager.listTasks({ storyId });
    const completedTasks = tasks.filter(t => t.status === ModelStatus.COMPLETED);

    if (completedTasks.length === tasks.length && tasks.length > 0) {
      await this.hierarchyManager.updateStory(storyId, {
        status: ModelStatus.COMPLETED
      });

      const story = await this.hierarchyManager.getStory(storyId);
      if (story) {
        await this.checkEpicCompletion(story.epicId);
      }
    }
  }

  /**
   * 檢查史詩是否完成
   */
  private async checkEpicCompletion(epicId: string): Promise<void> {
    const stories = await this.hierarchyManager.listStories({ epicId });
    const completedStories = stories.filter(s => s.status === ModelStatus.COMPLETED);

    if (completedStories.length === stories.length && stories.length > 0) {
      await this.hierarchyManager.updateEpic(epicId, {
        status: ModelStatus.COMPLETED
      });

      this.emit('epic:completed', { epicId });
    }
  }

  // ===== 輔助方法 =====

  private generateEpicTitle(phase: ProjectPhase, requirements?: Record<string, any>): string {
    const phaseNames = {
      [ProjectPhase.REQUIREMENTS]: '需求分析與規劃',
      [ProjectPhase.MVP]: 'MVP開發',
      [ProjectPhase.CONTINUOUS]: '持續改進與優化'
    };

    return phaseNames[phase] || '專案開發';
  }

  private generateEpicDescription(phase: ProjectPhase, requirements?: Record<string, any>): string {
    const descriptions = {
      [ProjectPhase.REQUIREMENTS]: '收集、分析和驗證專案需求，建立完整的功能規格',
      [ProjectPhase.MVP]: '開發最小可行產品，實作核心功能',
      [ProjectPhase.CONTINUOUS]: '根據用戶反饋持續改進產品功能'
    };

    return descriptions[phase] || '專案開發相關工作';
  }

  private generateBusinessValue(phase: ProjectPhase, requirements?: Record<string, any>): string {
    return '為用戶提供價值，提升產品競爭力';
  }

  private generateAcceptanceCriteria(phase: ProjectPhase, requirements?: Record<string, any>): string {
    const criteria = {
      [ProjectPhase.REQUIREMENTS]: '- 完成需求收集\n- 建立功能規格\n- 用戶驗收',
      [ProjectPhase.MVP]: '- 核心功能可用\n- 基本測試通過\n- 可部署到生產環境',
      [ProjectPhase.CONTINUOUS]: '- 新功能上線\n- 效能指標達標\n- 用戶滿意度提升'
    };

    return criteria[phase] || '功能正常運作';
  }

  private determinePriority(phase: ProjectPhase): Priority {
    return phase === ProjectPhase.MVP ? Priority.HIGH : Priority.MEDIUM;
  }

  private estimateEffort(phase: ProjectPhase, requirements?: Record<string, any>): number {
    const efforts = {
      [ProjectPhase.REQUIREMENTS]: 8,
      [ProjectPhase.MVP]: 21,
      [ProjectPhase.CONTINUOUS]: 13
    };

    return efforts[phase] || 13;
  }

  private extractRequirementsFromConversation(conversationHistory: any[]): any[] {
    // 簡化的需求提取邏輯
    return [
      {
        title: '用戶認證功能',
        userStory: 'As a user, I want to authenticate so that I can access the system',
        description: '實作用戶註冊、登入、登出功能',
        acceptanceCriteria: '- 用戶可以註冊\n- 用戶可以登入\n- 用戶可以安全登出',
        priority: Priority.HIGH
      }
    ];
  }

  private estimateStoryPoints(requirement: any): number {
    // 簡化的故事點估算
    return 5;
  }

  private generateTaskTemplates(story: Story): any[] {
    return [
      {
        title: '前端開發任務',
        description: `為故事 "${story.title}" 開發前端元件`,
        type: TaskType.DEV,
        acceptanceCriteria: 'UI元件正常運作',
        expectedOutcome: '前端功能完成',
        priority: Priority.MEDIUM,
        estimatedTime: 240,
        assignedAgent: 'Frontend Developer'
      },
      {
        title: '後端開發任務',
        description: `為故事 "${story.title}" 開發後端邏輯`,
        type: TaskType.DEV,
        acceptanceCriteria: 'API正常回應',
        expectedOutcome: '後端功能完成',
        priority: Priority.MEDIUM,
        estimatedTime: 180,
        assignedAgent: 'Backend Developer'
      }
    ];
  }

  private generateInstructionTemplates(task: Task): any[] {
    const baseInstructions = [
      {
        directive: `分析任務需求：${task.title}`,
        expectedOutcome: '需求分析完成',
        validationCriteria: '需求清晰明確'
      },
      {
        directive: `實作任務：${task.title}`,
        expectedOutcome: '功能實作完成',
        validationCriteria: '功能正常運作'
      },
      {
        directive: `測試任務：${task.title}`,
        expectedOutcome: '測試完成',
        validationCriteria: '所有測試通過'
      }
    ];

    return baseInstructions;
  }

  /**
   * 取得當前狀態
   */
  getCurrentState(): {
    epicId?: string;
    storyId?: string;
    taskId?: string;
    instructionId?: string;
  } {
    return {
      epicId: this.currentEpicId,
      storyId: this.currentStoryId,
      taskId: this.currentTaskId,
      instructionId: this.currentInstructionId
    };
  }

  /**
   * 設定當前狀態
   */
  setCurrentState(state: {
    epicId?: string;
    storyId?: string;
    taskId?: string;
    instructionId?: string;
  }): void {
    this.currentEpicId = state.epicId;
    this.currentStoryId = state.storyId;
    this.currentTaskId = state.taskId;
    this.currentInstructionId = state.instructionId;
  }

  /**
   * 清理資源
   */
  async cleanup(): Promise<void> {
    this.removeAllListeners();
    await this.hierarchyManager.cleanup();
  }
}