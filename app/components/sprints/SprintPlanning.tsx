'use client';

import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { AlertTriangle, ChevronDown, ChevronRight, Target } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface Story {
  id: string;
  title: string;
  description: string | null;
  storyPoints: number | null;
  priority: string;
  epic: {
    id: string;
    title: string;
    type: string;
    mvpPriority: string;
  } | null;
}

interface Epic {
  id: string;
  title: string;
  type: string;
  mvpPriority: string;
  status: string;
  stories: Array<{
    id: string;
    title: string;
    storyPoints: number | null;
    priority: string;
  }>;
}

interface Sprint {
  id: string;
  name: string;
  status: string;
  plannedStoryPoints: number;
  commitedStoryPoints: number;
  stories: Story[];
}

interface SprintPlanningProps {
  projectId: string;
  sprint: Sprint;
  onUpdate: () => void;
}

export function SprintPlanning({ projectId, sprint, onUpdate }: SprintPlanningProps) {
  const [backlogStories, setBacklogStories] = useState<Story[]>([]);
  const [backlogEpics, setBacklogEpics] = useState<Epic[]>([]);
  const [sprintStories, setSprintStories] = useState<Story[]>(sprint.stories);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());

  const fetchBacklog = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/backlog`);
      if (response.ok) {
        const data = await response.json();
        setBacklogStories(data.stories);
        setBacklogEpics(data.epics);
      }
    } catch (error) {
      console.error('Error fetching backlog:', error);
    }
  }, [projectId]);

  useEffect(() => {
    fetchBacklog();
  }, [fetchBacklog]);

  useEffect(() => {
    setSprintStories(sprint.stories);
  }, [sprint.stories]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // Moving from backlog to sprint
    if (source.droppableId === 'backlog' && destination.droppableId === 'sprint') {
      const story = backlogStories.find(s => s.id === draggableId);
      if (!story) return;

      // Update local state
      setBacklogStories(prev => prev.filter(s => s.id !== draggableId));
      setSprintStories(prev => [...prev, story]);

      // Update server
      await addStoriesToSprint([story.id]);
    }
    // Moving from sprint to backlog
    else if (source.droppableId === 'sprint' && destination.droppableId === 'backlog') {
      const story = sprintStories.find(s => s.id === draggableId);
      if (!story) return;

      // Update local state
      setSprintStories(prev => prev.filter(s => s.id !== draggableId));
      setBacklogStories(prev => [...prev, story]);

      // Update server
      await removeStoriesFromSprint([story.id]);
    }
  };

  const addStoriesToSprint = async (storyIds: string[]) => {
    try {
      const response = await fetch(`/api/sprints/${sprint.id}/stories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storyIds }),
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error adding stories to sprint:', error);
    }
  };

  const removeStoriesFromSprint = async (storyIds: string[]) => {
    try {
      const response = await fetch(`/api/sprints/${sprint.id}/stories`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storyIds }),
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error removing stories from sprint:', error);
    }
  };

  const toggleEpicExpansion = (epicId: string) => {
    const newExpanded = new Set(expandedEpics);
    if (newExpanded.has(epicId)) {
      newExpanded.delete(epicId);
    } else {
      newExpanded.add(epicId);
    }
    setExpandedEpics(newExpanded);
  };

  const calculateSprintCapacity = () => {
    const committed = sprintStories.reduce((sum, story) => sum + (story.storyPoints || 0), 0);
    const utilizationPercentage = sprint.plannedStoryPoints > 0
      ? Math.round((committed / sprint.plannedStoryPoints) * 100)
      : 0;

    return { committed, utilizationPercentage };
  };

  const { committed, utilizationPercentage } = calculateSprintCapacity();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'border-red-500 bg-red-900/20';
      case 'MEDIUM':
        return 'border-yellow-500 bg-yellow-900/20';
      case 'LOW':
        return 'border-green-500 bg-green-900/20';
      default:
        return 'border-gray-500 bg-gray-900/20';
    }
  };

  if (sprint.status !== 'PLANNING') {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Sprint planning is only available in PLANNING status</p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backlog Column */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-medium text-gray-900">產品待辦清單</h3>
            <p className="text-sm text-gray-600 mt-1">
              Drag and drop stories to sprint for planning
            </p>
          </div>

          <Droppable droppableId="backlog">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`p-4 min-h-[500px] max-h-[600px] overflow-y-auto ${
                  snapshot.isDraggingOver ? 'bg-gray-50' : ''
                }`}
              >
                {/* Epic Groups */}
                {backlogEpics.map((epic) => (
                  <div key={epic.id} className="mb-4">
                    <button
                      onClick={() => toggleEpicExpansion(epic.id)}
                      className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        {expandedEpics.has(epic.id) ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900">
                          {epic.title}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({epic.stories.length} 故事)
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        epic.mvpPriority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                        epic.mvpPriority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                        epic.mvpPriority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {epic.mvpPriority}
                      </span>
                    </button>

                    {expandedEpics.has(epic.id) && (
                      <div className="ml-6 mt-2 space-y-2">
                        {backlogStories
                          .filter(story => story.epic?.id === epic.id)
                          .map((story, index) => (
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
                                  className={`p-3 bg-white rounded-lg border-l-4 ${getPriorityColor(
                                    story.priority
                                  )} ${
                                    snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'
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
                                    </div>
                                    {story.storyPoints && (
                                      <div className="flex items-center gap-1 ml-2">
                                        <Target className="h-3 w-3 text-gray-400" />
                                        <span className="text-sm font-medium text-gray-700">
                                          {story.storyPoints}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Standalone Stories */}
                {backlogStories.filter(s => !s.epic).length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      獨立故事
                    </h4>
                    <div className="space-y-2">
                      {backlogStories
                        .filter(story => !story.epic)
                        .map((story, index) => (
                          <Draggable
                            key={story.id}
                            draggableId={story.id}
                            index={backlogStories.length + index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-3 bg-white rounded-lg border-l-4 ${getPriorityColor(
                                  story.priority
                                )} ${
                                  snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'
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
                                  </div>
                                  {story.storyPoints && (
                                    <div className="flex items-center gap-1 ml-2">
                                      <Target className="h-3 w-3 text-gray-400" />
                                      <span className="text-sm font-medium text-gray-700">
                                        {story.storyPoints}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                    </div>
                  </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>

        {/* Sprint Column */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="font-medium text-gray-900">{sprint.name}</h3>
            <div className="mt-2">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">容量使用率</span>
                <span className="font-medium">
                  {committed} / {sprint.plannedStoryPoints} 點
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    utilizationPercentage > 100
                      ? 'bg-red-600'
                      : utilizationPercentage > 80
                      ? 'bg-yellow-600'
                      : 'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
                />
              </div>
              {utilizationPercentage > 100 && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  超出容量 {committed - sprint.plannedStoryPoints} 點
                </p>
              )}
            </div>
          </div>

          <Droppable droppableId="sprint">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`p-4 min-h-[500px] max-h-[600px] overflow-y-auto ${
                  snapshot.isDraggingOver ? 'bg-blue-50' : ''
                }`}
              >
                <div className="space-y-2">
                  {sprintStories.map((story, index) => (
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
                          className={`p-3 bg-white rounded-lg border-l-4 ${getPriorityColor(
                            story.priority
                          )} ${
                            snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-900">
                                {story.title}
                              </h4>
                              {story.epic && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {story.epic.title}
                                </p>
                              )}
                              {story.description && (
                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                  {story.description}
                                </p>
                              )}
                            </div>
                            {story.storyPoints && (
                              <div className="flex items-center gap-1 ml-2">
                                <Target className="h-3 w-3 text-gray-400" />
                                <span className="text-sm font-medium text-gray-700">
                                  {story.storyPoints}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                </div>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>
    </DragDropContext>
  );
}