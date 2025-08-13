/**
 * 查詢優化器
 * 提供數據庫查詢優化和性能分析功能
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { PerformanceMonitor } from '@/lib/monitoring/performance-monitor';

export interface QueryAnalysis {
  query: string;
  executionTime: number;
  resultSize: number;
  indexUsage: string[];
  recommendations: string[];
  optimizationPotential: number; // 0-1
}

export interface QueryPattern {
  pattern: string;
  frequency: number;
  avgExecutionTime: number;
  totalExecutionTime: number;
  lastSeen: Date;
}

export interface OptimizationRule {
  id: string;
  name: string;
  description: string;
  category: 'indexing' | 'query_structure' | 'batching' | 'caching';
  priority: number; // 1-10
  condition: (analysis: QueryAnalysis) => boolean;
  optimize: (query: string) => string;
  estimatedImprovement: number;
}

export class QueryOptimizer extends EventEmitter {
  private queryPatterns: Map<string, QueryPattern> = new Map();
  private slowQueries: QueryAnalysis[] = [];
  private optimizationRules: OptimizationRule[] = [];
  private isMonitoring = false;

  constructor(
    private prisma: PrismaClient,
    private performanceMonitor?: PerformanceMonitor
  ) {
    super();
    this.initializeOptimizationRules();
  }

  /**
   * 初始化優化規則
   */
  private initializeOptimizationRules() {
    this.optimizationRules = [
      {
        id: 'select-specific-fields',
        name: '選擇特定欄位',
        description: '避免使用 SELECT * ，只選擇需要的欄位',
        category: 'query_structure',
        priority: 8,
        condition: (analysis) => analysis.query.includes('SELECT *'),
        optimize: (query) => query.replace('SELECT *', 'SELECT id, title, status'),
        estimatedImprovement: 0.3
      },
      {
        id: 'add-limit-clause',
        name: '添加 LIMIT 子句',
        description: '為大型結果集添加 LIMIT 限制',
        category: 'query_structure',
        priority: 7,
        condition: (analysis) => 
          !analysis.query.includes('LIMIT') && analysis.resultSize > 100,
        optimize: (query) => query + ' LIMIT 100',
        estimatedImprovement: 0.5
      },
      {
        id: 'optimize-where-clause',
        name: '優化 WHERE 條件',
        description: '將最有選擇性的條件放在前面',
        category: 'query_structure',
        priority: 6,
        condition: (analysis) => 
          analysis.query.includes('WHERE') && analysis.executionTime > 1000,
        optimize: (query) => this.optimizeWhereClause(query),
        estimatedImprovement: 0.4
      },
      {
        id: 'suggest-index',
        name: '建議添加索引',
        description: '為經常查詢的欄位建議索引',
        category: 'indexing',
        priority: 9,
        condition: (analysis) => 
          analysis.indexUsage.length === 0 && analysis.executionTime > 2000,
        optimize: (query) => `-- Consider adding index\n${query}`,
        estimatedImprovement: 0.7
      },
      {
        id: 'batch-similar-queries',
        name: '批次處理相似查詢',
        description: '將多個相似查詢合併為批次操作',
        category: 'batching',
        priority: 8,
        condition: (analysis) => this.hasSimilarQueries(analysis.query),
        optimize: (query) => this.createBatchQuery(query),
        estimatedImprovement: 0.6
      },
      {
        id: 'enable-query-cache',
        name: '啟用查詢快取',
        description: '為重複查詢啟用快取機制',
        category: 'caching',
        priority: 7,
        condition: (analysis) => this.isFrequentQuery(analysis.query),
        optimize: (query) => `-- Enable cache for this query\n${query}`,
        estimatedImprovement: 0.8
      }
    ];
  }

  /**
   * 開始查詢監控
   */
  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.setupPrismaMiddleware();
    this.emit('monitoring:started');
  }

  /**
   * 停止查詢監控
   */
  stopMonitoring() {
    this.isMonitoring = false;
    this.emit('monitoring:stopped');
  }

  /**
   * 設置 Prisma 中間件
   */
  private setupPrismaMiddleware() {
    this.prisma.$use(async (params, next) => {
      const startTime = Date.now();
      
      try {
        const result = await next(params);
        const executionTime = Date.now() - startTime;
        
        // 記錄查詢分析
        await this.analyzeQuery({
          action: params.action,
          model: params.model,
          args: params.args,
          executionTime,
          result
        });

        // 記錄性能指標
        if (this.performanceMonitor) {
          this.performanceMonitor.recordMetric(
            'database',
            'query_time',
            executionTime,
            'milliseconds',
            {
              action: params.action,
              model: params.model || 'unknown'
            }
          );
        }

        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        
        // 記錄錯誤
        if (this.performanceMonitor) {
          this.performanceMonitor.recordMetric(
            'database',
            'query_error',
            1,
            'count',
            {
              action: params.action,
              model: params.model || 'unknown',
              error: (error as Error).message
            }
          );
        }

        throw error;
      }
    });
  }

  /**
   * 分析查詢
   */
  private async analyzeQuery(queryInfo: {
    action: string;
    model?: string;
    args?: any;
    executionTime: number;
    result?: any;
  }) {
    const queryKey = `${queryInfo.action}:${queryInfo.model}:${JSON.stringify(queryInfo.args)}`;
    const queryString = this.buildQueryString(queryInfo);

    // 更新查詢模式統計
    this.updateQueryPattern(queryKey, queryInfo.executionTime);

    // 分析結果大小
    const resultSize = this.calculateResultSize(queryInfo.result);

    const analysis: QueryAnalysis = {
      query: queryString,
      executionTime: queryInfo.executionTime,
      resultSize,
      indexUsage: [], // 實際實現中需要從查詢計劃獲取
      recommendations: [],
      optimizationPotential: 0
    };

    // 應用優化規則
    analysis.recommendations = this.applyOptimizationRules(analysis);
    analysis.optimizationPotential = this.calculateOptimizationPotential(analysis);

    // 如果是慢查詢，記錄下來
    if (queryInfo.executionTime > 1000) { // 1秒閾值
      this.recordSlowQuery(analysis);
    }

    this.emit('query:analyzed', analysis);
    return analysis;
  }

  /**
   * 建立查詢字串
   */
  private buildQueryString(queryInfo: {
    action: string;
    model?: string;
    args?: any;
  }): string {
    const { action, model, args } = queryInfo;
    
    if (!model) return `Unknown query: ${action}`;

    switch (action) {
      case 'findMany':
        return `SELECT * FROM ${model}${args?.where ? ` WHERE ${JSON.stringify(args.where)}` : ''}`;
      case 'findUnique':
      case 'findFirst':
        return `SELECT * FROM ${model} WHERE ${JSON.stringify(args?.where)} LIMIT 1`;
      case 'create':
        return `INSERT INTO ${model} VALUES (${JSON.stringify(args?.data)})`;
      case 'update':
        return `UPDATE ${model} SET ${JSON.stringify(args?.data)} WHERE ${JSON.stringify(args?.where)}`;
      case 'delete':
        return `DELETE FROM ${model} WHERE ${JSON.stringify(args?.where)}`;
      case 'count':
        return `SELECT COUNT(*) FROM ${model}${args?.where ? ` WHERE ${JSON.stringify(args.where)}` : ''}`;
      default:
        return `${action} on ${model}`;
    }
  }

  /**
   * 計算結果大小
   */
  private calculateResultSize(result: any): number {
    if (!result) return 0;
    if (Array.isArray(result)) return result.length;
    if (typeof result === 'object') return 1;
    return 0;
  }

  /**
   * 更新查詢模式統計
   */
  private updateQueryPattern(queryKey: string, executionTime: number) {
    const pattern = this.queryPatterns.get(queryKey);
    
    if (pattern) {
      pattern.frequency++;
      pattern.totalExecutionTime += executionTime;
      pattern.avgExecutionTime = pattern.totalExecutionTime / pattern.frequency;
      pattern.lastSeen = new Date();
    } else {
      this.queryPatterns.set(queryKey, {
        pattern: queryKey,
        frequency: 1,
        avgExecutionTime: executionTime,
        totalExecutionTime: executionTime,
        lastSeen: new Date()
      });
    }
  }

  /**
   * 記錄慢查詢
   */
  private recordSlowQuery(analysis: QueryAnalysis) {
    this.slowQueries.push(analysis);
    
    // 保留最近100個慢查詢
    if (this.slowQueries.length > 100) {
      this.slowQueries.shift();
    }

    this.emit('slow_query:detected', analysis);
  }

  /**
   * 應用優化規則
   */
  private applyOptimizationRules(analysis: QueryAnalysis): string[] {
    const recommendations: string[] = [];

    for (const rule of this.optimizationRules.sort((a, b) => b.priority - a.priority)) {
      if (rule.condition(analysis)) {
        recommendations.push(
          `${rule.name}: ${rule.description} (預估改善: ${Math.round(rule.estimatedImprovement * 100)}%)`
        );
      }
    }

    return recommendations;
  }

  /**
   * 計算優化潛力
   */
  private calculateOptimizationPotential(analysis: QueryAnalysis): number {
    let potential = 0;
    let ruleCount = 0;

    for (const rule of this.optimizationRules) {
      if (rule.condition(analysis)) {
        potential += rule.estimatedImprovement;
        ruleCount++;
      }
    }

    return ruleCount > 0 ? potential / ruleCount : 0;
  }

  /**
   * 檢查是否有相似查詢
   */
  private hasSimilarQueries(query: string): boolean {
    const similarCount = Array.from(this.queryPatterns.values())
      .filter(pattern => this.calculateSimilarity(query, pattern.pattern) > 0.8)
      .length;
    
    return similarCount >= 3;
  }

  /**
   * 計算查詢相似性
   */
  private calculateSimilarity(query1: string, query2: string): number {
    // 簡化的相似性計算
    const words1 = query1.toLowerCase().split(/\W+/);
    const words2 = query2.toLowerCase().split(/\W+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  /**
   * 檢查是否為頻繁查詢
   */
  private isFrequentQuery(query: string): boolean {
    for (const pattern of this.queryPatterns.values()) {
      if (this.calculateSimilarity(query, pattern.pattern) > 0.9) {
        return pattern.frequency >= 10; // 執行10次以上算頻繁
      }
    }
    return false;
  }

  /**
   * 優化 WHERE 子句
   */
  private optimizeWhereClause(query: string): string {
    // 簡化的 WHERE 子句優化邏輯
    return query.replace(/WHERE\s+(.+)/, (match, conditions) => {
      const conditionList = conditions.split(/\s+AND\s+/i);
      // 假設索引欄位優先（實際需要更複雜的邏輯）
      const optimized = conditionList.sort((a, b) => {
        const aHasIndex = a.includes('id') || a.includes('status');
        const bHasIndex = b.includes('id') || b.includes('status');
        return bHasIndex ? 1 : aHasIndex ? -1 : 0;
      });
      
      return `WHERE ${optimized.join(' AND ')}`;
    });
  }

  /**
   * 創建批次查詢
   */
  private createBatchQuery(query: string): string {
    // 簡化的批次查詢建議
    if (query.includes('SELECT') && query.includes('WHERE id =')) {
      return query.replace(/WHERE id = \d+/, 'WHERE id IN (?, ?, ?)');
    }
    return query + ' -- Consider batching similar queries';
  }

  /**
   * 獲取查詢統計
   */
  getQueryStats(): {
    totalQueries: number;
    slowQueries: number;
    avgExecutionTime: number;
    topSlowQueries: QueryAnalysis[];
    frequentPatterns: QueryPattern[];
  } {
    const patterns = Array.from(this.queryPatterns.values());
    const totalQueries = patterns.reduce((sum, p) => sum + p.frequency, 0);
    const totalTime = patterns.reduce((sum, p) => sum + p.totalExecutionTime, 0);
    const avgExecutionTime = totalQueries > 0 ? totalTime / totalQueries : 0;

    return {
      totalQueries,
      slowQueries: this.slowQueries.length,
      avgExecutionTime,
      topSlowQueries: [...this.slowQueries]
        .sort((a, b) => b.executionTime - a.executionTime)
        .slice(0, 10),
      frequentPatterns: [...patterns]
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10)
    };
  }

  /**
   * 獲取優化建議
   */
  getOptimizationSuggestions(): Array<{
    query: string;
    currentPerformance: number;
    suggestions: string[];
    estimatedImprovement: number;
  }> {
    return this.slowQueries
      .filter(query => query.optimizationPotential > 0.2)
      .map(query => ({
        query: query.query,
        currentPerformance: query.executionTime,
        suggestions: query.recommendations,
        estimatedImprovement: query.optimizationPotential
      }))
      .sort((a, b) => b.estimatedImprovement - a.estimatedImprovement)
      .slice(0, 10);
  }

  /**
   * 生成優化報告
   */
  generateOptimizationReport(): {
    summary: {
      totalQueries: number;
      slowQueries: number;
      optimizationOpportunities: number;
      estimatedTimeReduction: number;
    };
    topIssues: Array<{
      category: string;
      count: number;
      avgImprovement: number;
    }>;
    recommendations: Array<{
      priority: number;
      description: string;
      impact: string;
      effort: string;
    }>;
  } {
    const stats = this.getQueryStats();
    const suggestions = this.getOptimizationSuggestions();

    // 按類別統計問題
    const categoryStats = new Map<string, { count: number; totalImprovement: number }>();
    
    for (const rule of this.optimizationRules) {
      const category = rule.category;
      const applicableQueries = this.slowQueries.filter(q => rule.condition(q));
      
      if (applicableQueries.length > 0) {
        const current = categoryStats.get(category) || { count: 0, totalImprovement: 0 };
        current.count += applicableQueries.length;
        current.totalImprovement += rule.estimatedImprovement * applicableQueries.length;
        categoryStats.set(category, current);
      }
    }

    const topIssues = Array.from(categoryStats.entries()).map(([category, stats]) => ({
      category,
      count: stats.count,
      avgImprovement: stats.totalImprovement / stats.count
    })).sort((a, b) => b.count - a.count);

    // 生成建議
    const recommendations = [
      {
        priority: 1,
        description: '添加索引到頻繁查詢的欄位',
        impact: 'High',
        effort: 'Low'
      },
      {
        priority: 2,
        description: '實施查詢結果快取',
        impact: 'High',
        effort: 'Medium'
      },
      {
        priority: 3,
        description: '優化查詢結構和條件順序',
        impact: 'Medium',
        effort: 'Low'
      },
      {
        priority: 4,
        description: '批次處理相似查詢',
        impact: 'Medium',
        effort: 'Medium'
      }
    ];

    return {
      summary: {
        totalQueries: stats.totalQueries,
        slowQueries: stats.slowQueries,
        optimizationOpportunities: suggestions.length,
        estimatedTimeReduction: suggestions.reduce((sum, s) => sum + (s.estimatedImprovement * s.currentPerformance), 0)
      },
      topIssues,
      recommendations
    };
  }

  /**
   * 清理舊數據
   */
  cleanup(retentionDays: number = 7) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    // 清理舊的查詢模式
    for (const [key, pattern] of this.queryPatterns.entries()) {
      if (pattern.lastSeen < cutoff) {
        this.queryPatterns.delete(key);
      }
    }

    // 清理舊的慢查詢記錄
    this.slowQueries = this.slowQueries.filter(query => {
      // 假設 QueryAnalysis 有 timestamp 屬性
      const queryTime = new Date(Date.now()); // 簡化處理
      return queryTime >= cutoff;
    });

    this.emit('cleanup:completed', { retentionDays });
  }
}