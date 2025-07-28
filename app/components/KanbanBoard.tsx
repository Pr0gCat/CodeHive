'use client';

import { useState, useEffect } from 'react';
import { KanbanCard, CardStatus } from '@/lib/db';
import KanbanColumn from './KanbanColumn';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
  projectId: string;
  cards: KanbanCard[];
  onCardUpdate?: (cardId: string, updates: Partial<KanbanCard>) => void;
  onCardCreate?: (cardData: Omit<KanbanCard, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) => void;
  onCardDelete?: (cardId: string) => void;
}

const COLUMNS = [
  { id: CardStatus.BACKLOG, title: 'Backlog', color: 'bg-transparent border-2 border-slate-400/60 shadow-lg shadow-slate-500/20' },
  { id: CardStatus.TODO, title: 'To Do', color: 'bg-transparent border-2 border-cyan-400/70 shadow-lg shadow-cyan-500/30' },
  { id: CardStatus.IN_PROGRESS, title: 'In Progress', color: 'bg-transparent border-2 border-amber-400/70 shadow-lg shadow-amber-500/30' },
  { id: CardStatus.REVIEW, title: 'Review', color: 'bg-transparent border-2 border-violet-400/70 shadow-lg shadow-violet-500/30' },
  { id: CardStatus.DONE, title: 'Done', color: 'bg-transparent border-2 border-emerald-400/70 shadow-lg shadow-emerald-500/30' },
];

export default function KanbanBoard({ 
  projectId,
  cards, 
  onCardUpdate, 
  onCardCreate, 
  onCardDelete 
}: KanbanBoardProps) {
  const [localCards, setLocalCards] = useState<KanbanCard[]>(cards);

  useEffect(() => {
    setLocalCards(cards);
  }, [cards]);

  const getCardsByStatus = (status: string) => {
    return localCards.filter(card => card.status === status);
  };

  const handleCardMove = async (cardId: string, newStatus: string) => {
    const card = localCards.find(c => c.id === cardId);
    if (!card || card.status === newStatus) return;

    // Optimistic update
    setLocalCards(prev => 
      prev.map(c => 
        c.id === cardId 
          ? { ...c, status: newStatus }
          : c
      )
    );

    // Call parent update handler
    if (onCardUpdate) {
      try {
        await onCardUpdate(cardId, { status: newStatus });
      } catch (error) {
        // Revert on error
        setLocalCards(prev => 
          prev.map(c => 
            c.id === cardId 
              ? { ...c, status: card.status }
              : c
          )
        );
        console.error('Failed to update card:', error);
      }
    }
  };

  const handleCardUpdate = async (cardId: string, updates: Partial<KanbanCard>) => {
    // Optimistic update
    setLocalCards(prev => 
      prev.map(c => 
        c.id === cardId 
          ? { ...c, ...updates }
          : c
      )
    );

    if (onCardUpdate) {
      try {
        await onCardUpdate(cardId, updates);
      } catch (error) {
        // Revert on error
        setLocalCards(cards);
        console.error('Failed to update card:', error);
      }
    }
  };

  const handleCardDelete = async (cardId: string) => {
    if (onCardDelete) {
      try {
        await onCardDelete(cardId);
        setLocalCards(prev => prev.filter(c => c.id !== cardId));
      } catch (error) {
        console.error('Failed to delete card:', error);
      }
    }
  };

  return (
    <div 
      className="h-full bg-primary-950 overflow-x-auto scrollbar-thin-horizontal" 
      style={{ 
        scrollbarColor: 'rgb(75, 85, 99) rgb(31, 41, 55)' // For Firefox
      }}
    >
      <div className="flex gap-6 p-6 h-full" style={{ minWidth: 'max-content' }}>
        {COLUMNS.map(column => (
          <KanbanColumn
            key={column.id}
            title={column.title}
            status={column.id}
            cards={getCardsByStatus(column.id)}
            className={cn('w-80 flex-shrink-0', column.color)}
            projectId={projectId}
            onCardMove={handleCardMove}
            onCardUpdate={handleCardUpdate}
            onCardDelete={handleCardDelete}
            onCardCreate={onCardCreate}
          />
        ))}
      </div>
    </div>
  );
}