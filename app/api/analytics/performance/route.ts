/**
 * Performance Analytics API
 * 
 * Provides detailed performance metrics, monitoring data, and system health information.
 */

import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/agents/performance-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric') || 'all';
    const timeRange = searchParams.get('timeRange') || '24h';
    const granularity = searchParams.get('granularity') || 'hour';

    // Parse time range
    const range = parseTimeRange(timeRange);

    let responseData: any = {};

    switch (metric) {
      case 'current':
        responseData = {
          metrics: performanceMonitor.getMetrics(),
          summary: performanceMonitor.getPerformanceSummary(),
          timestamp: new Date().toISOString()
        };
        break;

      case 'history':
        responseData = {
          history: await performanceMonitor.getPerformanceHistory(
            range, 
            granularity as 'minute' | 'hour' | 'day'
          ),
          range,
          granularity
        };
        break;

      case 'alerts':
        responseData = {
          active: performanceMonitor.getActiveAlerts(),
          history: performanceMonitor.getAlertHistory(100),
          summary: {
            active: performanceMonitor.getActiveAlerts().length,
            critical: performanceMonitor.getActiveAlerts().filter(a => a.severity === 'CRITICAL').length,
            resolved_today: performanceMonitor.getAlertHistory().filter(a => 
              a.resolved && a.resolvedAt && 
              a.resolvedAt.getTime() > Date.now() - 24 * 60 * 60 * 1000
            ).length
          }
        };
        break;

      case 'recommendations':
        const currentMetrics = performanceMonitor.getMetrics();
        responseData = {
          recommendations: currentMetrics.recommendations,
          summary: {
            total: currentMetrics.recommendations.length,
            high_priority: currentMetrics.recommendations.filter(r => r.severity === 'HIGH' || r.severity === 'CRITICAL').length,
            categories: getRecommendationCategories(currentMetrics.recommendations)
          }
        };
        break;

      case 'health':
        const healthData = performanceMonitor.getPerformanceSummary();
        const currentData = performanceMonitor.getMetrics();
        
        responseData = {
          overallScore: healthData.overallScore,
          systemHealth: healthData.systemHealth,
          components: {
            system: {
              score: calculateComponentScore(currentData.system),
              status: getComponentStatus(currentData.system)
            },
            ai: {
              score: calculateAIScore(currentData.ai),
              status: getAIStatus(currentData.ai)
            },
            database: {
              score: calculateDatabaseScore(currentData.database),
              status: getDatabaseStatus(currentData.database)
            },
            realtime: {
              score: calculateRealtimeScore(currentData.realtime),
              status: getRealtimeStatus(currentData.realtime)
            }
          },
          criticalIssues: healthData.criticalIssues,
          recommendations: healthData.recommendations
        };
        break;

      case 'all':
      default:
        const allMetrics = performanceMonitor.getMetrics();
        const allSummary = performanceMonitor.getPerformanceSummary();
        
        responseData = {
          current: allMetrics,
          summary: allSummary,
          alerts: {
            active: performanceMonitor.getActiveAlerts(),
            count: performanceMonitor.getActiveAlerts().length
          },
          history: await performanceMonitor.getPerformanceHistory(range, 'hour'),
          timestamp: new Date().toISOString()
        };
        break;
    }

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Performance API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to retrieve performance data',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}

/**
 * Update performance monitoring configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config = {} } = body;

    switch (action) {
      case 'start_monitoring':
        performanceMonitor.startMonitoring(config.interval || 30000);
        return NextResponse.json({
          success: true,
          message: '效能監控已啟動',
          config: { interval: config.interval || 30000 }
        });

      case 'stop_monitoring':
        performanceMonitor.stopMonitoring();
        return NextResponse.json({
          success: true,
          message: '效能監控已停止'
        });

      case 'resolve_alert':
        if (!config.alertId) {
          return NextResponse.json(
            { success: false, error: 'Alert ID is required' },
            { status: 400 }
          );
        }
        
        const resolved = performanceMonitor.resolveAlert(config.alertId);
        return NextResponse.json({
          success: resolved,
          message: resolved ? '警示已解決' : '找不到指定的警示',
          alertId: config.alertId
        });

      case 'update_thresholds':
        // In a real implementation, this would update alert thresholds
        return NextResponse.json({
          success: true,
          message: '閾值設定已更新',
          thresholds: config.thresholds
        });

      case 'export_metrics':
        const exportData = {
          timestamp: new Date().toISOString(),
          metrics: performanceMonitor.getMetrics(),
          alerts: performanceMonitor.getAlertHistory(1000),
          summary: performanceMonitor.getPerformanceSummary()
        };

        return NextResponse.json({
          success: true,
          message: '效能數據已匯出',
          data: exportData
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Performance configuration error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update performance configuration',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}

/**
 * Parse time range parameter
 */
