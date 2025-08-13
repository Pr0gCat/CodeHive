'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { useSocket } from '@/lib/hooks/useSocket';
import { 
  Activity, 
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Settings,
  Trash2,
  Play,
  Pause,
  AlertCircle
} from 'lucide-react';

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  score: number;
  components: {
    database: ComponentHealth;
    api: ComponentHealth;
    websocket: ComponentHealth;
    memory: ComponentHealth;
    agents: ComponentHealth;
  };
  timestamp: Date;
}

interface ComponentHealth {
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

interface PerformanceStats {
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
}

interface CacheStats {
  totalItems: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  avgAccessCount: number;
}

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

interface OptimizationSuggestion {
  query: string;
  currentPerformance: number;
  suggestions: string[];
  estimatedImprovement: number;
}

const statusColors = {
  healthy: 'text-green-600 bg-green-100',
  warning: 'text-yellow-600 bg-yellow-100',
  critical: 'text-red-600 bg-red-100'
};

const statusLabels = {
  healthy: '健康',
  warning: '警告',
  critical: '危險'
};

const trendIcons = {
  up: <TrendingUp className="h-4 w-4 text-red-500" />,
  down: <TrendingDown className="h-4 w-4 text-green-500" />,
  stable: <Minus className="h-4 w-4 text-gray-500" />
};

export default function PerformanceDashboard() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [optimizations, setOptimizations] = useState<OptimizationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(true);

  // WebSocket 連接
  const { isConnected } = useSocket({
    onSystemNotification: (data) => {
      if (data.channel === 'monitoring' || data.channel === 'alerts') {
        fetchDashboardData();
      }
    }
  });

  useEffect(() => {
    fetchDashboardData();
    
    // 設置定期更新
    const interval = setInterval(fetchDashboardData, 30000); // 每30秒更新
    
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 並行獲取所有數據
      const [
        overviewResponse,
        healthResponse,
        cacheResponse,
        alertsResponse,
        optimizationResponse
      ] = await Promise.all([
        fetch('/api/system/metrics?action=system_overview'),
        fetch('/api/system/metrics?action=health'),
        fetch('/api/system/metrics?action=cache_stats'),
        fetch('/api/system/metrics?action=alerts'),
        fetch('/api/system/metrics?action=optimization_suggestions')
      ]);

      const [
        overviewResult,
        healthResult,
        cacheResult,
        alertsResult,
        optimizationResult
      ] = await Promise.all([
        overviewResponse.json(),
        healthResponse.json(),
        cacheResponse.json(),
        alertsResponse.json(),
        optimizationResponse.json()
      ]);

      if (overviewResult.success) {
        setPerformanceStats(overviewResult.data.overview.performance);
        setSystemHealth(overviewResult.data.overview.health);
      }
      
      if (healthResult.success && healthResult.data.health) {
        setSystemHealth(healthResult.data.health);
      }
      
      if (cacheResult.success) {
        setCacheStats(cacheResult.data.stats);
      }
      
      if (alertsResult.success) {
        setAlerts(alertsResult.data.activeAlerts);
      }
      
      if (optimizationResult.success) {
        setOptimizations(optimizationResult.data.querySuggestions || []);
      }

    } catch (err) {
      setError('載入效能數據失敗');
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    try {
      const response = await fetch('/api/system/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cache_clear' })
      });

