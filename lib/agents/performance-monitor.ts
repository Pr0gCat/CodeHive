/**
 * Performance Monitoring Service
 * 
 * Monitors system performance, AI agent efficiency, and resource usage
 * with real-time alerting and optimization recommendations.
 */

export interface PerformanceMetrics {
  system: SystemMetrics;
  ai: AIPerformanceMetrics;
  database: DatabaseMetrics;
  realtime: RealtimeMetrics;
  recommendations: PerformanceRecommendation[];
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    average: number;
    peak: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    peak: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    inbound: number;
    outbound: number;
    latency: number;
  };
  uptime: number;
  responseTime: number;
}

export interface AIPerformanceMetrics {
  averageResponseTime: number;
  tokenUsageRate: number;
  requestThroughput: number;
  errorRate: number;
  actionSuccessRate: number;
  streamingPerformance: {
    averageLatency: number;
    chunkDeliveryRate: number;
    connectionStability: number;
  };
  costEfficiency: {
    tokensPerDollar: number;
    responseQuality: number;
    costTrend: number[];
  };
}

export interface DatabaseMetrics {
  connectionPool: {
    active: number;
    idle: number;
    total: number;
  };
  queryPerformance: {
    averageTime: number;
    slowQueries: number;
    cacheHitRate: number;
  };
  storage: {
    size: number;
    growth: number;
    indexEfficiency: number;
  };
}

export interface RealtimeMetrics {
  websocketConnections: number;
  messageLatency: number;
  deliveryRate: number;
  reconnectionRate: number;
  bandwidthUsage: number;
}

export interface PerformanceRecommendation {
  category: 'SYSTEM' | 'AI' | 'DATABASE' | 'REALTIME';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  impact: string;
  action: string;
  estimatedImprovement: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
}

export interface PerformanceAlert {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private alertRules: AlertRule[] = [];
  private activeAlerts: PerformanceAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor() {
    this.metrics = this.initializeMetrics();
    this.setupDefaultAlertRules();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      console.warn('Performance monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    console.log(`Starting performance monitoring with ${intervalMs}ms interval`);

    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
      this.checkAlertRules();
      this.generateRecommendations();
    }, intervalMs);

    // Initial collection
    this.collectMetrics();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    console.log('Performance monitoring stopped');
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance history
   */
  async getPerformanceHistory(
    timeRange: { start: Date; end: Date },
    granularity: 'minute' | 'hour' | 'day' = 'hour'
  ): Promise<PerformanceMetrics[]> {
    // In a real implementation, this would query stored metrics
    // For now, generate sample historical data
    const history: PerformanceMetrics[] = [];
    const interval = this.getIntervalMs(granularity);
    const duration = timeRange.end.getTime() - timeRange.start.getTime();
    const points = Math.min(Math.floor(duration / interval), 100); // Limit to 100 points

    for (let i = 0; i < points; i++) {
      const timestamp = new Date(timeRange.start.getTime() + i * interval);
      history.push(this.generateSampleMetrics(timestamp));
    }

    return history;
  }

