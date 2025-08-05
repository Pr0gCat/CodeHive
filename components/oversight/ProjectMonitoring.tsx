'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  Pause,
  Play,
  Archive,
  Zap,
  Calendar,
  GitBranch,
  Users,
  TrendingUp,
  Settings,
} from 'lucide-react';
import { Project } from '@/lib/db';

interface EnhancedProject extends Project {
  tokenUsage: {
    used: number;
    remaining: number;
    percentage: number;
  };
  progress: {
    epicsCompleted: number;
    totalEpics: number;
    percentage: number;
  };
  activity: {
    lastActivity: string;
    recentCommits: number;
    activeCycles: number;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
  }>;
}

type FilterType = 'all' | 'active' | 'paused' | 'warning' | 'completed';
type SortType = 'name' | 'activity' | 'progress' | 'tokens' | 'updated';

export function ProjectMonitoring() {
  const [projects, setProjects] = useState<EnhancedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('updated');
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    fetchProjects();

    // Refresh every 30 seconds
    const interval = setInterval(fetchProjects, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/oversight/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.data);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedProjects = projects
    .filter(project => {
      // Search filter
      if (
        searchTerm &&
        !project.name.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Status filter
      switch (filter) {
        case 'active':
          return project.status === 'ACTIVE';
        case 'paused':
          return project.status === 'PAUSED';
        case 'warning':
          return project.alerts.some(
            alert => alert.type === 'warning' || alert.type === 'error'
          );
        case 'completed':
          return project.status === 'COMPLETED';
        default:
          return true;
      }
    })
    .sort((a, b) => {
      const multiplier = sortDesc ? -1 : 1;

      switch (sortBy) {
        case 'name':
          return multiplier * a.name.localeCompare(b.name);
        case 'activity':
          return (
            multiplier *
            (new Date(a.activity.lastActivity).getTime() -
              new Date(b.activity.lastActivity).getTime())
          );
        case 'progress':
          return multiplier * (a.progress.percentage - b.progress.percentage);
        case 'tokens':
          return (
            multiplier * (a.tokenUsage.percentage - b.tokenUsage.percentage)
          );
        case 'updated':
        default:
          return (
            multiplier *
            (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
          );
      }
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-900 text-green-300 border border-green-700';
      case 'PAUSED':
        return 'bg-yellow-900 text-yellow-300 border border-yellow-700';
      case 'COMPLETED':
        return 'bg-blue-900 text-blue-300 border border-blue-700';
      case 'ARCHIVED':
        return 'bg-gray-900 text-gray-300 border border-gray-700';
      default:
        return 'bg-primary-900 text-primary-400 border border-primary-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Play className="h-4 w-4" />;
      case 'PAUSED':
        return <Pause className="h-4 w-4" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4" />;
      case 'ARCHIVED':
        return <Archive className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getTokenUsageColor = (percentage: number) => {
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

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary-400" />
            <input
              type="text"
              placeholder="搜尋專案..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2">
            {[
              { key: 'all', label: '全部' },
              { key: 'active', label: '活躍' },
              { key: 'paused', label: '暫停' },
              { key: 'warning', label: '警告' },
              { key: 'completed', label: '完成' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key as FilterType)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === key
                    ? 'bg-accent-600 text-accent-50'
                    : 'bg-primary-800 text-primary-300 hover:bg-primary-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortType)}
              className="px-4 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              <option value="updated">更新時間</option>
              <option value="name">名稱</option>
              <option value="activity">活動</option>
              <option value="progress">進度</option>
              <option value="tokens">Token 使用</option>
            </select>
            <button
              onClick={() => setSortDesc(!sortDesc)}
              className="px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-primary-300 hover:text-accent-50 transition-colors"
            >
              {sortDesc ? '↓' : '↑'}
            </button>
          </div>
        </div>
      </div>

      {/* Project Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredAndSortedProjects.map(project => (
          <div
            key={project.id}
            className="bg-primary-900 rounded-lg border border-primary-700 hover:border-primary-600 transition-all"
          >
            {/* Project Header */}
            <div className="p-6 pb-0">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <Link href={`/projects/${project.id}`} className="group">
                    <h3 className="text-lg font-semibold text-accent-50 group-hover:text-accent-400 transition-colors">
                      {project.name}
                    </h3>
                  </Link>
                  {project.summary && (
                    <p className="text-sm text-primary-200 mt-1 line-clamp-2">
                      {project.summary}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}
                  >
                    {getStatusIcon(project.status)}
                    {project.status}
                  </span>
                  {project.alerts.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-900 text-red-300 border border-red-700">
                      <AlertTriangle className="h-3 w-3" />
                      {project.alerts.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Indicators */}
              <div className="space-y-3">
                {/* Epic Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-primary-300">Epic 進度</span>
                    <span className="text-accent-50">
                      {project.progress.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-primary-700 rounded-full h-2">
                    <div
                      className="bg-accent-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${project.progress.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-primary-400 mt-1">
                    {project.progress.epicsCompleted} /{' '}
                    {project.progress.totalEpics} epics
                  </p>
                </div>

                {/* Token Usage */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-primary-300">Token 使用</span>
                    <span
                      className={getTokenUsageColor(
                        project.tokenUsage.percentage
                      )}
                    >
                      {project.tokenUsage.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-primary-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        project.tokenUsage.percentage >= 90
                          ? 'bg-red-500'
                          : project.tokenUsage.percentage >= 75
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min(project.tokenUsage.percentage, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-primary-400 mt-1">
                    {project.tokenUsage.used.toLocaleString()} /{' '}
                    {(
                      project.tokenUsage.used + project.tokenUsage.remaining
                    ).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Activity Metrics */}
            <div className="p-6 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary-400" />
                  <div>
                    <div className="text-primary-300">最後活動</div>
                    <div className="text-accent-50 font-medium">
                      {new Date(
                        project.activity.lastActivity
                      ).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary-400" />
                  <div>
                    <div className="text-primary-300">活躍循環</div>
                    <div className="text-accent-50 font-medium">
                      {project.activity.activeCycles}
                    </div>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {project.alerts.length > 0 && (
                <div className="mt-4 space-y-2">
                  {project.alerts.slice(0, 2).map((alert, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-2 p-2 rounded text-xs ${
                        alert.type === 'error'
                          ? 'bg-red-900 text-red-200'
                          : alert.type === 'warning'
                            ? 'bg-yellow-900 text-yellow-200'
                            : 'bg-blue-900 text-blue-200'
                      }`}
                    >
                      <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Actions */}
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/projects/${project.id}`}
                  className="flex-1 px-3 py-2 bg-accent-600 text-accent-50 text-center text-sm font-medium rounded hover:bg-accent-700 transition-colors"
                >
                  查看詳情
                </Link>
                <button className="px-3 py-2 bg-primary-700 text-primary-300 text-sm rounded hover:bg-primary-600 hover:text-accent-50 transition-colors">
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredAndSortedProjects.length === 0 && (
        <div className="text-center py-12">
          <div className="text-primary-500 mb-4">
            <Search className="w-16 h-16 mx-auto opacity-50" />
          </div>
          <h3 className="text-lg font-medium text-accent-50 mb-2">
            找不到符合條件的專案
          </h3>
          <p className="text-primary-300 mb-6">嘗試調整搜尋或篩選條件</p>
        </div>
      )}
    </div>
  );
}
