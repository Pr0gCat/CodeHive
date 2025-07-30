'use client';

import { useState } from 'react';
import { KanbanCard } from '@/lib/db';
import KanbanCardComponent from './KanbanCard';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  title: string;
  status: string;
  cards: KanbanCard[];
  className?: string;
  projectId?: string;
  onCardMove: (cardId: string, newStatus: string) => void;
  onCardUpdate: (cardId: string, updates: Partial<KanbanCard>) => void;
  onCardDelete: (cardId: string) => void;
  onCardCreate?: (cardData: Omit<KanbanCard, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) => void;
}

export default function KanbanColumn({
  title,
  status,
  cards,
  className,
  projectId,
  onCardMove,
  onCardUpdate,
  onCardDelete,
  onCardCreate,
}: KanbanColumnProps) {
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDescription, setNewCardDescription] = useState('');
  const [newCardTargetBranch, setNewCardTargetBranch] = useState('');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    onCardMove(cardId, status);
  };

  const handleAddCard = async () => {
    if (!newCardTitle.trim() || !onCardCreate) return;

    try {
      await onCardCreate({
        title: newCardTitle.trim(),
        description: newCardDescription.trim() || null,
        status,
        position: cards.length,
        assignedAgent: null,
        targetBranch: newCardTargetBranch.trim() || null,
      });
      
      setNewCardTitle('');
      setNewCardDescription('');
      setNewCardTargetBranch('');
      setIsAddingCard(false);
    } catch (error) {
      console.error('Failed to create card:', error);
    }
  };

  const handleCancelAdd = () => {
    setIsAddingCard(false);
    setNewCardTitle('');
    setNewCardDescription('');
    setNewCardTargetBranch('');
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg p-4 h-full',
        className
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="font-semibold text-primary-200 text-lg">
          {title}
        </h3>
        <span className="bg-primary-800 text-primary-300 text-xs px-2 py-1 rounded-full">
          {cards.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-primary-600 scrollbar-track-primary-800">
        {cards.map((card) => (
          <KanbanCardComponent
            key={card.id}
            card={card}
            projectId={projectId}
            onUpdate={onCardUpdate}
            onDelete={onCardDelete}
          />
        ))}

        {isAddingCard ? (
          <div className="bg-primary-800 p-3 rounded-lg shadow-sm border-2 border-dashed border-primary-700">
            <input
              type="text"
              placeholder="Card title..."
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              className="w-full p-2 text-sm bg-primary-900 border border-primary-700 text-accent-50 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-primary-400"
              autoFocus
            />
            <textarea
              placeholder="Description (optional)..."
              value={newCardDescription}
              onChange={(e) => setNewCardDescription(e.target.value)}
              className="w-full p-2 text-sm bg-primary-900 border border-primary-700 text-accent-50 rounded mb-2 resize-none focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-primary-400"
              rows={3}
            />
            <input
              type="text"
              placeholder="Target branch (optional)..."
              value={newCardTargetBranch}
              onChange={(e) => setNewCardTargetBranch(e.target.value)}
              className="w-full p-2 text-sm bg-primary-900 border border-primary-700 text-accent-50 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-primary-400"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddCard}
                className="px-3 py-1 bg-accent-600 text-accent-50 text-sm rounded hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
              >
                Add Card
              </button>
              <button
                onClick={handleCancelAdd}
                className="px-3 py-1 bg-primary-700 text-primary-200 text-sm rounded hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingCard(true)}
            className="w-full p-3 text-primary-400 text-sm border-2 border-dashed border-primary-700 rounded-lg hover:border-primary-600 hover:text-primary-300 focus:outline-none focus:ring-2 focus:ring-accent-400"
          >
            + Add a card
          </button>
        )}
      </div>
    </div>
  );
}