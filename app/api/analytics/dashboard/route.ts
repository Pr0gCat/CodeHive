/**
 * Analytics Dashboard API
 * 
 * Provides comprehensive project analytics and performance monitoring data
 * for the CodeHive dashboard interface.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/agents/analytics-service';
import { performanceMonitor } from '@/lib/agents/performance-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const timeRange = searchParams.get('timeRange') || '30d';
    const includePerformance = searchParams.get('includePerformance') === 'true';

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Parse time range
    const range = parseTimeRange(timeRange);

    // Get project metrics
    const projectMetrics = await analyticsService.getProjectMetrics(projectId, range);

    // Get dashboard data
    const dashboardData = await analyticsService.getDashboardData(projectId);

    // Get performance metrics if requested
    let performanceData = null;
    if (includePerformance) {
      performanceData = {
        current: performanceMonitor.getMetrics(),
        summary: performanceMonitor.getPerformanceSummary(),
        alerts: performanceMonitor.getActiveAlerts(),
        history: await performanceMonitor.getPerformanceHistory(range, 'hour')
      };
    }

    const response = {
      success: true,
      data: {
        project: {
          id: projectId,
          metrics: projectMetrics,
          dashboard: dashboardData
        },
        performance: performanceData,
        timestamp: new Date().toISOString()
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Dashboard API error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to load dashboard data',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}

/**
 * Update dashboard configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config } = body;

    switch (action) {
      case 'start_monitoring':
        performanceMonitor.startMonitoring(config.intervalMs || 30000);
        return NextResponse.json({
          success: true,
          message: 'Performance monitoring started'
        });

      case 'stop_monitoring':
        performanceMonitor.stopMonitoring();
        return NextResponse.json({
          success: true,
          message: 'Performance monitoring stopped'
        });

      case 'resolve_alert':
        const resolved = performanceMonitor.resolveAlert(config.alertId);
        return NextResponse.json({
          success: resolved,
          message: resolved ? 'Alert resolved' : 'Alert not found'
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Dashboard configuration error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to update dashboard configuration',
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
    case '1h':
      start = new Date(end.getTime() - 60 * 60 * 1000);
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
    case '90d':
      start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days
  }

  return { start, end };
}