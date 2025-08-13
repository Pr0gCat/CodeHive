import { EventEmitter } from 'events';
import { Instruction } from './project-agent';

/**
 * 佇列項目優先級
 */
export enum Priority {
  CRITICAL = 1000,    // 關鍵任務
  HIGH = 750,         // 高優先級
  NORMAL = 500,       // 普通優先級
  LOW = 250,          // 低優先級
  BACKGROUND = 100    // 背景任務
}

/**
 * 佇列項目狀態
 */
export enum QueueItemStatus {
  PENDING = 'pending',        // 待處理
  PROCESSING = 'processing',  // 處理中
  COMPLETED = 'completed',    // 已完成
  FAILED = 'failed',         // 失敗
  CANCELLED = 'cancelled',   // 已取消
  RETRY = 'retry'            // 重試中
}

/**
 * 佇列項目介面
 */
export interface QueueItem {
  id: string;
  instruction: Instruction;
  priority: Priority;
  status: QueueItemStatus;
  addedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  retryDelay: number;
  tags: string[];
  dependencies: string[];  // 依賴的其他項目ID
  estimatedDuration?: number;
  actualDuration?: number;
  metadata: Record<string, any>;
}

/**
 * 佇列統計
 */
export interface QueueStats {
  totalItems: number;
  pendingItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  throughput: number;  // 每分鐘完成數
}

/**
 * 佇列配置
 */
export interface QueueConfig {
  maxSize?: number;           // 最大佇列大小
  maxConcurrent?: number;     // 最大並發數
  defaultRetries?: number;    // 預設重試次數
  defaultRetryDelay?: number; // 預設重試延遲
  priorityThreshold?: Priority; // 優先級閾值
}

/**
 * 指令佇列管理器
 */
export class InstructionQueue extends EventEmitter {
  private items: Map<string, QueueItem> = new Map();
  private pendingQueue: QueueItem[] = [];
  private processingItems: Set<string> = new Set();
  private completedItems: QueueItem[] = [];
  private config: Required<QueueConfig>;
  private stats: QueueStats;
  private startTime: Date = new Date();

  constructor(config: QueueConfig = {}) {
    super();
    
    this.config = {
      maxSize: 10000,
      maxConcurrent: 1,
      defaultRetries: 3,
      defaultRetryDelay: 5000,
      priorityThreshold: Priority.NORMAL,
      ...config
    };

    this.stats = {
      totalItems: 0,
      pendingItems: 0,
      processingItems: 0,
      completedItems: 0,
      failedItems: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      throughput: 0
    };
  }

  /**
   * 新增項目到佇列
   */
  enqueue(
    instruction: Instruction,
    options: {
      priority?: Priority;
      maxRetries?: number;
      retryDelay?: number;
      tags?: string[];
      dependencies?: string[];
      estimatedDuration?: number;
      metadata?: Record<string, any>;
    } = {}
  ): string {
    // 檢查佇列大小限制
    if (this.items.size >= this.config.maxSize) {
      throw new Error('Queue is full');
    }

    const item: QueueItem = {
      id: this.generateId(),
      instruction,
      priority: options.priority || Priority.NORMAL,
      status: QueueItemStatus.PENDING,
      addedAt: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.defaultRetries,
      retryDelay: options.retryDelay ?? this.config.defaultRetryDelay,
      tags: options.tags || [],
      dependencies: options.dependencies || [],
      estimatedDuration: options.estimatedDuration,
      metadata: options.metadata || {}
    };

    // 檢查依賴是否存在且已完成
    if (!this.checkDependencies(item)) {
      throw new Error('Dependencies not satisfied');
    }

    this.items.set(item.id, item);
    this.insertSorted(item);
    this.updateStats();

    this.emit('item:enqueued', {
      itemId: item.id,
      priority: item.priority,
      queueSize: this.pendingQueue.length
    });

    return item.id;
  }

