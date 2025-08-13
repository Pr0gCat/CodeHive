/**
 * 性能監控系統
 * 提供系統性能指標收集、分析和監控功能
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { hierarchyBroadcaster } from '@/lib/socket/server';

export interface PerformanceMetric {
  id: string;
  timestamp: Date;
  category: 'database' | 'api' | 'websocket' | 'batch' | 'agent' | 'memory' | 'cpu';
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  score: number; // 0-100
  components: {
    database: ComponentHealth;
    api: ComponentHealth;
    websocket: ComponentHealth;
    memory: ComponentHealth;
    agents: ComponentHealth;
  };
  timestamp: Date;
}

export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'critical';
  score: number;
  metrics: {
    responseTime?: number;
    errorRate?: number;
    throughput?: number;
    utilization?: number;
  };
  issues: string[];
}

export interface AlertRule {
  id: string;
  name: string;
  category: string;
  condition: {
    metric: string;
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'ne';
    threshold: number;
    timeWindow: number; // 毫秒
  };
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  cooldown: number; // 最小警報間隔（毫秒）
  lastTriggered?: Date;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: Alert[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private healthHistory: SystemHealth[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private startTime: Date;

  constructor(private prisma: PrismaClient) {
    super();
    this.startTime = new Date();
    this.initializeDefaultAlertRules();
    this.startMonitoring();
  }

  /**
   * 初始化預設警報規則
   */
  private initializeDefaultAlertRules() {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-api-response-time',
        name: '高 API 響應時間',
        category: 'api',
        condition: {
          metric: 'api_response_time',
          operator: 'gt',
          threshold: 5000, // 5秒
          timeWindow: 300000 // 5分鐘
        },
        severity: 'warning',
        enabled: true,
        cooldown: 300000 // 5分鐘冷卻
      },
      {
        id: 'high-error-rate',
        name: '高錯誤率',
        category: 'api',
        condition: {
          metric: 'api_error_rate',
          operator: 'gt',
          threshold: 0.1, // 10%
          timeWindow: 300000
        },
        severity: 'critical',
        enabled: true,
        cooldown: 600000 // 10分鐘冷卻
      },
      {
        id: 'high-memory-usage',
        name: '高記憶體使用率',
        category: 'memory',
        condition: {
          metric: 'memory_usage_percent',
          operator: 'gt',
          threshold: 85, // 85%
          timeWindow: 600000 // 10分鐘
        },
        severity: 'warning',
        enabled: true,
        cooldown: 900000 // 15分鐘冷卻
      },
      {
        id: 'database-slow-query',
        name: '資料庫慢查詢',
        category: 'database',
        condition: {
          metric: 'db_query_time',
          operator: 'gt',
          threshold: 10000, // 10秒
          timeWindow: 180000 // 3分鐘
        },
        severity: 'critical',
        enabled: true,
        cooldown: 300000
      },
      {
        id: 'websocket-connection-drop',
        name: 'WebSocket 連線大量掉線',
        category: 'websocket',
        condition: {
          metric: 'websocket_disconnections',
          operator: 'gt',
          threshold: 10, // 每分鐘超過10次斷線
          timeWindow: 60000 // 1分鐘
        },
        severity: 'warning',
        enabled: true,
        cooldown: 300000
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  /**
   * 開始監控
   */
  private startMonitoring() {
    // 每30秒收集一次系統指標
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // 每分鐘評估系統健康狀況
    setInterval(() => {
      this.evaluateSystemHealth();
    }, 60000);

    // 每10秒檢查警報
    setInterval(() => {
      this.checkAlerts();
    }, 10000);
  }

  /**
   * 停止監控
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * 記錄性能指標
   */
  recordMetric(
    category: PerformanceMetric['category'],
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string> = {},
    metadata?: Record<string, any>
  ) {
    const metric: PerformanceMetric = {
      id: `${category}_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
      category,
      name,
      value,
      unit,
      tags,
      metadata
    };

    const key = `${category}:${name}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const metricsList = this.metrics.get(key)!;
    metricsList.push(metric);

    // 保留最近1000個指標
    if (metricsList.length > 1000) {
      metricsList.splice(0, metricsList.length - 1000);
    }

    // 發送事件
    this.emit('metric:recorded', metric);

    // 廣播即時指標
    hierarchyBroadcaster.sendSystemNotification(
      'info',
      `性能指標更新: ${name} = ${value} ${unit}`,
      'monitoring'
    );
  }

  /**
   * 收集系統指標
   */
  private async collectSystemMetrics() {
    const now = new Date();

    try {
      // 記憶體使用情況
      const memoryUsage = process.memoryUsage();
      this.recordMetric('memory', 'heap_used', memoryUsage.heapUsed, 'bytes');
      this.recordMetric('memory', 'heap_total', memoryUsage.heapTotal, 'bytes');
      this.recordMetric('memory', 'rss', memoryUsage.rss, 'bytes');
      this.recordMetric('memory', 'external', memoryUsage.external, 'bytes');

      const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      this.recordMetric('memory', 'usage_percent', heapUsedPercent, 'percent');

      // CPU 使用情況（使用 process.cpuUsage）
      const cpuUsage = process.cpuUsage();
      this.recordMetric('cpu', 'user_time', cpuUsage.user, 'microseconds');
      this.recordMetric('cpu', 'system_time', 'system' in cpuUsage ? (cpuUsage as any).system : 0, 'microseconds');

      // 運行時間
      const uptimeSeconds = (now.getTime() - this.startTime.getTime()) / 1000;
      this.recordMetric('cpu', 'uptime', uptimeSeconds, 'seconds');

      // 資料庫連線池狀態（如果支援）
      try {
        // 執行簡單查詢測量資料庫響應時間
        const dbStart = Date.now();
        await this.prisma.$queryRaw`SELECT 1 as test`;
        const dbTime = Date.now() - dbStart;
        this.recordMetric('database', 'query_time', dbTime, 'milliseconds', { query: 'health_check' });
      } catch (error) {
        this.recordMetric('database', 'error_count', 1, 'count', { error: 'connection_failed' });
      }

      // WebSocket 連線數（模擬，實際應從 Socket.IO 獲取）
      const connectionCount = Math.floor(Math.random() * 50) + 10; // 模擬10-60個連線
      this.recordMetric('websocket', 'active_connections', connectionCount, 'count');

    } catch (error) {
      console.error('收集系統指標失敗:', error);
      this.recordMetric('memory', 'collection_errors', 1, 'count');
    }
  }

  /**
   * 評估系統健康狀況
   */
  private evaluateSystemHealth() {
    const now = new Date();
    const timeWindow = 10 * 60 * 1000; // 10分鐘窗口

    // 評估各組件健康狀況
    const databaseHealth = this.evaluateComponentHealth('database', timeWindow);
    const apiHealth = this.evaluateComponentHealth('api', timeWindow);
    const websocketHealth = this.evaluateComponentHealth('websocket', timeWindow);
    const memoryHealth = this.evaluateComponentHealth('memory', timeWindow);
    const agentsHealth = this.evaluateComponentHealth('agent', timeWindow);

    // 計算總體健康分數
    const componentScores = [
      databaseHealth.score,
      apiHealth.score,
      websocketHealth.score,
      memoryHealth.score,
      agentsHealth.score
    ];

    const overallScore = componentScores.reduce((sum, score) => sum + score, 0) / componentScores.length;

    let overallStatus: SystemHealth['overall'] = 'healthy';
    if (overallScore < 50) {
      overallStatus = 'critical';
    } else if (overallScore < 80) {
      overallStatus = 'warning';
    }

    const health: SystemHealth = {
      overall: overallStatus,
      score: Math.round(overallScore),
      components: {
        database: databaseHealth,
        api: apiHealth,
        websocket: websocketHealth,
        memory: memoryHealth,
        agents: agentsHealth
      },
      timestamp: now
    };

    // 保存健康狀況歷史
    this.healthHistory.push(health);
    if (this.healthHistory.length > 288) { // 保留24小時（每5分鐘一次）
      this.healthHistory.shift();
    }

    // 發送事件
    this.emit('health:updated', health);

    // 廣播健康狀況更新
    hierarchyBroadcaster.sendSystemNotification(
      health.overall === 'healthy' ? 'info' : health.overall === 'warning' ? 'warning' : 'error',
      `系統健康狀況: ${health.overall} (分數: ${health.score})`,
      'monitoring'
    );
  }

  /**
   * 評估組件健康狀況
   */
  private evaluateComponentHealth(category: string, timeWindow: number): ComponentHealth {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow);
    
    const issues: string[] = [];
    let score = 100;
    const metrics: ComponentHealth['metrics'] = {};

    // 獲取相關指標
    const relevantMetrics = this.getMetricsInTimeWindow(category, windowStart, now);

    switch (category) {
      case 'database':
        const dbQueryTimes = relevantMetrics.filter(m => m.name === 'query_time');
        if (dbQueryTimes.length > 0) {
          const avgQueryTime = dbQueryTimes.reduce((sum, m) => sum + m.value, 0) / dbQueryTimes.length;
          metrics.responseTime = avgQueryTime;
          
          if (avgQueryTime > 5000) {
            issues.push('資料庫查詢時間過長');
            score -= 30;
          } else if (avgQueryTime > 2000) {
            issues.push('資料庫查詢時間較慢');
            score -= 15;
          }
        }
        
        const dbErrors = relevantMetrics.filter(m => m.name === 'error_count');
        if (dbErrors.length > 0) {
          const errorCount = dbErrors.reduce((sum, m) => sum + m.value, 0);
          if (errorCount > 0) {
            issues.push(`資料庫連線錯誤: ${errorCount} 次`);
            score -= errorCount * 10;
          }
        }
        break;

      case 'memory':
        const memoryUsage = relevantMetrics.filter(m => m.name === 'usage_percent');
        if (memoryUsage.length > 0) {
          const avgMemoryUsage = memoryUsage.reduce((sum, m) => sum + m.value, 0) / memoryUsage.length;
          metrics.utilization = avgMemoryUsage;
          
          if (avgMemoryUsage > 90) {
            issues.push('記憶體使用率過高');
            score -= 40;
          } else if (avgMemoryUsage > 80) {
            issues.push('記憶體使用率較高');
            score -= 20;
          }
        }
        break;

      case 'websocket':
        const connections = relevantMetrics.filter(m => m.name === 'active_connections');
        if (connections.length > 0) {
          const avgConnections = connections.reduce((sum, m) => sum + m.value, 0) / connections.length;
          metrics.throughput = avgConnections;
        }

        const disconnections = relevantMetrics.filter(m => m.name === 'disconnections');
        if (disconnections.length > 0) {
          const totalDisconnections = disconnections.reduce((sum, m) => sum + m.value, 0);
          if (totalDisconnections > 20) {
            issues.push('WebSocket 連線不穩定');
            score -= 25;
          }
        }
        break;

      case 'api':
        const apiResponseTimes = relevantMetrics.filter(m => m.name === 'response_time');
        if (apiResponseTimes.length > 0) {
          const avgResponseTime = apiResponseTimes.reduce((sum, m) => sum + m.value, 0) / apiResponseTimes.length;
          metrics.responseTime = avgResponseTime;
          
          if (avgResponseTime > 3000) {
            issues.push('API 響應時間過長');
            score -= 30;
          } else if (avgResponseTime > 1000) {
            issues.push('API 響應時間較慢');
            score -= 15;
          }
        }

        const apiErrors = relevantMetrics.filter(m => m.name === 'error_rate');
        if (apiErrors.length > 0) {
          const avgErrorRate = apiErrors.reduce((sum, m) => sum + m.value, 0) / apiErrors.length;
          metrics.errorRate = avgErrorRate;
          
          if (avgErrorRate > 0.05) {
            issues.push(`API 錯誤率較高: ${(avgErrorRate * 100).toFixed(1)}%`);
            score -= avgErrorRate * 100;
          }
        }
        break;

      case 'agent':
        // 代理相關指標評估
        const agentMetrics = relevantMetrics.filter(m => m.name.includes('agent'));
        if (agentMetrics.length === 0) {
          issues.push('缺少代理性能數據');
          score -= 10;
        }
        break;
    }

    // 確保分數在0-100範圍內
    score = Math.max(0, Math.min(100, score));

    let status: ComponentHealth['status'] = 'healthy';
    if (score < 50) {
      status = 'critical';
    } else if (score < 80) {
      status = 'warning';
    }

    return {
      status,
      score: Math.round(score),
      metrics,
      issues
    };
  }

  /**
   * 獲取時間窗口內的指標
   */
  private getMetricsInTimeWindow(category: string, start: Date, end: Date): PerformanceMetric[] {
    const result: PerformanceMetric[] = [];
    
    for (const [key, metricsList] of this.metrics.entries()) {
      if (key.startsWith(category + ':')) {
        const filtered = metricsList.filter(m => 
          m.timestamp >= start && m.timestamp <= end
        );
        result.push(...filtered);
      }
    }

    return result;
  }

  /**
   * 檢查警報
   */
  private checkAlerts() {
    const now = new Date();

    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // 檢查冷卻時間
      if (rule.lastTriggered && 
          now.getTime() - rule.lastTriggered.getTime() < rule.cooldown) {
        continue;
      }

      // 獲取時間窗口內的指標
      const windowStart = new Date(now.getTime() - rule.condition.timeWindow);
      const relevantMetrics = this.getMetricsInTimeWindow(rule.category, windowStart, now)
        .filter(m => m.name === rule.condition.metric);

      if (relevantMetrics.length === 0) continue;

      // 計算指標值（取平均值）
      const avgValue = relevantMetrics.reduce((sum, m) => sum + m.value, 0) / relevantMetrics.length;

      // 檢查條件
      let conditionMet = false;
      switch (rule.condition.operator) {
        case 'gt':
          conditionMet = avgValue > rule.condition.threshold;
          break;
        case 'lt':
          conditionMet = avgValue < rule.condition.threshold;
          break;
        case 'gte':
          conditionMet = avgValue >= rule.condition.threshold;
          break;
        case 'lte':
          conditionMet = avgValue <= rule.condition.threshold;
          break;
        case 'eq':
          conditionMet = avgValue === rule.condition.threshold;
          break;
        case 'ne':
          conditionMet = avgValue !== rule.condition.threshold;
          break;
      }

      if (conditionMet) {
        this.triggerAlert(rule, avgValue, relevantMetrics);
      }
    }
  }

  /**
   * 觸發警報
   */
  private triggerAlert(rule: AlertRule, value: number, metrics: PerformanceMetric[]) {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ruleId: rule.id,
      severity: rule.severity,
      message: `${rule.name}: ${rule.condition.metric} = ${value.toFixed(2)} (閾值: ${rule.condition.threshold})`,
      timestamp: new Date(),
      resolved: false,
      metadata: {
        rule: rule.name,
        metric: rule.condition.metric,
        value,
        threshold: rule.condition.threshold,
        recentMetrics: metrics.slice(-5)
      }
    };

    this.alerts.push(alert);
    rule.lastTriggered = new Date();

    // 保留最近100個警報
    if (this.alerts.length > 100) {
      this.alerts.splice(0, this.alerts.length - 100);
    }

    // 發送事件
    this.emit('alert:triggered', alert);

    // 廣播警報
    hierarchyBroadcaster.sendSystemNotification(
      alert.severity,
      alert.message,
      'alerts'
    );

    console.warn(`[ALERT] ${alert.message}`);
  }

  /**
   * 獲取最新系統健康狀況
   */
  getCurrentHealth(): SystemHealth | null {
    return this.healthHistory[this.healthHistory.length - 1] || null;
  }

  /**
   * 獲取健康狀況歷史
   */
  getHealthHistory(hours: number = 24): SystemHealth[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.healthHistory.filter(h => h.timestamp >= cutoff);
  }

  /**
   * 獲取指標
   */
  getMetrics(
    category?: string,
    name?: string,
    timeWindow?: number
  ): PerformanceMetric[] {
    let result: PerformanceMetric[] = [];

    if (category && name) {
      const key = `${category}:${name}`;
      result = this.metrics.get(key) || [];
    } else if (category) {
      for (const [key, metrics] of this.metrics.entries()) {
        if (key.startsWith(category + ':')) {
          result.push(...metrics);
        }
      }
    } else {
      for (const metrics of this.metrics.values()) {
        result.push(...metrics);
      }
    }

    // 應用時間窗口過濾
    if (timeWindow) {
      const cutoff = new Date(Date.now() - timeWindow);
      result = result.filter(m => m.timestamp >= cutoff);
    }

    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 獲取活動警報
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * 獲取所有警報
   */
  getAllAlerts(limit?: number): Alert[] {
    const sorted = [...this.alerts].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * 解決警報
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      
      this.emit('alert:resolved', alert);
      
      hierarchyBroadcaster.sendSystemNotification(
        'info',
        `警報已解決: ${alert.message}`,
        'alerts'
      );
      
      return true;
    }
    return false;
  }

  /**
   * 獲取性能統計
   */
  getPerformanceStats(timeWindow: number = 3600000): {
    totalMetrics: number;
    activeAlerts: number;
    systemHealth: SystemHealth | null;
    topMetrics: Array<{
      category: string;
      name: string;
      avgValue: number;
      unit: string;
      trend: 'up' | 'down' | 'stable';
    }>;
  } {
    const cutoff = new Date(Date.now() - timeWindow);
    let totalMetrics = 0;

    const metricStats: Record<string, {
      category: string;
      name: string;
      values: number[];
      unit: string;
    }> = {};

    // 收集指標統計
    for (const [key, metrics] of this.metrics.entries()) {
      const recentMetrics = metrics.filter(m => m.timestamp >= cutoff);
      totalMetrics += recentMetrics.length;

      if (recentMetrics.length > 0) {
        const [category, name] = key.split(':');
        metricStats[key] = {
          category,
          name,
          values: recentMetrics.map(m => m.value),
          unit: recentMetrics[0].unit
        };
      }
    }

    // 計算趨勢
    const topMetrics = Object.values(metricStats)
      .map(stat => {
        const avgValue = stat.values.reduce((sum, v) => sum + v, 0) / stat.values.length;
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (stat.values.length >= 2) {
          const firstHalf = stat.values.slice(0, Math.floor(stat.values.length / 2));
          const secondHalf = stat.values.slice(Math.floor(stat.values.length / 2));
          
          const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
          
          const change = Math.abs(secondAvg - firstAvg) / firstAvg;
          if (change > 0.1) { // 10% 變化閾值
            trend = secondAvg > firstAvg ? 'up' : 'down';
          }
        }

        return {
          category: stat.category,
          name: stat.name,
          avgValue,
          unit: stat.unit,
          trend
        };
      })
      .sort((a, b) => b.avgValue - a.avgValue)
      .slice(0, 10);

    return {
      totalMetrics,
      activeAlerts: this.getActiveAlerts().length,
      systemHealth: this.getCurrentHealth(),
      topMetrics
    };
  }
}