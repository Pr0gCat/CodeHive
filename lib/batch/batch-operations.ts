/**
 * 批量操作管理器
 * 提供批量處理和工作流程自動化功能
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { SmartCoordinator } from '@/lib/agents/smart-coordinator';
import { hierarchyBroadcaster } from '@/lib/socket/server';
import { ModelStatus, Priority } from '@/lib/models/types';

export interface BatchOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'execute' | 'workflow';
  targetType: 'epic' | 'story' | 'task' | 'instruction';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  errors: BatchError[];
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number; // 毫秒
  metadata: Record<string, any>;
  createdBy: string;
}

export interface BatchError {
  itemId: string;
  error: string;
  timestamp: Date;
}

export interface BatchCreateInput {
  type: BatchOperation['type'];
  targetType: BatchOperation['targetType'];
  items: any[];
  options?: {
    continueOnError?: boolean;
    maxConcurrency?: number;
    delay?: number; // 項目間延遲（毫秒）
    validateFirst?: boolean;
  };
  metadata?: Record<string, any>;
  createdBy: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  conditions: WorkflowCondition[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowTrigger {
  type: 'epic_created' | 'story_completed' | 'task_failed' | 'manual' | 'schedule';
  conditions: Record<string, any>;
}

export interface WorkflowStep {
  id: string;
  type: 'create_stories' | 'create_tasks' | 'execute_instructions' | 'send_notification' | 'wait' | 'condition';
  config: Record<string, any>;
  dependsOn?: string[]; // 依賴的步驟ID
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
  };
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'exists';
  value: any;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  context: Record<string, any>;
  logs: WorkflowLog[];
}

export interface WorkflowLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  stepId?: string;
  data?: Record<string, any>;
}

export class BatchOperationsManager extends EventEmitter {
  private operations: Map<string, BatchOperation> = new Map();
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private processingQueues: Map<string, any[]> = new Map();

  constructor(
    private prisma: PrismaClient,
    private hierarchyManager: HierarchyManager,
    private coordinator?: SmartCoordinator
  ) {
    super();
    this.initializeDefaultWorkflows();
    this.setupEventListeners();
  }

  /**
   * 初始化預設工作流程
   */
  private initializeDefaultWorkflows() {
    const defaultWorkflows: WorkflowDefinition[] = [
      {
        id: 'epic-to-stories',
        name: '史詩自動分解',
        description: '當新史詩創建時，自動生成用戶故事',
        triggers: [
          {
            type: 'epic_created',
            conditions: { autoGenerate: true }
          }
        ],
        steps: [
          {
            id: 'analyze-epic',
            type: 'create_stories',
            config: {
              maxStories: 10,
              analysisDepth: 'detailed'
            }
          },
          {
            id: 'notify-team',
            type: 'send_notification',
            config: {
              message: '新史詩已創建並分解為用戶故事',
              channels: ['system']
            },
            dependsOn: ['analyze-epic']
          }
        ],
        conditions: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'story-to-tasks',
        name: '故事自動任務化',
        description: '當故事完成分析時，自動生成開發任務',
        triggers: [
          {
            type: 'story_completed',
            conditions: { status: 'analyzed' }
          }
        ],
        steps: [
          {
            id: 'create-dev-tasks',
            type: 'create_tasks',
            config: {
              taskTypes: ['DEV', 'TEST', 'REVIEW'],
              estimateTime: true
            }
          },
          {
            id: 'coordinate-agents',
            type: 'execute_instructions',
            config: {
              strategy: 'skill-matched',
              priority: 'medium'
            },
            dependsOn: ['create-dev-tasks']
          }
        ],
        conditions: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultWorkflows.forEach(workflow => {
      this.workflows.set(workflow.id, workflow);
    });
  }

  /**
   * 設置事件監聽器
   */
  private setupEventListeners() {
    // 監聽階層管理器事件
    this.hierarchyManager.on('epic:created', (epic) => {
      this.triggerWorkflows('epic_created', { epic });
    });

    this.hierarchyManager.on('story:updated', (story) => {
      if (story.status === ModelStatus.COMPLETED) {
        this.triggerWorkflows('story_completed', { story });
      }
    });

    this.hierarchyManager.on('task:failed', (task) => {
      this.triggerWorkflows('task_failed', { task });
    });
  }

  /**
   * 創建批量操作
   */
  async createBatchOperation(input: BatchCreateInput): Promise<string> {
    const operationId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const operation: BatchOperation = {
      id: operationId,
      type: input.type,
      targetType: input.targetType,
      status: 'pending',
      progress: 0,
      totalItems: input.items.length,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      errors: [],
      metadata: input.metadata || {},
      createdBy: input.createdBy,
      estimatedDuration: this.estimateDuration(input.type, input.items.length)
    };

    this.operations.set(operationId, operation);

    // 如果需要驗證，先執行驗證
    if (input.options?.validateFirst) {
      await this.validateBatchItems(operation, input.items);
      if (operation.errors.length > 0 && !input.options.continueOnError) {
        operation.status = 'failed';
        this.emit('batch:failed', operation);
        return operationId;
      }
    }

    // 開始處理
    this.processBatchOperation(operation, input.items, input.options);

    this.emit('batch:created', operation);
    
    // 廣播批量操作狀態
    hierarchyBroadcaster.sendSystemNotification(
      'info',
      `批量操作已開始: ${operation.type} ${operation.targetType}`,
      'system'
    );

    return operationId;
  }

  /**
   * 估算執行時間
   */
  private estimateDuration(type: string, itemCount: number): number {
    const baseTime = {
      'create': 1000,  // 1秒每項
      'update': 500,   // 0.5秒每項
      'delete': 300,   // 0.3秒每項
      'execute': 5000, // 5秒每項
      'workflow': 3000 // 3秒每項
    };

    return (baseTime[type as keyof typeof baseTime] || 1000) * itemCount;
  }

  /**
   * 驗證批量項目
   */
  private async validateBatchItems(operation: BatchOperation, items: any[]) {
    for (const item of items) {
      try {
        await this.validateItem(operation.type, operation.targetType, item);
      } catch (error) {
        operation.errors.push({
          itemId: item.id || item.title || 'unknown',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * 驗證單個項目
   */
  private async validateItem(type: string, targetType: string, item: any) {
    switch (`${type}-${targetType}`) {
      case 'create-epic':
        if (!item.title || !item.projectId) {
          throw new Error('Epic 需要 title 和 projectId');
        }
        break;
      case 'create-story':
        if (!item.title || !item.epicId) {
          throw new Error('Story 需要 title 和 epicId');
        }
        break;
      case 'create-task':
        if (!item.title || !item.storyId || !item.type) {
          throw new Error('Task 需要 title、storyId 和 type');
        }
        break;
      case 'create-instruction':
        if (!item.directive || !item.taskId) {
          throw new Error('Instruction 需要 directive 和 taskId');
        }
        break;
    }
  }

  /**
   * 處理批量操作
   */
  private async processBatchOperation(
    operation: BatchOperation,
    items: any[],
    options?: BatchCreateInput['options']
  ) {
    operation.status = 'running';
    operation.startedAt = new Date();
    
    const maxConcurrency = options?.maxConcurrency || 5;
    const delay = options?.delay || 100;
    const continueOnError = options?.continueOnError ?? true;

    // 使用 Promise 池進行並行處理
    const processingPool = new Set<Promise<void>>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // 如果池子滿了，等待有空位
      if (processingPool.size >= maxConcurrency) {
        await Promise.race(processingPool);
      }

      const processPromise = this.processItem(operation, item, i)
        .finally(() => {
          processingPool.delete(processPromise);
          this.updateOperationProgress(operation);
        });

      processingPool.add(processPromise);

      // 項目間延遲
      if (delay > 0 && i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // 如果遇到錯誤且不繼續，停止處理
      if (!continueOnError && operation.errors.length > 0) {
        break;
      }
    }

    // 等待所有處理完成
    await Promise.all(processingPool);

    // 完成操作
    operation.completedAt = new Date();
    operation.status = operation.failedItems > 0 ? 
      (operation.successfulItems > 0 ? 'completed' : 'failed') : 
      'completed';

    this.emit('batch:completed', operation);
    
    // 廣播完成狀態
    hierarchyBroadcaster.sendSystemNotification(
      operation.status === 'completed' ? 'info' : 'warning',
      `批量操作完成: ${operation.successfulItems}/${operation.totalItems} 成功`,
      'system'
    );
  }

  /**
   * 處理單個項目
   */
  private async processItem(operation: BatchOperation, item: any, index: number) {
    try {
      switch (`${operation.type}-${operation.targetType}`) {
        case 'create-epic':
          await this.hierarchyManager.createEpic(item);
          break;
        case 'create-story':
          await this.hierarchyManager.createStory(item);
          break;
        case 'create-task':
          await this.hierarchyManager.createTask(item);
          break;
        case 'create-instruction':
          await this.hierarchyManager.createInstruction(item);
          break;
        case 'update-epic':
          await this.hierarchyManager.updateEpic(item.id, item);
          break;
        case 'update-story':
          await this.hierarchyManager.updateStory(item.id, item);
          break;
        case 'update-task':
          await this.hierarchyManager.updateTask(item.id, item);
          break;
        case 'update-instruction':
          await this.hierarchyManager.updateInstruction(item.id, item);
          break;
        case 'execute-instruction':
          // 這裡會整合指令執行邏輯
          await this.executeInstructionItem(item);
          break;
        default:
          throw new Error(`不支援的操作: ${operation.type}-${operation.targetType}`);
      }
      
      operation.successfulItems++;
      
    } catch (error) {
      operation.errors.push({
        itemId: item.id || item.title || `item-${index}`,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      operation.failedItems++;
    }
    
    operation.processedItems++;
  }

  /**
   * 執行指令項目
   */
  private async executeInstructionItem(item: any) {
    // 這裡會整合實際的指令執行邏輯
    // 目前使用模擬執行
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% 成功率
          resolve({ success: true, output: '模擬執行成功' });
        } else {
          reject(new Error('模擬執行失敗'));
        }
      }, 2000);
    });
  }

  /**
   * 更新操作進度
   */
  private updateOperationProgress(operation: BatchOperation) {
    operation.progress = Math.round((operation.processedItems / operation.totalItems) * 100);
    
    this.emit('batch:progress', {
      operationId: operation.id,
      progress: operation.progress,
      processedItems: operation.processedItems,
      totalItems: operation.totalItems
    });

    // 廣播進度更新
    hierarchyBroadcaster.sendSystemNotification(
      'info',
      `批量操作進度: ${operation.progress}% (${operation.processedItems}/${operation.totalItems})`,
      'system'
    );
  }

  /**
   * 觸發工作流程
   */
  private async triggerWorkflows(triggerType: string, context: Record<string, any>) {
    const applicableWorkflows = Array.from(this.workflows.values()).filter(
      workflow => workflow.isActive && 
      workflow.triggers.some(trigger => trigger.type === triggerType)
    );

    for (const workflow of applicableWorkflows) {
      await this.executeWorkflow(workflow.id, context);
    }
  }

  /**
   * 執行工作流程
   */
  async executeWorkflow(workflowId: string, context: Record<string, any> = {}): Promise<string> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`工作流程不存在: ${workflowId}`);
    }

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'running',
      progress: 0,
      startedAt: new Date(),
      context,
      logs: []
    };

    this.executions.set(executionId, execution);

    // 添加日誌
    this.addWorkflowLog(execution, 'info', `工作流程開始執行: ${workflow.name}`);

    try {
      await this.executeWorkflowSteps(execution, workflow);
      
      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.progress = 100;
      
      this.addWorkflowLog(execution, 'info', '工作流程執行完成');
      
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      
      this.addWorkflowLog(
        execution, 
        'error', 
        `工作流程執行失敗: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    this.emit('workflow:completed', execution);
    
    // 廣播工作流程狀態
    hierarchyBroadcaster.sendSystemNotification(
      execution.status === 'completed' ? 'info' : 'error',
      `工作流程 ${workflow.name} ${execution.status === 'completed' ? '完成' : '失敗'}`,
      'system'
    );

    return executionId;
  }

  /**
   * 執行工作流程步驟
   */
  private async executeWorkflowSteps(execution: WorkflowExecution, workflow: WorkflowDefinition) {
    const completedSteps = new Set<string>();
    
    for (const step of workflow.steps) {
      // 檢查依賴
      if (step.dependsOn) {
        const dependenciesMet = step.dependsOn.every(dep => completedSteps.has(dep));
        if (!dependenciesMet) {
          this.addWorkflowLog(execution, 'warn', `步驟 ${step.id} 依賴未滿足，跳過`);
          continue;
        }
      }

      execution.currentStep = step.id;
      this.addWorkflowLog(execution, 'info', `執行步驟: ${step.id}`);

      try {
        await this.executeWorkflowStep(execution, step);
        completedSteps.add(step.id);
        
        execution.progress = Math.round((completedSteps.size / workflow.steps.length) * 100);
        
      } catch (error) {
        this.addWorkflowLog(
          execution,
          'error',
          `步驟 ${step.id} 執行失敗: ${error instanceof Error ? error.message : String(error)}`
        );

        // 如果有重試策略，執行重試
        if (step.retryPolicy) {
          let retryCount = 0;
          while (retryCount < step.retryPolicy.maxRetries) {
            retryCount++;
            this.addWorkflowLog(execution, 'info', `重試步驟 ${step.id} (${retryCount}/${step.retryPolicy.maxRetries})`);
            
            await new Promise(resolve => setTimeout(resolve, step.retryPolicy!.retryDelay));
            
            try {
              await this.executeWorkflowStep(execution, step);
              completedSteps.add(step.id);
              break;
            } catch (retryError) {
              if (retryCount >= step.retryPolicy.maxRetries) {
                throw retryError;
              }
            }
          }
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * 執行單個工作流程步驟
   */
  private async executeWorkflowStep(execution: WorkflowExecution, step: WorkflowStep) {
    switch (step.type) {
      case 'create_stories':
        await this.executeCreateStoriesStep(execution, step);
        break;
      case 'create_tasks':
        await this.executeCreateTasksStep(execution, step);
        break;
      case 'execute_instructions':
        await this.executeInstructionsStep(execution, step);
        break;
      case 'send_notification':
        await this.executeSendNotificationStep(execution, step);
        break;
      case 'wait':
        await this.executeWaitStep(execution, step);
        break;
      default:
        throw new Error(`不支援的步驟類型: ${step.type}`);
    }
  }

  /**
   * 執行創建故事步驟
   */
  private async executeCreateStoriesStep(execution: WorkflowExecution, step: WorkflowStep) {
    const { epic } = execution.context;
    if (!epic) {
      throw new Error('缺少 epic 上下文');
    }

    const maxStories = step.config.maxStories || 5;
    
    // 這裡會整合實際的故事生成邏輯
    // 目前使用模擬生成
    for (let i = 1; i <= maxStories; i++) {
      await this.hierarchyManager.createStory({
        epicId: epic.id,
        title: `自動生成故事 ${i}`,
        userStory: `作為用戶，我想要功能 ${i}`,
        priority: Priority.MEDIUM
      });
    }
    
    this.addWorkflowLog(execution, 'info', `已生成 ${maxStories} 個用戶故事`);
  }

  /**
   * 執行創建任務步驟
   */
  private async executeCreateTasksStep(execution: WorkflowExecution, step: WorkflowStep) {
    const { story } = execution.context;
    if (!story) {
      throw new Error('缺少 story 上下文');
    }

    const taskTypes = step.config.taskTypes || ['DEV'];
    
    for (const taskType of taskTypes) {
      await this.hierarchyManager.createTask({
        storyId: story.id,
        title: `${taskType} 任務 - ${story.title}`,
        type: taskType,
        priority: Priority.MEDIUM
      });
    }
    
    this.addWorkflowLog(execution, 'info', `已生成 ${taskTypes.length} 個開發任務`);
  }

  /**
   * 執行指令執行步驟
   */
  private async executeInstructionsStep(execution: WorkflowExecution, step: WorkflowStep) {
    if (!this.coordinator) {
      throw new Error('需要代理協調器來執行指令');
    }

    const { epic } = execution.context;
    const strategy = step.config.strategy || 'skill-matched';
    
    await this.coordinator.coordinateExecution(epic.projectId, strategy, {
      epicId: epic.id
    });
    
    this.addWorkflowLog(execution, 'info', `已使用策略 ${strategy} 協調指令執行`);
  }

  /**
   * 執行發送通知步驟
   */
  private async executeSendNotificationStep(execution: WorkflowExecution, step: WorkflowStep) {
    const message = step.config.message || '工作流程通知';
    const channels = step.config.channels || ['system'];
    
    for (const channel of channels) {
      hierarchyBroadcaster.sendSystemNotification('info', message, channel);
    }
    
    this.addWorkflowLog(execution, 'info', `已發送通知到 ${channels.join(', ')}`);
  }

  /**
   * 執行等待步驟
   */
  private async executeWaitStep(execution: WorkflowExecution, step: WorkflowStep) {
    const duration = step.config.duration || 1000;
    
    this.addWorkflowLog(execution, 'info', `等待 ${duration}ms`);
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * 添加工作流程日誌
   */
  private addWorkflowLog(
    execution: WorkflowExecution,
    level: 'info' | 'warn' | 'error',
    message: string,
    stepId?: string,
    data?: Record<string, any>
  ) {
    execution.logs.push({
      timestamp: new Date(),
      level,
      message,
      stepId,
      data
    });
  }

  /**
   * 取消批量操作
   */
  async cancelBatchOperation(operationId: string): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`批量操作不存在: ${operationId}`);
    }

    if (operation.status !== 'running') {
      throw new Error(`無法取消狀態為 ${operation.status} 的操作`);
    }

    operation.status = 'cancelled';
    operation.completedAt = new Date();
    
    this.emit('batch:cancelled', operation);
    
    hierarchyBroadcaster.sendSystemNotification(
      'info',
      `批量操作已取消: ${operationId}`,
      'system'
    );
  }

  /**
   * 獲取批量操作狀態
   */
  getBatchOperation(operationId: string): BatchOperation | undefined {
    return this.operations.get(operationId);
  }

  /**
   * 獲取所有批量操作
   */
  getAllBatchOperations(): BatchOperation[] {
    return Array.from(this.operations.values());
  }

  /**
   * 獲取工作流程執行狀態
   */
  getWorkflowExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * 獲取所有工作流程
   */
  getAllWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  /**
   * 添加新工作流程
   */
  addWorkflow(workflow: Omit<WorkflowDefinition, 'createdAt' | 'updatedAt'>): void {
    const fullWorkflow: WorkflowDefinition = {
      ...workflow,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.workflows.set(workflow.id, fullWorkflow);
    
    this.emit('workflow:added', fullWorkflow);
  }

  /**
   * 獲取批量操作統計
   */
  getBatchStats(): {
    totalOperations: number;
    runningOperations: number;
    completedOperations: number;
    failedOperations: number;
    totalItemsProcessed: number;
    successRate: number;
  } {
    const operations = Array.from(this.operations.values());
    
    const totalItemsProcessed = operations.reduce(
      (sum, op) => sum + op.processedItems, 0
    );
    
    const totalSuccessfulItems = operations.reduce(
      (sum, op) => sum + op.successfulItems, 0
    );
    
    return {
      totalOperations: operations.length,
      runningOperations: operations.filter(op => op.status === 'running').length,
      completedOperations: operations.filter(op => op.status === 'completed').length,
      failedOperations: operations.filter(op => op.status === 'failed').length,
      totalItemsProcessed,
      successRate: totalItemsProcessed > 0 ? (totalSuccessfulItems / totalItemsProcessed) : 0
    };
  }
}