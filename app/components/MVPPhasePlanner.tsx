'use client';

import { useState, useEffect } from 'react';
import { MVPPhase, Epic } from '@/lib/db';
import { useToast } from './ui/ToastManager';

interface EpicInfo {
  id: string;
  title: string;
  type: string;
  phase: string;
  mvpPriority: string;
  status: string;
  progress: {
    storiesCompleted: number;
    storiesTotal: number;
    percentage: number;
  };
}

interface MVPPhaseWithProgress extends MVPPhase {
  progress: {
    epics: {
      total: number;
      completed: number;
    };
    stories: {
      total: number;
      completed: number;
      percentage: number;
    };
  };
  coreEpics: Array<{
    id: string;
    title: string;
    phase: string;
    status: string;
  }>;
}

interface MVPPhasePlannerProps {
  projectId: string;
}

export default function MVPPhasePlanner({ projectId }: MVPPhasePlannerProps) {
  const { showToast } = useToast();
  const [phases, setPhases] = useState<MVPPhaseWithProgress[]>([]);
  const [epics, setEpics] = useState<EpicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch project overview which includes MVP phases
      const overviewResponse = await fetch(
        `/api/projects/${projectId}/overview`
      );
      const overviewData = await overviewResponse.json();

      if (overviewData.success) {
        setPhases(overviewData.data.mvpPhases || []);
      }

      // Fetch epics for assignment
      const epicsResponse = await fetch(`/api/epics?projectId=${projectId}`);
      const epicsData = await epicsResponse.json();

      if (epicsData.success) {
        setEpics(epicsData.data);
      }
    } catch (error) {
      showToast('無法載入 MVP 階段資料', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [projectId]);

  const getPhaseStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return 'bg-blue-900 text-blue-300 border-blue-700';
      case 'IN_PROGRESS':
        return 'bg-amber-900 text-amber-300 border-amber-700';
      case 'COMPLETED':
        return 'bg-green-900 text-green-300 border-green-700';
      case 'CANCELLED':
        return 'bg-red-900 text-red-300 border-red-700';
      default:
        return 'bg-primary-900 text-primary-400 border-primary-800';
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    if (percentage >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getMVPPriorityColor = (priority: string) => {
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
          <div className="h-6 bg-primary-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-primary-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-accent-50">MVP 階段規劃</h2>
        <div className="flex items-center gap-4">
          <div className="text-sm text-primary-400">{phases.length} 個階段</div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            新增階段
          </button>
        </div>
      </div>

      {phases.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-primary-400 mb-4">尚未建立任何 MVP 階段</div>
          <p className="text-sm text-primary-500 mb-6">
            MVP 階段幫助您將項目分解為可管理的發布週期，
            <br />
            每個階段包含一組核心功能，支援漸進式開發。
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700"
          >
            建立第一個 MVP 階段
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 整體進度概覽 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-primary-700 rounded-lg p-4">
              <div className="text-sm text-primary-400">總階段數</div>
              <div className="text-2xl font-bold text-accent-50">
                {phases.length}
              </div>
            </div>
            <div className="bg-primary-700 rounded-lg p-4">
              <div className="text-sm text-primary-400">進行中</div>
              <div className="text-2xl font-bold text-amber-300">
                {phases.filter(p => p.status === 'IN_PROGRESS').length}
              </div>
            </div>
            <div className="bg-primary-700 rounded-lg p-4">
              <div className="text-sm text-primary-400">已完成</div>
              <div className="text-2xl font-bold text-green-300">
                {phases.filter(p => p.status === 'COMPLETED').length}
              </div>
            </div>
            <div className="bg-primary-700 rounded-lg p-4">
              <div className="text-sm text-primary-400">總體進度</div>
              <div className="text-2xl font-bold text-accent-50">
                {phases.length > 0
                  ? Math.round(
                      (phases.filter(p => p.status === 'COMPLETED').length /
                        phases.length) *
                        100
                    )
                  : 0}
                %
              </div>
            </div>
          </div>

          {/* MVP 階段清單 */}
          <div className="space-y-4">
            {phases.map((phase, index) => (
              <div
                key={phase.id}
                className="bg-primary-700 border border-primary-600 rounded-lg p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-accent-600 text-accent-50 px-2 py-1 rounded text-sm font-medium">
                          Phase {index + 1}
                        </span>
                        <h3 className="text-lg font-medium text-accent-50">
                          {phase.name}
                        </h3>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded border ${getPhaseStatusColor(phase.status)}`}
                      >
                        {phase.status}
                      </span>
                    </div>
                    {phase.description && (
                      <p className="text-sm text-primary-300 mb-3">
                        {phase.description}
                      </p>
                    )}
                    {phase.targetDate && (
                      <div className="flex items-center gap-2 text-sm text-primary-400">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        目標日期：
                        {new Date(phase.targetDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-medium text-accent-50">
                      {phase.progress.epics.completed}/
                      {phase.progress.epics.total} Epics
                    </div>
                    <div className="text-xs text-primary-400">
                      {phase.progress.stories.completed}/
                      {phase.progress.stories.total} Stories
                    </div>
                  </div>
                </div>

                {/* 進度條 */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-primary-300">階段進度</span>
                    <span className="text-accent-50">
                      {phase.progress.stories.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-primary-600 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(phase.progress.stories.percentage)}`}
                      style={{ width: `${phase.progress.stories.percentage}%` }}
                    />
                  </div>
                </div>

                {/* 核心 Epics */}
                {phase.coreEpics.length > 0 && (
                  <div className="bg-primary-800/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-accent-300 mb-3">
                      核心功能 ({phase.coreEpics.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {phase.coreEpics.map(epic => {
                        const epicData = epics.find(e => e.id === epic.id);
                        return (
                          <div
                            key={epic.id}
                            className="bg-primary-700 border border-primary-600 rounded p-3"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-accent-50 truncate flex-1">
                                {epic.title}
                              </span>
                              {epicData && (
                                <div
                                  className={`w-3 h-3 rounded-full ml-2 ${getMVPPriorityColor(epicData.mvpPriority)}`}
                                  title={`優先級: ${epicData.mvpPriority}`}
                                />
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-primary-400">
                                {epic.phase}
                              </span>
                              {epicData && (
                                <span className="text-primary-400">
                                  {epicData.progress.percentage}% 完成
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 階段操作按鈕 */}
                <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-primary-600">
                  <button className="px-3 py-1.5 text-sm text-primary-300 border border-primary-600 rounded hover:bg-primary-600">
                    編輯
                  </button>
                  {phase.status === 'PLANNING' && (
                    <button className="px-3 py-1.5 text-sm bg-accent-600 text-accent-50 rounded hover:bg-accent-700">
                      開始階段
                    </button>
                  )}
                  {phase.status === 'IN_PROGRESS' && (
                    <button className="px-3 py-1.5 text-sm bg-green-600 text-green-50 rounded hover:bg-green-700">
                      完成階段
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 未分配的 Epics */}
          {epics.filter(
            epic =>
              !phases.some(phase =>
                JSON.parse(phase.coreFeatures || '[]').includes(epic.id)
              )
          ).length > 0 && (
            <div className="bg-primary-700 border border-primary-600 rounded-lg p-6">
              <h3 className="text-lg font-medium text-accent-50 mb-4">
                未分配的 Epics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {epics
                  .filter(
                    epic =>
                      !phases.some(phase =>
                        JSON.parse(phase.coreFeatures || '[]').includes(epic.id)
                      )
                  )
                  .map(epic => (
                    <div
                      key={epic.id}
                      className="bg-primary-800 border border-primary-600 rounded p-3 cursor-pointer hover:bg-primary-750"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-accent-50 truncate flex-1">
                          {epic.title}
                        </span>
                        <div
                          className={`w-3 h-3 rounded-full ml-2 ${getMVPPriorityColor(epic.mvpPriority)}`}
                          title={`優先級: ${epic.mvpPriority}`}
                        />
                      </div>
                      <div className="text-xs text-primary-400">
                        {epic.type} • {epic.progress.percentage}% 完成
                      </div>
                    </div>
                  ))}
              </div>
              <div className="mt-4 text-sm text-primary-500">
                💡 這些 Epic 尚未分配到任何 MVP
                階段，建議將它們加入適當的階段中。
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
