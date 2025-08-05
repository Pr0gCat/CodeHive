'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  BarChart3,
  PieChart,
  Download,
  Calendar,
  Filter,
  Zap,
  Clock,
  Target,
  Users,
  AlertCircle,
} from 'lucide-react';

interface AnalyticsData {
  tokenUsage: {
    daily: Array<{ date: string; used: number; projects: number }>;
    byProject: Array<{ name: string; used: number; percentage: number }>;
    trends: {
      weeklyChange: number;
      monthlyAverage: number;
      peakUsage: number;
      efficiency: number;
    };
  };
  projectPerformance: {
    completionRates: Array<{ project: string; rate: number; epics: number }>;
    cycleTimes: Array<{ project: string; avgTime: number; cycles: number }>;
    bottlenecks: Array<{ project: string; issue: string; impact: string }>;
  };
  agentPerformance: {
    successRates: Array<{ agent: string; rate: number; tasks: number }>;
    usagePatterns: Array<{ agent: string; hours: number; efficiency: number }>;
  };
  timeMetrics: {
    peakHours: Array<{ hour: number; activity: number }>;
    weeklyPatterns: Array<{ day: string; activity: number }>;
    responseTime: {
      average: number;
      p95: number;
      p99: number;
    };
  };
}

type TimeRange = '7d' | '30d' | '90d' | '1y';
type MetricType = 'tokens' | 'performance' | 'agents' | 'time';

