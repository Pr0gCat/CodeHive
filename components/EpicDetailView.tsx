'use client';

import { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, Target, PlayCircle, User } from 'lucide-react';

interface Story {
  id: string;
  title: string;
  description: string;
  status: string;
  storyPoints: number;
  priority: string;
  acceptanceCriteria: string[];
  assignedAgent?: string;
}

interface Epic {
  id: string;
  title: string;
  description: string;
  status: string;
  type: string;
  mvpPriority: string;
  estimatedStoryPoints: number;
  actualStoryPoints: number;
  createdAt: string;
  stories: Story[];
}

interface EpicDetailViewProps {
  epicId: string;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EpicDetailView({ epicId, projectId, isOpen, onClose }: EpicDetailViewProps) {
  const [epic, setEpic] = useState<Epic | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && epicId) {
      fetchEpicDetails();
    }
  }, [isOpen, epicId, projectId]);

  const fetchEpicDetails = async () => {
    setLoading(true);
    try {
      // Fetch epic details with stories
      const response = await fetch(`/api/projects/${projectId}/overview`);
      if (response.ok) {
        const data = await response.json();
        const epicData = data.epics?.find((e: any) => e.id === epicId);
        
        if (epicData) {
          const transformedEpic: Epic = {
            id: epicData.id,
            title: epicData.title,
            description: epicData.description || 'No description available',
            status: epicData.status || 'PLANNING',
            type: epicData.type || 'FEATURE',
            mvpPriority: epicData.mvpPriority || 'MEDIUM',
            estimatedStoryPoints: epicData.estimatedStoryPoints || 0,
            actualStoryPoints: epicData.actualStoryPoints || 0,
            createdAt: epicData.createdAt || new Date().toISOString(),
            stories: epicData.stories?.map((story: any) => ({
              id: story.id,
              title: story.title,
              description: story.description || '',
              status: story.status || 'BACKLOG',
              storyPoints: story.storyPoints || 0,
              priority: story.priority || 'MEDIUM',
              acceptanceCriteria: story.acceptanceCriteria 
                ? JSON.parse(story.acceptanceCriteria)
                : [],
              assignedAgent: story.assignedAgent,
            })) || [],
          };
          setEpic(transformedEpic);
        }
      }
    } catch (error) {
      console.error('Error fetching epic details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'BACKLOG':
        return 'bg-gray-100 text-gray-800';
      case 'TODO':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
      case 'REVIEW':
        return 'bg-purple-100 text-purple-800';
      case 'DONE':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'BACKLOG':
        return <Clock className="h-4 w-4" />;
      case 'TODO':
        return <PlayCircle className="h-4 w-4" />;
      case 'IN_PROGRESS':
        return <Target className="h-4 w-4" />;
      case 'REVIEW':
        return <User className="h-4 w-4" />;
      case 'DONE':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'text-red-600 bg-red-50';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50';
      case 'LOW':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">
                {epic?.title || 'Loading...'}
              </h2>
              {epic && (
                <div className="flex items-center gap-4 text-indigo-100">
                  <span className="text-sm">
                    {epic.stories.length} stories
                  </span>
                  <span className="text-sm">
                    {epic.estimatedStoryPoints} story points
                  </span>
                  <span className="text-sm">
                    Created {new Date(epic.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-indigo-200 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : epic ? (
            <div className="space-y-6">
              {/* Epic Description */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Description
                </h3>
                <p className="text-gray-600">{epic.description}</p>
              </div>

              {/* Epic Status */}
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">Status:</span>
                  <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(epic.status)}`}>
                    {epic.status}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Priority:</span>
                  <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(epic.mvpPriority)}`}>
                    {epic.mvpPriority}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Type:</span>
                  <span className="ml-2 text-sm text-gray-700">{epic.type}</span>
                </div>
              </div>

              {/* Stories List */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Stories ({epic.stories.length})
                </h3>
                
                {epic.stories.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No stories found for this epic.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {epic.stories.map((story) => (
                      <div
                        key={story.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 mb-1">
                              {story.title}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {story.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(story.status)}`}>
                              {getStatusIcon(story.status)}
                              <span className="ml-1">{story.status}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center gap-4">
                            <span>{story.storyPoints} points</span>
                            <span className={`px-2 py-1 rounded ${getPriorityColor(story.priority)}`}>
                              {story.priority} priority
                            </span>
                            {story.assignedAgent && (
                              <span>Assigned: {story.assignedAgent}</span>
                            )}
                          </div>
                        </div>

                        {/* Acceptance Criteria */}
                        {story.acceptanceCriteria.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="text-sm font-medium text-gray-700 mb-2">
                              Acceptance Criteria:
                            </div>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {story.acceptanceCriteria.map((criteria, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-gray-400 mr-2">•</span>
                                  {criteria}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Epic not found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}