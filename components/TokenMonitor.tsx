'use client';

import { formatShortNumber } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/ToastManager';

interface MonitorData {
  global: {
    totalTokensUsed: number;
    dailyLimit: number;
    usagePercentage: number;
    status: 'safe' | 'warning' | 'critical';
    warningThreshold: number;
    criticalThreshold: number;
    remainingTokens: number;
    requestsToday: number;
  };
  projects: Array<{
    id: string;
    name: string;
    usedTokens: number;
    budgetTokens: number;
    allocatedPercentage: number;
    usagePercentage: number;
    status: 'safe' | 'warning' | 'critical';
    isOverBudget: boolean;
  }>;
  summary: {
    totalProjects: number;
    projectsOverBudget: number;
    projectsNearLimit: number;
    averageUsage: number;
  };
}

export default function TokenMonitor() {
  const { showToast } = useToast();
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchMonitorData();
    // Refresh data every 30 seconds
    const interval = setInterval(fetchMonitorData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMonitorData = async () => {
    try {
      const response = await fetch('/api/tokens/monitor');
      const data = await response.json();

      if (data.success) {
        setMonitorData(data.data);
        setError(null);
        setLastUpdated(new Date());
      } else {
        const errorMsg = data.error || '無法取得監控資料';
        setError(errorMsg);
        showToast(errorMsg, 'error');
      }
    } catch (err) {
      const errorMsg = '無法取得監控資料';
      setError(errorMsg);
      showToast(errorMsg, 'error');
      console.error('Monitor fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'text-red-400 bg-red-900/20 border-red-700';
      case 'warning':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-700';
      default:
        return 'text-green-400 bg-green-900/20 border-green-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  };

  if (loading) {
    return (
      <div className="bg-primary-900 rounded-lg p-6 border border-primary-700">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600 mx-auto mb-4"></div>
          <p className="text-primary-400">讀取監控資料中...</p>
        </div>
      </div>
    );
  }

  if (error || !monitorData) {
    return (
      <div className="bg-primary-900 rounded-lg p-6 border border-primary-700">
        <div className="text-center text-red-400">
          <svg
            className="w-8 h-8 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchMonitorData}
            className="mt-2 px-4 py-2 bg-primary-800 text-primary-200 rounded hover:bg-primary-700 text-xs"
          >
            重新嘗試
          </button>
        </div>
      </div>
    );
  }

  const { global, projects, summary } = monitorData;

  return (
    <div className="space-y-6">
      {/* Global Status Card */}
      <div className="bg-primary-900 rounded-lg p-6 border border-primary-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-accent-50 flex items-center">
            <svg
              className="w-6 h-6 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            全域 Token 使用監控
          </h2>
          <div className="text-xs text-primary-400">
            最後更新：{lastUpdated.toLocaleTimeString()}
          </div>
        </div>

        {/* 全域使用狀態 */}
        <div
          className={`p-4 rounded-lg border mb-6 ${getStatusColor(global.status)}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <span className="text-2xl mr-3">
                {getStatusIcon(global.status)}
              </span>
              <div>
                <div className="font-semibold">
                  {global.status === 'critical'
                    ? '危險'
                    : global.status === 'warning'
                      ? '警告'
                      : '正常'}
                </div>
                <div className="text-sm opacity-80">
                  {global.usagePercentage.toFixed(1)}% 已使用
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                {formatShortNumber(global.totalTokensUsed)}
              </div>
              <div className="text-sm opacity-80">
                / {formatShortNumber(global.dailyLimit)}
              </div>
            </div>
          </div>

          {/* 進度條 */}
          <div className="w-full bg-primary-700 rounded-full h-3 mb-2">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${getProgressBarColor(global.status)}`}
              style={{ width: `${Math.min(100, global.usagePercentage)}%` }}
            />

            {/* Threshold markers */}
            <div className="relative -mt-3">
              <div
                className="absolute w-0.5 h-3 bg-yellow-400 opacity-60"
                style={{ left: `${global.warningThreshold}%` }}
                title={`警告閾值: ${global.warningThreshold}%`}
              />
              <div
                className="absolute w-0.5 h-3 bg-red-400 opacity-60"
                style={{ left: `${global.criticalThreshold}%` }}
                title={`危險閾值: ${global.criticalThreshold}%`}
              />
            </div>
          </div>

          <div className="flex justify-between text-sm">
            <span>剩餘：{formatShortNumber(global.remainingTokens)}</span>
            <span>{global.requestsToday} 次請求</span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-primary-800 rounded-lg p-4 border border-primary-600">
            <div className="text-2xl font-bold text-accent-50">
              {summary.totalProjects}
            </div>
            <div className="text-sm text-primary-300">專案總數</div>
          </div>
          <div className="bg-primary-800 rounded-lg p-4 border border-primary-600">
            <div className="text-2xl font-bold text-red-400">
              {summary.projectsOverBudget}
            </div>
            <div className="text-sm text-primary-300">超出預算專案</div>
          </div>
          <div className="bg-primary-800 rounded-lg p-4 border border-primary-600">
            <div className="text-2xl font-bold text-yellow-400">
              {summary.projectsNearLimit}
            </div>
            <div className="text-sm text-primary-300">接近上限</div>
          </div>
          <div className="bg-primary-800 rounded-lg p-4 border border-primary-600">
            <div className="text-2xl font-bold text-accent-50">
              {summary.averageUsage.toFixed(1)}%
            </div>
            <div className="text-sm text-primary-300">平均使用率</div>
          </div>
        </div>

        {/* Resource Usage Trends */}
        <div className="bg-primary-800 rounded-lg p-4 border border-primary-600">
          <h3 className="text-lg font-semibold text-accent-50 mb-4">
            資源使用趨勢
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-300">每日燃燒率</span>
              <span className="text-sm font-medium text-accent-50">
                {formatShortNumber(global.totalTokensUsed)} tokens/天
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-primary-300">預估剩餘天數</span>
              <span className="text-sm font-medium text-accent-50">
                {global.totalTokensUsed > 0
                  ? Math.floor(
                      global.remainingTokens / (global.totalTokensUsed || 1)
                    )
                  : '∞'}{' '}
                天
              </span>
            </div>
            <div className="bg-primary-700 rounded-lg p-3 mt-4">
              <div className="text-xs text-primary-400 mb-2">Token 分配</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-primary-300">已使用</span>
                  <span className="text-red-400">
                    {formatShortNumber(global.totalTokensUsed)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-primary-300">剩餘</span>
                  <span className="text-green-400">
                    {formatShortNumber(global.remainingTokens)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