  /**
   * 從佇列取出下一個項目
   */
  dequeue(): QueueItem | null {
    // 檢查並發限制
    if (this.processingItems.size >= this.config.maxConcurrent) {
      return null;
    }

    // 找到第一個滿足依賴條件的項目
    for (let i = 0; i < this.pendingQueue.length; i++) {
      const item = this.pendingQueue[i];
      
      if (this.areDependenciesSatisfied(item)) {
        // 從pending佇列移除
        this.pendingQueue.splice(i, 1);
        
        // 標記為處理中
        item.status = QueueItemStatus.PROCESSING;
        item.startedAt = new Date();
        this.processingItems.add(item.id);
        
        this.updateStats();
        
        this.emit('item:dequeued', {
          itemId: item.id,
          waitTime: item.startedAt.getTime() - item.addedAt.getTime()
        });

        return item;
      }
    }

    return null;
  }

  /**
   * 標記項目為完成
   */
  complete(itemId: string, result?: any): boolean {
    const item = this.items.get(itemId);
    if (!item || item.status !== QueueItemStatus.PROCESSING) {
      return false;
    }

    item.status = QueueItemStatus.COMPLETED;
    item.completedAt = new Date();
    
    if (item.startedAt) {
      item.actualDuration = item.completedAt.getTime() - item.startedAt.getTime();
    }

    this.processingItems.delete(itemId);
    this.completedItems.push(item);
    this.updateStats();

    this.emit('item:completed', {
      itemId,
      duration: item.actualDuration,
      result
    });

    // 清理舊的完成項目
    this.cleanupCompletedItems();

    return true;
  }

  /**
   * 標記項目為失敗
   */
  fail(itemId: string, error: any): boolean {
    const item = this.items.get(itemId);
    if (!item || item.status !== QueueItemStatus.PROCESSING) {
      return false;
    }

    this.processingItems.delete(itemId);

    // 檢查是否需要重試
    if (item.retryCount < item.maxRetries) {
      this.scheduleRetry(item, error);
      return true;
    }

    // 標記為失敗
    item.status = QueueItemStatus.FAILED;
    item.completedAt = new Date();
    
    if (item.startedAt) {
      item.actualDuration = item.completedAt.getTime() - item.startedAt.getTime();
    }

    this.updateStats();

    this.emit('item:failed', {
      itemId,
      error,
      retryCount: item.retryCount
    });

    return true;
  }

  /**
   * 取消項目
   */
  cancel(itemId: string): boolean {
    const item = this.items.get(itemId);
    if (!item) {
      return false;
    }

    // 從不同狀態移除
    if (item.status === QueueItemStatus.PENDING) {
      const index = this.pendingQueue.findIndex(i => i.id === itemId);
      if (index !== -1) {
        this.pendingQueue.splice(index, 1);
      }
    } else if (item.status === QueueItemStatus.PROCESSING) {
      this.processingItems.delete(itemId);
    }

    item.status = QueueItemStatus.CANCELLED;
    item.completedAt = new Date();
    this.updateStats();

    this.emit('item:cancelled', { itemId });

    return true;
  }

  /**
   * 重新排程項目
   */
  reschedule(itemId: string, newPriority: Priority): boolean {
    const item = this.items.get(itemId);
    if (!item || item.status !== QueueItemStatus.PENDING) {
      return false;
    }

    // 從佇列移除
    const index = this.pendingQueue.findIndex(i => i.id === itemId);
    if (index !== -1) {
      this.pendingQueue.splice(index, 1);
    }

    // 更新優先級並重新插入
    item.priority = newPriority;
    this.insertSorted(item);

    this.emit('item:rescheduled', {
      itemId,
      newPriority
    });

    return true;
  }

  /**
   * 取得佇列項目
   */
  getItem(itemId: string): QueueItem | undefined {
    return this.items.get(itemId);
  }

  /**
   * 依標籤取得項目
   */
  getItemsByTag(tag: string): QueueItem[] {
    return Array.from(this.items.values())
      .filter(item => item.tags.includes(tag));
  }

  /**
   * 依狀態取得項目
   */
  getItemsByStatus(status: QueueItemStatus): QueueItem[] {
    return Array.from(this.items.values())
      .filter(item => item.status === status);
  }

