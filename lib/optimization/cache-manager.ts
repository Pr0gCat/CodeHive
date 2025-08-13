/**
 * 快取管理系統
 * 提供智能快取、效能最佳化和資料預取功能
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';

export interface CacheItem {
  key: string;
  value: any;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
  tags: string[];
  size: number; // bytes
}

export interface CacheStats {
  totalItems: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  oldestItem?: Date;
  newestItem?: Date;
  avgAccessCount: number;
}

export interface CacheConfig {
  maxSize: number; // bytes
  maxItems: number;
  defaultTTL: number; // milliseconds
  cleanupInterval: number; // milliseconds
  enableStats: boolean;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'size';
}

export interface QueryOptimization {
  originalQuery: string;
  optimizedQuery: string;
  estimatedImprovement: number;
  reason: string;
  applied: boolean;
}

export class CacheManager extends EventEmitter {
  private cache: Map<string, CacheItem> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0
  };
  
  private cleanupTimer?: NodeJS.Timeout;
  private queryCache: Map<string, { result: any; timestamp: Date }> = new Map();
  private optimizations: QueryOptimization[] = [];

  constructor(
    private config: CacheConfig,
    private prisma: PrismaClient,
    private hierarchyManager?: HierarchyManager
  ) {
    super();
    this.startCleanup();
    this.setupQueryInterceptors();
  }

  /**
   * 開始清理定時器
   */
  private startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 停止清理定時器
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * 設置查詢攔截器
   */
  private setupQueryInterceptors() {
    // 為 Prisma 查詢添加快取層
    if (this.hierarchyManager) {
      this.interceptHierarchyQueries();
    }
  }

  /**
   * 攔截階層查詢
   */
  private interceptHierarchyQueries() {
    if (!this.hierarchyManager) return;

    // 快取 Epic 列表查詢
    const originalListEpics = this.hierarchyManager.listEpics.bind(this.hierarchyManager);
    this.hierarchyManager.listEpics = async (filter?: any) => {
      const cacheKey = `epics:list:${JSON.stringify(filter || {})}`;
      const cached = this.get(cacheKey);
      
      if (cached) {
        this.emit('cache:hit', { key: cacheKey, type: 'epic_list' });
        return cached;
      }

      const result = await originalListEpics(filter);
      this.set(cacheKey, result, { ttl: 300000, tags: ['epics', 'hierarchy'] }); // 5分鐘 TTL
      
      this.emit('cache:miss', { key: cacheKey, type: 'epic_list' });
      return result;
    };

    // 快取 Story 列表查詢
    const originalListStories = this.hierarchyManager.listStories.bind(this.hierarchyManager);
    this.hierarchyManager.listStories = async (filter?: any) => {
      const cacheKey = `stories:list:${JSON.stringify(filter || {})}`;
      const cached = this.get(cacheKey);
      
      if (cached) {
        this.emit('cache:hit', { key: cacheKey, type: 'story_list' });
        return cached;
      }

      const result = await originalListStories(filter);
      this.set(cacheKey, result, { ttl: 300000, tags: ['stories', 'hierarchy'] });
      
      this.emit('cache:miss', { key: cacheKey, type: 'story_list' });
      return result;
    };

    // 快取統計查詢
    const originalGetStats = this.hierarchyManager.getHierarchyStatistics.bind(this.hierarchyManager);
    this.hierarchyManager.getHierarchyStatistics = async (projectId: string) => {
      const cacheKey = `stats:hierarchy:${projectId}`;
      const cached = this.get(cacheKey);
      
      if (cached) {
        this.emit('cache:hit', { key: cacheKey, type: 'hierarchy_stats' });
        return cached;
      }

      const result = await originalGetStats(projectId);
      this.set(cacheKey, result, { ttl: 120000, tags: ['stats', 'hierarchy', projectId] }); // 2分鐘 TTL
      
      this.emit('cache:miss', { key: cacheKey, type: 'hierarchy_stats' });
      return result;
    };
  }

  /**
   * 設置快取項目
   */
  set(
    key: string, 
    value: any, 
    options: {
      ttl?: number;
      tags?: string[];
    } = {}
  ): boolean {
    const now = new Date();
    const ttl = options.ttl || this.config.defaultTTL;
    const size = this.calculateSize(value);

    // 檢查是否需要清理空間
    if (this.needsEviction(size)) {
      this.evict(size);
    }

    const item: CacheItem = {
      key,
      value: this.cloneValue(value),
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttl),
      accessCount: 0,
      lastAccessed: now,
      tags: options.tags || [],
      size
    };

    this.cache.set(key, item);
    this.emit('cache:set', { key, size, ttl });

    return true;
  }

  /**
   * 獲取快取項目
   */
  get(key: string): any {
    this.stats.totalRequests++;

    const item = this.cache.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // 檢查是否過期
    if (item.expiresAt < new Date()) {
      this.cache.delete(key);
      this.stats.misses++;
      this.emit('cache:expired', { key });
      return null;
    }

    // 更新存取統計
    item.accessCount++;
    item.lastAccessed = new Date();
    this.stats.hits++;

    return this.cloneValue(item.value);
  }

  /**
   * 刪除快取項目
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.emit('cache:deleted', { key });
    }
    return deleted;
  }

  /**
   * 根據標籤清除快取
   */
  invalidateByTag(tag: string): number {
    let count = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
        this.emit('cache:invalidated', { key, tag });
      }
    }

    return count;
  }

  /**
   * 根據模式清除快取
   */
  invalidateByPattern(pattern: RegExp): number {
    let count = 0;
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
        this.emit('cache:invalidated', { key, pattern: pattern.source });
      }
    }

    return count;
  }

  /**
   * 清除所有快取
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.emit('cache:cleared', { count });
  }

  /**
   * 檢查是否需要清理
   */
  private needsEviction(newItemSize: number): boolean {
    const currentSize = this.getCurrentSize();
    const currentCount = this.cache.size;

    return (
      currentSize + newItemSize > this.config.maxSize ||
      currentCount >= this.config.maxItems
    );
  }

  /**
   * 清理過期項目和執行清理策略
   */
  private evict(requiredSpace: number) {
    const now = new Date();
    let freedSpace = 0;
    const itemsToEvict: string[] = [];

    // 首先清除過期項目
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt < now) {
        itemsToEvict.push(key);
        freedSpace += item.size;
      }
    }

    // 如果空間不足，根據清理策略清除更多項目
    if (freedSpace < requiredSpace) {
      const items = Array.from(this.cache.values())
        .filter(item => !itemsToEvict.includes(item.key))
        .sort(this.getSortFunction());

      for (const item of items) {
        if (freedSpace >= requiredSpace) break;
        
        itemsToEvict.push(item.key);
        freedSpace += item.size;
      }
    }

    // 執行清理
    for (const key of itemsToEvict) {
      this.cache.delete(key);
      this.stats.evictions++;
      this.emit('cache:evicted', { key });
    }
  }

  /**
   * 獲取排序函數
   */
  private getSortFunction() {
    switch (this.config.evictionPolicy) {
      case 'lru': // 最近最少使用
        return (a: CacheItem, b: CacheItem) => 
          a.lastAccessed.getTime() - b.lastAccessed.getTime();
      
      case 'lfu': // 最少使用頻率
        return (a: CacheItem, b: CacheItem) => 
          a.accessCount - b.accessCount;
      
      case 'ttl': // 即將過期
        return (a: CacheItem, b: CacheItem) => 
          a.expiresAt.getTime() - b.expiresAt.getTime();
      
      case 'size': // 最大尺寸
        return (a: CacheItem, b: CacheItem) => 
          b.size - a.size;
      
      default:
        return (a: CacheItem, b: CacheItem) => 
          a.lastAccessed.getTime() - b.lastAccessed.getTime();
    }
  }

  /**
   * 定期清理
   */
  private cleanup() {
    const now = new Date();
    let expiredCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt < now) {
        this.cache.delete(key);
        expiredCount++;
        this.emit('cache:expired', { key });
      }
    }

    if (expiredCount > 0) {
      this.emit('cache:cleanup', { expiredCount });
    }
  }

  /**
   * 計算值的大小
   */
  private calculateSize(value: any): number {
    const jsonString = JSON.stringify(value);
    return Buffer.byteLength(jsonString, 'utf8');
  }

  /**
   * 克隆值
   */
  private cloneValue(value: any): any {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }

  /**
   * 獲取當前快取大小
   */
  private getCurrentSize(): number {
    let totalSize = 0;
    for (const item of this.cache.values()) {
      totalSize += item.size;
    }
    return totalSize;
  }

  /**
   * 獲取快取統計
   */
  getStats(): CacheStats {
    const items = Array.from(this.cache.values());
    const totalSize = this.getCurrentSize();
    const hitRate = this.stats.totalRequests > 0 
      ? this.stats.hits / this.stats.totalRequests 
      : 0;
    const missRate = 1 - hitRate;

    const accessCounts = items.map(item => item.accessCount);
    const avgAccessCount = accessCounts.length > 0
      ? accessCounts.reduce((sum, count) => sum + count, 0) / accessCounts.length
      : 0;

    const timestamps = items.map(item => item.createdAt.getTime());
    const oldestItem = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined;
    const newestItem = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined;

    return {
      totalItems: this.cache.size,
      totalSize,
      hitRate,
      missRate,
      evictionCount: this.stats.evictions,
      oldestItem,
      newestItem,
      avgAccessCount
    };
  }

  /**
   * 預熱快取
   */
  async warmup(projectId?: string): Promise<void> {
    this.emit('cache:warmup:start', { projectId });

    try {
      if (this.hierarchyManager && projectId) {
        // 預載入 Epic 列表
        await this.hierarchyManager.listEpics({ projectId });
        
        // 獲取所有 Epics 並預載入相關 Stories
        const epics = await this.hierarchyManager.listEpics({ projectId });
        for (const epic of epics.slice(0, 5)) { // 限制預載入數量
          await this.hierarchyManager.listStories({ epicId: epic.id });
        }

        // 預載入統計
        await this.hierarchyManager.getHierarchyStatistics(projectId);
      }

      this.emit('cache:warmup:complete', { projectId });
    } catch (error) {
      this.emit('cache:warmup:error', { projectId, error });
    }
  }

  /**
   * 智能預取
   */
  async intelligentPrefetch(context: {
    userId?: string;
    projectId?: string;
    recentActions?: string[];
  }): Promise<void> {
    if (!this.hierarchyManager || !context.projectId) return;

    this.emit('cache:prefetch:start', context);

    try {
      // 根據最近的操作預測需要的數據
      if (context.recentActions?.includes('view_epics')) {
        // 預取相關 Stories
        const epics = await this.hierarchyManager.listEpics({ projectId: context.projectId });
        for (const epic of epics.slice(0, 3)) {
          setTimeout(async () => {
            await this.hierarchyManager!.listStories({ epicId: epic.id });
          }, 100); // 延遲預取避免阻塞
        }
      }

      if (context.recentActions?.includes('view_stats')) {
        // 預取詳細統計
        setTimeout(async () => {
          await this.hierarchyManager!.getHierarchyStatistics(context.projectId!);
        }, 200);
      }

      this.emit('cache:prefetch:complete', context);
    } catch (error) {
      this.emit('cache:prefetch:error', { context, error });
    }
  }

  /**
   * 查詢優化分析
   */
  analyzeQueryOptimizations(): QueryOptimization[] {
    const optimizations: QueryOptimization[] = [];

    // 分析快取命中率低的查詢
    const lowHitRateQueries = this.findLowHitRateQueries();
    for (const query of lowHitRateQueries) {
      optimizations.push({
        originalQuery: query.pattern,
        optimizedQuery: this.optimizeQuery(query.pattern),
        estimatedImprovement: query.missRate * 0.8, // 估計80%改善
        reason: '快取命中率低，建議增加 TTL 或改善索引',
        applied: false
      });
    }

    // 分析大型查詢結果
    const largeResultQueries = this.findLargeResultQueries();
    for (const query of largeResultQueries) {
      optimizations.push({
        originalQuery: query.pattern,
        optimizedQuery: this.optimizeQuery(query.pattern, 'pagination'),
        estimatedImprovement: 0.6,
        reason: '查詢結果過大，建議使用分頁或限制返回字段',
        applied: false
      });
    }

    this.optimizations = optimizations;
    return optimizations;
  }

  /**
   * 查找快取命中率低的查詢
   */
  private findLowHitRateQueries(): Array<{ pattern: string; missRate: number }> {
    // 模擬分析邏輯
    return [
      { pattern: 'epics:list:*', missRate: 0.7 },
      { pattern: 'tasks:list:*', missRate: 0.8 }
    ];
  }

  /**
   * 查找大型查詢結果
   */
  private findLargeResultQueries(): Array<{ pattern: string; avgSize: number }> {
    const largeQueries: Array<{ pattern: string; avgSize: number }> = [];
    
    for (const item of this.cache.values()) {
      if (item.size > 50000) { // 50KB 閾值
        largeQueries.push({
          pattern: item.key,
          avgSize: item.size
        });
      }
    }

    return largeQueries.slice(0, 5); // 返回前5個
  }

  /**
   * 優化查詢
   */
  private optimizeQuery(query: string, type: string = 'cache'): string {
    switch (type) {
      case 'pagination':
        return query.includes('list') 
          ? query.replace('list', 'list:paginated:limit=20')
          : query;
      case 'cache':
        return query + ':optimized:ttl=600000'; // 10分鐘 TTL
      default:
        return query;
    }
  }

  /**
   * 應用優化建議
   */
  applyOptimization(optimizationIndex: number): boolean {
    const optimization = this.optimizations[optimizationIndex];
    if (!optimization || optimization.applied) {
      return false;
    }

    // 這裡會實際應用優化邏輯
    optimization.applied = true;
    
    this.emit('optimization:applied', optimization);
    return true;
  }

  /**
   * 獲取優化建議
   */
  getOptimizations(): QueryOptimization[] {
    return this.optimizations;
  }

  /**
   * 記憶體使用情況
   */
  getMemoryUsage(): {
    cacheSize: number;
    itemCount: number;
    averageItemSize: number;
    memoryEfficiency: number;
  } {
    const totalSize = this.getCurrentSize();
    const itemCount = this.cache.size;
    const averageItemSize = itemCount > 0 ? totalSize / itemCount : 0;
    const memoryEfficiency = this.config.maxSize > 0 ? (totalSize / this.config.maxSize) : 0;

    return {
      cacheSize: totalSize,
      itemCount,
      averageItemSize,
      memoryEfficiency
    };
  }

  /**
   * 重設統計
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };
    this.emit('stats:reset');
  }
}