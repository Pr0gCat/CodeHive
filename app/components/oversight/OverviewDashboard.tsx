'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Activity,
  Target,
  Pause,
  Play,
  Archive
} from 'lucide-react';

interface PortfolioStats {
  totalProjects: number;
  activeProjects: number;
  pausedProjects: number;
  completedProjects: number;
  archivedProjects: number;
  totalTokensUsed: number;
  totalTokensRemaining: number;
  dailyBurnRate: number;
  averageProgress: number;
}

interface SystemHealth {
  agentQueueStatus: 'active' | 'paused' | 'error';
  activeTasks: number;
  pendingQueries: number;
  recentActivities: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
    projectName?: string;
  }>;
}

export function OverviewDashboard() {
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolioData();
    fetchSystemHealth();
    
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchPortfolioData();
      fetchSystemHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchPortfolioData = async () => {
    try {
      const response = await fetch('/api/oversight/portfolio');
      if (response.ok) {
        const data = await response.json();
        setPortfolioStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemHealth = async () => {
    try {
      const response = await fetch('/api/agents/queue');
      if (response.ok) {
        const data = await response.json();
        setSystemHealth({
          agentQueueStatus: data.data?.status?.toLowerCase() || 'error',
          activeTasks: data.data?.activeTasks || 0,
          pendingQueries: data.data?.pendingQueries || 0,
          recentActivities: data.data?.recentActivities || []
        });
      }
    } catch (error) {
      console.error('Error fetching system health:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400';
      case 'paused':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getResourceStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-400';
    if (percentage >= 75) return 'text-yellow-400';
    return 'text-green-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500"></div>
      </div>
    );
  }

  const tokenUsagePercentage = portfolioStats 
    ? (() => {
        const total = portfolioStats.totalTokensUsed + portfolioStats.totalTokensRemaining;
        return total > 0 ? (portfolioStats.totalTokensUsed / total) * 100 : 0;
      })()
    : 0;

  return (
    <div className="space-y-6">
      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-primary-300">總專案數</h3>
              <p className="text-2xl font-bold text-accent-50">{portfolioStats?.totalProjects || 0}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-accent-400" />
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-400">
              <Play className="h-3 w-3" />
              {portfolioStats?.activeProjects || 0} 活躍
            </span>
            <span className="flex items-center gap-1 text-yellow-400">
              <Pause className="h-3 w-3" />
              {portfolioStats?.pausedProjects || 0} 暫停
            </span>
          </div>
        </div>

        <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-primary-300">Token 使用率</h3>
              <p className={`text-2xl font-bold ${getResourceStatusColor(tokenUsagePercentage)}`}>
                {tokenUsagePercentage.toFixed(1)}%
              </p>
            </div>
            <Zap className="h-8 w-8 text-accent-400" />
          </div>
          <div className="mt-4">
            <div className="w-full bg-primary-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  tokenUsagePercentage >= 90 ? 'bg-red-500' :
                  tokenUsagePercentage >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(tokenUsagePercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-primary-400 mt-1">
              {portfolioStats && (portfolioStats.totalTokensUsed + portfolioStats.totalTokensRemaining) > 0 
                ? `${portfolioStats.totalTokensUsed.toLocaleString()} / ${(portfolioStats.totalTokensUsed + portfolioStats.totalTokensRemaining).toLocaleString()} tokens`
                : '未設定 Token 限制'
              }
            </p>
          </div>
        </div>

        <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-primary-300">系統狀態</h3>
              <p className={`text-2xl font-bold capitalize ${getStatusColor(systemHealth?.agentQueueStatus || 'error')}`}>
                {systemHealth?.agentQueueStatus || 'Unknown'}
              </p>
            </div>
            <Activity className="h-8 w-8 text-accent-400" />
          </div>
          <div className="mt-4 text-sm text-primary-300">
            <p>{systemHealth?.activeTasks || 0} 活躍任務</p>
            <p>{systemHealth?.pendingQueries || 0} 待處理查詢</p>
          </div>
        </div>

        <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-primary-300">平均進度</h3>
              <p className="text-2xl font-bold text-accent-50">{portfolioStats?.averageProgress?.toFixed(1) || 0}%</p>
            </div>
            <Target className="h-8 w-8 text-accent-400" />
          </div>
          <div className="mt-4">
            <div className="w-full bg-primary-700 rounded-full h-2">
              <div
                className="bg-accent-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${portfolioStats?.averageProgress || 0}%` }}
              />
            </div>
            <p className="text-xs text-primary-400 mt-1">
              跨所有活躍專案
            </p>
          </div>
        </div>
      </div>


      {/* Quick Actions */}
      <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
        <h3 className="text-lg font-semibold text-accent-50 mb-4">快速操作</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center gap-3 p-4 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 transition-colors">
            <Play className="h-5 w-5" />
            <span>全部恢復</span>
          </button>
          <button className="flex items-center gap-3 p-4 bg-yellow-600 text-yellow-50 rounded-lg hover:bg-yellow-700 transition-colors">
            <Pause className="h-5 w-5" />
            <span>全部暫停</span>
          </button>
          <button className="flex items-center gap-3 p-4 bg-primary-700 text-accent-50 rounded-lg hover:bg-primary-600 transition-colors">
            <TrendingUp className="h-5 w-5" />
            <span>生成報告</span>
          </button>
        </div>
      </div>
    </div>
  );
}