  /**
   * Collect current performance metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const [systemMetrics, aiMetrics, dbMetrics, realtimeMetrics] = await Promise.all([
        this.collectSystemMetrics(),
        this.collectAIMetrics(),
        this.collectDatabaseMetrics(),
        this.collectRealtimeMetrics()
      ]);

      this.metrics = {
        system: systemMetrics,
        ai: aiMetrics,
        database: dbMetrics,
        realtime: realtimeMetrics,
        recommendations: this.metrics.recommendations // Keep existing recommendations
      };

      console.log(`Performance metrics collected at ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Error collecting performance metrics:', error);
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    // In a real implementation, this would use system monitoring libraries
    // like 'systeminformation' or 'node-os-utils'
    const mockMetrics: SystemMetrics = {
      cpu: {
        usage: 15 + Math.random() * 20, // 15-35%
        average: 25,
        peak: 45
      },
      memory: {
        used: 512 + Math.random() * 256, // 512-768 MB
        total: 2048,
        percentage: 0,
        peak: 856
      },
      disk: {
        used: 15360, // 15 GB
        total: 51200, // 50 GB
        percentage: 30
      },
      network: {
        inbound: Math.random() * 1000, // KB/s
        outbound: Math.random() * 500,
        latency: 10 + Math.random() * 20 // 10-30ms
      },
      uptime: Date.now() - (7 * 24 * 60 * 60 * 1000), // 7 days
      responseTime: 50 + Math.random() * 100 // 50-150ms
    };

    mockMetrics.memory.percentage = (mockMetrics.memory.used / mockMetrics.memory.total) * 100;
    return mockMetrics;
  }

  /**
   * Collect AI performance metrics
   */
  private async collectAIMetrics(): Promise<AIPerformanceMetrics> {
    // This would integrate with AI service metrics in production
    return {
      averageResponseTime: 1200 + Math.random() * 800, // 1.2-2.0s
      tokenUsageRate: 100 + Math.random() * 50, // tokens per minute
      requestThroughput: 5 + Math.random() * 10, // requests per minute
      errorRate: Math.random() * 5, // 0-5%
      actionSuccessRate: 85 + Math.random() * 10, // 85-95%
      streamingPerformance: {
        averageLatency: 200 + Math.random() * 100, // 200-300ms
        chunkDeliveryRate: 95 + Math.random() * 5, // 95-100%
        connectionStability: 98 + Math.random() * 2 // 98-100%
      },
      costEfficiency: {
        tokensPerDollar: 10000 + Math.random() * 2000,
        responseQuality: 0.85 + Math.random() * 0.1,
        costTrend: Array.from({ length: 7 }, () => 0.02 + Math.random() * 0.01) // Daily costs
      }
    };
  }

  /**
   * Collect database metrics
   */
  private async collectDatabaseMetrics(): Promise<DatabaseMetrics> {
    // This would integrate with Prisma metrics in production
    return {
      connectionPool: {
        active: 2 + Math.floor(Math.random() * 5),
        idle: 8 + Math.floor(Math.random() * 10),
        total: 20
      },
      queryPerformance: {
        averageTime: 10 + Math.random() * 20, // 10-30ms
        slowQueries: Math.floor(Math.random() * 3),
        cacheHitRate: 85 + Math.random() * 10 // 85-95%
      },
      storage: {
        size: 50 + Math.random() * 10, // 50-60 MB
        growth: 0.5 + Math.random() * 0.3, // MB per day
        indexEfficiency: 90 + Math.random() * 8 // 90-98%
      }
    };
  }

  /**
   * Collect realtime metrics
   */
  private async collectRealtimeMetrics(): Promise<RealtimeMetrics> {
    // This would integrate with WebSocket server metrics
    return {
      websocketConnections: Math.floor(Math.random() * 10),
      messageLatency: 50 + Math.random() * 30, // 50-80ms
      deliveryRate: 98 + Math.random() * 2, // 98-100%
      reconnectionRate: Math.random() * 2, // 0-2%
      bandwidthUsage: Math.random() * 100 // KB/s
    };
  }

