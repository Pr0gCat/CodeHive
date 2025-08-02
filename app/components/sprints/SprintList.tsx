'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import {
  Calendar,
  CheckCircle,
  Clock,
  PlayCircle,
  XCircle,
  ChevronRight,
  Target,
  TrendingUp,
} from 'lucide-react';

interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: string;
  plannedStoryPoints: number;
  commitedStoryPoints: number;
  completedStoryPoints: number;
  velocity: number | null;
  stories: Array<{
    id: string;
    status: string;
  }>;
}

interface SprintListProps {
  projectId: string;
}

export function SprintList({ projectId }: SprintListProps) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSprints();
  }, [projectId]);

  const fetchSprints = async () => {
    try {
      const response = await fetch(`/api/sprints?projectId=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch sprints');
      const data = await response.json();
      setSprints(data);
    } catch (error) {
      console.error('Error fetching sprints:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return <Clock className="h-5 w-5 text-gray-500" />;
      case 'ACTIVE':
        return <PlayCircle className="h-5 w-5 text-blue-500" />;
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'CANCELLED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return '規劃中';
      case 'ACTIVE':
        return '進行中';
      case 'COMPLETED':
        return '已完成';
      case 'CANCELLED':
        return '已取消';
      default:
        return status;
    }
  };

  const getProgressPercentage = (sprint: Sprint) => {
    if (sprint.status === 'PLANNING' || sprint.commitedStoryPoints === 0) {
      return 0;
    }
    return Math.round((sprint.completedStoryPoints / sprint.commitedStoryPoints) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (sprints.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">尚未建立任何 Sprint</p>
        <Link
          href={`/projects/${projectId}/sprints/new`}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-accent-600 hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500"
        >
          建立第一個 Sprint
        </Link>
      </div>
    );
  }

  // Group sprints by status
  const activeSprints = sprints.filter((s) => s.status === 'ACTIVE');
  const planningSprints = sprints.filter((s) => s.status === 'PLANNING');
  const completedSprints = sprints.filter((s) => s.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      {/* Active Sprints */}
      {activeSprints.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">進行中的 Sprint</h2>
          <div className="space-y-3">
            {activeSprints.map((sprint) => (
              <SprintCard key={sprint.id} sprint={sprint} projectId={projectId} />
            ))}
          </div>
        </div>
      )}

      {/* Planning Sprints */}
      {planningSprints.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">規劃中的 Sprint</h2>
          <div className="space-y-3">
            {planningSprints.map((sprint) => (
              <SprintCard key={sprint.id} sprint={sprint} projectId={projectId} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Sprints */}
      {completedSprints.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">已完成的 Sprint</h2>
          <div className="space-y-3">
            {completedSprints.map((sprint) => (
              <SprintCard key={sprint.id} sprint={sprint} projectId={projectId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SprintCard({ sprint, projectId }: { sprint: Sprint; projectId: string }) {
  const progress = getProgressPercentage(sprint);

  return (
    <Link
      href={`/projects/${projectId}/sprints/${sprint.id}`}
      className="block bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200"
    >
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {getStatusIcon(sprint.status)}
              <h3 className="text-lg font-medium text-gray-900">{sprint.name}</h3>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  sprint.status === 'ACTIVE'
                    ? 'bg-blue-100 text-blue-800'
                    : sprint.status === 'COMPLETED'
                    ? 'bg-green-100 text-green-800'
                    : sprint.status === 'CANCELLED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {getStatusText(sprint.status)}
              </span>
            </div>

            {sprint.goal && (
              <p className="mt-2 text-sm text-gray-600 flex items-start gap-2">
                <Target className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                {sprint.goal}
              </p>
            )}

            <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(sprint.startDate), 'yyyy/MM/dd', { locale: zhTW })} -{' '}
                {format(new Date(sprint.endDate), 'yyyy/MM/dd', { locale: zhTW })}
              </span>
              {sprint.velocity !== null && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  速率: {sprint.velocity.toFixed(1)} 點/天
                </span>
              )}
            </div>

            {sprint.status !== 'PLANNING' && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">
                    完成 {sprint.completedStoryPoints} / {sprint.commitedStoryPoints} 故事點
                  </span>
                  <span className="font-medium text-gray-900">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {sprint.status === 'PLANNING' && (
              <div className="mt-4 text-sm text-gray-600">
                <span className="font-medium">{sprint.plannedStoryPoints}</span> 故事點已規劃，
                <span className="font-medium ml-1">{sprint.stories.length}</span> 個任務
              </div>
            )}
          </div>

          <ChevronRight className="h-5 w-5 text-gray-400 ml-4" />
        </div>
      </div>
    </Link>
  );
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'PLANNING':
      return <Clock className="h-5 w-5 text-gray-500" />;
    case 'ACTIVE':
      return <PlayCircle className="h-5 w-5 text-blue-500" />;
    case 'COMPLETED':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'CANCELLED':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return null;
  }
}

function getStatusText(status: string) {
  switch (status) {
    case 'PLANNING':
      return '規劃中';
    case 'ACTIVE':
      return '進行中';
    case 'COMPLETED':
      return '已完成';
    case 'CANCELLED':
      return '已取消';
    default:
      return status;
  }
}

function getProgressPercentage(sprint: Sprint) {
  if (sprint.status === 'PLANNING' || sprint.commitedStoryPoints === 0) {
    return 0;
  }
  return Math.round((sprint.completedStoryPoints / sprint.commitedStoryPoints) * 100);
}