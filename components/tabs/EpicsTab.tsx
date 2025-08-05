'use client';

import { useState, useEffect } from 'react';
import { FileText, Clock, CheckCircle, Target, ArrowRight, Sparkles, AlertCircle, Bot } from 'lucide-react';
import { EpicDetailView } from '../EpicDetailView';

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
  const [generating, setGenerating] = useState(false);
  const [canGenerate, setCanGenerate] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null);
  const [coordinating, setCoordinating] = useState(false);
  const [coordinationResult, setCoordinationResult] = useState<string | null>(null);

  useEffect(() => {
    fetchEpics();
    checkGenerationAvailability();
  }, [projectId]);

  const fetchEpics = async () => {
    try {
      // Fetch epics from the projects API
      const response = await fetch(`/api/projects/${projectId}/overview`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Transform the data to match Epic interface
        const transformedEpics = data.epics?.map((epic: any) => {
          // Calculate progress based on story completion
          const totalStories = epic._count?.stories || 0;
          const completedStories = epic.stories?.filter((story: any) => story.status === 'DONE').length || 0;
          const progress = totalStories > 0 ? completedStories / totalStories : 0;
          
          return {
            id: epic.id,
            title: epic.title,
            description: epic.description || 'No description available',
            status: epic.status || 'PLANNING',
            progress,
            storiesCount: totalStories,
            completedStoriesCount: completedStories,
            estimatedCycles: epic.estimatedStoryPoints || 0,
            completedCycles: completedStories,
            createdAt: epic.createdAt || new Date().toISOString(),
          };
        }) || [];
        
        setEpics(transformedEpics);
      }
    } catch (error) {
      console.error('Error fetching epics:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkGenerationAvailability = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/epics/generate`);
      if (response.ok) {
        const data = await response.json();
        setCanGenerate(data.canGenerate);
      }
    } catch (error) {
      console.error('Error checking generation availability:', error);
      setCanGenerate(false);
    }
  };

  const generateEpics = async () => {
    if (generating) return;

    setGenerating(true);
    setGenerationError(null);

    try {
      console.log('🚀 Starting epic generation...');
      
      const response = await fetch(`/api/projects/${projectId}/epics/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate epics');
      }

      console.log('✅ Epic generation completed:', data);

      // Refresh the epics list
      await fetchEpics();
      
      // Update generation availability
      setCanGenerate(false);

      // Show success message or handle as needed
      alert(`Successfully generated ${data.data.epics.length} epics with ${data.data.totalStories} stories!`);
      
    } catch (error) {
      console.error('Epic generation failed:', error);
      setGenerationError(
        error instanceof Error ? error.message : 'Failed to generate epics'
      );
    } finally {
      setGenerating(false);
    }
  };

  const coordinateProject = async () => {
    if (coordinating) return;

    setCoordinating(true);
    setCoordinationResult(null);

    try {
      console.log('🎼 Starting autonomous project coordination...');
      
      const response = await fetch(`/api/projects/${projectId}/coordinate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to coordinate project');
      }

      console.log('✅ Project coordination completed:', data);

      // Refresh the epics list to show any changes
      await fetchEpics();
      
      const phase = data.meta?.currentPhase || 'Unknown';
      const activeAgents = data.meta?.activeAgents || [];
      
      setCoordinationResult(
        `Coordination complete! Phase: ${phase}. Active agents: ${activeAgents.join(', ') || 'None'}.`
      );

      // Clear result after a few seconds
      setTimeout(() => setCoordinationResult(null), 10000);
      
    } catch (error) {
      console.error('Project coordination failed:', error);
      setCoordinationResult(
        `Coordination failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Clear error after a few seconds  
      setTimeout(() => setCoordinationResult(null), 10000);
    } finally {
      setCoordinating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'BLOCKED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PLANNING':
        return <Clock className="h-4 w-4" />;
      case 'IN_PROGRESS':
        return <Target className="h-4 w-4" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
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
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Epics Yet
        </h3>
        
        {generating ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              <span className="text-gray-600">Analyzing project and generating epics...</span>
            </div>
            <p className="text-sm text-gray-500">
              This may take 2-3 minutes while the Project Manager analyzes your codebase.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {canGenerate && (
              <div className="space-y-4">
                <p className="text-gray-600 mb-4">
                  Let the Project Manager analyze your existing project and generate meaningful epics and stories.
                </p>
                <button
                  onClick={generateEpics}
                  disabled={generating}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate Project Epics
                </button>
                {generationError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-medium text-red-800">Generation Failed</h4>
                        <p className="text-sm text-red-700 mt-1">{generationError}</p>
                        <button
                          onClick={() => setGenerationError(null)}
                          className="text-sm text-red-600 hover:text-red-500 mt-2 underline"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="border-t pt-6">
              <p className="text-gray-600 mb-2">
                Or start by describing what you want to build in the Overview tab.
              </p>
              <p className="text-sm text-gray-500">
                The Project Manager agent will automatically break your request into
                Epics and Stories.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Epics Overview with Auto-Manage */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Epic Overview
          </h3>
          <button
            onClick={coordinateProject}
            disabled={coordinating}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Bot className="h-4 w-4 mr-2" />
            {coordinating ? 'Auto-Managing...' : 'Auto-Manage Project'}
          </button>
        </div>

        {/* Coordination Result */}
        {coordinationResult && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">{coordinationResult}</p>
          </div>
        )}
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
        {epics.map(epic => (
          <div
            key={epic.id}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-lg font-medium text-gray-900">
                    {epic.title}
                  </h4>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(epic.status)}`}
                  >
                    {getStatusIcon(epic.status)}
                    <span className="ml-1">{epic.status}</span>
                  </span>
                </div>
                <p className="text-gray-600 mb-3">{epic.description}</p>
              </div>
              <button 
                onClick={() => setSelectedEpicId(epic.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            {/* Progress Bar */}
            {epic.status !== 'PLANNING' && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium text-gray-900">
                    {Math.round(epic.progress * 100)}%
                  </span>
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
              <span>
                Created {new Date(epic.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Epic Detail Modal */}
      <EpicDetailView
        epicId={selectedEpicId || ''}
        projectId={projectId}
        isOpen={!!selectedEpicId}
        onClose={() => setSelectedEpicId(null)}
      />
    </div>
  );
}
