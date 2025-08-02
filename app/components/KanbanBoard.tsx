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
  { id: 'IN_PROGRESS', title: '進行中', color: 'bg-yellow-900 border-yellow-700' },
  { id: 'REVIEW', title: '審查中', color: 'bg-purple-900 border-purple-700' },
  { id: 'DONE', title: '已完成', color: 'bg-green-900 border-green-700' },
] as const;

export default function KanbanBoard({ projectId }: KanbanBoardProps) {
  const { showToast } = useToast();
  const [stories, setStories] = useState<Story[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchStories();
    fetchEpics();
  }, [projectId]);

  const fetchStories = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/cards`);
      const data = await response.json();
      if (data.success) {
        setStories(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stories:', error);
      showToast('無法載入 Stories', 'error');
    } finally {
      setLoading(false);
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
        showToast(`Story 已移至 ${KANBAN_COLUMNS.find(c => c.id === targetStatus)?.title}`, 'success');
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
      title.includes('claude code') && title.includes('/init') ||
      title.includes('initialize') && title.includes('claude') ||
      (Array.isArray(tags) ? tags : JSON.parse(tags || '[]')).includes('claude-code')
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEpicColor = (type: string) => {
    switch (type) {
      case 'MVP': return 'bg-purple-100 text-purple-800';
      case 'FEATURE': return 'bg-blue-100 text-blue-800';
      case 'ENHANCEMENT': return 'bg-green-100 text-green-800';
      case 'BUGFIX': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-accent-50">Story 看板</h2>
          <p className="text-primary-300 mt-1">拖拽 Stories 來更改狀態</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新增 Story
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-6 min-w-max pb-6">
          {KANBAN_COLUMNS.map((column) => {
            const columnStories = stories.filter(story => story.status === column.id);
            
            return (
              <div
                key={column.id}
                className={`flex-shrink-0 w-80 ${column.color} rounded-lg border`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {/* Column Header */}
                <div className="p-4 border-b border-primary-600">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-accent-50">{column.title}</h3>
                    <span className="px-2 py-1 bg-primary-700 text-primary-200 rounded-full text-sm">
                      {columnStories.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="p-4 space-y-3 min-h-[200px]">
                  {columnStories.map((story) => (
                    <div
                      key={story.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, story.id)}
                      className={`bg-primary-800 rounded-lg p-4 cursor-move hover:bg-primary-750 transition-colors ${
                        draggedItem === story.id ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Story Header */}
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-medium text-accent-50 text-sm leading-tight">
                          {story.title}
                        </h4>
                        <div className="flex items-center gap-1 ml-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getPriorityColor(story.priority)}`}>
                            {story.priority}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      {story.description && (
                        <p className="text-primary-300 text-xs mb-3 line-clamp-2">{story.description}</p>
                      )}

                      {/* Epic Badge */}
                      {story.epic && (
                        <div className="mb-3">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getEpicColor(story.epic.type)}`}>
                            {story.epic.title}
                          </span>
                        </div>
                      )}

                      {/* Story Points & TDD */}
                      <div className="flex items-center justify-between text-xs text-primary-400 mb-3">
                        <div className="flex items-center gap-3">
                          {story.storyPoints && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              {story.storyPoints}
                            </span>
                          )}
                          {story.tddEnabled && (
                            <span className="flex items-center gap-1 text-green-400">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              TDD
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cycles Progress */}
                      {story.cycles.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center gap-1 mb-1">
                            <svg className="w-3 h-3 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="text-xs text-primary-400">
                              {story.cycles.filter(c => c.status === 'COMPLETED').length}/{story.cycles.length} 週期
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {story.cycles.map((cycle, idx) => (
                              <div
                                key={cycle.id}
                                className={`w-2 h-2 rounded-full ${
                                  cycle.status === 'COMPLETED' ? 'bg-green-400' :
                                  cycle.status === 'ACTIVE' ? 'bg-yellow-400' :
                                  'bg-gray-600'
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
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>{story.assignedAgent}</span>
                        </div>
                      )}

                      {/* Task Count */}
                      {story._count.agentTasks > 0 && (
                        <div className="flex items-center gap-1 text-xs text-primary-400 mt-2">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span>{story._count.agentTasks} 個任務</span>
                        </div>
                      )}

                      {/* Claude Code Execute Button */}
                      {isClaudeCodeInitTask(story) && story.status === 'TODO' && (
                        <div className="mt-3 pt-3 border-t border-primary-600">
                          <button
                            onClick={(e) => {
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
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6 4h6" />
                                </svg>
                                執行 Claude Code /init
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Claude Code Status Indicator */}
                      {isClaudeCodeInitTask(story) && story.status === 'IN_PROGRESS' && (
                        <div className="mt-3 pt-3 border-t border-primary-600">
                          <div className="flex items-center gap-2 text-xs text-yellow-400">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-400"></div>
                            <span>Claude Code 執行中...</span>
                          </div>
                        </div>
                      )}

                      {/* Claude Code Success Indicator */}
                      {isClaudeCodeInitTask(story) && story.status === 'DONE' && (
                        <div className="mt-3 pt-3 border-t border-primary-600">
                          <div className="flex items-center gap-2 text-xs text-green-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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

      {/* Create Story Modal - TODO: Implement */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-primary-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-accent-50 mb-4">建立新 Story</h3>
            <p className="text-primary-300 mb-4">Story 建立功能開發中...</p>
            <button 
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 bg-primary-600 text-primary-200 rounded-lg hover:bg-primary-700"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}