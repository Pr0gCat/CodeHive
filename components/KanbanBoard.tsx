'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/ToastManager';

interface Epic {
  id: string;
  title: string;
  type: string;
  phase: string;
  mvpPriority: string;
}

interface Story {
  id: string;
  title: string;
  description?: string;
  status: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  position: number;
  assignedAgent?: string;
  epicId?: string;
  storyPoints?: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  tddEnabled: boolean;
  acceptanceCriteria?: string;
  tags?: string[] | string;
  epic?: Epic;
  cycles: Array<{
    id: string;
    title: string;
    phase: string;
    status: string;
  }>;
  agentTasks: any[];
  _count: {
    agentTasks: number;
    queuedTasks: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface KanbanBoardProps {
  projectId: string;
}

const KANBAN_COLUMNS = [
  { id: 'BACKLOG', title: '待辦', color: 'bg-gray-900 border-gray-700' },
  { id: 'TODO', title: '準備開始', color: 'bg-blue-900 border-blue-700' },
  {
    id: 'IN_PROGRESS',
    title: '進行中',
    color: 'bg-yellow-900 border-yellow-700',
  },
  { id: 'REVIEW', title: '審查中', color: 'bg-purple-900 border-purple-700' },
  { id: 'DONE', title: '已完成', color: 'bg-green-900 border-green-700' },
] as const;

export default function KanbanBoard({ projectId }: KanbanBoardProps) {
  const { showToast } = useToast();
  const [stories, setStories] = useState<Story[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createCardData, setCreateCardData] = useState<{
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    tddEnabled: boolean;
    storyPoints: number;
    acceptanceCriteria: string;
  }>({
    title: '',
    description: '',
    priority: 'MEDIUM',
    tddEnabled: false,
    storyPoints: 0,
    acceptanceCriteria: '',
  });

  useEffect(() => {
    fetchStories();
    fetchEpics();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchStories();
      fetchEpics();
    }, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [projectId]);

  const fetchStories = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    }
    try {
      const response = await fetch(`/api/projects/${projectId}/cards`);
      const data = await response.json();
      if (data.success) {
        setStories(data.data);
        if (isManualRefresh) {
          showToast('Stories 已更新', 'success');
        }
      }
    } catch (error) {
      console.error('Failed to fetch stories:', error);
      showToast('無法載入 Stories', 'error');
    } finally {
      setLoading(false);
      if (isManualRefresh) {
        setRefreshing(false);
      }
    }
  };

