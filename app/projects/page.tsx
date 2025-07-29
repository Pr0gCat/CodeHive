'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Project, KanbanCard, CardStatus } from '@/lib/db';
import Navbar from '../components/Navbar';
import ProjectImportModal from '../components/ProjectImportModal';
import ProgressBar from '../components/ProgressBar';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>('unknown');

  const fetchAgentStatus = async () => {
    try {
      const response = await fetch('/api/agents/queue');
      const data = await response.json();
      
      if (data.success) {
        setAgentStatus(data.data.status.toLowerCase());
      }
    } catch {
      // Silently fail for agent status updates
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchAgentStatus();
    
    // Update agent status every 5 seconds
    const interval = setInterval(fetchAgentStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      
      if (data.success) {
        setProjects(data.data);
      } else {
        setError(data.error || 'Failed to fetch projects');
      }
    } catch {
      setError('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };


  const getAgentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-lime-900 text-lime-300 border border-lime-700';
      case 'paused': return 'bg-yellow-900 text-yellow-300 border border-yellow-700';
      default: return 'bg-primary-900 text-primary-400 border border-primary-800';
    }
  };

  const calculateProgress = (cards: KanbanCard[]) => {
    if (!cards || cards.length === 0) return { total: 0, completed: 0 };
    
    const total = cards.length;
    const completed = cards.filter(card => card.status === CardStatus.DONE).length;
    
    return { total, completed };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-primary-300">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-400 font-medium">{error}</p>
          <button
            onClick={fetchProjects}
            className="mt-4 px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-950">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-accent-50 mb-2">Projects</h1>
            <p className="text-primary-300">Manage your software development projects</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-primary-700 text-accent-50 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            >
              Import from Git
            </button>
            <Link
              href="/projects/new"
              className="px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
            >
              Create Project
            </Link>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-primary-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-accent-50 mb-2">No projects yet</h3>
            <p className="text-primary-300 mb-6">Get started by creating your first project</p>
            <Link
              href="/projects/new"
              className="inline-flex items-center px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700"
            >
              Create Project
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project: Project & { kanbanCards?: KanbanCard[]; _count?: { kanbanCards?: number; tokenUsage?: number } }) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group block"
              >
                <div className="bg-primary-900 rounded-lg shadow-sm border border-primary-800 p-6 hover:shadow-md hover:border-primary-700 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-accent-50 group-hover:text-primary-400 transition-colors">
                        {project.name}
                      </h3>
                      {project.summary && (
                        <p className="text-sm text-primary-200 mt-1 font-medium line-clamp-1">
                          {project.summary}
                        </p>
                      )}
                      {project.description && (
                        <p className="text-sm text-primary-300 mt-1 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAgentStatusColor(agentStatus)}`}>
                      {agentStatus.toUpperCase()}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  {(() => {
                    const progress = calculateProgress(project.kanbanCards || []);
                    return progress.total > 0 ? (
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-xs text-primary-400 mb-2">
                          <span>Progress</span>
                          <span>{progress.completed}/{progress.total} completed</span>
                        </div>
                        <ProgressBar 
                          total={progress.total} 
                          completed={progress.completed}
                          showPercentage={false}
                        />
                      </div>
                    ) : null;
                  })()}

                  <div className="flex items-center justify-between text-sm text-primary-400">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {project._count?.kanbanCards || 0} cards
                      </span>
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {project._count?.tokenUsage || 0} tasks
                      </span>
                    </div>
                    <span>
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {project.localPath && (
                    <div className="mt-3 pt-3 border-t border-primary-800">
                      <p className="text-xs text-primary-400 font-mono truncate">
                        {project.localPath}
                      </p>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <ProjectImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
}