  /**
   * 取得佇列統計
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * 取得佇列資訊
   */
  getQueueInfo(): {
    pendingItems: Array<{
      id: string;
      priority: Priority;
      addedAt: Date;
      dependencies: string[];
      estimatedDuration?: number;
    }>;
    processingItems: string[];
    totalSize: number;
  } {
    return {
      pendingItems: this.pendingQueue.map(item => ({
        id: item.id,
        priority: item.priority,
        addedAt: item.addedAt,
        dependencies: item.dependencies,
        estimatedDuration: item.estimatedDuration
      })),
      processingItems: Array.from(this.processingItems),
      totalSize: this.items.size
    };
  }

  /**
   * 清空佇列
   */
  clear(): void {
    const clearedCount = this.items.size;
    
    this.items.clear();
    this.pendingQueue = [];
    this.processingItems.clear();
    this.completedItems = [];
    this.updateStats();

    this.emit('queue:cleared', { clearedCount });
  }

  /**
   * 暫停佇列處理
   */
  pause(): void {
    this.emit('queue:paused');
  }

  /**
   * 恢復佇列處理
   */
  resume(): void {
    this.emit('queue:resumed');
  }

  /**
   * 按優先級插入項目
   */
  private insertSorted(item: QueueItem): void {
    const insertIndex = this.pendingQueue.findIndex(
      existing => existing.priority < item.priority
    );
    
    if (insertIndex === -1) {
      this.pendingQueue.push(item);
    } else {
      this.pendingQueue.splice(insertIndex, 0, item);
    }
  }

  /**
   * 檢查依賴是否存在
   */
  private checkDependencies(item: QueueItem): boolean {
    return item.dependencies.every(depId => this.items.has(depId));
  }

  /**
   * 檢查依賴是否已滿足
   */
  private areDependenciesSatisfied(item: QueueItem): boolean {
    return item.dependencies.every(depId => {
      const dep = this.items.get(depId);
      return dep && dep.status === QueueItemStatus.COMPLETED;
    });
  }

  /**
   * 排程重試
   */
  private scheduleRetry(item: QueueItem, error: any): void {
    item.retryCount++;
    item.status = QueueItemStatus.RETRY;

    setTimeout(() => {
      item.status = QueueItemStatus.PENDING;
      this.insertSorted(item);
      this.updateStats();

      this.emit('item:retry', {
        itemId: item.id,
        retryCount: item.retryCount,
        error
      });
    }, item.retryDelay);
  }

  /**
   * 更新統計
   */
  private updateStats(): void {
    const allItems = Array.from(this.items.values());
    
    this.stats.totalItems = allItems.length;
    this.stats.pendingItems = this.pendingQueue.length;
    this.stats.processingItems = this.processingItems.size;
    this.stats.completedItems = allItems.filter(i => i.status === QueueItemStatus.COMPLETED).length;
    this.stats.failedItems = allItems.filter(i => i.status === QueueItemStatus.FAILED).length;

    // 計算平均等待時間
    const completedWithTiming = allItems.filter(i => 
      i.status === QueueItemStatus.COMPLETED && i.startedAt
    );
    
    if (completedWithTiming.length > 0) {
      const totalWaitTime = completedWithTiming.reduce((sum, item) => 
        sum + (item.startedAt!.getTime() - item.addedAt.getTime()), 0
      );
      this.stats.averageWaitTime = totalWaitTime / completedWithTiming.length;
    }

    // 計算平均處理時間
    const completedWithDuration = allItems.filter(i => i.actualDuration);
    if (completedWithDuration.length > 0) {
      const totalDuration = completedWithDuration.reduce((sum, item) => 
        sum + item.actualDuration!, 0
      );
      this.stats.averageProcessingTime = totalDuration / completedWithDuration.length;
    }

    // 計算吞吐量（每分鐘完成數）
    const uptimeMinutes = (Date.now() - this.startTime.getTime()) / 60000;
    this.stats.throughput = uptimeMinutes > 0 ? this.stats.completedItems / uptimeMinutes : 0;

    this.emit('stats:updated', this.stats);
  }

  /**
   * 清理完成的項目
   */
  private cleanupCompletedItems(): void {
    // 保留最近100個完成的項目
    if (this.completedItems.length > 100) {
      const toRemove = this.completedItems.splice(0, this.completedItems.length - 100);
      toRemove.forEach(item => {
        this.items.delete(item.id);
      });
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}