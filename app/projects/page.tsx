'use client';

import { Project } from '@/lib/db';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import ProjectImportModal from '@/components/ProjectImportModal';

interface ProjectTask {
  taskId: string;
  taskType: string;
  status: string;
  currentPhase?: string;
  progress: number;
  message: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>('unknown');
  const [projectTasks, setProjectTasks] = useState<Record<string, ProjectTask>>(
    {}
  );
  // Removed cancelling projects and confirmation modal - no deletion allowed
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<{
    type: 'success' | 'error' | null;
    text: string;
  }>({ type: null, text: '' });

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
    const interval = setInterval(() => {
      fetchAgentStatus();
      fetchProjectTasks();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchProjects = async (forceRefresh = false) => {
    try {
      const url = forceRefresh ? '/api/projects?refresh=true' : '/api/projects';
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setProjects(data.data);
        // Fetch task information for INITIALIZING projects
        fetchProjectTasks(data.data);
      } else {
        setError(data.error || 'Failed to fetch projects');
      }
    } catch {
      setError('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectTasks = async (projectList?: Project[]) => {
    const initializingProjects = (projectList || projects).filter(
      (project: Project) => project.status === 'INITIALIZING'
    );

    for (const project of initializingProjects) {
      try {
        const response = await fetch(`/api/projects/${project.id}/task`);
        const data = await response.json();

        if (data.success) {
          setProjectTasks(prev => ({
            ...prev,
            [project.id]: data.data,
          }));
        }
      } catch (error) {
        console.error(`Failed to fetch task for project ${project.id}:`, error);
      }
    }
  };

  // Project deletion/cancellation removed - projects cannot be deleted

  const handleRefreshProjects = async () => {
    setIsRefreshing(true);
    setRefreshMessage({ type: null, text: '' });
    
    try {
      // Trigger cleanup and discovery
      const cleanupResponse = await fetch('/api/registry/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'run' }),
      });

      const cleanupData = await cleanupResponse.json();
      
      if (cleanupData.success) {
        console.log('✅ Registry cleanup completed:', cleanupData.data);
        
        // Show user feedback
        const { removed, archived, healthChecked } = cleanupData.data;
        if (removed > 0 || archived > 0) {
          setRefreshMessage({
            type: 'success',
            text: `Registry refreshed! ${archived} projects archived, ${removed} removed, ${healthChecked} health-checked.`
          });
        } else {
          setRefreshMessage({
            type: 'success',
            text: `Registry refreshed successfully! ${healthChecked} projects health-checked.`
          });
        }
        
        // Clear message after 5 seconds
        setTimeout(() => {
          setRefreshMessage({ type: null, text: '' });
        }, 5000);
      } else {
        console.warn('⚠️ Registry cleanup had issues:', cleanupData.error);
        setRefreshMessage({
          type: 'error',
          text: `Refresh failed: ${cleanupData.error}`
        });
        
        // Clear error message after 5 seconds
        setTimeout(() => {
          setRefreshMessage({ type: null, text: '' });
        }, 5000);
      }

      // Refresh the projects list with forced discovery
      await fetchProjects(true);
      
    } catch (error) {
      console.error('❌ Error refreshing projects:', error);
      setRefreshMessage({
        type: 'error',
        text: 'Failed to refresh projects. Please try again.'
      });
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setRefreshMessage({ type: null, text: '' });
      }, 5000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getAgentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-lime-900 text-lime-300 border border-lime-700';
      case 'paused':
        return 'bg-yellow-900 text-yellow-300 border border-yellow-700';
      default:
        return 'bg-primary-900 text-primary-400 border border-primary-800';
    }
  };

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'INITIALIZING':
        return 'bg-blue-900 text-blue-300 border border-blue-700';
      case 'ACTIVE':
        return 'bg-green-900 text-green-300 border border-green-700';
      case 'PAUSED':
        return 'bg-yellow-900 text-yellow-300 border border-yellow-700';
      case 'ARCHIVED':
        return 'bg-gray-900 text-gray-300 border border-gray-700';
      default:
        return 'bg-primary-900 text-primary-400 border border-primary-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-primary-300">載入專案中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-red-400 font-medium">{error}</p>
          <button
            onClick={fetchProjects}
            className="mt-4 px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700"
          >
            重新嘗試
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
            <h1 className="text-3xl font-bold text-accent-50 mb-2">專案</h1>
            <p className="text-primary-300">管理您的軟體開發專案</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleRefreshProjects}
              disabled={isRefreshing}
              className="px-4 py-2 bg-primary-800 text-accent-50 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Refresh project registry and clean up removed projects"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? '更新中...' : '重新整理'}
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-primary-700 text-accent-50 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
            >
              從 Git 匯入
            </button>
            <Link
              href="/projects/new"
              className="px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500 transition-colors"
            >
              建立專案
            </Link>
          </div>
        </div>

        {/* Refresh Message Toast */}
        {refreshMessage.type && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300 ${
            refreshMessage.type === 'success' 
              ? 'bg-green-900 border border-green-700 text-green-100' 
              : 'bg-red-900 border border-red-700 text-red-100'
          }`}>
            {refreshMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            <span className="text-sm font-medium">{refreshMessage.text}</span>
            <button
              onClick={() => setRefreshMessage({ type: null, text: '' })}
              className="ml-2 text-current opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-primary-500 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-accent-50 mb-2">
              尚無專案
            </h3>
            <p className="text-primary-300 mb-6">建立第一個專案即可開始</p>
            <Link
              href="/projects/new"
              className="inline-flex items-center px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700"
            >
              建立專案
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map(
              (
                project: Project & {
                  _count?: { tokenUsage?: number; kanbanCards?: number };
                }
              ) => (
                <div key={project.id} className="group">
                  {project.status === 'INITIALIZING' ? (
                    // INITIALIZING projects - not clickable, show cancel button
                    <div className="bg-primary-900 rounded-lg shadow-sm border border-primary-800 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold text-accent-50">
                              {project.name}
                            </h3>
                            <span
                              className={`px-3 py-1 text-xs font-medium rounded-full ${getProjectStatusColor(project.status)}`}
                            >
                              {project.status}
                            </span>
                            <div className="flex items-center">
                              <div className="animate-spin rounded-full h-4 w-4 border border-blue-300 border-t-transparent"></div>
                            </div>
                          </div>

                          {/* Initialization Progress */}
                          {projectTasks[project.id] && (
                            <div className="mb-3">
                              <div
                                className={`text-sm mb-1 ${
                                  projectTasks[project.id].status === 'FAILED'
                                    ? 'text-red-300'
                                    : 'text-blue-300'
                                }`}
                              >
                                {projectTasks[project.id].status === 'FAILED'
                                  ? 'Initialization Failed'
                                  : projectTasks[project.id].currentPhase ||
                                    'Initializing...'}
                              </div>
                              <div className="text-xs text-primary-400 mb-2">
                                {projectTasks[project.id].message}
                              </div>
                              <div className="w-full bg-primary-800 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    projectTasks[project.id].status === 'FAILED'
                                      ? 'bg-red-500'
                                      : 'bg-blue-500'
                                  }`}
                                  style={{
                                    width: `${projectTasks[project.id].progress}%`,
                                  }}
                                />
                              </div>
                              <div className="text-xs text-primary-400 mt-1">
                                {projectTasks[project.id].status === 'FAILED'
                                  ? 'Failed - manual cleanup required'
                                  : `${projectTasks[project.id].progress}% complete`}
                              </div>
                            </div>
                          )}
                        </div>

                      </div>

                      {project.summary && (
                        <p className="text-sm text-primary-300 mb-3 line-clamp-2">
                          {project.summary}
                        </p>
                      )}

                      {/* Tech Stack Info */}
                      <div className="flex items-center gap-4 text-sm text-primary-400 mb-3">
                        {project.language && (
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            {project.language}
                          </span>
                        )}
                        {project.framework && (
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            {project.framework}
                          </span>
                        )}
                        {project.packageManager && (
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                            {project.packageManager}
                          </span>
                        )}
                      </div>

                      {/* Git Info & Path */}
                      <div className="pt-3 border-t border-primary-800">
                        <div className="flex items-center gap-4 text-xs">
                          {project.gitUrl && (
                            <span className="flex items-center gap-1 text-primary-400">
                              <svg
                                className="w-3 h-3"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.30 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                              </svg>
                              Remote
                            </span>
                          )}
                          <span className="text-primary-400 font-mono truncate max-w-md">
                            {project.localPath}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Active projects - clickable
                    <Link href={`/projects/${project.id}`} className="block">
                      <div className="bg-primary-900 rounded-lg shadow-sm border border-primary-800 p-6 hover:shadow-md hover:border-primary-700 transition-all">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-semibold text-accent-50 group-hover:text-accent-400 transition-colors">
                                {project.name}
                              </h3>
                              <span
                                className={`px-3 py-1 text-xs font-medium rounded-full ${getProjectStatusColor(project.status)}`}
                              >
                                {project.status}
                              </span>
                            </div>
                            {project.summary && (
                              <p className="text-sm text-primary-300 mb-3 line-clamp-2">
                                {project.summary}
                              </p>
                            )}

                            {/* Tech Stack Info */}
                            <div className="flex items-center gap-4 text-sm text-primary-400 mb-3">
                              {project.language && (
                                <span className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  {project.language}
                                </span>
                              )}
                              {project.framework && (
                                <span className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                  {project.framework}
                                </span>
                              )}
                              {project.packageManager && (
                                <span className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                  {project.packageManager}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-medium text-accent-50 mb-1">
                              Last updated:{' '}
                              {new Date(project.updatedAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-primary-400">
                              {new Date(project.updatedAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>

                        {/* Detailed Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="text-center">
                            <div className="text-lg font-semibold text-accent-50">
                              {project._count?.kanbanCards || 0}
                            </div>
                            <div className="text-xs text-primary-400">
                              Total Cards
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-green-400">
                              0
                            </div>
                            <div className="text-xs text-primary-400">
                              Completed
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-yellow-400">
                              0
                            </div>
                            <div className="text-xs text-primary-400">
                              In Progress
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-blue-400">
                              {project._count?.tokenUsage || 0}
                            </div>
                            <div className="text-xs text-primary-400">
                              Token Usage
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-primary-300">Progress</span>
                            <span className="text-accent-50">0%</span>
                          </div>
                          <div className="w-full bg-primary-700 rounded-full h-2">
                            <div
                              className="bg-accent-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: '0%' }}
                            />
                          </div>
                        </div>

                        {/* Git Info & Path */}
                        <div className="pt-3 border-t border-primary-800">
                          <div className="flex items-center gap-4 text-xs">
                            {project.gitUrl && (
                              <span className="flex items-center gap-1 text-primary-400">
                                <svg
                                  className="w-3 h-3"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.30 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                </svg>
                                Remote
                              </span>
                            )}
                            <span className="text-primary-400 font-mono truncate max-w-md">
                              {project.localPath}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              )
            )}
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
