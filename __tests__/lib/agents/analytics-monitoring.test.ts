import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { analyticsService } from '@/lib/agents/analytics-service';
import { performanceMonitor } from '@/lib/agents/performance-monitor';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client');

const mockPrisma = {
  epic: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn()
  },
  story: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn()
  },
  task: {
    findMany: jest.fn(),
    count: jest.fn()
  },
  conversation: {
    findMany: jest.fn(),
    findFirst: jest.fn()
  },
  message: {
    findMany: jest.fn()
  },
  messageAction: {
    findMany: jest.fn()
  }
};

describe('Analytics and Monitoring Integration Tests', () => {
  const testProjectId = 'test-analytics-project';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Prisma instance
    (PrismaClient as jest.MockedClass<typeof PrismaClient>).mockImplementation(() => mockPrisma as any);
  });

  afterEach(() => {
    performanceMonitor.stopMonitoring();
    jest.restoreAllMocks();
  });

  describe('Analytics Service', () => {
    it('should generate comprehensive project metrics', async () => {
      // Mock database responses
      mockPrisma.epic.findMany.mockResolvedValue([
        { id: '1', status: 'COMPLETED', title: 'Epic 1', estimatedEffort: 10 },
        { id: '2', status: 'IN_PROGRESS', title: 'Epic 2', estimatedEffort: 15 }
      ]);

      mockPrisma.story.findMany.mockResolvedValue([
        { status: 'COMPLETED', storyPoints: 5 },
        { status: 'IN_PROGRESS', storyPoints: 8 },
        { status: 'PENDING', storyPoints: 3 }
      ]);

      mockPrisma.task.findMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'IN_PROGRESS' },
        { status: 'PENDING' }
      ]);

      mockPrisma.conversation.findFirst.mockResolvedValue({
        phase: 'MVP'
      });

      const metrics = await analyticsService.getProjectMetrics(testProjectId);

      expect(metrics).toBeDefined();
      expect(metrics.overview).toBeDefined();
      expect(metrics.overview.totalEpics).toBe(2);
      expect(metrics.overview.totalStories).toBe(3);
      expect(metrics.overview.totalTasks).toBe(4);
      expect(metrics.overview.currentPhase).toBe('MVP');
      expect(metrics.overview.healthScore).toBeGreaterThan(0);
      expect(metrics.overview.healthScore).toBeLessThanOrEqual(100);

      expect(metrics.progress).toBeDefined();
      expect(metrics.productivity).toBeDefined();
      expect(metrics.quality).toBeDefined();
      expect(metrics.aiPerformance).toBeDefined();
    });

    it('should calculate project health score correctly', async () => {
      // Mock high completion rate scenario
      mockPrisma.epic.findMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'COMPLETED' }
      ]);

      mockPrisma.story.findMany.mockResolvedValue([
        { status: 'COMPLETED', storyPoints: 5 },
        { status: 'COMPLETED', storyPoints: 3 }
      ]);

      mockPrisma.task.findMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'COMPLETED' }
      ]);

      mockPrisma.conversation.findFirst.mockResolvedValue({
        phase: 'CONTINUOUS'
      });

      const metrics = await analyticsService.getProjectMetrics(testProjectId);
      
      expect(metrics.overview.completionRate).toBe(100);
      expect(metrics.overview.healthScore).toBeGreaterThan(80);
    });

    it('should get dashboard data with recent activity', async () => {
      mockPrisma.message.findMany.mockResolvedValue([
        {
          content: '用戶詢問關於專案進度的問題',
          role: 'USER',
          createdAt: new Date()
        },
        {
          content: '根據目前的進度，專案預計下週完成核心功能',
          role: 'AGENT',
          createdAt: new Date()
        }
      ]);

      mockPrisma.task.count
        .mockResolvedValueOnce(0) // blocked tasks
        .mockResolvedValueOnce(0); // overdue tasks

      const dashboardData = await analyticsService.getDashboardData(testProjectId);

      expect(dashboardData).toBeDefined();
      expect(dashboardData.recentActivity).toHaveLength(2);
      expect(dashboardData.recentActivity[0].type).toBe('user_message');
      expect(dashboardData.recentActivity[1].type).toBe('ai_response');
      expect(dashboardData.alerts).toHaveLength(0);
      expect(dashboardData.currentSprint).toBeDefined();
    });

    it('should detect project alerts', async () => {
      // Mock blocked tasks
      mockPrisma.task.count
        .mockResolvedValueOnce(3) // blocked tasks
        .mockResolvedValueOnce(2); // overdue tasks

      mockPrisma.message.findMany.mockResolvedValue([]);

      const dashboardData = await analyticsService.getDashboardData(testProjectId);

      expect(dashboardData.alerts).toHaveLength(2);
      expect(dashboardData.alerts[0].type).toBe('warning');
      expect(dashboardData.alerts[0].message).toContain('被阻擋');
      expect(dashboardData.alerts[1].type).toBe('error');
      expect(dashboardData.alerts[1].message).toContain('逾期');
    });
  });

  describe('Performance Monitor', () => {
    it('should collect and provide performance metrics', () => {
      const metrics = performanceMonitor.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.system).toBeDefined();
      expect(metrics.ai).toBeDefined();
      expect(metrics.database).toBeDefined();
      expect(metrics.realtime).toBeDefined();

      // System metrics
      expect(metrics.system.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.system.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.system.memory.percentage).toBeLessThanOrEqual(100);

      // AI metrics
      expect(metrics.ai.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.ai.actionSuccessRate).toBeGreaterThanOrEqual(0);
      expect(metrics.ai.actionSuccessRate).toBeLessThanOrEqual(100);

      // Database metrics
      expect(metrics.database.connectionPool.total).toBeGreaterThan(0);
      expect(metrics.database.queryPerformance.cacheHitRate).toBeGreaterThanOrEqual(0);

      // Realtime metrics
      expect(metrics.realtime.deliveryRate).toBeGreaterThanOrEqual(0);
      expect(metrics.realtime.deliveryRate).toBeLessThanOrEqual(100);
    });

    it('should start and stop monitoring', () => {
      expect(performanceMonitor['isMonitoring']).toBe(false);

      performanceMonitor.startMonitoring(1000); // 1 second interval for testing
      expect(performanceMonitor['isMonitoring']).toBe(true);
      expect(performanceMonitor['monitoringInterval']).not.toBeNull();

      performanceMonitor.stopMonitoring();
      expect(performanceMonitor['isMonitoring']).toBe(false);
      expect(performanceMonitor['monitoringInterval']).toBeNull();
    });

    it('should generate performance recommendations', () => {
      // Force high metrics to trigger recommendations
      const originalCollectMetrics = performanceMonitor['collectSystemMetrics'];
      jest.spyOn(performanceMonitor as any, 'collectSystemMetrics').mockImplementation(async () => ({
        cpu: { usage: 85, average: 80, peak: 90 },
        memory: { used: 1800, total: 2048, percentage: 88, peak: 1900 },
        disk: { used: 40960, total: 51200, percentage: 80 },
        network: { inbound: 1000, outbound: 500, latency: 50 },
        uptime: Date.now(),
        responseTime: 200
      }));

      jest.spyOn(performanceMonitor as any, 'collectAIMetrics').mockImplementation(async () => ({
        averageResponseTime: 2500, // High response time
        tokenUsageRate: 150,
        requestThroughput: 10,
        errorRate: 8, // High error rate
        actionSuccessRate: 82,
        streamingPerformance: {
          averageLatency: 250,
          chunkDeliveryRate: 96,
          connectionStability: 98
        },
        costEfficiency: {
          tokensPerDollar: 9000,
          responseQuality: 0.88,
          costTrend: []
        }
      }));

      performanceMonitor['collectMetrics']();
      performanceMonitor['generateRecommendations']();

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.recommendations.length).toBeGreaterThan(0);

      const systemRecs = metrics.recommendations.filter(r => r.category === 'SYSTEM');
      const aiRecs = metrics.recommendations.filter(r => r.category === 'AI');

      expect(systemRecs.length).toBeGreaterThan(0);
      expect(aiRecs.length).toBeGreaterThan(0);

      // Restore original method
      jest.spyOn(performanceMonitor as any, 'collectSystemMetrics').mockImplementation(originalCollectMetrics);
    });

    it('should handle alert rules and notifications', async () => {
      // Manually trigger alert conditions
      const highCPUMetrics = {
        system: {
          cpu: { usage: 90, average: 85, peak: 95 },
          memory: { used: 1024, total: 2048, percentage: 50, peak: 1200 },
          disk: { used: 15360, total: 51200, percentage: 30 },
          network: { inbound: 500, outbound: 250, latency: 25 },
          uptime: Date.now(),
          responseTime: 100
        },
        ai: {
          averageResponseTime: 1000,
          tokenUsageRate: 100,
          requestThroughput: 5,
          errorRate: 2,
          actionSuccessRate: 95,
          streamingPerformance: {
            averageLatency: 200,
            chunkDeliveryRate: 98,
            connectionStability: 99
          },
          costEfficiency: {
            tokensPerDollar: 11000,
            responseQuality: 0.9,
            costTrend: []
          }
        },
        database: {
          connectionPool: { active: 3, idle: 12, total: 20 },
          queryPerformance: { averageTime: 15, slowQueries: 0, cacheHitRate: 92 },
          storage: { size: 55, growth: 0.6, indexEfficiency: 94 }
        },
        realtime: {
          websocketConnections: 5,
          messageLatency: 60,
          deliveryRate: 98,
          reconnectionRate: 1,
          bandwidthUsage: 50
        },
        recommendations: []
      };

      performanceMonitor['metrics'] = highCPUMetrics;
      performanceMonitor['checkAlertRules']();

      const activeAlerts = performanceMonitor.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);

      const cpuAlert = activeAlerts.find(alert => alert.ruleId === 'high-cpu-usage');
      expect(cpuAlert).toBeDefined();
      expect(cpuAlert?.severity).toBe('HIGH');
      expect(cpuAlert?.resolved).toBe(false);
    });

    it('should calculate performance summary correctly', () => {
      const summary = performanceMonitor.getPerformanceSummary();

      expect(summary).toBeDefined();
      expect(summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(summary.overallScore).toBeLessThanOrEqual(100);
      expect(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']).toContain(summary.systemHealth);
      expect(summary.criticalIssues).toBeGreaterThanOrEqual(0);
      expect(summary.recommendations).toBeGreaterThanOrEqual(0);
    });

    it('should provide performance history', async () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        end: new Date()
      };

      const history = await performanceMonitor.getPerformanceHistory(timeRange, 'hour');

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      expect(history.length).toBeLessThanOrEqual(24);

      // Check that each point has required metrics
      for (const point of history) {
        expect(point.system).toBeDefined();
        expect(point.ai).toBeDefined();
        expect(point.database).toBeDefined();
        expect(point.realtime).toBeDefined();
      }
    });

    it('should resolve alerts manually', () => {
      // Create a test alert
      const testAlert = {
        id: 'test-alert-123',
        ruleId: 'test-rule',
        title: 'Test Alert',
        description: 'Test alert description',
        severity: 'MEDIUM' as const,
        timestamp: new Date(),
        resolved: false,
        metadata: {}
      };

      performanceMonitor['activeAlerts'].push(testAlert);

      const resolved = performanceMonitor.resolveAlert('test-alert-123');
      expect(resolved).toBe(true);

      const alert = performanceMonitor['activeAlerts'].find(a => a.id === 'test-alert-123');
      expect(alert?.resolved).toBe(true);
      expect(alert?.resolvedAt).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should integrate analytics and performance data', async () => {
      // Start performance monitoring
      performanceMonitor.startMonitoring(500); // Short interval for testing

      // Wait for a collection cycle
      await new Promise(resolve => setTimeout(resolve, 600));

      // Mock analytics data
      mockPrisma.epic.findMany.mockResolvedValue([{ status: 'COMPLETED' }]);
      mockPrisma.story.findMany.mockResolvedValue([{ status: 'COMPLETED', storyPoints: 5 }]);
      mockPrisma.task.findMany.mockResolvedValue([{ status: 'COMPLETED' }]);
      mockPrisma.conversation.findFirst.mockResolvedValue({ phase: 'MVP' });
      mockPrisma.message.findMany.mockResolvedValue([]);

      // Get combined data
      const [projectMetrics, performanceMetrics, performanceSummary] = await Promise.all([
        analyticsService.getProjectMetrics(testProjectId),
        performanceMonitor.getMetrics(),
        performanceMonitor.getPerformanceSummary()
      ]);

      // Verify integration
      expect(projectMetrics).toBeDefined();
      expect(performanceMetrics).toBeDefined();
      expect(performanceSummary).toBeDefined();

      // Check that both systems provide complementary data
      expect(projectMetrics.overview.healthScore).toBeDefined();
      expect(performanceSummary.overallScore).toBeDefined();
      expect(performanceSummary.systemHealth).toBeDefined();

      performanceMonitor.stopMonitoring();
    });

    it('should handle concurrent data collection', async () => {
      const promises = [];

      // Start multiple concurrent operations
      for (let i = 0; i < 5; i++) {
        promises.push(performanceMonitor['collectMetrics']());
      }

      // Mock analytics calls
      mockPrisma.epic.findMany.mockResolvedValue([]);
      mockPrisma.story.findMany.mockResolvedValue([]);
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.conversation.findFirst.mockResolvedValue({ phase: 'REQUIREMENTS' });

      promises.push(analyticsService.getProjectMetrics(testProjectId));

      // Wait for all operations to complete
      const results = await Promise.all(promises);

      expect(results).toHaveLength(6);
      expect(results[5]).toBeDefined(); // Analytics result
    });

    it('should provide real-time dashboard updates', async () => {
      // Mock recent activity
      mockPrisma.message.findMany.mockResolvedValue([
        {
          content: '即時測試訊息',
          role: 'USER',
          createdAt: new Date()
        }
      ]);

      mockPrisma.task.count.mockResolvedValue(0);

      const dashboardData = await analyticsService.getDashboardData(testProjectId);
      const performanceData = performanceMonitor.getPerformanceSummary();

      expect(dashboardData.recentActivity).toBeDefined();
      expect(dashboardData.recentActivity.length).toBeGreaterThan(0);
      expect(performanceData.systemHealth).toBeDefined();

      // Verify real-time characteristics
      expect(dashboardData.activeUsers).toBeDefined();
      expect(dashboardData.currentSprint).toBeDefined();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      mockPrisma.epic.findMany.mockRejectedValue(new Error('Database connection failed'));
      mockPrisma.story.findMany.mockRejectedValue(new Error('Database connection failed'));
      mockPrisma.task.findMany.mockRejectedValue(new Error('Database connection failed'));

      await expect(analyticsService.getProjectMetrics(testProjectId)).rejects.toThrow();
    });

    it('should continue monitoring despite collection errors', async () => {
      const originalCollectMetrics = performanceMonitor['collectMetrics'];
      let errorCount = 0;

      // Mock collection error
      jest.spyOn(performanceMonitor as any, 'collectMetrics').mockImplementation(async () => {
        errorCount++;
        if (errorCount === 1) {
          throw new Error('Collection failed');
        }
        return originalCollectMetrics.call(performanceMonitor);
      });

      performanceMonitor.startMonitoring(100); // Very short interval
      
      // Wait for multiple collection cycles
      await new Promise(resolve => setTimeout(resolve, 300));
      
      expect(errorCount).toBeGreaterThan(1); // Should have retried
      expect(performanceMonitor['isMonitoring']).toBe(true); // Should still be running

      performanceMonitor.stopMonitoring();

      // Restore original method
      jest.spyOn(performanceMonitor as any, 'collectMetrics').mockImplementation(originalCollectMetrics);
    });

    it('should validate performance thresholds', () => {
      const metrics = performanceMonitor.getMetrics();

      // Validate system metrics
      expect(metrics.system.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.system.cpu.usage).toBeLessThanOrEqual(100);
      expect(metrics.system.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.system.memory.percentage).toBeLessThanOrEqual(100);

      // Validate AI metrics
      expect(metrics.ai.actionSuccessRate).toBeGreaterThanOrEqual(0);
      expect(metrics.ai.actionSuccessRate).toBeLessThanOrEqual(100);
      expect(metrics.ai.errorRate).toBeGreaterThanOrEqual(0);

      // Validate database metrics
      expect(metrics.database.queryPerformance.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.database.queryPerformance.cacheHitRate).toBeLessThanOrEqual(100);

      // Validate realtime metrics
      expect(metrics.realtime.deliveryRate).toBeGreaterThanOrEqual(0);
      expect(metrics.realtime.deliveryRate).toBeLessThanOrEqual(100);
    });
  });
});