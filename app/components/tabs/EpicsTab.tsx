'use client';

import { useState, useEffect } from 'react';
import { FileText, Clock, CheckCircle, Target, ArrowRight } from 'lucide-react';

interface Epic {
  id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  storiesCount: number;
  completedStoriesCount: number;
  estimatedCycles: number;
  completedCycles: number;
  createdAt: string;
}

interface EpicsTabProps {
  projectId: string;
}

export function EpicsTab({ projectId }: EpicsTabProps) {
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEpics();
  }, [projectId]);

  const fetchEpics = async () => {
    try {
      // This would fetch from a proper epics API endpoint
      const response = await fetch(`/api/progress/overview?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        // Transform the data to match Epic interface
        const transformedEpics = data.epics?.map((epic: any) => ({
          id: epic.id,
          title: epic.title,
          description: epic.description || 'No description available',
          status: epic.status || 'PLANNING',
          progress: epic.progress || 0,
          storiesCount: 0, // TODO: Get from actual data
          completedStoriesCount: 0,
          estimatedCycles: 0,
          completedCycles: 0,
          createdAt: new Date().toISOString(),
        })) || [];
        setEpics(transformedEpics);
      }
    } catch (error) {
      console.error('Error fetching epics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNING': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'BLOCKED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PLANNING': return <Clock className="h-4 w-4" />;
      case 'IN_PROGRESS': return <Target className="h-4 w-4" />;
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

  if (epics.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Epics Yet</h3>
        <p className="text-gray-600 mb-4">
          Start by describing what you want to build in the Overview tab.
        </p>
        <p className="text-sm text-gray-500">
          The Project Manager agent will automatically break your request into Epics and Stories.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Epics Overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Epic Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">
              {epics.filter(e => e.status === 'PLANNING').length}
            </div>
            <div className="text-sm text-blue-800">Planning</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {epics.filter(e => e.status === 'IN_PROGRESS').length}
            </div>
            <div className="text-sm text-yellow-800">In Progress</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">
              {epics.filter(e => e.status === 'COMPLETED').length}
            </div>
            <div className="text-sm text-green-800">Completed</div>
          </div>
        </div>
      </div>

      {/* Epic List */}
      <div className="space-y-4">
        {epics.map((epic) => (
          <div key={epic.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-lg font-medium text-gray-900">{epic.title}</h4>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(epic.status)}`}>
                    {getStatusIcon(epic.status)}
                    <span className="ml-1">{epic.status}</span>
                  </span>
                </div>
                <p className="text-gray-600 mb-3">{epic.description}</p>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            {/* Progress Bar */}
            {epic.status !== 'PLANNING' && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium text-gray-900">{Math.round(epic.progress * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${epic.progress * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Epic Stats */}
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <span>{epic.storiesCount} stories</span>
              <span>{epic.estimatedCycles} estimated cycles</span>
              <span>Created {new Date(epic.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}