  const fetchEpics = async () => {
    try {
      const response = await fetch(`/api/epics?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setEpics(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch epics:', error);
    }
  };

  const handleRefresh = async () => {
    await fetchStories(true);
    await fetchEpics();
  };


  const handleDragStart = (e: React.DragEvent, storyId: string) => {
    setDraggedItem(storyId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();

    if (!draggedItem) return;

    const story = stories.find(s => s.id === draggedItem);
    if (!story || story.status === targetStatus) {
      setDraggedItem(null);
      return;
    }

    try {
      const response = await fetch(`/api/cards/${draggedItem}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: targetStatus,
        }),
      });

      if (response.ok) {
        setStories(prev =>
          prev.map(s =>
            s.id === draggedItem
              ? { ...s, status: targetStatus as Story['status'] }
              : s
          )
        );
        showToast(
          `Story 已移至 ${KANBAN_COLUMNS.find(c => c.id === targetStatus)?.title}`,
          'success'
        );
      } else {
        showToast('移動 Story 失敗', 'error');
      }
    } catch (error) {
      console.error('Failed to update story status:', error);
      showToast('移動 Story 失敗', 'error');
    }

    setDraggedItem(null);
  };

  const isClaudeCodeInitTask = (story: Story): boolean => {
    const title = story.title.toLowerCase();
    const tags = story.tags || [];

    return (
      (title.includes('claude code') && title.includes('/init')) ||
      (title.includes('initialize') && title.includes('claude')) ||
      (Array.isArray(tags) ? tags : JSON.parse(tags || '[]')).includes(
        'claude-code'
      )
    );
  };

  const executeClaudeCodeTask = async (storyId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cards/${storyId}/execute-claude`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        showToast('Claude Code /init 執行成功！', 'success');
        // Refresh stories to show updated status
        fetchStories();
      } else {
        showToast(`執行失敗: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to execute Claude Code task:', error);
      showToast('執行 Claude Code 任務失敗', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createCard = async () => {
    if (!createCardData.title.trim()) {
      showToast('請輸入 Story 標題', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: createCardData.title,
          description: createCardData.description,
          priority: createCardData.priority,
          tddEnabled: createCardData.tddEnabled,
          storyPoints: createCardData.storyPoints || undefined,
          acceptanceCriteria: createCardData.acceptanceCriteria || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        showToast('Story 建立成功！', 'success');
        setShowCreateModal(false);
        setCreateCardData({
          title: '',
          description: '',
          priority: 'MEDIUM',
          tddEnabled: false,
          storyPoints: 0,
          acceptanceCriteria: '',
        });
        fetchStories(); // Refresh stories
      } else {
        showToast(`建立失敗: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to create card:', error);
      showToast('建立 Story 失敗', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEpicColor = (type: string) => {
    switch (type) {
      case 'MVP':
        return 'bg-purple-100 text-purple-800';
      case 'FEATURE':
        return 'bg-blue-100 text-blue-800';
      case 'ENHANCEMENT':
        return 'bg-green-100 text-green-800';
      case 'BUGFIX':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-accent-50">Story 看板</h2>
          <p className="text-primary-300 mt-1">拖拽 Stories 來更改狀態</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
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
            {refreshing ? '更新中...' : '更新'}
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-6 min-w-max pb-6">
          {KANBAN_COLUMNS.map(column => {
            const columnStories = stories.filter(
              story => story.status === column.id
            );

            return (
              <div
                key={column.id}
                className={`flex-shrink-0 w-80 ${column.color} rounded-lg border`}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, column.id)}
              >
                {/* Column Header */}
                <div className="p-4 border-b border-primary-600">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-accent-50">
                      {column.title}
                    </h3>
                    <span className="px-2 py-1 bg-primary-700 text-primary-200 rounded-full text-sm">
                      {columnStories.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="p-4 space-y-3 min-h-[200px] max-h-[600px] overflow-y-auto">
                  {columnStories.map(story => (
                    <div
                      key={story.id}
                      draggable
                      onDragStart={e => handleDragStart(e, story.id)}
                      className={`bg-primary-800 rounded-lg p-4 cursor-move hover:bg-primary-750 transition-colors ${
                        draggedItem === story.id ? 'opacity-50' : ''
                      } ${
                        story.tddEnabled
                          ? 'border-l-4 border-green-500'
                          : 'border-l-4 border-blue-500'
                      }`}
                    >
                      {/* Story Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-2 flex-1">
                          <h4 className="font-medium text-accent-50 text-sm leading-tight">
                            {story.title}
                          </h4>
                          {/* TDD Badge */}
                          {story.tddEnabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900 text-green-300 rounded-full text-xs font-medium border border-green-700">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                />
                              </svg>
                              TDD
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900 text-blue-300 rounded-full text-xs font-medium border border-blue-700">
                              <svg
                                className="w-3 h-3"
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
                              DOC
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${getPriorityColor(story.priority)}`}
                          >
                            {story.priority}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      {story.description && (
                        <p className="text-primary-300 text-xs mb-3 line-clamp-2">
                          {story.description}
                        </p>
                      )}

                      {/* Epic Badge */}
                      {story.epic && (
                        <div className="mb-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getEpicColor(story.epic.type)}`}
                          >
                            {story.epic.title}
                          </span>
                        </div>
                      )}

                      {/* Story Points */}
                      {story.storyPoints && (
                        <div className="flex items-center text-xs text-primary-400 mb-3">
                          <span className="flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                            {story.storyPoints} 點
                          </span>
                        </div>
                      )}

                      {/* Cycles Progress */}
                      {story.cycles.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center gap-1 mb-1">
                            <svg
                              className="w-3 h-3 text-primary-400"
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
                            <span className="text-xs text-primary-400">
                              {
                                story.cycles.filter(
                                  c => c.status === 'COMPLETED'
                                ).length
                              }
                              /{story.cycles.length} 週期
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {story.cycles.map((cycle, idx) => (
                              <div
                                key={cycle.id}
                                className={`w-2 h-2 rounded-full ${
                                  cycle.status === 'COMPLETED'
                                    ? 'bg-green-400'
                                    : cycle.status === 'ACTIVE'
                                      ? 'bg-yellow-400'
                                      : 'bg-gray-600'
                                }`}
                                title={`${cycle.title} - ${cycle.phase}`}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Assigned Agent */}
                      {story.assignedAgent && (
                        <div className="flex items-center gap-1 text-xs text-primary-400">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <span>{story.assignedAgent}</span>
                        </div>
                      )}

                      {/* Task Count */}
                      {story._count.agentTasks > 0 && (
                        <div className="flex items-center gap-1 text-xs text-primary-400 mt-2">
                          <svg
                            className="w-3 h-3"
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
                          <span>{story._count.agentTasks} 個任務</span>
                        </div>
                      )}

                      {/* Claude Code Execute Button */}
                      {isClaudeCodeInitTask(story) &&
                        story.status === 'TODO' && (
                          <div className="mt-3 pt-3 border-t border-primary-600">
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                executeClaudeCodeTask(story.id);
                              }}
                              disabled={loading}
                              className="w-full px-3 py-2 bg-accent-600 text-accent-50 rounded-md hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
                            >
                              {loading ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent-50"></div>
                                  執行中...
                                </>
                              ) : (
                                <>
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
                                      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6 4h6"
                                    />
                                  </svg>
                                  執行 Claude Code /init
                                </>
                              )}
                            </button>
                          </div>
                        )}

                      {/* Claude Code Status Indicator */}
                      {isClaudeCodeInitTask(story) &&
                        story.status === 'IN_PROGRESS' && (
                          <div className="mt-3 pt-3 border-t border-primary-600">
                            <div className="flex items-center gap-2 text-xs text-yellow-400">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-400"></div>
                              <span>Claude Code 執行中...</span>
                            </div>
                          </div>
                        )}

                      {/* Claude Code Success Indicator */}
                      {isClaudeCodeInitTask(story) &&
                        story.status === 'DONE' && (
                          <div className="mt-3 pt-3 border-t border-primary-600">
                            <div className="flex items-center gap-2 text-xs text-green-400">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              <span>Claude Code /init 已完成</span>
                            </div>
                          </div>
                        )}
                    </div>
                  ))}

                  {/* Empty State */}
                  {columnStories.length === 0 && (
                    <div className="text-center py-8 text-primary-400">
                      <p className="text-sm">無 Stories</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Card Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-primary-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-accent-50">
                新增 Story
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-primary-400 hover:text-accent-50"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-accent-50 mb-1">
                  標題 *
                </label>
                <input
                  type="text"
                  value={createCardData.title}
                  onChange={e =>
                    setCreateCardData(prev => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-primary-700 border border-primary-600 rounded-md text-accent-50 focus:outline-none focus:border-accent-500"
                  placeholder="輸入 Story 標題"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-accent-50 mb-1">
                  描述
                </label>
                <textarea
                  value={createCardData.description}
                  onChange={e =>
                    setCreateCardData(prev => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-primary-700 border border-primary-600 rounded-md text-accent-50 focus:outline-none focus:border-accent-500"
                  placeholder="描述這個 Story 的內容"
                  rows={3}
                />
              </div>

              {/* TDD Toggle - Most Important */}
              <div className="bg-primary-700 rounded-lg p-4 border-2 border-dashed border-primary-600">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-accent-50 mb-1">
                      Story 類型
                    </label>
                    <p className="text-xs text-primary-300">
                      {createCardData.tddEnabled
                        ? '程式實作任務 - 需要 TDD 開發週期'
                        : '文件/分析任務 - 不需要程式實作'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setCreateCardData(prev => ({
                          ...prev,
                          tddEnabled: false,
                        }))
                      }
                      className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 ${
                        !createCardData.tddEnabled
                          ? 'bg-blue-600 text-blue-100 border border-blue-500'
                          : 'bg-primary-600 text-primary-300 border border-primary-500'
                      }`}
                    >
                      <svg
                        className="w-3 h-3"
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
                      文件
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCreateCardData(prev => ({
                          ...prev,
                          tddEnabled: true,
                        }))
                      }
                      className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 ${
                        createCardData.tddEnabled
                          ? 'bg-green-600 text-green-100 border border-green-500'
                          : 'bg-primary-600 text-primary-300 border border-primary-500'
                      }`}
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                        />
                      </svg>
                      程式
                    </button>
                  </div>
                </div>
              </div>

              {/* Priority & Story Points */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-accent-50 mb-1">
                    優先級
                  </label>
                  <select
                    value={createCardData.priority}
                    onChange={e =>
                      setCreateCardData(prev => ({
                        ...prev,
                        priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH',
                      }))
                    }
                    className="w-full px-3 py-2 bg-primary-700 border border-primary-600 rounded-md text-accent-50 focus:outline-none focus:border-accent-500"
                  >
                    <option value="LOW">低</option>
                    <option value="MEDIUM">中</option>
                    <option value="HIGH">高</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-accent-50 mb-1">
                    Story Points
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={createCardData.storyPoints}
                    onChange={e =>
                      setCreateCardData(prev => ({
                        ...prev,
                        storyPoints: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 bg-primary-700 border border-primary-600 rounded-md text-accent-50 focus:outline-none focus:border-accent-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Acceptance Criteria (only for TDD stories) */}
              {createCardData.tddEnabled && (
                <div>
                  <label className="block text-sm font-medium text-accent-50 mb-1">
                    驗收標準
                  </label>
                  <textarea
                    value={createCardData.acceptanceCriteria}
                    onChange={e =>
                      setCreateCardData(prev => ({
                        ...prev,
                        acceptanceCriteria: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-primary-700 border border-primary-600 rounded-md text-accent-50 focus:outline-none focus:border-accent-500"
                    placeholder="定義完成的標準..."
                    rows={2}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-primary-300 hover:text-accent-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={createCard}
                disabled={loading || !createCardData.title.trim()}
                className="px-4 py-2 bg-accent-600 text-accent-50 rounded-md hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-50"></div>
                    建立中...
                  </>
                ) : (
                  <>
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
                    建立 Story
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
