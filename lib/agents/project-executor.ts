import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { ProjectAgent, Instruction } from './project-agent';
import { ClaudeCodeResult } from './claude-code-integration';
import { InstructionQueue, Priority, QueueItemStatus } from './instruction-queue';

/**
 * 執行器狀態
 */
export enum ExecutorStatus {
  STOPPED = 'stopped',      // 停止
  STARTING = 'starting',    // 啟動中
  RUNNING = 'running',      // 運行中
  PAUSING = 'pausing',      // 暫停中
  PAUSED = 'paused',        // 已暫停
  ERROR = 'error'           // 錯誤
}

/**
 * 執行器配置
 */
export interface ProjectExecutorConfig {
  projectId: string;
  pollingInterval?: number;  // 輪詢間隔（毫秒）
  maxRetries?: number;       // 最大重試次數
  retryDelay?: number;       // 重試延遲（毫秒）
  timeout?: number;          // 執行逾時（毫秒）
}

/**
 * 執行任務項目
 */
interface ExecutionTask {
  queueItemId: string;
  instruction: Instruction;
  startedAt: Date;
  timeoutId?: NodeJS.Timeout;
}

/**
 * 執行統計
 */
export interface ExecutionStats {
  totalExecuted: number;
  totalCompleted: number;
  totalFailed: number;
  totalRetries: number;
  averageExecutionTime: number;
  queueSize: number;
  uptime: number;
}

/**
 * 專案執行器 - 持續輪詢並執行指令
 */
export class ProjectExecutor extends EventEmitter {
  private prisma: PrismaClient;
  private projectAgent: ProjectAgent;
  private config: ProjectExecutorConfig;
  private status: ExecutorStatus = ExecutorStatus.STOPPED;
  private pollingTimer: NodeJS.Timer | null = null;
  private instructionQueue: InstructionQueue;
  private currentExecution: ExecutionTask | null = null;
  private stats: ExecutionStats;
  private startTime: Date | null = null;

  constructor(
    prisma: PrismaClient,
    projectAgent: ProjectAgent,
    config: ProjectExecutorConfig
  ) {
    super();
    this.prisma = prisma;
    this.projectAgent = projectAgent;
    this.config = {
      pollingInterval: 1000,    // 預設1秒輪詢
      maxRetries: 3,           // 預設重試3次
      retryDelay: 5000,        // 預設5秒重試延遲
      timeout: 300000,         // 預設5分鐘逾時
      ...config
    };

    // 初始化佇列
    this.instructionQueue = new InstructionQueue({
      maxConcurrent: 1,        // 一次只執行一個
      defaultRetries: this.config.maxRetries,
      defaultRetryDelay: this.config.retryDelay
    });

    // 初始化統計
    this.stats = {
      totalExecuted: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalRetries: 0,
      averageExecutionTime: 0,
      queueSize: 0,
      uptime: 0
    };

    // 監聽佇列事件
    this.setupQueueListeners();
  }

