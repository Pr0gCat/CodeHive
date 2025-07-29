'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Project, KanbanCard, ProjectSettings } from '@/lib/db';
import KanbanBoard from '../../components/KanbanBoard';
import AgentStatusPanel from '../../components/AgentStatusPanel';
import ProjectSettingsModal from '../../components/ProjectSettingsModal';
import ProjectLogsModal from '../../components/ProjectLogsModal';
import { addInitialProjectLogs } from '@/lib/logging/init-logs';
import { logProjectEvent } from '@/lib/logging/project-logger';

interface ProjectPageProps {
  params: { id: string };
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const [project, setProject] = useState<Project & { kanbanCards: KanbanCard[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);
  const [agentStatus, setAgentStatus] = useState<string>('unknown');

  const fetchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${params.id}`);
      const data = await response.json();
      
      if (data.success) {
        setProject(data.data);
        // Add initial project logs for demonstration
        addInitialProjectLogs(data.data.id, data.data.name);
      } else {
        setError(data.error || 'Failed to fetch project');
      }
    } catch {
      setError('Failed to fetch project');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchAgentStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/agents/queue');
      const data = await response.json();
      
      if (data.success) {
        setAgentStatus(data.data.status.toLowerCase());
      }
    } catch {
      // Silently fail for agent status updates
    }
  }, []);

  useEffect(() => {
    fetchProject();
    fetchAgentStatus();
    
    // Update agent status every 5 seconds
    const interval = setInterval(fetchAgentStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchProject, fetchAgentStatus]);

  const handleCardUpdate = async (cardId: string, updates: Partial<KanbanCard>) => {
    const response = await fetch(`/api/cards/${cardId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to update card');
    }

    // Refresh project data
    await fetchProject();
  };

  const handleCardCreate = async (cardData: Omit<KanbanCard, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) => {
    const response = await fetch(`/api/projects/${params.id}/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cardData),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to create card');
    }

    // Refresh project data
    await fetchProject();
  };

  const handleCardDelete = async (cardId: string) => {
    const response = await fetch(`/api/cards/${cardId}`, {
      method: 'DELETE',
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete card');
    }

    // Refresh project data
    await fetchProject();
  };

  const handleProjectReview = async () => {
    if (!project) return;
    
    setReviewLoading(true);
    
    // Log the start of project review
    logProjectEvent.agentTaskStarted(project.id, 'project-manager', 'review-task', 'Comprehensive project analysis and CLAUDE.md generation');
    
    try {
      const response = await fetch('/api/agents/project-manager', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          action: 'review',
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Log successful completion
        logProjectEvent.agentTaskCompleted(project.id, 'project-manager', 'review-task', 2500);
        
        // Show success message and optionally refresh project data
        alert(`Project review completed successfully!\n\nCLAUDE.md has been ${data.data.result.artifacts?.claudeMdPath ? 'created' : 'generated'}.`);
        await fetchProject();
      } else {
        // Log failure
        logProjectEvent.agentTaskFailed(project.id, 'project-manager', 'review-task', data.error || 'Unknown error');
        alert(`Project review failed: ${data.error}`);
      }
    } catch (error) {
      // Log error
      logProjectEvent.agentTaskFailed(project.id, 'project-manager', 'review-task', error instanceof Error ? error.message : 'Network error');
      console.error('Project review error:', error);
      alert('Failed to complete project review. Please try again.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSettingsUpdate = (settings: ProjectSettings) => {
    setProjectSettings(settings);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-accent-100 text-accent-800';
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-blue-100 text-blue-800';
      case 'ARCHIVED': return 'bg-primary-900 text-primary-200';
      default: return 'bg-primary-900 text-primary-200';
    }
  };

  const getAgentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-lime-900 text-lime-300 border border-lime-700';
      case 'paused': return 'bg-yellow-900 text-yellow-300 border border-yellow-700';
      default: return 'bg-primary-900 text-primary-400 border border-primary-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-primary-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-600 font-medium">{error || 'Project not found'}</p>
          <Link
            href="/projects"
            className="mt-4 inline-block px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-950">
      {/* Header */}
      <div className="bg-primary-900 border-b border-primary-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/projects"
                className="text-primary-300 hover:text-accent-50"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-accent-50">{project.name}</h1>
                {project.summary && (
                  <p className="text-primary-200 mt-1 text-sm font-medium">{project.summary}</p>
                )}
                {project.description && (
                  <p className="text-primary-300 mt-1 text-sm">{project.description}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleProjectReview}
                disabled={reviewLoading}
                className="px-4 py-2 text-sm font-medium text-accent-50 bg-accent-600 rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {reviewLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-50"></div>
                    <span>Reviewing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Review Project</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setLogsModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-primary-300 border border-primary-600 rounded-lg hover:bg-primary-800 hover:text-accent-50 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-6 8h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z" />
                </svg>
                <span>Logs</span>
              </button>
              <button
                onClick={() => setSettingsModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-primary-300 border border-primary-600 rounded-lg hover:bg-primary-800 hover:text-accent-50 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Settings</span>
              </button>
              <div className="text-sm text-primary-400">
                Last updated {new Date(project.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          {project.localPath && (
            <div className="mt-3 pt-3 border-t border-primary-700">
              <p className="text-sm text-primary-400 font-mono">
                <span className="font-medium">Path:</span> {project.localPath}
              </p>
              {project.gitUrl && (
                <p className="text-sm text-primary-400 mt-1">
                  <span className="font-medium">Repository:</span>{' '}
                  <a 
                    href={project.gitUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-accent-500 hover:text-accent-400"
                  >
                    {project.gitUrl}
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex h-[calc(100vh-120px)]">
        {/* Agent Status Panel */}
        <div className="w-80 p-4 bg-primary-950 border-r border-primary-800 h-full">
          <AgentStatusPanel projectId={project.id} />
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden">
          <KanbanBoard
            projectId={project.id}
            cards={project.kanbanCards}
            onCardUpdate={handleCardUpdate}
            onCardCreate={handleCardCreate}
            onCardDelete={handleCardDelete}
          />
        </div>
      </div>

      {/* Project Settings Modal */}
      <ProjectSettingsModal
        projectId={project.id}
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        onSettingsUpdate={handleSettingsUpdate}
      />

      {/* Project Logs Modal */}
      <ProjectLogsModal
        projectId={project.id}
        isOpen={logsModalOpen}
        onClose={() => setLogsModalOpen(false)}
      />
    </div>
  );
}