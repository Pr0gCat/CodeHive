'use client';

import { useState, useEffect } from 'react';
import { Zap, TrendingUp, AlertTriangle, Clock } from 'lucide-react';

interface TokenUsage {
  today: number;
  thisWeek: number;
  thisMonth: number;
}

interface TokenLimits {
  dailyLimit: number;
  weeklyGuideline: number;
  monthlyBudget: number;
}

interface ResourcesTabProps {
  projectId: string;
}

export function ResourcesTab({ projectId }: ResourcesTabProps) {
  const [usage, setUsage] = useState<TokenUsage>({ today: 0, thisWeek: 0, thisMonth: 0 });
  const [limits, setLimits] = useState<TokenLimits>({ dailyLimit: 100000, weeklyGuideline: 500000, monthlyBudget: 2000000 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTokenStatus();
  }, [projectId]);

  const fetchTokenStatus = async () => {
    try {
      // This would fetch from the token management API
      const response = await fetch(`/api/progress/overview?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.resources) {
          setUsage({
            today: data.resources.tokensUsed || 0,
            thisWeek: data.resources.tokensUsed * 7 || 0,
            thisMonth: data.resources.tokensUsed * 30 || 0,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching token status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 95) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 95) return 'text-red-400';
    if (percentage >= 80) return 'text-yellow-400';
    return 'text-green-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500"></div>
      </div>
    );
  }

  const dailyPercentage = getUsagePercentage(usage.today, limits.dailyLimit);
  const weeklyPercentage = getUsagePercentage(usage.thisWeek, limits.weeklyGuideline);
  const monthlyPercentage = getUsagePercentage(usage.thisMonth, limits.monthlyBudget);

  return (
    <div className="space-y-6">
      {/* Token Budget Overview */}
      <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
        <h3 className="text-lg font-semibold text-accent-50 mb-4">Token 預算</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Daily Usage */}
          <div className="bg-primary-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-accent-50">每日使用量</h4>
              <span className={`text-sm font-medium ${getStatusColor(dailyPercentage)}`}>
                {dailyPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-sm text-primary-300 mb-1">
                <span>{usage.today.toLocaleString()}</span>
                <span>{limits.dailyLimit.toLocaleString()}</span>
              </div>
              <div className="w-full bg-primary-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(dailyPercentage)}`}
                  style={{ width: `${Math.min(dailyPercentage, 100)}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-primary-400">
              每日午夜 UTC 重置
            </p>
          </div>

          {/* Weekly Usage */}
          <div className="bg-primary-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-accent-50">每週使用量</h4>
              <span className={`text-sm font-medium ${getStatusColor(weeklyPercentage)}`}>
                {weeklyPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-sm text-primary-300 mb-1">
                <span>{usage.thisWeek.toLocaleString()}</span>
                <span>{limits.weeklyGuideline.toLocaleString()}</span>
              </div>
              <div className="w-full bg-primary-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(weeklyPercentage)}`}
                  style={{ width: `${Math.min(weeklyPercentage, 100)}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-primary-400">
              可持續使用指引
            </p>
          </div>

          {/* Monthly Usage */}
          <div className="bg-primary-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-accent-50">每月預算</h4>
              <span className={`text-sm font-medium ${getStatusColor(monthlyPercentage)}`}>
                {monthlyPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-sm text-primary-300 mb-1">
                <span>{usage.thisMonth.toLocaleString()}</span>
                <span>{limits.monthlyBudget.toLocaleString()}</span>
              </div>
              <div className="w-full bg-primary-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(monthlyPercentage)}`}
                  style={{ width: `${Math.min(monthlyPercentage, 100)}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-primary-400">
              每月總分配
            </p>
          </div>
        </div>
      </div>

      {/* Usage Alerts */}
      {(dailyPercentage >= 80 || weeklyPercentage >= 80 || monthlyPercentage >= 80) && (
        <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <h4 className="font-medium text-yellow-100">使用量警告</h4>
          </div>
          <div className="text-sm text-yellow-200">
            {dailyPercentage >= 95 && <p>• 每日限制即將達到 - 工作即將暫停</p>}
            {dailyPercentage >= 80 && dailyPercentage < 95 && <p>• 每日使用量較高 - 考慮優先處理簡單任務</p>}
            {weeklyPercentage >= 80 && <p>• 每週使用量較高 - 監控開發速度</p>}
            {monthlyPercentage >= 80 && <p>• 每月預算使用量較高 - 謹慎規劃剩餘工作</p>}
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
        <h3 className="text-lg font-semibold text-accent-50 mb-4">效能指標</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-900 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              <span className="font-medium text-blue-200">燃燒率</span>
            </div>
            <div className="text-2xl font-bold text-blue-300">1,234</div>
            <div className="text-sm text-blue-400">tokens/小時</div>
          </div>
          
          <div className="bg-green-900 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-green-400" />
              <span className="font-medium text-green-200">每日循環</span>
            </div>
            <div className="text-2xl font-bold text-green-300">12</div>
            <div className="text-sm text-green-400">平均完成</div>
          </div>
          
          <div className="bg-purple-900 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-purple-400" />
              <span className="font-medium text-purple-200">平均循環</span>
            </div>
            <div className="text-2xl font-bold text-purple-300">45</div>
            <div className="text-sm text-purple-400">分鐘</div>
          </div>
          
          <div className="bg-orange-900 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-orange-400" />
              <span className="font-medium text-orange-200">效率</span>
            </div>
            <div className="text-2xl font-bold text-orange-300">87%</div>
            <div className="text-sm text-orange-400">成功率</div>
          </div>
        </div>
      </div>

      {/* Budget Management */}
      <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
        <h3 className="text-lg font-semibold text-accent-50 mb-4">預算管理</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-primary-800 rounded-lg">
            <div>
              <h4 className="font-medium text-accent-50">工作排程</h4>
              <p className="text-sm text-primary-300">AI 代理根據 token 可用性優先安排工作</p>
            </div>
            <span className="px-3 py-1 bg-green-800 text-green-200 rounded-full text-sm font-medium">
              啟用
            </span>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-primary-800 rounded-lg">
            <div>
              <h4 className="font-medium text-accent-50">自動暫停</h4>
              <p className="text-sm text-primary-300">達到每日限制時工作自動暫停</p>
            </div>
            <span className="px-3 py-1 bg-blue-800 text-blue-200 rounded-full text-sm font-medium">
              啟用
            </span>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-primary-800 rounded-lg">
            <div>
              <h4 className="font-medium text-accent-50">預算警告</h4>
              <p className="text-sm text-primary-300">80% 和 95% 使用量閾值通知</p>
            </div>
            <span className="px-3 py-1 bg-blue-800 text-blue-200 rounded-full text-sm font-medium">
              啟用
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}