function parseTimeRange(timeRange: string): { start: Date; end: Date } {
  const end = new Date();
  let start: Date;

  switch (timeRange) {
    case '15m':
      start = new Date(end.getTime() - 15 * 60 * 1000);
      break;
    case '1h':
      start = new Date(end.getTime() - 60 * 60 * 1000);
      break;
    case '6h':
      start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
      break;
    case '24h':
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

/**
 * Get recommendation categories summary
 */
function getRecommendationCategories(recommendations: any[]): Record<string, number> {
  const categories = recommendations.reduce((acc, rec) => {
    acc[rec.category] = (acc[rec.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return categories;
}

/**
 * Calculate component score
 */
function calculateComponentScore(systemMetrics: any): number {
  let score = 100;
  
  if (systemMetrics.cpu.usage > 80) score -= 30;
  else if (systemMetrics.cpu.usage > 60) score -= 15;
  
  if (systemMetrics.memory.percentage > 85) score -= 25;
  else if (systemMetrics.memory.percentage > 70) score -= 10;
  
  if (systemMetrics.responseTime > 200) score -= 20;
  else if (systemMetrics.responseTime > 100) score -= 10;

  return Math.max(0, score);
}

/**
 * Get component status
 */
function getComponentStatus(systemMetrics: any): 'healthy' | 'warning' | 'critical' {
  if (systemMetrics.cpu.usage > 90 || systemMetrics.memory.percentage > 95) {
    return 'critical';
  }
  if (systemMetrics.cpu.usage > 70 || systemMetrics.memory.percentage > 80) {
    return 'warning';
  }
  return 'healthy';
}

/**
 * Calculate AI score
 */
function calculateAIScore(aiMetrics: any): number {
  let score = 100;
  
  if (aiMetrics.averageResponseTime > 3000) score -= 30;
  else if (aiMetrics.averageResponseTime > 2000) score -= 15;
  
  if (aiMetrics.errorRate > 10) score -= 40;
  else if (aiMetrics.errorRate > 5) score -= 20;
  
  if (aiMetrics.actionSuccessRate < 80) score -= 25;
  else if (aiMetrics.actionSuccessRate < 90) score -= 10;

  return Math.max(0, score);
}

/**
 * Get AI status
 */
function getAIStatus(aiMetrics: any): 'healthy' | 'warning' | 'critical' {
  if (aiMetrics.errorRate > 15 || aiMetrics.actionSuccessRate < 70) {
    return 'critical';
  }
  if (aiMetrics.errorRate > 5 || aiMetrics.averageResponseTime > 3000) {
    return 'warning';
  }
  return 'healthy';
}

/**
 * Calculate database score
 */
function calculateDatabaseScore(dbMetrics: any): number {
  let score = 100;
  
  if (dbMetrics.queryPerformance.averageTime > 100) score -= 25;
  else if (dbMetrics.queryPerformance.averageTime > 50) score -= 10;
  
  if (dbMetrics.queryPerformance.cacheHitRate < 80) score -= 20;
  else if (dbMetrics.queryPerformance.cacheHitRate < 90) score -= 10;
  
  if (dbMetrics.connectionPool.active / dbMetrics.connectionPool.total > 0.8) score -= 15;

  return Math.max(0, score);
}

/**
 * Get database status
 */
function getDatabaseStatus(dbMetrics: any): 'healthy' | 'warning' | 'critical' {
  if (dbMetrics.queryPerformance.averageTime > 200 || dbMetrics.queryPerformance.cacheHitRate < 70) {
    return 'critical';
  }
  if (dbMetrics.queryPerformance.averageTime > 100 || dbMetrics.queryPerformance.cacheHitRate < 85) {
    return 'warning';
  }
  return 'healthy';
}

/**
 * Calculate realtime score
 */
function calculateRealtimeScore(realtimeMetrics: any): number {
  let score = 100;
  
  if (realtimeMetrics.deliveryRate < 90) score -= 30;
  else if (realtimeMetrics.deliveryRate < 95) score -= 15;
  
  if (realtimeMetrics.messageLatency > 200) score -= 20;
  else if (realtimeMetrics.messageLatency > 100) score -= 10;
  
  if (realtimeMetrics.reconnectionRate > 5) score -= 25;

  return Math.max(0, score);
}

/**
 * Get realtime status
 */
function getRealtimeStatus(realtimeMetrics: any): 'healthy' | 'warning' | 'critical' {
  if (realtimeMetrics.deliveryRate < 85 || realtimeMetrics.reconnectionRate > 10) {
    return 'critical';
  }
  if (realtimeMetrics.deliveryRate < 95 || realtimeMetrics.messageLatency > 150) {
    return 'warning';
  }
  return 'healthy';
}