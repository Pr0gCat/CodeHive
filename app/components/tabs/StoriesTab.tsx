'use client';

import { useState, useEffect } from 'react';
import { BarChart3, CheckCircle, Clock, Play, Target } from 'lucide-react';

interface Story {
  id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  tasksCount: number;
  completedTasksCount: number;
  acceptanceCriteria: string[];
  epicTitle: string;
}

interface StoriesTabProps {
  projectId: string;
}

export function StoriesTab({ projectId }: StoriesTabProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for now
    setTimeout(() => {
      setStories([]);
      setLoading(false);
    }, 1000);
  }, [projectId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-gray-100 text-gray-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'TESTING': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4" />;
      case 'IN_PROGRESS': return <Play className="h-4 w-4" />;
      case 'TESTING': return <Target className="h-4 w-4" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Stories Yet</h3>
        <p className="text-gray-600 mb-4">
          Stories will appear here when you create Epics in the Overview tab.
        </p>
        <p className="text-sm text-gray-500">
          Each Epic gets broken down into multiple user-facing Stories automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stories Overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Stories Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-600">
              {stories.filter(s => s.status === 'PENDING').length}
            </div>
            <div className="text-sm text-gray-800">Pending</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">
              {stories.filter(s => s.status === 'IN_PROGRESS').length}
            </div>
            <div className="text-sm text-blue-800">In Progress</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {stories.filter(s => s.status === 'TESTING').length}
            </div>
            <div className="text-sm text-yellow-800">Testing</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">
              {stories.filter(s => s.status === 'COMPLETED').length}
            </div>
            <div className="text-sm text-green-800">Completed</div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Story Board</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {['PENDING', 'IN_PROGRESS', 'TESTING', 'COMPLETED'].map((status) => (
            <div key={status} className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">{status.replace('_', ' ')}</h4>
              <div className="space-y-3">
                {stories
                  .filter(story => story.status === status)
                  .map((story) => (
                    <div key={story.id} className="bg-white border border-gray-200 rounded-lg p-3">
                      <h5 className="font-medium text-gray-900 text-sm mb-1">{story.title}</h5>
                      <p className="text-xs text-gray-600 mb-2">{story.epicTitle}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{story.tasksCount} tasks</span>
                        <div className="text-xs text-gray-900">{Math.round(story.progress * 100)}%</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}