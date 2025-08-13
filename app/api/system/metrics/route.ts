/**
 * 系統指標 API
 * 提供性能監控、快取統計和查詢優化的 API 端點
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { PerformanceMonitor } from '@/lib/monitoring/performance-monitor';
import { CacheManager } from '@/lib/optimization/cache-manager';
import { QueryOptimizer } from '@/lib/optimization/query-optimizer';

// 全局實例管理
let performanceMonitorInstance: PerformanceMonitor | null = null;
let cacheManagerInstance: CacheManager | null = null;
let queryOptimizerInstance: QueryOptimizer | null = null;

function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor(prisma);
  }
  return performanceMonitorInstance;
}

function getCacheManager(): CacheManager {
  if (!cacheManagerInstance) {
    const hierarchyManager = new HierarchyManager(prisma);
    cacheManagerInstance = new CacheManager(
      {
        maxSize: 50 * 1024 * 1024, // 50MB
        maxItems: 1000,
        defaultTTL: 300000, // 5分鐘
        cleanupInterval: 60000, // 1分鐘
        enableStats: true,
        evictionPolicy: 'lru'
      },
      prisma,
      hierarchyManager
    );
  }
  return cacheManagerInstance;
}

function getQueryOptimizer(): QueryOptimizer {
  if (!queryOptimizerInstance) {
    const performanceMonitor = getPerformanceMonitor();
    queryOptimizerInstance = new QueryOptimizer(prisma, performanceMonitor);
    queryOptimizerInstance.startMonitoring();
  }
  return queryOptimizerInstance;
}

/**
 * GET /api/system/metrics - 獲取系統指標和統計
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const timeWindow = parseInt(searchParams.get('timeWindow') || '3600000'); // 預設1小時

    const performanceMonitor = getPerformanceMonitor();
    const cacheManager = getCacheManager();
    const queryOptimizer = getQueryOptimizer();

    switch (action) {
      case 'health': {
        const health = performanceMonitor.getCurrentHealth();
        
        return NextResponse.json({
          success: true,
          data: {
            action: 'health',
            health,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'health_history': {
        const hours = parseInt(searchParams.get('hours') || '24');
        const history = performanceMonitor.getHealthHistory(hours);
        
        return NextResponse.json({
          success: true,
          data: {
            action: 'health_history',
            history,
            hours,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'performance_stats': {
        const stats = performanceMonitor.getPerformanceStats(timeWindow);
        
        return NextResponse.json({
          success: true,
          data: {
            action: 'performance_stats',
            stats,
            timeWindow,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'cache_stats': {
        const cacheStats = cacheManager.getStats();
        const memoryUsage = cacheManager.getMemoryUsage();
        
        return NextResponse.json({
          success: true,
          data: {
            action: 'cache_stats',
            stats: cacheStats,
            memory: memoryUsage,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'query_stats': {
        const queryStats = queryOptimizer.getQueryStats();
        
        return NextResponse.json({
          success: true,
          data: {
            action: 'query_stats',
            stats: queryStats,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'optimization_suggestions': {
        const suggestions = queryOptimizer.getOptimizationSuggestions();
        const cacheOptimizations = cacheManager.getOptimizations();
        
        return NextResponse.json({
          success: true,
          data: {
            action: 'optimization_suggestions',
            querySuggestions: suggestions,
            cacheOptimizations,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'optimization_report': {
        const report = queryOptimizer.generateOptimizationReport();
        
        return NextResponse.json({
          success: true,
          data: {
            action: 'optimization_report',
            report,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'alerts': {
        const activeAlerts = performanceMonitor.getActiveAlerts();
        const allAlerts = performanceMonitor.getAllAlerts(50);
        
        return NextResponse.json({
          success: true,
          data: {
            action: 'alerts',
            activeAlerts,
            recentAlerts: allAlerts,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'metrics': {
        const category = searchParams.get('category');
        const name = searchParams.get('name');
        const metrics = performanceMonitor.getMetrics(category || undefined, name || undefined, timeWindow);
        
        return NextResponse.json({
          success: true,
          data: {
            action: 'metrics',
            metrics,
            category,
            name,
            timeWindow,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'system_overview': {
        // 綜合系統概述
        const health = performanceMonitor.getCurrentHealth();
        const performanceStats = performanceMonitor.getPerformanceStats(timeWindow);
        const cacheStats = cacheManager.getStats();
        const queryStats = queryOptimizer.getQueryStats();
        const activeAlerts = performanceMonitor.getActiveAlerts();

        return NextResponse.json({
          success: true,
          data: {
            action: 'system_overview',
            overview: {
              health,
              performance: performanceStats,
              cache: cacheStats,
              database: {
                totalQueries: queryStats.totalQueries,
                slowQueries: queryStats.slowQueries,
                avgExecutionTime: queryStats.avgExecutionTime
              },
              alerts: {
                active: activeAlerts.length,
                critical: activeAlerts.filter(a => a.severity === 'critical').length,
                warnings: activeAlerts.filter(a => a.severity === 'warning').length
              }
            },
            timestamp: new Date().toISOString()
          }
        });
      }

      default: {
        // 預設返回系統概述
        const health = performanceMonitor.getCurrentHealth();
        const activeAlerts = performanceMonitor.getActiveAlerts();
        
        return NextResponse.json({
          success: true,
          data: {
            status: 'active',
            health: health?.overall || 'unknown',
            healthScore: health?.score || 0,
            activeAlerts: activeAlerts.length,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
          }
        });
      }
    }
  } catch (error) {
    console.error('獲取系統指標失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法獲取系統指標',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/system/metrics - 執行系統操作和配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    const performanceMonitor = getPerformanceMonitor();
    const cacheManager = getCacheManager();
    const queryOptimizer = getQueryOptimizer();

    switch (action) {
      case 'record_metric': {
        const { category, name, value, unit, tags, metadata } = params;

        if (!category || !name || value === undefined || !unit) {
          return NextResponse.json(
            {
              success: false,
              error: '缺少必要參數',
              required: ['category', 'name', 'value', 'unit']
            },
            { status: 400 }
          );
        }

        performanceMonitor.recordMetric(category, name, value, unit, tags, metadata);

        return NextResponse.json({
          success: true,
          data: {
            action: 'record_metric',
            recorded: { category, name, value, unit },
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'cache_warmup': {
        const { projectId } = params;
        await cacheManager.warmup(projectId);

        return NextResponse.json({
          success: true,
          data: {
            action: 'cache_warmup',
            projectId,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'cache_clear': {
        cacheManager.clear();

        return NextResponse.json({
          success: true,
          data: {
            action: 'cache_clear',
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'cache_invalidate': {
        const { tag, pattern } = params;
        let count = 0;

        if (tag) {
          count = cacheManager.invalidateByTag(tag);
        } else if (pattern) {
          count = cacheManager.invalidateByPattern(new RegExp(pattern));
        } else {
          return NextResponse.json(
            {
              success: false,
              error: '需要 tag 或 pattern 參數'
            },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            action: 'cache_invalidate',
            invalidatedItems: count,
            tag,
            pattern,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'intelligent_prefetch': {
        const { context } = params;
        await cacheManager.intelligentPrefetch(context);

        return NextResponse.json({
          success: true,
          data: {
            action: 'intelligent_prefetch',
            context,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'resolve_alert': {
        const { alertId } = params;

        if (!alertId) {
          return NextResponse.json(
            {
              success: false,
              error: '警報 ID 是必填的',
              required: ['alertId']
            },
            { status: 400 }
          );
        }

        const resolved = performanceMonitor.resolveAlert(alertId);

        return NextResponse.json({
          success: true,
          data: {
            action: 'resolve_alert',
            alertId,
            resolved,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'apply_optimization': {
        const { type, index } = params;

        if (type === 'cache' && index !== undefined) {
          const applied = cacheManager.applyOptimization(index);
          
          return NextResponse.json({
            success: true,
            data: {
              action: 'apply_optimization',
              type: 'cache',
              index,
              applied,
              timestamp: new Date().toISOString()
            }
          });
        }

        return NextResponse.json(
          {
            success: false,
            error: '不支援的優化類型或缺少參數'
          },
          { status: 400 }
        );
      }

      case 'start_monitoring': {
        queryOptimizer.startMonitoring();

        return NextResponse.json({
          success: true,
          data: {
            action: 'start_monitoring',
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'stop_monitoring': {
        queryOptimizer.stopMonitoring();

        return NextResponse.json({
          success: true,
          data: {
            action: 'stop_monitoring',
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'analyze_optimizations': {
        const cacheOptimizations = cacheManager.analyzeQueryOptimizations();
        
        return NextResponse.json({
          success: true,
          data: {
            action: 'analyze_optimizations',
            optimizations: cacheOptimizations,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'cleanup': {
        const { retentionDays = 7 } = params;
        queryOptimizer.cleanup(retentionDays);

        return NextResponse.json({
          success: true,
          data: {
            action: 'cleanup',
            retentionDays,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'reset_stats': {
        cacheManager.resetStats();

        return NextResponse.json({
          success: true,
          data: {
            action: 'reset_stats',
            timestamp: new Date().toISOString()
          }
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `不支援的操作: ${action}`,
            availableActions: [
              'record_metric',
              'cache_warmup',
              'cache_clear',
              'cache_invalidate',
              'intelligent_prefetch',
              'resolve_alert',
              'apply_optimization',
              'start_monitoring',
              'stop_monitoring',
              'analyze_optimizations',
              'cleanup',
              'reset_stats'
            ]
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('系統操作失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '系統操作失敗',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}