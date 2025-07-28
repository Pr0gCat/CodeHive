'use client';

import { useState } from 'react';
import { KanbanCard } from '@/lib/db';
import { cn } from '@/lib/utils';
import AgentInvoker from './AgentInvoker';

interface KanbanCardProps {
  card: KanbanCard;
  onUpdate: (cardId: string, updates: Partial<KanbanCard>) => void;
  onDelete: (cardId: string) => void;
  projectId?: string;
}

export default function KanbanCardComponent({ card, onUpdate, onDelete, projectId }: KanbanCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDescription, setEditDescription] = useState(card.description || '');
  const [isDragging, setIsDragging] = useState(false);
  const [showAgentInvoker, setShowAgentInvoker] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
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
    if (window.confirm('Are you sure you want to delete this card?')) {
      try {
        await onDelete(card.id);
      } catch (error) {
        console.error('Failed to delete card:', error);
      }
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
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        'bg-primary-800 p-3 rounded-lg shadow-sm border-l-4 cursor-move transition-all duration-200 group hover:shadow-md',
        getStatusColor(card.status),
        isDragging && 'opacity-50 rotate-2'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-accent-50 text-sm leading-tight">
          {card.title}
        </h4>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {projectId && (
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
            onClick={handleDelete}
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
    </div>
  );
}