  /**
   * Initialize default metrics structure
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      system: {
        cpu: { usage: 0, average: 0, peak: 0 },
        memory: { used: 0, total: 0, percentage: 0, peak: 0 },
        disk: { used: 0, total: 0, percentage: 0 },
        network: { inbound: 0, outbound: 0, latency: 0 },
        uptime: 0,
        responseTime: 0
      },
      ai: {
        averageResponseTime: 0,
        tokenUsageRate: 0,
        requestThroughput: 0,
        errorRate: 0,
        actionSuccessRate: 0,
        streamingPerformance: {
          averageLatency: 0,
          chunkDeliveryRate: 0,
          connectionStability: 0
        },
        costEfficiency: {
          tokensPerDollar: 0,
          responseQuality: 0,
          costTrend: []
        }
      },
      database: {
        connectionPool: { active: 0, idle: 0, total: 0 },
        queryPerformance: { averageTime: 0, slowQueries: 0, cacheHitRate: 0 },
        storage: { size: 0, growth: 0, indexEfficiency: 0 }
      },
      realtime: {
        websocketConnections: 0,
        messageLatency: 0,
        deliveryRate: 0,
        reconnectionRate: 0,
        bandwidthUsage: 0
      },
      recommendations: []
    };
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'high-cpu-usage',
        name: 'High CPU Usage',
        condition: 'cpu.usage > threshold',
        threshold: 80,
        severity: 'HIGH',
        enabled: true
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        condition: 'memory.percentage > threshold',
        threshold: 85,
        severity: 'HIGH',
        enabled: true
      },
      {
        id: 'slow-ai-response',
        name: 'Slow AI Response Time',
        condition: 'ai.averageResponseTime > threshold',
        threshold: 3000, // 3 seconds
        severity: 'MEDIUM',
        enabled: true
      },
      {
        id: 'high-error-rate',
        name: 'High AI Error Rate',
        condition: 'ai.errorRate > threshold',
        threshold: 10, // 10%
        severity: 'CRITICAL',
        enabled: true
      },
      {
        id: 'low-websocket-delivery',
        name: 'Low WebSocket Delivery Rate',
        condition: 'realtime.deliveryRate < threshold',
        threshold: 95,
        severity: 'MEDIUM',
        enabled: true
      }
    ];
  }

  /**
   * Check alert rules against current metrics
   */
  private checkAlertRules(): void {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      const isTriggered = this.evaluateAlertCondition(rule);
      const existingAlert = this.activeAlerts.find(
        alert => alert.ruleId === rule.id && !alert.resolved
      );

      if (isTriggered && !existingAlert) {
        // Create new alert
        const alert: PerformanceAlert = {
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId: rule.id,
          title: rule.name,
          description: this.getAlertDescription(rule),
          severity: rule.severity,
          timestamp: new Date(),
          resolved: false,
          metadata: this.getAlertMetadata(rule)
        };

        this.activeAlerts.push(alert);
        console.warn(`Performance alert triggered: ${alert.title}`);
      } else if (!isTriggered && existingAlert) {
        // Resolve alert
        existingAlert.resolved = true;
        existingAlert.resolvedAt = new Date();
        console.info(`Performance alert resolved: ${existingAlert.title}`);
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateAlertCondition(rule: AlertRule): boolean {
    const { condition, threshold } = rule;
    const metrics = this.metrics;

    // Simple condition evaluation - in production, use a proper expression parser
    if (condition === 'cpu.usage > threshold') {
      return metrics.system.cpu.usage > threshold;
    }
    if (condition === 'memory.percentage > threshold') {
      return metrics.system.memory.percentage > threshold;
    }
    if (condition === 'ai.averageResponseTime > threshold') {
      return metrics.ai.averageResponseTime > threshold;
    }
    if (condition === 'ai.errorRate > threshold') {
      return metrics.ai.errorRate > threshold;
    }
    if (condition === 'realtime.deliveryRate < threshold') {
      return metrics.realtime.deliveryRate < threshold;
    }

    return false;
  }

  /**
   * Get alert description
   */
  private getAlertDescription(rule: AlertRule): string {
    const descriptions = {
      'high-cpu-usage': `CPU 使用率超過 ${rule.threshold}%`,
      'high-memory-usage': `記憶體使用率超過 ${rule.threshold}%`,
      'slow-ai-response': `AI 回應時間超過 ${rule.threshold}ms`,
      'high-error-rate': `AI 錯誤率超過 ${rule.threshold}%`,
      'low-websocket-delivery': `WebSocket 傳送成功率低於 ${rule.threshold}%`
    };

    return descriptions[rule.id as keyof typeof descriptions] || `${rule.name} triggered`;
  }

  /**
   * Get alert metadata
   */
  private getAlertMetadata(rule: AlertRule): Record<string, any> {
    const currentValue = this.getCurrentValue(rule.condition);
    
    return {
      threshold: rule.threshold,
      currentValue,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get current value for alert condition
   */
  private getCurrentValue(condition: string): number {
    const metrics = this.metrics;
    
    if (condition.includes('cpu.usage')) return metrics.system.cpu.usage;
    if (condition.includes('memory.percentage')) return metrics.system.memory.percentage;
    if (condition.includes('ai.averageResponseTime')) return metrics.ai.averageResponseTime;
    if (condition.includes('ai.errorRate')) return metrics.ai.errorRate;
    if (condition.includes('realtime.deliveryRate')) return metrics.realtime.deliveryRate;
    
    return 0;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): void {
    const recommendations: PerformanceRecommendation[] = [];
    const metrics = this.metrics;

    // System recommendations
    if (metrics.system.cpu.usage > 70) {
      recommendations.push({
        category: 'SYSTEM',
        severity: 'MEDIUM',
        title: 'High CPU Usage Detected',
        description: 'CPU 使用率偏高，可能影響系統回應速度',
        impact: '系統回應時間可能增加 20-30%',
        action: '考慮優化程式碼或增加伺服器資源',
        estimatedImprovement: 25
      });
    }

    // AI recommendations
    if (metrics.ai.averageResponseTime > 2000) {
      recommendations.push({
        category: 'AI',
        severity: 'MEDIUM',
        title: 'AI Response Time Optimization',
        description: 'AI 回應時間較長，影響使用者體驗',
        impact: '使用者等待時間增加',
        action: '調整 AI 模型參數或實作回應快取',
        estimatedImprovement: 40
      });
    }

    if (metrics.ai.errorRate > 5) {
      recommendations.push({
        category: 'AI',
        severity: 'HIGH',
        title: 'AI Error Rate Too High',
        description: 'AI 服務錯誤率過高',
        impact: '功能可用性下降',
        action: '檢查 API 金鑰和網路連線',
        estimatedImprovement: 60
      });
    }

    // Database recommendations
    if (metrics.database.queryPerformance.averageTime > 50) {
      recommendations.push({
        category: 'DATABASE',
        severity: 'LOW',
        title: 'Database Query Optimization',
        description: '資料庫查詢效能可以進一步優化',
        impact: '頁面載入時間略微增加',
        action: '檢查查詢索引和優化慢查詢',
        estimatedImprovement: 20
      });
    }

    // Realtime recommendations
    if (metrics.realtime.deliveryRate < 98) {
      recommendations.push({
        category: 'REALTIME',
        severity: 'MEDIUM',
        title: 'WebSocket Delivery Improvement',
        description: 'WebSocket 訊息傳送成功率可以改善',
        impact: '即時更新可能延遲或丟失',
        action: '檢查網路穩定性和連線管理',
        estimatedImprovement: 15
      });
    }

    this.metrics.recommendations = recommendations;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.activeAlerts.filter(alert => !alert.resolved);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 50): PerformanceAlert[] {
    return this.activeAlerts
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Resolve alert manually
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    overallScore: number;
    systemHealth: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    criticalIssues: number;
    recommendations: number;
  } {
    const metrics = this.metrics;
    let score = 100;

    // Deduct points for various issues
    if (metrics.system.cpu.usage > 80) score -= 20;
    if (metrics.system.memory.percentage > 85) score -= 20;
    if (metrics.ai.averageResponseTime > 2000) score -= 15;
    if (metrics.ai.errorRate > 5) score -= 25;
    if (metrics.database.queryPerformance.averageTime > 100) score -= 10;
    if (metrics.realtime.deliveryRate < 95) score -= 10;

    const healthMapping = {
      EXCELLENT: score >= 90,
      GOOD: score >= 70,
      FAIR: score >= 50,
      POOR: score < 50
    };

    const systemHealth = Object.entries(healthMapping)
      .find(([, condition]) => condition)?.[0] as any || 'POOR';

    const criticalIssues = this.activeAlerts.filter(
      alert => !alert.resolved && alert.severity === 'CRITICAL'
    ).length;

    return {
      overallScore: Math.max(0, score),
      systemHealth,
      criticalIssues,
      recommendations: metrics.recommendations.length
    };
  }

  /**
   * Generate sample metrics for history
   */
  private generateSampleMetrics(timestamp: Date): PerformanceMetrics {
    const baseTime = timestamp.getTime();
    const variance = Math.sin(baseTime / (24 * 60 * 60 * 1000)) * 0.2; // Daily cycle

    return {
      system: {
        cpu: {
          usage: Math.max(5, 20 + variance * 30 + Math.random() * 10),
          average: 25,
          peak: 45
        },
        memory: {
          used: 512 + variance * 100 + Math.random() * 50,
          total: 2048,
          percentage: 0,
          peak: 800
        },
        disk: { used: 15360, total: 51200, percentage: 30 },
        network: {
          inbound: Math.max(0, 500 + variance * 200 + Math.random() * 100),
          outbound: Math.max(0, 250 + variance * 100 + Math.random() * 50),
          latency: Math.max(5, 20 + variance * 10 + Math.random() * 5)
        },
        uptime: baseTime,
        responseTime: Math.max(20, 100 + variance * 50 + Math.random() * 30)
      },
      ai: {
        averageResponseTime: Math.max(800, 1500 + variance * 300 + Math.random() * 200),
        tokenUsageRate: Math.max(50, 120 + variance * 20 + Math.random() * 30),
        requestThroughput: Math.max(1, 8 + variance * 3 + Math.random() * 2),
        errorRate: Math.max(0, variance * 2 + Math.random() * 1),
        actionSuccessRate: Math.max(80, 92 + variance * 5 + Math.random() * 3),
        streamingPerformance: {
          averageLatency: Math.max(100, 250 + variance * 50 + Math.random() * 30),
          chunkDeliveryRate: Math.max(90, 97 + variance * 2 + Math.random() * 1),
          connectionStability: Math.max(95, 99 + variance * 1 + Math.random() * 0.5)
        },
        costEfficiency: {
          tokensPerDollar: 11000 + variance * 500 + Math.random() * 200,
          responseQuality: Math.max(0.7, 0.9 + variance * 0.05 + Math.random() * 0.02),
          costTrend: []
        }
      },
      database: {
        connectionPool: {
          active: Math.max(1, 3 + Math.floor(variance * 2 + Math.random() * 2)),
          idle: Math.max(5, 12 + Math.floor(variance * 3 + Math.random() * 2)),
          total: 20
        },
        queryPerformance: {
          averageTime: Math.max(5, 15 + variance * 5 + Math.random() * 5),
          slowQueries: Math.max(0, Math.floor(variance * 1 + Math.random() * 1)),
          cacheHitRate: Math.max(80, 90 + variance * 3 + Math.random() * 2)
        },
        storage: {
          size: 55 + Math.random() * 5,
          growth: 0.6 + Math.random() * 0.2,
          indexEfficiency: Math.max(85, 94 + variance * 2 + Math.random() * 1)
        }
      },
      realtime: {
        websocketConnections: Math.max(0, Math.floor(5 + variance * 3 + Math.random() * 2)),
        messageLatency: Math.max(20, 60 + variance * 10 + Math.random() * 10),
        deliveryRate: Math.max(90, 98 + variance * 1 + Math.random() * 0.5),
        reconnectionRate: Math.max(0, variance * 0.5 + Math.random() * 0.5),
        bandwidthUsage: Math.max(10, 50 + variance * 20 + Math.random() * 15)
      },
      recommendations: []
    };
  }

  /**
   * Get interval in milliseconds
   */
  private getIntervalMs(granularity: 'minute' | 'hour' | 'day'): number {
    switch (granularity) {
      case 'minute': return 60 * 1000;
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();