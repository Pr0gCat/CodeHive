'use client';

import { ActiveSprintWidget } from '@/components/sprints/ActiveSprintWidget';
import { useToast } from '@/components/ui/ToastManager';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface ProjectOverview {
  project: {
    id: string;
    name: string;
    description?: string;
    summary?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  hierarchy: {
    epics: Array<{
      id: string;
      title: string;
      type: string;
      phase: string;
      status: string;
      mvpPriority: string;
      progress: {
        stories: {
          total: number;
          completed: number;
        };
        cycles: {
          total: number;
          completed: number;
        };
      };
      stories: Array<{
        id: string;
        title: string;
        status: string;
        storyPoints?: number;
        tddEnabled: boolean;
        cycles: Array<{
          id: string;
          title: string;
          phase: string;
          status: string;
        }>;
        hasBlockers: boolean;
      }>;
      dependencies: Array<{
        id: string;
        type: string;
        dependsOn: {
          id: string;
          title: string;
          phase: string;
        };
      }>;
    }>;
    standaloneStories: Array<{
      id: string;
      title: string;
      status: string;
      storyPoints?: number;
      tddEnabled: boolean;
      cycles: Array<{
        id: string;
        title: string;
        phase: string;
        status: string;
      }>;
    }>;
  };
  mvpPhases: Array<{
    id: string;
    name: string;
    status: string;
    progress: {
      stories: {
        total: number;
        completed: number;
        percentage: number;
      };
    };
  }>;
  statistics: {
    epics: {
      total: number;
      byPhase: Record<string, number>;
      byPriority: Record<string, number>;
    };
    stories: {
      total: number;
      byStatus: Record<string, number>;
      totalStoryPoints: number;
      completedStoryPoints: number;
    };
    cycles: {
      total: number;
      byPhase: Record<string, number>;
      byStatus: Record<string, number>;
    };
    progress: {
      epics: number;
      stories: number;
      storyPoints: number;
      cycles: number;
    };
  };
  blockers: Array<{
    type: 'epic' | 'story';
    id: string;
    title: string;
    blockedBy: Array<{
      id: string;
      title: string;
      phase?: string;
      status?: string;
    }>;
  }>;
  recentQueries: Array<{
    id: string;
    type: string;
    title: string;
    urgency: string;
    createdAt: string;
  }>;
}

interface HierarchicalProjectViewProps {
  projectId: string;
}

export default function HierarchicalProjectView({
  projectId,
}: HierarchicalProjectViewProps) {
  const { showToast } = useToast();
  const [overview, setOverview] = useState<ProjectOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'board' | 'timeline'>(
    'tree'
  );

  const fetchOverview = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/overview`);
      const data = await response.json();

      if (data.success) {
        setOverview(data.data);
      } else {
        showToast(data.error || '無法載入專案概覽', 'error');
      }
    } catch (_error) {
      showToast('無法載入專案概覽', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    // Refresh every 30 seconds
    const interval = setInterval(fetchOverview, 30000);
    return () => clearInterval(interval);
  }, [projectId]);

  const toggleEpicExpansion = (epicId: string) => {
    const newExpanded = new Set(expandedEpics);
    if (newExpanded.has(epicId)) {
      newExpanded.delete(epicId);
    } else {
      newExpanded.add(epicId);
    }
    setExpandedEpics(newExpanded);
  };

  const getStatusColor = (
    status: string,
    type: 'epic' | 'story' | 'cycle' = 'story'
  ) => {
    switch (status) {
      case 'PLANNING':
      case 'BACKLOG':
        return 'text-gray-400 bg-gray-900/20';
      case 'TODO':
        return 'text-cyan-400 bg-cyan-900/20';
      case 'IN_PROGRESS':
        return 'text-amber-400 bg-amber-900/20';
      case 'REVIEW':
        return 'text-purple-400 bg-purple-900/20';
      case 'DONE':
      case 'COMPLETED':
        return 'text-green-400 bg-green-900/20';
      case 'CANCELLED':
      case 'FAILED':
        return 'text-red-400 bg-red-900/20';
      case 'RED':
        return 'text-red-400 bg-red-900/20';
      case 'GREEN':
        return 'text-green-400 bg-green-900/20';
      case 'REFACTOR':
        return 'text-blue-400 bg-blue-900/20';
      default:
        return 'text-gray-400 bg-gray-900/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-500';
      case 'HIGH':
        return 'bg-orange-500';
      case 'MEDIUM':
        return 'bg-yellow-500';
      case 'LOW':
        return 'bg-blue-500';
      case 'FUTURE':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="bg-primary-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-primary-700 rounded w-1/2 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-primary-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="bg-primary-800 rounded-lg p-6 text-center">
        <div className="text-red-400 mb-2">無法載入專案概覽</div>
        <button
          onClick={fetchOverview}
          className="px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700"
        >
          重新載入
        </button>
      </div>
    );
  }

  return (
    <div className="bg-primary-800 rounded-lg p-6">
      {/* 標題和視圖切換 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-accent-50">專案總覽</h2>
        <div className="flex items-center gap-2">
          <div className="flex bg-primary-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 text-sm rounded ${
                viewMode === 'tree'
                  ? 'bg-accent-600 text-accent-50'
                  : 'text-primary-300 hover:text-accent-50'
              }`}
            >
              樹狀視圖
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1.5 text-sm rounded ${
                viewMode === 'board'
                  ? 'bg-accent-600 text-accent-50'
                  : 'text-primary-300 hover:text-accent-50'
              }`}
            >
              看板視圖
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 text-sm rounded ${
                viewMode === 'timeline'
                  ? 'bg-accent-600 text-accent-50'
                  : 'text-primary-300 hover:text-accent-50'
              }`}
            >
              時間軸
            </button>
          </div>
        </div>
      </div>

      {/* 統計概覽 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-primary-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-primary-400">Epics</div>
            <div className="text-xl font-bold text-accent-50">
              {overview.statistics.epics.total}
            </div>
          </div>
          <div className="w-full bg-primary-600 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${overview.statistics.progress.epics}%` }}
            />
          </div>
          <div className="text-xs text-primary-400 mt-1">
            {overview.statistics.progress.epics}% 完成
          </div>
        </div>

        <div className="bg-primary-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-primary-400">Stories</div>
            <div className="text-xl font-bold text-accent-50">
              {overview.statistics.stories.total}
            </div>
          </div>
          <div className="w-full bg-primary-600 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${overview.statistics.progress.stories}%` }}
            />
          </div>
          <div className="text-xs text-primary-400 mt-1">
            {overview.statistics.progress.stories}% 完成
          </div>
        </div>

        <div className="bg-primary-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-primary-400">Story Points</div>
            <div className="text-xl font-bold text-accent-50">
              {overview.statistics.stories.totalStoryPoints}
            </div>
          </div>
          <div className="w-full bg-primary-600 rounded-full h-2">
            <div
              className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${overview.statistics.progress.storyPoints}%` }}
            />
          </div>
          <div className="text-xs text-primary-400 mt-1">
            {overview.statistics.progress.storyPoints}% 完成
          </div>
        </div>

        <div className="bg-primary-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-primary-400">TDD Cycles</div>
            <div className="text-xl font-bold text-accent-50">
              {overview.statistics.cycles.total}
            </div>
          </div>
          <div className="w-full bg-primary-600 rounded-full h-2">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${overview.statistics.progress.cycles}%` }}
            />
          </div>
          <div className="text-xs text-primary-400 mt-1">
            {overview.statistics.progress.cycles}% 完成
          </div>
        </div>
      </div>

      {/* Active Sprint Widget */}
      <div className="mb-6">
        <ActiveSprintWidget projectId={projectId} />
      </div>

      {/* 阻塞警告 */}
      {overview.blockers.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="w-5 h-5 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <span className="text-yellow-300 font-medium">
              阻塞警告 ({overview.blockers.length})
            </span>
          </div>
          <div className="space-y-2">
            {overview.blockers.slice(0, 3).map(blocker => (
              <div key={blocker.id} className="text-sm text-yellow-200">
                <span className="font-medium">{blocker.title}</span> 被
                {blocker.blockedBy.map(dep => dep.title).join(', ')} 阻塞
              </div>
            ))}
            {overview.blockers.length > 3 && (
              <div className="text-sm text-yellow-400">
                還有 {overview.blockers.length - 3} 個阻塞項目...
              </div>
            )}
          </div>
        </div>
      )}

      {/* 主要內容區域 - 樹狀視圖 */}
      {viewMode === 'tree' && (
        <div className="space-y-4">
          {/* MVP 階段 */}
          {overview.mvpPhases.length > 0 && (
            <div className="bg-primary-700/50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium text-accent-50 mb-4">
                MVP 階段
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {overview.mvpPhases.map(phase => (
                  <div key={phase.id} className="bg-primary-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-accent-50">
                        {phase.name}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs rounded ${getStatusColor(phase.status)}`}
                      >
                        {phase.status}
                      </span>
                    </div>
                    <div className="w-full bg-primary-600 rounded-full h-2 mb-2">
                      <div
                        className="bg-accent-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${phase.progress.stories.percentage}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-primary-400">
                      {phase.progress.stories.completed}/
                      {phase.progress.stories.total} Stories
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Epics 樹狀結構 */}
          <div className="space-y-3">
            {overview.hierarchy.epics.map(epic => (
              <div
                key={epic.id}
                className="bg-primary-700 rounded-lg border border-primary-600"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-primary-650"
                  onClick={() => toggleEpicExpansion(epic.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {expandedEpics.has(epic.id) ? (
                          <svg
                            className="w-4 h-4 text-primary-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4 text-primary-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        )}
                        <svg
                          className="w-5 h-5 text-accent-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                          />
                        </svg>
                      </div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-accent-50">
                          {epic.title}
                        </h3>
                        <div
                          className={`w-3 h-3 rounded-full ${getPriorityColor(epic.mvpPriority)}`}
                          title={`優先級: ${epic.mvpPriority}`}
                        />
                        <span
                          className={`px-2 py-1 text-xs rounded ${getStatusColor(epic.phase, 'epic')}`}
                        >
                          {epic.phase}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-primary-400">
                      {epic.progress.stories.completed}/
                      {epic.progress.stories.total} Stories
                    </div>
                  </div>
                </div>

                {/* Stories 展開內容 */}
                {expandedEpics.has(epic.id) && (
                  <div className="px-4 pb-4">
                    <div className="ml-8 space-y-2">
                      {epic.stories.map(story => (
                        <div
                          key={story.id}
                          className="bg-primary-800 rounded p-3 border-l-4 border-blue-500"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <svg
                                className="w-4 h-4 text-blue-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              <span className="text-sm font-medium text-accent-50">
                                {story.title}
                              </span>
                              {story.hasBlockers && (
                                <svg
                                  className="w-4 h-4 text-yellow-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                  />
                                </svg>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {story.storyPoints && (
                                <span className="text-xs text-accent-300">
                                  {story.storyPoints} SP
                                </span>
                              )}
                              <span
                                className={`px-2 py-1 text-xs rounded ${getStatusColor(story.status)}`}
                              >
                                {story.status}
                              </span>
                            </div>
                          </div>

                          {/* TDD Cycles */}
                          {story.tddEnabled && story.cycles.length > 0 && (
                            <div className="ml-6 mt-2 space-y-1">
                              {story.cycles.map(cycle => (
                                <div
                                  key={cycle.id}
                                  className="flex items-center justify-between bg-primary-700/50 rounded px-2 py-1"
                                >
                                  <div className="flex items-center gap-2">
                                    <svg
                                      className="w-3 h-3 text-purple-400"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                      />
                                    </svg>
                                    <span className="text-xs text-primary-200">
                                      {cycle.title}
                                    </span>
                                  </div>
                                  <span
                                    className={`px-1.5 py-0.5 text-xs rounded ${getStatusColor(cycle.phase, 'cycle')}`}
                                  >
                                    {cycle.phase}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* 獨立 Stories */}
            {overview.hierarchy.standaloneStories.length > 0 && (
              <div className="bg-primary-700 rounded-lg border border-primary-600 p-4">
                <h3 className="text-lg font-medium text-accent-50 mb-4">
                  獨立 Stories
                </h3>
                <div className="space-y-2">
                  {overview.hierarchy.standaloneStories.map(story => (
                    <div
                      key={story.id}
                      className="bg-primary-800 rounded p-3 border-l-4 border-gray-500"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <svg
                            className="w-4 h-4 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <span className="text-sm font-medium text-accent-50">
                            {story.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {story.storyPoints && (
                            <span className="text-xs text-accent-300">
                              {story.storyPoints} SP
                            </span>
                          )}
                          <span
                            className={`px-2 py-1 text-xs rounded ${getStatusColor(story.status)}`}
                          >
                            {story.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 其他視圖模式的占位符 */}
      {viewMode === 'board' && (
        <div className="space-y-6">
          {/* MVP 階段看板 */}
          {overview.mvpPhases.length > 0 && (
            <div className="bg-primary-700/50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-accent-50 mb-4">
                MVP 階段看板
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {overview.mvpPhases.map(phase => (
                  <div key={phase.id} className="bg-primary-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-accent-50">
                        {phase.name}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs rounded ${getStatusColor(phase.status)}`}
                      >
                        {phase.status}
                      </span>
                    </div>
                    <div className="w-full bg-primary-600 rounded-full h-2 mb-2">
                      <div
                        className="bg-accent-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${phase.progress.stories.percentage}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-primary-400">
                      {phase.progress.stories.completed}/
                      {phase.progress.stories.total} Stories
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Epics 看板 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-accent-50">Epics 看板</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {overview.hierarchy.epics.map(epic => (
                <div
                  key={epic.id}
                  className="bg-primary-700 rounded-lg p-4 border-l-4 border-accent-500"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-accent-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                      <span className="font-medium text-accent-50">
                        {epic.title}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded ${getStatusColor(epic.status, 'epic')}`}
                    >
                      {epic.status}
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-primary-400 mb-1">
                      <span>進度</span>
                      <span>
                        {epic.progress.stories.completed}/
                        {epic.progress.stories.total}
                      </span>
                    </div>
                    <div className="w-full bg-primary-600 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${epic.progress.stories.total > 0 ? (epic.progress.stories.completed / epic.progress.stories.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Stories 列表 */}
                  <div className="space-y-2">
                    <div className="text-xs text-primary-400 font-medium">
                      Stories
                    </div>
                    {epic.stories.slice(0, 3).map(story => (
                      <div
                        key={story.id}
                        className="bg-primary-800 rounded p-2 border-l-2 border-blue-500"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-primary-200 truncate flex-1">
                            {story.title}
                          </span>
                          <div className="flex items-center gap-1">
                            {story.storyPoints && (
                              <span className="text-xs text-accent-300">
                                {story.storyPoints} SP
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 text-xs rounded ${getStatusColor(story.status)}`}
                            >
                              {story.status}
                            </span>
                          </div>
                        </div>
                        {story.hasBlockers && (
                          <div className="flex items-center gap-1 mt-1">
                            <svg
                              className="w-3 h-3 text-yellow-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                              />
                            </svg>
                            <span className="text-xs text-yellow-400">
                              有阻塞
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                    {epic.stories.length > 3 && (
                      <div className="text-xs text-primary-400 text-center">
                        +{epic.stories.length - 3} 個 Stories
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 獨立 Stories 看板 */}
          {overview.hierarchy.standaloneStories.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-accent-50">
                獨立 Stories
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {overview.hierarchy.standaloneStories.map(story => (
                  <div
                    key={story.id}
                    className="bg-primary-700 rounded-lg p-4 border-l-4 border-gray-500"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span className="font-medium text-accent-50">
                          {story.title}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded ${getStatusColor(story.status)}`}
                      >
                        {story.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      {story.storyPoints && (
                        <span className="text-xs text-accent-300">
                          {story.storyPoints} Story Points
                        </span>
                      )}
                      {story.tddEnabled && (
                        <div className="flex items-center gap-1">
                          <svg
                            className="w-3 h-3 text-purple-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          <span className="text-xs text-purple-400">TDD</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === 'timeline' && (
        <div className="space-y-6">
          {/* 專案時間軸 */}
          <div className="bg-primary-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-accent-50 mb-4">
              專案時間軸
            </h3>
            <div className="relative">
              {/* 時間軸線 */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-primary-600"></div>

              <div className="space-y-6">
                {/* 專案開始 */}
                <div className="relative pl-12">
                  <div className="absolute left-2 top-2 w-4 h-4 bg-green-500 rounded-full border-2 border-primary-800"></div>
                  <div className="bg-primary-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-accent-50">專案開始</h4>
                      <span className="text-xs text-primary-400">
                        {new Date(
                          overview.project.createdAt
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-primary-300">
                      {overview.project.name}
                    </p>
                  </div>
                </div>

                {/* MVP 階段里程碑 */}
                {overview.mvpPhases.map((phase, index) => (
                  <div key={phase.id} className="relative pl-12">
                    <div
                      className={`absolute left-2 top-2 w-4 h-4 rounded-full border-2 border-primary-800 ${
                        phase.status === 'COMPLETED'
                          ? 'bg-green-500'
                          : phase.status === 'IN_PROGRESS'
                            ? 'bg-yellow-500'
                            : 'bg-primary-600'
                      }`}
                    ></div>
                    <div className="bg-primary-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-accent-50">
                          {phase.name}
                        </h4>
                        <span
                          className={`px-2 py-1 text-xs rounded ${getStatusColor(phase.status)}`}
                        >
                          {phase.status}
                        </span>
                      </div>
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-primary-400 mb-1">
                          <span>進度</span>
                          <span>{phase.progress.stories.percentage}%</span>
                        </div>
                        <div className="w-full bg-primary-600 rounded-full h-2">
                          <div
                            className="bg-accent-500 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${phase.progress.stories.percentage}%`,
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-primary-400">
                        {phase.progress.stories.completed}/
                        {phase.progress.stories.total} Stories 完成
                      </p>
                    </div>
                  </div>
                ))}

                {/* Epics 時間軸 */}
                {overview.hierarchy.epics.map(epic => (
                  <div key={epic.id} className="relative pl-12">
                    <div
                      className={`absolute left-2 top-2 w-4 h-4 rounded-full border-2 border-primary-800 ${
                        epic.status === 'COMPLETED'
                          ? 'bg-green-500'
                          : epic.status === 'IN_PROGRESS'
                            ? 'bg-blue-500'
                            : 'bg-primary-600'
                      }`}
                    ></div>
                    <div className="bg-primary-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-accent-50">
                          {epic.title}
                        </h4>
                        <span
                          className={`px-2 py-1 text-xs rounded ${getStatusColor(epic.status, 'epic')}`}
                        >
                          {epic.status}
                        </span>
                      </div>
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-primary-400 mb-1">
                          <span>進度</span>
                          <span>
                            {epic.progress.stories.completed}/
                            {epic.progress.stories.total}
                          </span>
                        </div>
                        <div className="w-full bg-primary-600 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${epic.progress.stories.total > 0 ? (epic.progress.stories.completed / epic.progress.stories.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Stories 子項目 */}
                      {epic.stories.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <div className="text-xs text-primary-400 font-medium">
                            Stories
                          </div>
                          {epic.stories.slice(0, 3).map(story => (
                            <div
                              key={story.id}
                              className="bg-primary-800 rounded p-2 ml-4"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-primary-200 truncate flex-1">
                                  {story.title}
                                </span>
                                <div className="flex items-center gap-1">
                                  {story.storyPoints && (
                                    <span className="text-xs text-accent-300">
                                      {story.storyPoints} SP
                                    </span>
                                  )}
                                  <span
                                    className={`px-1.5 py-0.5 text-xs rounded ${getStatusColor(story.status)}`}
                                  >
                                    {story.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {epic.stories.length > 3 && (
                            <div className="text-xs text-primary-400 text-center ml-4">
                              +{epic.stories.length - 3} 個 Stories
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* 專案統計里程碑 */}
                <div className="relative pl-12">
                  <div className="absolute left-2 top-2 w-4 h-4 bg-purple-500 rounded-full border-2 border-primary-800"></div>
                  <div className="bg-primary-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-accent-50">專案統計</h4>
                      <span className="text-xs text-primary-400">目前狀態</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-primary-400">Epics:</span>
                        <span className="text-accent-50 ml-2">
                          {overview.statistics.epics.total}
                        </span>
                      </div>
                      <div>
                        <span className="text-primary-400">Stories:</span>
                        <span className="text-accent-50 ml-2">
                          {overview.statistics.stories.total}
                        </span>
                      </div>
                      <div>
                        <span className="text-primary-400">Story Points:</span>
                        <span className="text-accent-50 ml-2">
                          {overview.statistics.stories.totalStoryPoints}
                        </span>
                      </div>
                      <div>
                        <span className="text-primary-400">TDD Cycles:</span>
                        <span className="text-accent-50 ml-2">
                          {overview.statistics.cycles.total}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 阻塞項目警告 */}
          {overview.blockers.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <h3 className="text-lg font-medium text-yellow-400 mb-3">
                阻塞項目
              </h3>
              <div className="space-y-2">
                {overview.blockers.map(blocker => (
                  <div key={blocker.id} className="bg-primary-800 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        className="w-4 h-4 text-yellow-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                      <span className="font-medium text-yellow-400">
                        {blocker.title}
                      </span>
                      <span className="text-xs text-primary-400">
                        ({blocker.type})
                      </span>
                    </div>
                    <div className="text-sm text-primary-300">
                      被阻塞於: {blocker.blockedBy.map(b => b.title).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