      const result = await response.json();
      if (result.success) {
        await fetchDashboardData();
      } else {
        setError('清除快取失敗');
      }
    } catch (err) {
      setError('清除快取請求失敗');
    }
  };

  const handleWarmupCache = async () => {
    try {
      const response = await fetch('/api/system/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cache_warmup' })
      });

      const result = await response.json();
      if (result.success) {
        await fetchDashboardData();
      } else {
        setError('快取預熱失敗');
      }
    } catch (err) {
      setError('快取預熱請求失敗');
    }
  };

  const handleToggleMonitoring = async () => {
    try {
      const action = isMonitoring ? 'stop_monitoring' : 'start_monitoring';
      const response = await fetch('/api/system/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const result = await response.json();
      if (result.success) {
        setIsMonitoring(!isMonitoring);
      } else {
        setError('切換監控狀態失敗');
      }
    } catch (err) {
      setError('監控狀態切換請求失敗');
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/system/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_alert', alertId })
      });

      const result = await response.json();
      if (result.success) {
        setAlerts(alerts.filter(a => a.id !== alertId));
      } else {
        setError('解決警報失敗');
      }
    } catch (err) {
      setError('解決警報請求失敗');
    }
  };

  if (loading && !systemHealth) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-900">效能監控中心</h2>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
                 title={isConnected ? '即時連線中' : '離線'}></div>
          </div>
          <p className="text-gray-600 mt-1">
            即時監控系統效能、快取狀態和查詢優化
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={handleToggleMonitoring}
            variant={isMonitoring ? "default" : "outline"}
            className="flex items-center gap-2"
          >
            {isMonitoring ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isMonitoring ? '停止監控' : '開始監控'}
          </Button>
          <Button
            variant="outline"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            重新整理
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
            <Button onClick={() => setError(null)} variant="outline" size="sm" className="mt-2">
              關閉
            </Button>
          </CardContent>
        </Card>
      )}

      {/* System Health Overview */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle>系統健康狀況</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${statusColors[systemHealth.overall]}`}>
                  {systemHealth.overall === 'healthy' ? <CheckCircle className="h-6 w-6" /> :
                   systemHealth.overall === 'warning' ? <AlertTriangle className="h-6 w-6" /> :
                   <AlertCircle className="h-6 w-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    整體狀態: {statusLabels[systemHealth.overall]}
                  </h3>
                  <p className="text-gray-600">健康評分: {systemHealth.score}/100</p>
                </div>
              </div>
              
              <Progress value={systemHealth.score} className="w-32" />
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              {Object.entries(systemHealth.components).map(([name, component]) => (
                <div key={name} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium capitalize">{name}</span>
                    <Badge className={statusColors[component.status]}>
                      {statusLabels[component.status]}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    {component.metrics.responseTime && (
                      <div>響應時間: {component.metrics.responseTime.toFixed(0)}ms</div>
                    )}
                    {component.metrics.utilization && (
                      <div>使用率: {component.metrics.utilization.toFixed(1)}%</div>
                    )}
                    {component.issues.length > 0 && (
                      <div className="text-red-600">問題: {component.issues.length}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Statistics */}
      {performanceStats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">總指標數</p>
                  <p className="text-2xl font-bold">{performanceStats.totalMetrics}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">活動警報</p>
                  <p className="text-2xl font-bold text-orange-600">{performanceStats.activeAlerts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">系統運行時間</p>
                  <p className="text-2xl font-bold">{Math.floor(process.uptime ? process.uptime() / 3600 : 0)}小時</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">健康評分</p>
                  <p className="text-2xl font-bold">{systemHealth?.score || 0}/100</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cache Statistics */}
      {cacheStats && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>快取統計</CardTitle>
              <div className="flex gap-2">
                <Button onClick={handleWarmupCache} size="sm" variant="outline">
                  <Zap className="h-3 w-3 mr-1" />
                  預熱
                </Button>
                <Button onClick={handleClearCache} size="sm" variant="outline">
                  <Trash2 className="h-3 w-3 mr-1" />
                  清除
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-4">
              <div className="border rounded-lg p-3">
                <div className="text-sm text-gray-600">快取項目</div>
                <div className="text-xl font-bold">{cacheStats.totalItems}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-sm text-gray-600">快取大小</div>
                <div className="text-xl font-bold">{(cacheStats.totalSize / 1024 / 1024).toFixed(1)}MB</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-sm text-gray-600">命中率</div>
                <div className="text-xl font-bold text-green-600">{(cacheStats.hitRate * 100).toFixed(1)}%</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>命中率</span>
                <span>{(cacheStats.hitRate * 100).toFixed(1)}%</span>
              </div>
              <Progress value={cacheStats.hitRate * 100} className="h-2" />
              
              <div className="flex justify-between text-xs text-gray-600">
                <span>失誤率: {(cacheStats.missRate * 100).toFixed(1)}%</span>
                <span>清理次數: {cacheStats.evictionCount}</span>
                <span>平均存取: {cacheStats.avgAccessCount.toFixed(1)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Metrics */}
      {performanceStats?.topMetrics && performanceStats.topMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>重點指標</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {performanceStats.topMetrics.slice(0, 8).map((metric, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">
                      {metric.category}.{metric.name}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {metric.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {trendIcons[metric.trend]}
                    <span className="text-sm">
                      {metric.avgValue.toFixed(2)} {metric.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>活動警報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-1 rounded ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-600' :
                      alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{alert.message}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleString('zh-TW')}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleResolveAlert(alert.id)}
                    size="sm"
                    variant="outline"
                  >
                    解決
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Optimization Suggestions */}
      {optimizations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>優化建議</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {optimizations.slice(0, 5).map((optimization, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-medium">查詢優化機會</div>
                    <Badge className="bg-green-100 text-green-800">
                      預估改善: {Math.round(optimization.estimatedImprovement * 100)}%
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    當前性能: {optimization.currentPerformance.toFixed(0)}ms
                  </div>
                  <div className="text-sm space-y-1">
                    {optimization.suggestions.map((suggestion, suggestionIndex) => (
                      <div key={suggestionIndex} className="text-gray-700">
                        • {suggestion}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}