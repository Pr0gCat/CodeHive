'use client';

import { useState, useEffect } from 'react';
import { Epic, EpicPhase, EpicStatus, MVPPriority } from '@/lib/db';
import { useToast } from '@/components/ui/ToastManager';
import EpicCreateModal from './EpicCreateModal';

interface EpicWithProgress extends Epic {
  progress: {
    storiesCompleted: number;
    storiesTotal: number;
    storyPointsCompleted: number;
    storyPointsTotal: number;
    percentage: number;
  };
  stories: Array<{
    id: string;
    title: string;
    status: string;
    storyPoints: number | null;
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
  project: {
    id: string;
    name: string;
  };
}

interface EpicDashboardProps {
  projectId: string;
}

export default function EpicDashboard({ projectId }: EpicDashboardProps) {
  const { showToast } = useToast();
  const [epics, setEpics] = useState<EpicWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEpic, setSelectedEpic] = useState<EpicWithProgress | null>(
    null
  );
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchEpics = async () => {
    try {
      const response = await fetch(`/api/epics?projectId=${projectId}`);
      const data = await response.json();

      if (data.success) {
        setEpics(data.data);
      } else {
        showToast(data.error || '無法載入 Epic 清單', 'error');
      }
    } catch (error) {
      showToast('無法載入 Epic 清單', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchEpics, 30000);
    return () => clearInterval(interval);
  }, [projectId]);

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'PLANNING':
        return 'bg-blue-900 text-blue-300 border-blue-700';
      case 'IN_PROGRESS':
        return 'bg-amber-900 text-amber-300 border-amber-700';
      case 'DONE':
        return 'bg-green-900 text-green-300 border-green-700';
      case 'CANCELLED':
        return 'bg-red-900 text-red-300 border-red-700';
      default:
        return 'bg-primary-900 text-primary-400 border-primary-800';
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

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    if (percentage >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const handleEpicClick = (epic: EpicWithProgress) => {
    setSelectedEpic(epic);
  };

  const handleCreateEpic = () => {
    setShowCreateModal(true);
  };

  if (loading) {
    return (
      <div className="bg-primary-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-primary-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-primary-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-accent-50">
          Epic 管理儀表板
        </h2>
        <div className="flex items-center gap-4">
          <div className="text-sm text-primary-400">{epics.length} 個 Epic</div>
          <button
            onClick={handleCreateEpic}
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
            新增 Epic
          </button>
        </div>
      </div>

      {epics.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-primary-400 mb-4">尚未建立任何 Epic</div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Epic 摘要統計 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-primary-700 rounded-lg p-4">
              <div className="text-sm text-primary-400">總計</div>
              <div className="text-2xl font-bold text-accent-50">
                {epics.length}
              </div>
            </div>
            <div className="bg-primary-700 rounded-lg p-4">
              <div className="text-sm text-primary-400">進行中</div>
              <div className="text-2xl font-bold text-amber-300">
                {epics.filter(e => e.phase === 'IN_PROGRESS').length}
              </div>
            </div>
            <div className="bg-primary-700 rounded-lg p-4">
              <div className="text-sm text-primary-400">已完成</div>
              <div className="text-2xl font-bold text-green-300">
                {epics.filter(e => e.phase === 'DONE').length}
              </div>
            </div>
            <div className="bg-primary-700 rounded-lg p-4">
              <div className="text-sm text-primary-400">整體進度</div>
              <div className="text-2xl font-bold text-accent-50">
                {epics.length > 0
                  ? Math.round(
                      (epics.filter(e => e.phase === 'DONE').length /
                        epics.length) *
                        100
                    )
                  : 0}
                %
              </div>
            </div>
          </div>

          {/* Epic 清單 */}
          <div className="space-y-3">
            {epics.map(epic => (
              <div
                key={epic.id}
                onClick={() => handleEpicClick(epic)}
                className="bg-primary-700 border border-primary-600 rounded-lg p-4 hover:bg-primary-650 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-accent-50">
                        {epic.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full border ${getPhaseColor(epic.phase)}`}
                        >
                          {epic.phase}
                        </span>
                        <div
                          className={`w-3 h-3 rounded-full ${getPriorityColor(epic.mvpPriority)}`}
                          title={`優先級: ${epic.mvpPriority}`}
                        />
                      </div>
                    </div>
                    {epic.description && (
                      <div className="text-sm text-primary-300 mb-2">
                        {epic.description}
                      </div>
                    )}
                    {epic.coreValue && (
                      <div className="text-sm text-accent-300 italic mb-2">
                        核心價值：{epic.coreValue}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-medium text-accent-50">
                      {epic.progress.storiesCompleted}/
                      {epic.progress.storiesTotal} Stories
                    </div>
                    <div className="text-xs text-primary-400">
                      {epic.progress.storyPointsCompleted}/
                      {epic.progress.storyPointsTotal} SP
                    </div>
                  </div>
                </div>

                {/* 進度條 */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-primary-300">進度</span>
                    <span className="text-accent-50">
                      {epic.progress.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-primary-600 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(epic.progress.percentage)}`}
                      style={{ width: `${epic.progress.percentage}%` }}
                    />
                  </div>
                </div>

                {/* 依賴警告 */}
                {epic.dependencies.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-yellow-300">
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
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    依賴於 {epic.dependencies.length} 個其他 Epic
                  </div>
                )}

                {/* Stories 狀態概覽 */}
                {epic.stories.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-primary-600">
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                        <span className="text-primary-400">
                          {epic.stories.filter(s => s.status === 'TODO').length}{' '}
                          Todo
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                        <span className="text-primary-400">
                          {
                            epic.stories.filter(s => s.status === 'IN_PROGRESS')
                              .length
                          }{' '}
                          進行中
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-primary-400">
                          {epic.stories.filter(s => s.status === 'DONE').length}{' '}
                          完成
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Epic 創建模態窗 */}
      <EpicCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        projectId={projectId}
        onEpicCreated={() => {
          fetchEpics();
          setShowCreateModal(false);
        }}
      />

      {/* Epic 詳情側邊欄會在後續實現 */}
    </div>
  );
}