  /**
   * 啟動執行器
   */
  async start(): Promise<void> {
    if (this.status === ExecutorStatus.RUNNING) {
      return;
    }

    this.status = ExecutorStatus.STARTING;
    this.startTime = new Date();
    
    try {
      // 載入未完成的指令
      await this.loadPendingInstructions();

      // 開始輪詢
      this.startPolling();

      this.status = ExecutorStatus.RUNNING;
      this.emit('started', { projectId: this.config.projectId });
      
      console.log(`ProjectExecutor started for project ${this.config.projectId}`);
    } catch (error) {
      this.status = ExecutorStatus.ERROR;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 停止執行器
   */
  async stop(): Promise<void> {
    if (this.status === ExecutorStatus.STOPPED) {
      return;
    }

    this.status = ExecutorStatus.PAUSING;
    
    // 停止輪詢
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    // 等待當前執行完成
    if (this.currentExecution) {
      await this.waitForCurrentExecution();
    }

    this.status = ExecutorStatus.STOPPED;
    this.emit('stopped', { projectId: this.config.projectId });
    
    console.log(`ProjectExecutor stopped for project ${this.config.projectId}`);
  }

  /**
   * 暫停執行器
   */
  async pause(): Promise<void> {
    if (this.status !== ExecutorStatus.RUNNING) {
      return;
    }

    this.status = ExecutorStatus.PAUSING;
    
    // 停止輪詢但不清空佇列
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.status = ExecutorStatus.PAUSED;
    this.emit('paused', { projectId: this.config.projectId });
  }

  /**
   * 恢復執行器
   */
  async resume(): Promise<void> {
    if (this.status !== ExecutorStatus.PAUSED) {
      return;
    }

    // 重新開始輪詢
    this.startPolling();
    this.status = ExecutorStatus.RUNNING;
    this.emit('resumed', { projectId: this.config.projectId });
  }

  /**
   * 設定佇列監聽器
   */
  private setupQueueListeners(): void {
    this.instructionQueue.on('item:enqueued', (event) => {
      this.updateQueueStats();
      this.emit('instruction:queued', {
        instructionId: event.itemId,
        priority: event.priority,
        queueSize: event.queueSize
      });
    });

    this.instructionQueue.on('item:completed', (event) => {
      this.stats.totalCompleted++;
      this.updateExecutionTime(event.duration);
      this.emit('instruction:completed', event);
    });

    this.instructionQueue.on('item:failed', (event) => {
      this.stats.totalFailed++;
      this.emit('instruction:failed', event);
    });

    this.instructionQueue.on('item:retry', (event) => {
      this.stats.totalRetries++;
      this.emit('instruction:retrying', event);
    });

    this.instructionQueue.on('stats:updated', (stats) => {
      this.stats.queueSize = stats.totalItems;
      this.emit('stats:updated', this.stats);
    });
  }

  /**
   * 新增指令到佇列
   */
  async addInstruction(
    instruction: Instruction, 
    options: {
      priority?: Priority;
      tags?: string[];
      dependencies?: string[];
      estimatedDuration?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    const queueItemId = this.instructionQueue.enqueue(instruction, {
      priority: options.priority || Priority.NORMAL,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      tags: options.tags,
      dependencies: options.dependencies,
      estimatedDuration: options.estimatedDuration,
      metadata: options.metadata
    });

    return queueItemId;
  }

  /**
   * 移除指令從佇列
   */
  removeInstruction(instructionId: string): boolean {
    // 需要根據instruction ID找到對應的佇列項目
    const queueInfo = this.instructionQueue.getQueueInfo();
    const targetItem = queueInfo.pendingItems.find(item => {
      const queueItem = this.instructionQueue.getItem(item.id);
      return queueItem?.instruction.id === instructionId;
    });

    if (targetItem) {
      const cancelled = this.instructionQueue.cancel(targetItem.id);
      if (cancelled) {
        this.emit('instruction:removed', {
          instructionId,
          queueSize: this.instructionQueue.getStats().totalItems
        });
      }
      return cancelled;
    }

    return false;
  }

  /**
   * 重新排程指令優先級
   */
  rescheduleInstruction(instructionId: string, newPriority: Priority): boolean {
    const queueInfo = this.instructionQueue.getQueueInfo();
    const targetItem = queueInfo.pendingItems.find(item => {
      const queueItem = this.instructionQueue.getItem(item.id);
      return queueItem?.instruction.id === instructionId;
    });

    if (targetItem) {
      return this.instructionQueue.reschedule(targetItem.id, newPriority);
    }

    return false;
  }

  /**
   * 清空佇列
   */
  clearQueue(): void {
    const currentStats = this.instructionQueue.getStats();
    const clearedCount = currentStats.totalItems;
    
    this.instructionQueue.clear();
    
    this.emit('queue:cleared', { clearedCount });
  }

  /**
   * 開始輪詢
   */
  private startPolling(): void {
    this.pollingTimer = setInterval(async () => {
      try {
        await this.pollAndExecute();
      } catch (error) {
        this.emit('polling:error', error);
        console.error('Polling error:', error);
      }
    }, this.config.pollingInterval);
  }

  /**
   * 輪詢並執行
   */
  private async pollAndExecute(): Promise<void> {
    // 如果正在執行或暫停中，跳過
    if (this.currentExecution || this.status !== ExecutorStatus.RUNNING) {
      return;
    }

    // 從佇列取得下一個項目
    const nextItem = this.instructionQueue.dequeue();
    if (!nextItem) {
      return; // 佇列為空或沒有可執行的項目
    }

    // 建立執行任務
    this.currentExecution = {
      queueItemId: nextItem.id,
      instruction: nextItem.instruction,
      startedAt: new Date()
    };

    // 設定逾時
    if (this.config.timeout) {
      this.currentExecution.timeoutId = setTimeout(() => {
        this.handleExecutionTimeout();
      }, this.config.timeout);
    }
    
    try {
      await this.executeInstruction(this.currentExecution);
    } catch (error) {
      await this.handleExecutionError(this.currentExecution, error);
    } finally {
      // 清理逾時
      if (this.currentExecution?.timeoutId) {
        clearTimeout(this.currentExecution.timeoutId);
      }
      this.currentExecution = null;
    }
  }

  /**
   * 執行指令
   */
  private async executeInstruction(task: ExecutionTask): Promise<void> {
    this.emit('instruction:started', {
      instructionId: task.instruction.id,
      queueItemId: task.queueItemId
    });

    try {
      // 執行指令
      const result: ClaudeCodeResult = await this.projectAgent.executeInstruction(
        task.instruction
      );
      
      if (result.success) {
        await this.handleExecutionSuccess(task, result);
      } else {
        await this.handleExecutionFailure(task, result);
      }
    } catch (error) {
      await this.handleExecutionError(task, error);
    }
  }

  /**
   * 處理執行成功
   */
  private async handleExecutionSuccess(
    task: ExecutionTask,
    result: ClaudeCodeResult
  ): Promise<void> {
    // 標記佇列項目為完成
    this.instructionQueue.complete(task.queueItemId, result);

    // 儲存執行記錄
    await this.saveExecutionRecord(task, 'completed', result);
  }

  /**
   * 處理執行失敗
   */
  private async handleExecutionFailure(
    task: ExecutionTask,
    result: ClaudeCodeResult
  ): Promise<void> {
    // 標記佇列項目為失敗（會自動處理重試）
    this.instructionQueue.fail(task.queueItemId, result.error);

    // 儲存執行記錄
    await this.saveExecutionRecord(task, 'failed', result);
  }

  /**
   * 處理執行錯誤
   */
  private async handleExecutionError(
    task: ExecutionTask,
    error: any
  ): Promise<void> {
    // 標記佇列項目為失敗（會自動處理重試）
    this.instructionQueue.fail(task.queueItemId, error);

    // 儲存執行記錄
    await this.saveExecutionRecord(task, 'error', { error });
  }

  /**
   * 處理執行逾時
   */
  private handleExecutionTimeout(): void {
    if (this.currentExecution) {
      const error = new Error('Execution timeout');
      this.instructionQueue.fail(this.currentExecution.queueItemId, error);
      
      this.emit('instruction:timeout', {
        instructionId: this.currentExecution.instruction.id,
        queueItemId: this.currentExecution.queueItemId
      });
    }
  }


  /**
   * 載入待處理的指令
   */
  private async loadPendingInstructions(): Promise<void> {
    try {
      // TODO: 從資料庫載入未完成的指令
      // 暫時先不載入，新的指令會透過addInstruction加入
      console.log('Loading pending instructions...');
    } catch (error) {
      console.error('Failed to load pending instructions:', error);
    }
  }

  /**
   * 等待當前執行完成
   */
  private async waitForCurrentExecution(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.currentExecution) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * 更新佇列統計
   */
  private updateQueueStats(): void {
    const queueStats = this.instructionQueue.getStats();
    this.stats.queueSize = queueStats.totalItems;
    this.emit('stats:updated', this.stats);
  }

  /**
   * 更新執行時間統計
   */
  private updateExecutionTime(duration: number): void {
    this.stats.totalExecuted++;
    
    // 更新平均執行時間
    const totalTime = this.stats.averageExecutionTime * (this.stats.totalExecuted - 1) + duration;
    this.stats.averageExecutionTime = totalTime / this.stats.totalExecuted;
    
    // 更新運行時間
    if (this.startTime) {
      this.stats.uptime = Date.now() - this.startTime.getTime();
    }
  }

  /**
   * 儲存執行記錄
   */
  private async saveExecutionRecord(
    task: ExecutionTask,
    status: string,
    data: any
  ): Promise<void> {
    try {
      // TODO: 實作實際的資料庫儲存邏輯
      const duration = Date.now() - task.startedAt.getTime();
      console.log('Saving execution record:', {
        instructionId: task.instruction.id,
        queueItemId: task.queueItemId,
        status,
        duration,
        data
      });
    } catch (error) {
      console.error('Failed to save execution record:', error);
    }
  }

  /**
   * 取得執行器狀態
   */
  getStatus(): ExecutorStatus {
    return this.status;
  }

  /**
   * 取得執行統計
   */
  getStats(): ExecutionStats {
    // 更新即時統計
    if (this.startTime) {
      this.stats.uptime = Date.now() - this.startTime.getTime();
    }
    return { ...this.stats };
  }

  /**
   * 取得佇列資訊
   */
  getQueueInfo(): {
    items: Array<{
      queueItemId: string;
      instructionId: string;
      priority: Priority;
      addedAt: Date;
      dependencies: string[];
    }>;
    currentExecution: {
      queueItemId: string;
      instructionId: string;
      startedAt: Date;
    } | null;
    stats: any;
  } {
    const queueInfo = this.instructionQueue.getQueueInfo();
    const queueStats = this.instructionQueue.getStats();
    
    return {
      items: queueInfo.pendingItems.map(item => ({
        queueItemId: item.id,
        instructionId: this.instructionQueue.getItem(item.id)?.instruction.id || '',
        priority: item.priority,
        addedAt: item.addedAt,
        dependencies: item.dependencies
      })),
      currentExecution: this.currentExecution ? {
        queueItemId: this.currentExecution.queueItemId,
        instructionId: this.currentExecution.instruction.id,
        startedAt: this.currentExecution.startedAt
      } : null,
      stats: queueStats
    };
  }

  /**
   * 是否正在運行
   */
  isRunning(): boolean {
    return this.status === ExecutorStatus.RUNNING;
  }

  /**
   * 清理資源
   */
  async cleanup(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
  }
}