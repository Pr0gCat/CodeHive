'use client';

import { useState, useEffect } from 'react';
import { formatShortNumber } from '@/lib/utils';

interface ProjectProgress {
  id: string;
  name: string;
  status: string;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  tasks: {
    backlog: number;
    todo: number;
    inProgress: number;
    review: number;
    done: number;
  };
  activeAgents: number;
  recentActivity: string;
  tokenUsage: {
    used: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export default function ProjectProgressDashboard() {
  const [projects, setProjects] = useState<ProjectProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjectProgress();
    // Refresh every 30 seconds for real-time updates
    const interval = setInterval(fetchProjectProgress, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchProjectProgress = async () => {
    try {
      const response = await fetch('/api/projects/progress');
      const data = await response.json();
      
      if (data.success) {
        setProjects(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch project progress');
      }
    } catch (err) {
      setError('Failed to fetch project progress');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-900 text-green-300 border border-green-700';
      case 'PAUSED': return 'bg-yellow-900 text-yellow-300 border border-yellow-700';
      case 'COMPLETED': return 'bg-blue-900 text-blue-300 border border-blue-700';
      case 'ARCHIVED': return 'bg-primary-900 text-primary-400 border border-primary-800';
      default: return 'bg-primary-900 text-primary-400 border border-primary-800';
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    if (percentage >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="bg-primary-900 border border-primary-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-primary-800 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-primary-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-primary-900 border border-red-700 rounded-lg p-6">
        <div className="text-red-300 text-sm">{error}</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="bg-primary-900 border border-primary-800 rounded-lg p-6 text-center">
        <div className="text-primary-400 mb-2">No active projects</div>
        <div className="text-sm text-primary-500">Create a project to see progress tracking</div>
      </div>
    );
  }

  return (
    <div className="bg-primary-900 border border-primary-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-accent-50">專案進度</h2>
        <div className="text-sm text-primary-400">
          {projects.filter(p => p.status === 'ACTIVE').length} 個活躍專案
        </div>
      </div>

      <div className="space-y-4">
        {projects.map((project) => (
          <div key={project.id} className="bg-primary-800 border border-primary-700 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-medium text-accent-50">{project.name}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                </div>
                <div className="text-sm text-primary-400">{project.recentActivity}</div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-medium text-accent-50">
                  {project.progress.completed}/{project.progress.total} 個任務
                </div>
                <div className="text-xs text-primary-400">
                  {project.activeAgents} 個代理活躍
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-primary-300">Progress</span>
                <span className="text-accent-50">{project.progress.percentage}%</span>
              </div>
              <div className="w-full bg-primary-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(project.progress.percentage)}`}
                  style={{ width: `${project.progress.percentage}%` }}
                />
              </div>
            </div>

            {/* Task Breakdown */}
            <div className="grid grid-cols-5 gap-2 text-xs">
              <div className="text-center">
                <div className="text-primary-400">待辦清單</div>
                <div className="font-medium text-accent-50">{project.tasks.backlog}</div>
              </div>
              <div className="text-center">
                <div className="text-primary-400">Todo</div>
                <div className="font-medium text-blue-300">{project.tasks.todo}</div>
              </div>
              <div className="text-center">
                <div className="text-primary-400">進行中</div>
                <div className="font-medium text-yellow-300">{project.tasks.inProgress}</div>
              </div>
              <div className="text-center">
                <div className="text-primary-400">審查中</div>
                <div className="font-medium text-purple-300">{project.tasks.review}</div>
              </div>
              <div className="text-center">
                <div className="text-primary-400">已完成</div>
                <div className="font-medium text-green-300">{project.tasks.done}</div>
              </div>
            </div>

            {/* Token Usage Indicator */}
            <div className="mt-3 pt-3 border-t border-primary-700">
              <div className="flex items-center justify-between text-xs">
                <span className="text-primary-400">Token Usage Today</span>
                <div className="flex items-center gap-1">
                  <span className="text-accent-50">{formatShortNumber(project.tokenUsage.used)}</span>
                  <div className={`w-2 h-2 rounded-full ${
                    project.tokenUsage.trend === 'up' ? 'bg-green-500' :
                    project.tokenUsage.trend === 'down' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}