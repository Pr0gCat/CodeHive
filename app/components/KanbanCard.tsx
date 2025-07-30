'use client';

import { KanbanCard } from '@/lib/db';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import AgentInvoker from './AgentInvoker';
import ConfirmDialog from './ui/ConfirmDialog';

interface EpicInfo {
  id: string;
  title: string;
  type: string;
  phase: string;
  mvpPriority: string;
}

interface ExtendedKanbanCard extends KanbanCard {
  epic?: EpicInfo;
  cycles?: Array<{
    id: string;
    title: string;
    phase: string;
    status: string;
  }>;
}

interface KanbanCardProps {
  card: ExtendedKanbanCard;
  onUpdate: (cardId: string, updates: Partial<KanbanCard>) => void;
  onDelete: (cardId: string) => void;
  projectId?: string;
}

interface PendingQuery {
  id: string;
  title: string;
  urgency: string;
  type: string;
}

export default function KanbanCardComponent({ card, onUpdate, onDelete, projectId }: KanbanCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDescription, setEditDescription] = useState(card.description || '');
  const [isDragging, setIsDragging] = useState(false);
  const [showAgentInvoker, setShowAgentInvoker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingQueries, setPendingQueries] = useState<PendingQuery[]>([]);
  const [isWaitingForQuery, setIsWaitingForQuery] = useState(false);

  // Check for pending queries for this card
  useEffect(() => {
    const checkPendingQueries = async () => {
      if (!projectId) return;
      
      try {
        const response = await fetch(`/api/projects/${projectId}/queries?status=PENDING&cardId=${card.id}`);
        const data = await response.json();
        
        if (data.success) {
          const queries = data.data.filter((query: any) => 
            query.context && JSON.parse(query.context).cardId === card.id
          );
          setPendingQueries(queries);
          setIsWaitingForQuery(queries.some((q: PendingQuery) => q.urgency === 'BLOCKING'));
        }
      } catch (error) {
        console.error('Failed to fetch pending queries:', error);
      }
    };

    checkPendingQueries();
    // Check every 30 seconds for updates
    const interval = setInterval(checkPendingQueries, 30000);
    return () => clearInterval(interval);
  }, [projectId, card.id]);

  const handleDragStart = (e: React.DragEvent) => {
    // Don't allow dragging if waiting for blocking queries
    if (isWaitingForQuery) {
      e.preventDefault();
      return;
    }
    
    e.dataTransfer.setData('text/plain', card.id);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditTitle(card.title);
    setEditDescription(card.description || '');
  };

  const handleSave = async () => {
    if (!editTitle.trim()) return;

    try {
      await onUpdate(card.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update card:', error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditTitle(card.title);
    setEditDescription(card.description || '');
  };

  const handleDelete = async () => {
    try {
      await onDelete(card.id);
    } catch (error) {
      console.error('Failed to delete card:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'BACKLOG': return 'border-l-gray-400';
      case 'TODO': return 'border-l-blue-400';
      case 'IN_PROGRESS': return 'border-l-yellow-400';
      case 'REVIEW': return 'border-l-purple-400';
      case 'DONE': return 'border-l-green-400';
      default: return 'border-l-gray-400';
    }
  };

  const getQueryUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'BLOCKING': return 'text-red-500 bg-red-900/20 border-red-500/30';
      case 'ADVISORY': return 'text-blue-500 bg-blue-900/20 border-blue-500/30';
      default: return 'text-gray-500 bg-gray-900/20 border-gray-500/30';
    }
  };

  const getQueryTypeLabel = (type: string) => {
    switch (type) {
      case 'ARCHITECTURE': return '架構';
      case 'BUSINESS_LOGIC': return '業務邏輯';
      case 'UI_UX': return '用戶界面';
      case 'INTEGRATION': return '集成';
      case 'CLARIFICATION': return '澄清';
      default: return type;
    }
  };

  const getEpicPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'FUTURE': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTDDPhaseColor = (phase: string) => {
    switch (phase) {
      case 'RED': return 'text-red-400 bg-red-900/20';
      case 'GREEN': return 'text-green-400 bg-green-900/20';
      case 'REFACTOR': return 'text-blue-400 bg-blue-900/20';
      case 'REVIEW': return 'text-purple-400 bg-purple-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  if (isEditing) {
    return (
      <div className="bg-primary-800 p-3 rounded-lg shadow-sm border border-primary-700">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full p-2 text-sm bg-primary-900 border border-primary-700 text-accent-50 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-primary-400"
          autoFocus
        />
        <textarea
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          placeholder="Description..."
          className="w-full p-2 text-sm bg-primary-900 border border-primary-700 text-accent-50 rounded mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-primary-400"
          rows={3}
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-accent-600 text-accent-50 text-sm rounded hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1 bg-primary-700 text-primary-200 text-sm rounded hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable={!isWaitingForQuery}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        'bg-primary-800 p-3 rounded-lg shadow-sm border-l-4 transition-all duration-200 group hover:shadow-md',
        getStatusColor(card.status),
        isDragging && 'opacity-50 rotate-2',
        isWaitingForQuery && 'opacity-75 cursor-not-allowed border-2 border-dashed border-yellow-500/50'
      )}
    >
      {/* Waiting for Query Indicator */}
      {isWaitingForQuery && (
        <div className="mb-3 p-2 bg-yellow-900/20 border border-yellow-500/30 rounded">
          <div className="flex items-center gap-2 mb-2">
            <div className="animate-pulse w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="text-yellow-400 text-xs font-medium">等待用戶查詢</span>
          </div>
          <div className="space-y-1">
            {pendingQueries.map((query) => (
              <div
                key={query.id}
                className={cn(
                  'text-xs px-2 py-1 rounded border',
                  getQueryUrgencyColor(query.urgency)
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{query.title}</span>
                  <span className="text-xs opacity-75">{getQueryTypeLabel(query.type)}</span>
                </div>
                <div className="text-xs opacity-75 mt-1">
                  {query.urgency === 'BLOCKING' ? '阻塞性查詢' : '建議性查詢'}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => window.open(`/projects/${projectId}?tab=queries`, '_blank')}
            className="mt-2 w-full px-2 py-1 bg-yellow-600/20 text-yellow-300 text-xs rounded hover:bg-yellow-600/30 transition-colors"
          >
            查看查詢詳情
          </button>
        </div>
      )}

      {/* Epic 關聯顯示 */}
      {card.epic && (
        <div className="mb-3 p-2 bg-primary-700/50 rounded border border-primary-600">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <svg className="w-3 h-3 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-xs font-medium text-accent-300">Epic</span>
            </div>
            <span className={`px-1.5 py-0.5 text-xs rounded border ${getEpicPriorityColor(card.epic.mvpPriority)}`}>
              {card.epic.mvpPriority}
            </span>
          </div>
          <div className="text-xs text-primary-200 truncate" title={card.epic.title}>
            {card.epic.title}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-primary-400">{card.epic.type}</span>
            <span className="text-xs text-primary-400">•</span>
            <span className="text-xs text-primary-400">{card.epic.phase}</span>
          </div>
        </div>
      )}

      {/* TDD 循環顯示 */}
      {card.tddEnabled && card.cycles && card.cycles.length > 0 && (
        <div className="mb-3 p-2 bg-primary-700/30 rounded border border-primary-600">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs font-medium text-blue-300">TDD 循環</span>
            <span className="text-xs text-primary-400">({card.cycles.length})</span>
          </div>
          <div className="space-y-1">
            {card.cycles.slice(0, 2).map((cycle) => (
              <div key={cycle.id} className="flex items-center justify-between">
                <span className="text-xs text-primary-200 truncate flex-1" title={cycle.title}>
                  {cycle.title}
                </span>
                <span className={`px-1.5 py-0.5 text-xs rounded ${getTDDPhaseColor(cycle.phase)}`}>
                  {cycle.phase}
                </span>
              </div>
            ))}
            {card.cycles.length > 2 && (
              <div className="text-xs text-primary-400 text-center">
                +{card.cycles.length - 2} 個循環
              </div>
            )}
          </div>
        </div>
      )}

      {/* Story Points 顯示 */}
      {card.storyPoints && (
        <div className="mb-2 flex items-center gap-2">
          <svg className="w-3 h-3 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs text-accent-300">{card.storyPoints} SP</span>
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-accent-50 text-sm leading-tight">
          {card.title}
        </h4>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {projectId && !isWaitingForQuery && (
            <button
              onClick={() => setShowAgentInvoker(true)}
              className="p-1 text-primary-400 hover:text-accent-600 focus:outline-none"
              title="Run agent"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          )}
          <button
            onClick={handleEdit}
            className="p-1 text-primary-400 hover:text-accent-500 focus:outline-none"
            title="Edit card"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1 text-primary-400 hover:text-red-600 focus:outline-none"
            title="Delete card"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {card.description && (
        <p className="text-primary-300 text-xs mb-3 leading-relaxed">
          {card.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-primary-400">
        <span className="bg-primary-900 text-primary-300 px-2 py-1 rounded">
          {card.status.replace('_', ' ')}
        </span>
        {card.assignedAgent && (
          <span className="text-accent-500 font-medium">
            {card.assignedAgent}
          </span>
        )}
      </div>

      {card.targetBranch && (
        <div className="mt-2 text-xs">
          <span className="text-primary-400">目標分支：</span>
          <span className="text-accent-400 font-mono bg-accent-900 px-2 py-1 rounded">
            {card.targetBranch}
          </span>
        </div>
      )}

      <div className="mt-2 text-xs text-primary-400">
        Updated {new Date(card.updatedAt).toLocaleDateString()}
      </div>

      {showAgentInvoker && projectId && (
        <AgentInvoker
          cardId={card.id}
          projectId={projectId}
          onClose={() => setShowAgentInvoker(false)}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="刪除卡片"
        message="您確定要刪除這張卡片嗎？此操作無法復原。"
        confirmText="刪除"
        cancelText="取消"
        type="danger"
      />
    </div>
  );
}