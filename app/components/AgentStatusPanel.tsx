'use client';

import { formatShortNumber } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/ToastManager';

interface AgentStatusPanelProps {
  projectId: string;
}

interface QueueStatus {
  status: string;
  pendingTasks: number;
  activeTasks: number;
  rateLimitStatus: {
    dailyTokens: {
      used: number;
      limit: number;
      percentage: number;
      remaining: number;
    };
    minuteRequests: {
      used: number;
      limit: number;
      percentage: number;
      remaining: number;
    };
  };
}

export default function AgentStatusPanel({ projectId }: AgentStatusPanelProps) {
  const { showToast } = useToast();
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchQueueStatus = async () => {
    try {
      const response = await fetch('/api/agents/queue');
      const data = await response.json();

      if (data.success) {
        setQueueStatus(data.data);
        setError(null);
      } else {
        setError('無法載入佇列狀態');
      }
    } catch (err) {
      setError('無法載入佇列狀態');
    } finally {
      setLoading(false);
    }
  };

  const handleQueueToggle = async () => {
    try {
      const response = await fetch('/api/agents/queue', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'toggle' }),
      });

      const data = await response.json();

      if (data.success) {
        setQueueStatus(data.data);
      } else {
        showToast(`切換佇列失敗：${data.error}`, 'error');
      }
    } catch (err) {
      showToast('切換佇列失敗', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-lime-900 text-lime-300 border border-lime-700';
      case 'paused':
        return 'bg-yellow-900 text-yellow-300 border border-yellow-700';
      default:
        return 'bg-primary-900 text-primary-400 border border-primary-800';
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-accent-500';
  };

  if (loading) {
    return (
      <div className="bg-primary-800 rounded-lg shadow-sm border border-primary-700 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-primary-800 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-primary-800 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-primary-800 rounded-lg shadow-sm border border-red-700 p-4">
        <div className="text-red-300 text-sm">{error}</div>
      </div>
    );
  }

  if (!queueStatus) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="bg-primary-800 rounded-lg shadow-sm border border-primary-700 p-4 space-y-4 w-full">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-accent-50">Agent 狀態</h3>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(queueStatus.status)}`}
          >
            {queueStatus.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-primary-700 rounded-lg">
            <div className="text-2xl font-bold text-accent-50">
              {queueStatus.pendingTasks}
            </div>
            <div className="text-xs text-primary-400">等待中任務</div>
          </div>
          <div className="text-center p-3 bg-primary-700 rounded-lg">
            <div className="text-2xl font-bold text-accent-50">
              {queueStatus.activeTasks}
            </div>
            <div className="text-xs text-primary-400">執行中任務</div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-primary-300">每日 Tokens</span>
              <span className="text-accent-50">
                {formatShortNumber(
                  queueStatus.rateLimitStatus.dailyTokens.used
                )}{' '}
                /{' '}
                {formatShortNumber(
                  queueStatus.rateLimitStatus.dailyTokens.limit
                )}
              </span>
            </div>
            <div className="w-full bg-primary-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getUsageColor(queueStatus.rateLimitStatus.dailyTokens.percentage)}`}
                style={{
                  width: `${Math.min(queueStatus.rateLimitStatus.dailyTokens.percentage, 100)}%`,
                }}
              />
            </div>
            <div className="text-xs text-primary-400 mt-1">
              {queueStatus.rateLimitStatus.dailyTokens.percentage}% 已使用
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-primary-300">請求/分鐘</span>
              <span className="text-accent-50">
                {queueStatus.rateLimitStatus.minuteRequests.used} / 分鐘
              </span>
            </div>
            <div className="w-full bg-primary-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getUsageColor(queueStatus.rateLimitStatus.minuteRequests.percentage)}`}
                style={{
                  width: `${Math.min(queueStatus.rateLimitStatus.minuteRequests.percentage, 100)}%`,
                }}
              />
            </div>
            <div className="text-xs text-primary-400 mt-1">
              速率限制：{queueStatus.rateLimitStatus.minuteRequests.limit}/分鐘
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t border-primary-700">
          <button
            onClick={handleQueueToggle}
            className={`w-full px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 ${
              queueStatus.status === 'ACTIVE'
                ? 'bg-yellow-600 text-yellow-50 hover:bg-yellow-700 focus:ring-yellow-500'
                : 'bg-accent-600 text-accent-50 hover:bg-accent-700 focus:ring-accent-500'
            }`}
          >
            {queueStatus.status === 'ACTIVE' ? '暫停佇列' : '恢復佇列'}
          </button>
        </div>
      </div>

      {/* Additional space for full width layout */}
      <div className="flex-1"></div>
    </div>
  );
}