export function AnalyticsReports() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [activeMetric, setActiveMetric] = useState<MetricType>('tokens');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(
        `/api/oversight/analytics?range=${timeRange}`
      );
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'csv' | 'pdf') => {
    try {
      const response = await fetch(
        `/api/oversight/analytics/export?format=${format}&range=${timeRange}`
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-report-${timeRange}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-primary-300';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '↗';
    if (change < 0) return '↘';
    return '→';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-accent-50 mb-2">
              分析報告
            </h2>
            <p className="text-primary-300">深入了解專案效能和資源使用情況</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Time Range */}
            <div className="flex bg-primary-800 rounded-lg">
              {[
                { key: '7d', label: '7天' },
                { key: '30d', label: '30天' },
                { key: '90d', label: '90天' },
                { key: '1y', label: '1年' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTimeRange(key as TimeRange)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    timeRange === key
                      ? 'bg-accent-600 text-accent-50'
                      : 'text-primary-300 hover:text-accent-50'
                  } first:rounded-l-lg last:rounded-r-lg`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Export Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => exportReport('csv')}
                className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-primary-300 rounded-lg hover:bg-primary-600 hover:text-accent-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
              <button
                onClick={() => exportReport('pdf')}
                className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-primary-300 rounded-lg hover:bg-primary-600 hover:text-accent-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* Metric Navigation */}
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { key: 'tokens', label: 'Token 使用', icon: Zap },
            { key: 'performance', label: '專案效能', icon: Target },
            { key: 'agents', label: 'AI 代理', icon: Users },
            { key: 'time', label: '時間分析', icon: Clock },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveMetric(key as MetricType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeMetric === key
                  ? 'bg-accent-600 text-accent-50'
                  : 'bg-primary-800 text-primary-300 hover:bg-primary-700 hover:text-accent-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Token Usage Analytics */}
      {activeMetric === 'tokens' && analyticsData?.tokenUsage && (
        <div className="space-y-6">
          {/* Token Trends Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-primary-300">
                    週變化
                  </h3>
                  <p
                    className={`text-2xl font-bold ${getChangeColor(analyticsData.tokenUsage.trends.weeklyChange)}`}
                  >
                    {getChangeIcon(
                      analyticsData.tokenUsage.trends.weeklyChange
                    )}{' '}
                    {Math.abs(analyticsData.tokenUsage.trends.weeklyChange)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-accent-400" />
              </div>
            </div>

            <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-primary-300">
                    月平均
                  </h3>
                  <p className="text-2xl font-bold text-accent-50">
                    {analyticsData.tokenUsage.trends.monthlyAverage.toLocaleString()}
                  </p>
                  <p className="text-xs text-primary-400">tokens/日</p>
                </div>
                <BarChart3 className="h-8 w-8 text-accent-400" />
              </div>
            </div>

            <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-primary-300">
                    峰值使用
                  </h3>
                  <p className="text-2xl font-bold text-accent-50">
                    {analyticsData.tokenUsage.trends.peakUsage.toLocaleString()}
                  </p>
                  <p className="text-xs text-primary-400">單日最高</p>
                </div>
                <Zap className="h-8 w-8 text-accent-400" />
              </div>
            </div>

            <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-primary-300">效率</h3>
                  <p className="text-2xl font-bold text-accent-50">
                    {analyticsData.tokenUsage.trends.efficiency}%
                  </p>
                  <p className="text-xs text-primary-400">目標達成率</p>
                </div>
                <Target className="h-8 w-8 text-accent-400" />
              </div>
            </div>
          </div>

          {/* Daily Usage Chart */}
          <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
            <h3 className="text-lg font-semibold text-accent-50 mb-4">
              每日 Token 使用量
            </h3>
            <div className="h-64 flex items-end justify-between gap-2">
              {analyticsData.tokenUsage.daily.slice(-30).map((day, index) => (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center"
                >
                  <div className="w-full bg-primary-700 rounded-t relative">
                    <div
                      className="bg-accent-500 rounded-t transition-all duration-300"
                      style={{
                        height: `${(day.used / Math.max(...analyticsData.tokenUsage.daily.map(d => d.used))) * 200}px`,
                        minHeight: '4px',
                      }}
                    />
                  </div>
                  <span className="text-xs text-primary-400 mt-2 transform -rotate-45 origin-top-left">
                    {new Date(day.date).toLocaleDateString('zh-TW', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Token Usage by Project */}
          <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
            <h3 className="text-lg font-semibold text-accent-50 mb-4">
              專案 Token 使用分佈
            </h3>
            <div className="space-y-4">
              {analyticsData.tokenUsage.byProject.slice(0, 10).map(project => (
                <div
                  key={project.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-accent-50">
                        {project.name}
                      </span>
                      <span className="text-sm text-primary-300">
                        {project.used.toLocaleString()} ({project.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-primary-700 rounded-full h-2">
                      <div
                        className="bg-accent-500 h-2 rounded-full"
                        style={{ width: `${project.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Project Performance Analytics */}
      {activeMetric === 'performance' && analyticsData?.projectPerformance && (
        <div className="space-y-6">
          {/* Completion Rates */}
          <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
            <h3 className="text-lg font-semibold text-accent-50 mb-4">
              Epic 完成率
            </h3>
            <div className="space-y-4">
              {analyticsData.projectPerformance.completionRates.map(project => (
                <div
                  key={project.project}
                  className="flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-accent-50">
                        {project.project}
                      </span>
                      <span className="text-sm text-primary-300">
                        {project.rate}% ({project.epics} epics)
                      </span>
                    </div>
                    <div className="w-full bg-primary-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          project.rate >= 80
                            ? 'bg-green-500'
                            : project.rate >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${project.rate}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cycle Times */}
          <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
            <h3 className="text-lg font-semibold text-accent-50 mb-4">
              平均循環時間
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analyticsData.projectPerformance.cycleTimes.map(project => (
                <div
                  key={project.project}
                  className="bg-primary-800 rounded-lg p-4"
                >
                  <h4 className="font-medium text-accent-50 mb-2">
                    {project.project}
                  </h4>
                  <div className="text-2xl font-bold text-accent-400 mb-1">
                    {project.avgTime}h
                  </div>
                  <p className="text-xs text-primary-400">
                    {project.cycles} 個循環
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottlenecks */}
          <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
            <h3 className="text-lg font-semibold text-accent-50 mb-4">
              瓶頸分析
            </h3>
            <div className="space-y-3">
              {analyticsData.projectPerformance.bottlenecks.map(
                (bottleneck, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-4 bg-yellow-900 border border-yellow-700 rounded-lg"
                  >
                    <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-medium text-yellow-100">
                        {bottleneck.project}
                      </h4>
                      <p className="text-sm text-yellow-200 mt-1">
                        {bottleneck.issue}
                      </p>
                      <span className="inline-block px-2 py-1 bg-yellow-800 text-yellow-200 text-xs rounded mt-2">
                        影響: {bottleneck.impact}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Agent Performance Analytics */}
      {activeMetric === 'agents' && analyticsData?.agentPerformance && (
        <div className="space-y-6">
          {/* Success Rates */}
          <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
            <h3 className="text-lg font-semibold text-accent-50 mb-4">
              AI 代理成功率
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {analyticsData.agentPerformance.successRates.map(agent => (
                <div
                  key={agent.agent}
                  className="bg-primary-800 rounded-lg p-6 text-center"
                >
                  <h4 className="font-medium text-accent-50 mb-3">
                    {agent.agent}
                  </h4>
                  <div className="text-3xl font-bold text-accent-400 mb-2">
                    {agent.rate}%
                  </div>
                  <p className="text-sm text-primary-300">
                    {agent.tasks} 個任務
                  </p>
                  <div className="mt-4 w-full bg-primary-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        agent.rate >= 90
                          ? 'bg-green-500'
                          : agent.rate >= 75
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${agent.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Usage Patterns */}
          <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
            <h3 className="text-lg font-semibold text-accent-50 mb-4">
              使用模式
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-primary-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-300">
                      代理
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-300">
                      使用時數
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-300">
                      效率
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-300">
                      狀態
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.agentPerformance.usagePatterns.map(agent => (
                    <tr
                      key={agent.agent}
                      className="border-b border-primary-800"
                    >
                      <td className="py-3 px-4 text-sm text-accent-50">
                        {agent.agent}
                      </td>
                      <td className="py-3 px-4 text-sm text-primary-300">
                        {agent.hours}h
                      </td>
                      <td className="py-3 px-4 text-sm text-primary-300">
                        {agent.efficiency}%
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            agent.efficiency >= 80
                              ? 'bg-green-900 text-green-300'
                              : agent.efficiency >= 60
                                ? 'bg-yellow-900 text-yellow-300'
                                : 'bg-red-900 text-red-300'
                          }`}
                        >
                          {agent.efficiency >= 80
                            ? '優秀'
                            : agent.efficiency >= 60
                              ? '良好'
                              : '需改進'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Time Analytics */}
      {activeMetric === 'time' && analyticsData?.timeMetrics && (
        <div className="space-y-6">
          {/* Response Time Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
              <h3 className="text-sm font-medium text-primary-300">
                平均響應時間
              </h3>
              <p className="text-2xl font-bold text-accent-50">
                {analyticsData.timeMetrics.responseTime.average}ms
              </p>
            </div>
            <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
              <h3 className="text-sm font-medium text-primary-300">
                95th 百分位
              </h3>
              <p className="text-2xl font-bold text-accent-50">
                {analyticsData.timeMetrics.responseTime.p95}ms
              </p>
            </div>
            <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
              <h3 className="text-sm font-medium text-primary-300">
                99th 百分位
              </h3>
              <p className="text-2xl font-bold text-accent-50">
                {analyticsData.timeMetrics.responseTime.p99}ms
              </p>
            </div>
          </div>

          {/* Peak Hours */}
          <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
            <h3 className="text-lg font-semibold text-accent-50 mb-4">
              每日活動模式
            </h3>
            <div className="h-32 flex items-end justify-between gap-1">
              {analyticsData.timeMetrics.peakHours.map(hour => (
                <div
                  key={hour.hour}
                  className="flex-1 flex flex-col items-center"
                >
                  <div
                    className="w-full bg-accent-500 rounded-t transition-all duration-300"
                    style={{
                      height: `${(hour.activity / Math.max(...analyticsData.timeMetrics.peakHours.map(h => h.activity))) * 100}px`,
                      minHeight: '4px',
                    }}
                  />
                  <span className="text-xs text-primary-400 mt-1">
                    {hour.hour}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
