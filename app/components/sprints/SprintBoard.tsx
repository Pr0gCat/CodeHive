'use client';

import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { MoreVertical, Target } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Story {
  id: string;
  title: string;
  description: string | null;
  status: string;
  storyPoints: number | null;
  priority: string;
  epic: {
    id: string;
    title: string;
    type: string;
  } | null;
}

interface SprintBoardProps {
  sprintId: string;
  stories: Story[];
  onStoryUpdate: (storyId: string, status: string) => void;
}

const columns = [
  { id: 'TODO', title: '待辦', color: 'bg-gray-100' },
  { id: 'IN_PROGRESS', title: '進行中', color: 'bg-blue-100' },
  { id: 'REVIEW', title: '審查中', color: 'bg-yellow-100' },
  { id: 'DONE', title: '完成', color: 'bg-green-100' },
];

export function SprintBoard({ sprintId, stories, onStoryUpdate }: SprintBoardProps) {
  const [storyColumns, setStoryColumns] = useState<Record<string, Story[]>>({});

  useEffect(() => {
    const grouped = stories.reduce((acc, story) => {
      const status = story.status;
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(story);
      return acc;
    }, {} as Record<string, Story[]>);

    // Ensure all columns exist
    columns.forEach((col) => {
      if (!grouped[col.id]) {
        grouped[col.id] = [];
      }
    });

    setStoryColumns(grouped);
  }, [stories]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId) {
      // Reorder within the same column
      const column = Array.from(storyColumns[source.droppableId]);
      const [removed] = column.splice(source.index, 1);
      column.splice(destination.index, 0, removed);

      setStoryColumns({
        ...storyColumns,
        [source.droppableId]: column,
      });
    } else {
      // Move between columns
      const sourceColumn = Array.from(storyColumns[source.droppableId]);
      const destColumn = Array.from(storyColumns[destination.droppableId]);
      const [removed] = sourceColumn.splice(source.index, 1);
      destColumn.splice(destination.index, 0, removed);

      setStoryColumns({
        ...storyColumns,
        [source.droppableId]: sourceColumn,
        [destination.droppableId]: destColumn,
      });

      // Update story status
      onStoryUpdate(draggableId, destination.droppableId);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'border-red-500';
      case 'MEDIUM':
        return 'border-yellow-500';
      case 'LOW':
        return 'border-green-500';
      default:
        return 'border-gray-300';
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {columns.map((column) => (
          <div key={column.id} className="flex flex-col">
            <div className={`${column.color} rounded-t-lg px-4 py-2`}>
              <h3 className="font-medium text-gray-900">{column.title}</h3>
              <p className="text-sm text-gray-600">
                {storyColumns[column.id]?.length || 0} 個項目
              </p>
            </div>

            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 bg-gray-50 p-2 min-h-[400px] ${
                    snapshot.isDraggingOver ? 'bg-gray-100' : ''
                  }`}
                >
                  {storyColumns[column.id]?.map((story, index) => (
                    <Draggable
                      key={story.id}
                      draggableId={story.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`bg-white rounded-lg shadow-sm p-3 mb-2 border-l-4 ${getPriorityColor(
                            story.priority
                          )} ${
                            snapshot.isDragging ? 'shadow-lg rotate-3' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-900">
                                {story.title}
                              </h4>
                              {story.description && (
                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                  {story.description}
                                </p>
                              )}
                              {story.epic && (
                                <div className="mt-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    {story.epic.title}
                                  </span>
                                </div>
                              )}
                              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                                {story.storyPoints && (
                                  <div className="flex items-center gap-1">
                                    <Target className="h-3 w-3" />
                                    <span>{story.storyPoints} 點</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <button className="text-gray-400 hover:text-gray-600">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}