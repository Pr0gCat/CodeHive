'use client';

import { Project, ProjectSettings } from '@/lib/db';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AgentStatusPanel from '@/components/AgentStatusPanel';
import ProjectLogsModal from '@/components/ProjectLogsModal';
import ProjectSettingsModal from '@/components/ProjectSettingsModal';
import { useToast } from '@/components/ui/ToastManager';
import ClaudeMdViewer from '@/components/ClaudeMdViewer';
import { UnifiedProjectOverview } from '@/components/UnifiedProjectOverview';
import UserQueriesPanel from '@/components/UserQueriesPanel';
import EpicCreateModal from '@/components/EpicCreateModal';
import KanbanBoard from '@/components/KanbanBoard';
import ProjectAgentChat from '@/components/ProjectAgentChat';

interface ProjectPageProps {
  params: { id: string };
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [epicCreateModalOpen, setEpicCreateModalOpen] = useState(false);
  const [projectSettings, setProjectSettings] =
    useState<ProjectSettings | null>(null);
  const [agentStatus, setAgentStatus] = useState<string>('unknown');
  const [epics, setEpics] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'epics'
    | 'stories'
    | 'tasks'
    | 'cycles'
    | 'queries'
    | 'claude-md'
  >('queries'); // Start with conversation-first approach
  const [projectPhase, setProjectPhase] = useState<
    'REQUIREMENTS' | 'MVP' | 'CONTINUOUS'
  >('REQUIREMENTS');

  const handlePhaseChange = useCallback((newPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS') => {
    setProjectPhase(newPhase);
    // Also update the project object to reflect the new phase
    if (project) {
      setProject({
        ...project,
        phase: newPhase
      });
    }
  }, [project]);
  const [projectAgentStatus, setProjectAgentStatus] = useState<
    'IDLE' | 'PLANNING' | 'EXECUTING' | 'VALIDATING'
  >('IDLE');
  const [claudeMdLastUpdate, setClaudeMdLastUpdate] = useState<Date | null>(
    null
  );
  const [initializationProgress, setInitializationProgress] = useState<{
    currentPhase?: string;
    progress?: number;
    message?: string;
    taskId?: string;
  } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  // Check URL parameters for tab selection
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'claude-md') {
      setActiveTab('claude-md');
    } else if (tab === 'overview') {
      setActiveTab('overview');
    } else if (tab === 'epics') {
      setActiveTab('epics');
    } else if (tab === 'stories') {
      setActiveTab('stories');
    } else if (tab === 'tasks') {
      setActiveTab('tasks');
    } else if (tab === 'cycles') {
      setActiveTab('cycles');
    } else {
      setActiveTab('queries'); // Default to conversation-first
    }
  }, []);

  const fetchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${params.id}`);
      const data = await response.json();

      if (data.success) {
        setProject(data.data);

        // Set project phase from database
        if (data.data.phase) {
          setProjectPhase(data.data.phase as 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS');
        }

        // If project is initializing, try to fetch progress
        if (data.data.status === 'INITIALIZING') {
          fetchInitializationProgress();
        }
      } else {
        setError(data.error || '無法載入專案');
      }
    } catch {
      setError('無法載入專案');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchInitializationProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${params.id}/task`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setInitializationProgress({
            currentPhase: data.data.currentPhase,
            progress: data.data.progress,
            message: data.data.message,
            taskId: data.data.taskId,
          });
        }
      }
    } catch (err) {
      // Silently fail - progress is optional
      console.warn('Failed to fetch initialization progress:', err);
    }
  }, [params.id]);

  // Cancel initialization function
  const handleCancelInitialization = async () => {
    if (!initializationProgress?.taskId || isCancelling) return;

    const confirmed = confirm(
      `Are you sure you want to cancel the initialization of "${project?.name}"?\n\nThis will stop the process and remove all created files and database records.`
    );

    if (!confirmed) return;

    setIsCancelling(true);

    try {
      const response = await fetch(
        `/api/tasks/${initializationProgress.taskId}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const result = await response.json();

      if (result.success) {
        showToast('Project initialization cancelled successfully', 'success');
        // Redirect to projects list
        router.push('/projects');
      } else {
        showToast(`Failed to cancel initialization: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error cancelling initialization:', error);
      showToast('Error cancelling initialization. Please try again.', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

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

  const fetchClaudeMdStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${params.id}/claude-md`);
      const data = await response.json();

      if (data.success && data.data.lastModified) {
        setClaudeMdLastUpdate(new Date(data.data.lastModified));
      }
    } catch {
      // Silently fail for CLAUDE.md status updates
    }
  }, [params.id]);

  const fetchEpics = useCallback(async () => {
    try {
      const response = await fetch(`/api/epics?projectId=${params.id}`);
      const data = await response.json();

      if (data.success) {
        setEpics(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch epics:', error);
    }
  }, [params.id]);

  const handleEpicCreated = () => {
    fetchEpics();
    showToast('Epic 已成功建立', 'success');
  };

  useEffect(() => {
    fetchProject();
    fetchAgentStatus();
    fetchClaudeMdStatus();
    fetchEpics();

    // Set up polling for initialization progress
    let initProgressInterval: NodeJS.Timeout | null = null;

    const startInitProgressPolling = () => {
      // Poll every 2 seconds during initialization
      initProgressInterval = setInterval(() => {
        if (project?.status === 'INITIALIZING') {
          fetchInitializationProgress();
          fetchProject(); // Check if status changed
        } else {
          // Stop polling when not initializing
          if (initProgressInterval) {
            clearInterval(initProgressInterval);
            initProgressInterval = null;
          }
        }
      }, 2000);
    };

    // Start polling if project is initializing
    if (project?.status === 'INITIALIZING') {
      startInitProgressPolling();
    }

    // Set up SSE connection for agent status updates
    let eventSource: EventSource | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectAgentSSE = () => {
      if (eventSource) {
        eventSource.close();
      }

      console.log(`🔗 Connecting to Agent Queue SSE`);
      eventSource = new EventSource('/api/agents/queue/live');

      eventSource.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          console.log('📡 Agent Queue SSE Event received:', data);

          // Reset reconnect attempts on successful message
          reconnectAttempts = 0;

          if (data.type === 'connected') {
            console.log(`✅ Connected to agent queue stream`);
          } else if (data.type === 'queue_status') {
            // Handle queue status updates
            setAgentStatus(data.status.status.toLowerCase());
          } else if (data.type === 'queue_event') {
            // Handle specific queue events
            console.log('Queue event:', data.event);
          }
        } catch (error) {
          console.error('Error parsing agent queue SSE event:', error);
        }
      };

      eventSource.onerror = error => {
        const eventSourceState = eventSource?.readyState;

        // Only log error if it's not a normal close (readyState 2)
        if (eventSourceState !== EventSource.CLOSED) {
          console.warn(
            'Agent Queue SSE connection interrupted, attempting to reconnect...'
          );
        }

        // Close current connection
        eventSource?.close();

        // Attempt to reconnect if under limit
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts - 1),
            10000
          );

          console.log(
            `🔄 Reconnecting Agent Queue SSE in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`
          );

          reconnectTimeout = setTimeout(() => {
            connectAgentSSE();
          }, delay);
        } else {
          console.error(
            'Agent Queue SSE max reconnection attempts reached, falling back to polling'
          );
          // Fallback to manual fetch on persistent error
          setTimeout(fetchAgentStatus, 10000);
        }
      };
    };

    // Initial connection
    connectAgentSSE();

    // CLAUDE.md doesn't need frequent updates - only check every 2 minutes
    const claudeMdInterval = setInterval(fetchClaudeMdStatus, 120000);

    return () => {
      console.log('🔌 Closing Agent Queue SSE connection');
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (initProgressInterval) {
        clearInterval(initProgressInterval);
      }
      eventSource?.close();
      clearInterval(claudeMdInterval);
    };
  }, [fetchProject, fetchAgentStatus, fetchClaudeMdStatus]);

  const handleSettingsUpdate = (settings: ProjectSettings) => {
    setProjectSettings(settings);
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    
    setDeletingProject(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        showToast('專案已成功刪除', 'success');
        // Redirect to projects list
        window.location.href = '/projects';
      } else {
        showToast(`刪除失敗: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      showToast('刪除專案時發生錯誤', 'error');
    } finally {
      setDeletingProject(false);
      setShowDeleteConfirmation(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-accent-100 text-accent-800';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'ARCHIVED':
        return 'bg-primary-900 text-primary-200';
      default:
        return 'bg-primary-900 text-primary-200';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-primary-600">載入專案中...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
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
          <p className="text-red-600 font-medium">找不到專案</p>
          <Link
            href="/projects"
            className="mt-4 inline-block px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700"
          >
            返回專案列表
          </Link>
        </div>
      </div>
    );
  }

  // Check if project import failed
  if (project.status === 'FAILED') {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div className="rounded-full h-16 w-16 bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-red-400 mb-2">
              {project.name}
            </h2>
            <p className="text-red-300 font-medium mb-4">
              專案導入失敗
            </p>
            <div className="bg-red-950 border border-red-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-200">
                {project.description || '導入過程中發生未知錯誤'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setShowDeleteConfirmation(true)}
              className="block w-full px-4 py-2 bg-red-800 text-red-200 rounded hover:bg-red-700 transition-colors"
            >
              刪除失敗專案
            </button>
          </div>

          {/* Delete Confirmation Modal */}
          {showDeleteConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
              <div className="bg-primary-900 rounded-lg p-6 max-w-md mx-4 border border-primary-700">
                <div className="flex items-center mb-4">
                  <svg className="h-6 w-6 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h3 className="text-lg font-medium text-primary-100">確認刪除專案</h3>
                </div>
                
                <p className="text-primary-300 mb-6">
                  您確定要永久刪除專案「{project.name}」嗎？此操作無法復原，將會刪除所有相關數據。
                </p>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDeleteConfirmation(false)}
                    disabled={deletingProject}
                    className="flex-1 px-4 py-2 bg-primary-700 text-primary-200 rounded hover:bg-primary-600 transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDeleteProject}
                    disabled={deletingProject}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {deletingProject ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        刪除中...
                      </>
                    ) : (
                      '確認刪除'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Check if project is still initializing
  if (project.status === 'INITIALIZING') {
    return (
      <div className="min-h-screen bg-primary-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-accent-400 border-t-transparent mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-accent-50 mb-2">
              {project.name}
            </h2>
            <p className="text-accent-300 font-medium mb-4">
              專案正在初始化中...
            </p>

            {/* Progress Information */}
            {initializationProgress && (
              <div className="mb-4">
                {initializationProgress.currentPhase && (
                  <p className="text-sm text-accent-200 mb-2">
                    當前階段：{initializationProgress.currentPhase}
                  </p>
                )}
                {initializationProgress.progress !== undefined && (
                  <div className="w-full bg-primary-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-accent-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${initializationProgress.progress}%` }}
                    ></div>
                  </div>
                )}
                {initializationProgress.message && (
                  <p className="text-xs text-primary-300">
                    {initializationProgress.message}
                  </p>
                )}
              </div>
            )}

            <div className="text-sm text-primary-300 space-y-2">
              <p>• 正在設置專案結構</p>
              <p>• 正在初始化 Git 儲存庫</p>
              <p>• 正在分析專案並生成配置</p>
            </div>
          </div>
          <div className="bg-primary-900 border border-primary-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-primary-400">
              初始化過程在背景進行，完成後您將能夠正常使用專案的所有功能。
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/projects"
              className="inline-block px-6 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 transition-colors font-medium"
            >
              返回專案列表
            </Link>

            {/* Cancel Button */}
            {initializationProgress?.taskId && (
              <button
                onClick={handleCancelInitialization}
                disabled={isCancelling}
                className={`
                  px-6 py-2 border border-red-600 text-red-400 font-medium rounded-lg 
                  transition-all duration-200
                  ${
                    isCancelling
                      ? 'bg-red-600/10 cursor-not-allowed opacity-50'
                      : 'hover:bg-red-600/20 hover:border-red-500 hover:text-red-300'
                  }
                `}
              >
                {isCancelling ? '取消中...' : '取消初始化'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-primary-950 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-primary-900 border-b border-primary-800 flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/projects"
                className="text-primary-300 hover:text-accent-50"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-accent-50">
                  {project.name}
                </h1>
                {project.description ? (
                  <p className="text-primary-300 mt-1 text-sm">
                    {project.description}
                  </p>
                ) : project.summary ? (
                  <p className="text-primary-200 mt-1 text-sm font-medium">
                    {project.summary}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-sm text-primary-400">
                最後更新：{new Date(project.updatedAt).toLocaleDateString()}
              </div>
              <button
                onClick={() => setLogsModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-primary-300 border border-primary-600 rounded-lg hover:bg-primary-800 hover:text-accent-50 flex items-center space-x-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m-6 8h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z"
                  />
                </svg>
                <span>記錄</span>
              </button>
              <button
                onClick={() => setSettingsModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-primary-300 border border-primary-600 rounded-lg hover:bg-primary-800 hover:text-accent-50 flex items-center space-x-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>設定</span>
              </button>
            </div>
          </div>

          {project.localPath && (
            <div className="mt-3 pt-3 border-t border-primary-700">
              <p className="text-sm text-primary-400 font-mono">
                <span className="font-medium">路徑：</span> {project.localPath}
              </p>
              {project.gitUrl && (
                <p className="text-sm text-primary-400 mt-1">
                  <span className="font-medium">儲存庫：</span>{' '}
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

      {/* Project Phase & Agent Status Indicator */}
      <div className="bg-primary-900 border-b border-primary-800 flex-shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-primary-400">專案階段：</span>
                <div className="flex gap-2">
                  {[
                    { key: 'REQUIREMENTS', label: '需求獲取', color: 'blue' },
                    { key: 'MVP', label: 'MVP開發', color: 'purple' },
                    { key: 'CONTINUOUS', label: '持續整合', color: 'green' }
                  ].map((phase) => (
                    <button
                      key={phase.key}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        projectPhase === phase.key
                          ? `bg-${phase.color}-600 text-white`
                          : 'bg-primary-700 text-primary-300 hover:bg-primary-600'
                      }`}
                      onClick={() => setProjectPhase(phase.key as any)}
                    >
                      {phase.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-primary-400">專案代理：</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  projectAgentStatus === 'IDLE'
                    ? 'bg-gray-700 text-gray-200'
                    : projectAgentStatus === 'PLANNING'
                      ? 'bg-blue-700 text-blue-200'
                      : projectAgentStatus === 'EXECUTING'
                        ? 'bg-green-700 text-green-200'
                        : 'bg-yellow-700 text-yellow-200'
                }`}>
                  {projectAgentStatus === 'IDLE' ? '閒置' :
                   projectAgentStatus === 'PLANNING' ? '規劃中' :
                   projectAgentStatus === 'EXECUTING' ? '執行中' : '驗證中'}
                </span>
              </div>
            </div>
            <div className="text-sm text-primary-400">
              {projectPhase === 'REQUIREMENTS' && '🔍 探索專案需求和願景'}
              {projectPhase === 'MVP' && '🚀 建立最小可行產品'}
              {projectPhase === 'CONTINUOUS' && '🔄 持續改進和迭代'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Agent Status Panel - Always Visible */}
        <div className="w-64 lg:w-72 xl:w-80 2xl:w-96 p-4 bg-primary-950 border-r border-primary-800 h-full overflow-y-auto flex-shrink-0">
          <AgentStatusPanel projectId={project.id} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Tabs - Conversation-First Approach */}
          <div className="border-b border-primary-800 bg-primary-950 flex-shrink-0">
            <div className="flex overflow-x-auto">
              {/* PRIMARY: Conversation Interface */}
              <button
                onClick={() => setActiveTab('queries')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'queries'
                    ? 'text-accent-50 border-accent-500 bg-accent-500/10'
                    : 'text-primary-400 hover:text-accent-50 border-transparent hover:border-primary-600'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <div className="flex flex-col items-start">
                  <span>專案對話</span>
                  <span className="text-xs text-primary-500 font-normal">主要互動介面</span>
                </div>
              </button>

              {/* SECONDARY: Execution Status */}
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'text-accent-50 border-accent-500'
                    : 'text-primary-400 hover:text-accent-50 border-transparent hover:border-primary-600'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                執行狀態
              </button>

              <button
                onClick={() => setActiveTab('tasks')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'tasks'
                    ? 'text-accent-50 border-accent-500'
                    : 'text-primary-400 hover:text-accent-50 border-transparent hover:border-primary-600'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                當前任務
              </button>

              {/* TERTIARY: Development Tools */}
              <button
                onClick={() => setActiveTab('epics')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'epics'
                    ? 'text-accent-50 border-accent-500'
                    : 'text-primary-400 hover:text-accent-50 border-transparent hover:border-primary-600'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                史詩規劃
              </button>

              <button
                onClick={() => setActiveTab('stories')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'stories'
                    ? 'text-accent-50 border-accent-500'
                    : 'text-primary-400 hover:text-accent-50 border-transparent hover:border-primary-600'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
                故事開發
              </button>

              <button
                onClick={() => setActiveTab('cycles')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'cycles'
                    ? 'text-accent-50 border-accent-500'
                    : 'text-primary-400 hover:text-accent-50 border-transparent hover:border-primary-600'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                ATDD週期
              </button>

              {/* DOCUMENTATION */}
              <button
                onClick={() => setActiveTab('claude-md')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'claude-md'
                    ? 'text-accent-50 border-accent-500'
                    : 'text-primary-400 hover:text-accent-50 border-transparent hover:border-primary-600'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="flex flex-col items-start">
                  <span>專案文檔</span>
                  {claudeMdLastUpdate && (
                    <span className="text-xs text-primary-500 font-normal">
                      {claudeMdLastUpdate.toLocaleDateString('zh-TW', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0">
            {/* Execution Status Overview */}
            <div
              className={`h-full ${activeTab === 'overview' ? 'block' : 'hidden'} flex flex-col`}
            >
              <div className="p-6 flex-1 overflow-y-auto min-h-0">
                <div className="max-w-7xl mx-auto space-y-6">
                  {/* Agent Status Summary */}
                  <div className="bg-primary-900 border border-primary-700 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-accent-50">專案代理執行狀態</h2>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-primary-400">當前狀態：</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          projectAgentStatus === 'IDLE'
                            ? 'bg-gray-700 text-gray-200'
                            : projectAgentStatus === 'PLANNING'
                              ? 'bg-blue-700 text-blue-200'
                              : projectAgentStatus === 'EXECUTING'
                                ? 'bg-green-700 text-green-200'
                                : 'bg-yellow-700 text-yellow-200'
                        }`}>
                          {projectAgentStatus === 'IDLE' ? '閒置中' :
                           projectAgentStatus === 'PLANNING' ? '規劃中' :
                           projectAgentStatus === 'EXECUTING' ? '執行中' : '驗證中'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Execution Hierarchy */}
                    <div className="grid md:grid-cols-3 gap-6">
                      {/* Current Epic */}
                      <div className="bg-primary-800 border border-primary-600 rounded-lg p-4">
                        <h3 className="font-semibold text-accent-50 mb-3 flex items-center gap-2">
                          📚 當前史詩
                        </h3>
                        {epics.find(e => e.phase === 'IN_PROGRESS') ? (
                          epics.filter(e => e.phase === 'IN_PROGRESS').map(epic => (
                            <div key={epic.id}>
                              <h4 className="font-medium text-accent-50 mb-1">{epic.title}</h4>
                              <p className="text-sm text-primary-300 mb-2">{epic.description}</p>
                              <div className="flex justify-between text-xs text-primary-400">
                                <span>進度: {epic.progress?.percentage || 0}%</span>
                                <span className="px-2 py-1 bg-green-800 text-green-200 rounded">
                                  {epic.phase}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-primary-400 text-sm">無進行中的史詩</p>
                        )}
                      </div>

                      {/* Current Story */}
                      <div className="bg-primary-800 border border-primary-600 rounded-lg p-4">
                        <h3 className="font-semibold text-accent-50 mb-3 flex items-center gap-2">
                          📝 當前故事
                        </h3>
                        <p className="text-primary-400 text-sm">等待史詩啟動</p>
                      </div>

                      {/* Current Task */}
                      <div className="bg-primary-800 border border-primary-600 rounded-lg p-4">
                        <h3 className="font-semibold text-accent-50 mb-3 flex items-center gap-2">
                          ⚡ 當前任務
                        </h3>
                        <p className="text-primary-400 text-sm">等待故事分派</p>
                      </div>
                    </div>
                  </div>

                  {/* ATDD Cycle Status */}
                  <div className="bg-primary-900 border border-primary-700 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-accent-50 mb-4 flex items-center gap-2">
                      🔄 ATDD 執行循環
                    </h3>
                    <div className="grid grid-cols-4 gap-4">
                      {[
                        { name: '定義期望', desc: '明確任務目標', active: false, icon: '🎯' },
                        { name: '建立標準', desc: '設定驗證條件', active: false, icon: '📋' },
                        { name: '執行指令', desc: 'Claude Code 實作', active: false, icon: '⚙️' },
                        { name: '驗證結果', desc: '確認完成狀態', active: false, icon: '✅' }
                      ].map((step, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg text-center border-2 transition-all ${
                            step.active
                              ? 'bg-accent-600 text-white border-accent-500'
                              : 'bg-primary-800 text-primary-300 border-primary-600'
                          }`}
                        >
                          <div className="text-2xl mb-2">{step.icon}</div>
                          <h4 className="font-medium text-sm mb-1">{step.name}</h4>
                          <p className="text-xs opacity-80">{step.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Project Statistics */}
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-primary-900 border border-primary-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-accent-50 mb-4">專案統計</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-primary-300">史詩總數</span>
                          <span className="text-accent-50 font-medium">{epics.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-primary-300">已完成史詩</span>
                          <span className="text-accent-50 font-medium">
                            {epics.filter(e => e.phase === 'DONE').length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-primary-300">進行中史詩</span>
                          <span className="text-accent-50 font-medium">
                            {epics.filter(e => e.phase === 'IN_PROGRESS').length}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-primary-900 border border-primary-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-accent-50 mb-4">代幣使用</h3>
                      <div className="space-y-3 text-center">
                        <div>
                          <div className="text-2xl font-bold text-accent-50">0</div>
                          <div className="text-sm text-primary-400">總計代幣</div>
                        </div>
                        <div>
                          <div className="text-lg font-medium text-accent-50">$0.00</div>
                          <div className="text-sm text-primary-400">預估成本</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-primary-900 border border-primary-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-accent-50 mb-4">快速操作</h3>
                      <div className="space-y-3">
                        <button
                          onClick={() => setActiveTab('queries')}
                          className="w-full px-4 py-2 bg-accent-600 text-white rounded-lg hover:bg-accent-700 text-sm"
                        >
                          開始對話
                        </button>
                        <button
                          onClick={() => setActiveTab('epics')}
                          className="w-full px-4 py-2 border border-primary-600 text-primary-300 rounded-lg hover:bg-primary-800 text-sm"
                        >
                          管理史詩
                        </button>
                        <button
                          onClick={() => setActiveTab('claude-md')}
                          className="w-full px-4 py-2 border border-primary-600 text-primary-300 rounded-lg hover:bg-primary-800 text-sm"
                        >
                          查看文檔
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Epics Management Tab */}
            <div
              className={`h-full ${activeTab === 'epics' ? 'block' : 'hidden'} flex flex-col`}
            >
              <div className="p-6 flex-1 overflow-y-auto min-h-0">
                <div className="max-w-7xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-accent-50">
                        Epic 規劃
                      </h2>
                      <p className="text-primary-300 mt-1">
                        規劃專案的主要功能模組和大型需求
                      </p>
                    </div>
                    <button
                      onClick={() => setEpicCreateModalOpen(true)}
                      className="px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      新增 Epic
                    </button>
                  </div>

                  {/* Epic List */}
                  {epics.length > 0 ? (
                    <div className="space-y-4">
                      {epics.map(epic => (
                        <div
                          key={epic.id}
                          className="bg-primary-900 border border-primary-700 rounded-lg p-6"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-semibold text-accent-50">
                                  {epic.title}
                                </h3>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    epic.type === 'MVP'
                                      ? 'bg-purple-900 text-purple-200'
                                      : epic.type === 'FEATURE'
                                        ? 'bg-blue-900 text-blue-200'
                                        : epic.type === 'ENHANCEMENT'
                                          ? 'bg-green-900 text-green-200'
                                          : 'bg-orange-900 text-orange-200'
                                  }`}
                                >
                                  {epic.type}
                                </span>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    epic.mvpPriority === 'CRITICAL'
                                      ? 'bg-red-900 text-red-200'
                                      : epic.mvpPriority === 'HIGH'
                                        ? 'bg-orange-900 text-orange-200'
                                        : epic.mvpPriority === 'MEDIUM'
                                          ? 'bg-yellow-900 text-yellow-200'
                                          : epic.mvpPriority === 'LOW'
                                            ? 'bg-blue-900 text-blue-200'
                                            : 'bg-gray-900 text-gray-200'
                                  }`}
                                >
                                  {epic.mvpPriority}
                                </span>
                              </div>
                              {epic.description && (
                                <p className="text-primary-300 mb-3">
                                  {epic.description}
                                </p>
                              )}
                              {epic.coreValue && (
                                <p className="text-sm text-accent-200 mb-3">
                                  <span className="font-medium">
                                    核心價值：
                                  </span>{' '}
                                  {epic.coreValue}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  epic.phase === 'PLANNING'
                                    ? 'bg-blue-900 text-blue-200'
                                    : epic.phase === 'IN_PROGRESS'
                                      ? 'bg-green-900 text-green-200'
                                      : epic.phase === 'DONE'
                                        ? 'bg-gray-900 text-gray-200'
                                        : 'bg-red-900 text-red-200'
                                }`}
                              >
                                {epic.phase}
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-4">
                            <div className="flex justify-between text-sm text-primary-300 mb-2">
                              <span>進度</span>
                              <span>{epic.progress?.percentage || 0}%</span>
                            </div>
                            <div className="w-full bg-primary-700 rounded-full h-2">
                              <div
                                className="bg-accent-500 h-2 rounded-full transition-all duration-300"
                                style={{
                                  width: `${epic.progress?.percentage || 0}%`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-primary-400 mt-1">
                              <span>
                                {epic.progress?.storiesCompleted || 0} /{' '}
                                {epic.progress?.storiesTotal || 0} Stories
                              </span>
                              <span>
                                {epic.progress?.storyPointsCompleted || 0} /{' '}
                                {epic.progress?.storyPointsTotal || 0} 點數
                              </span>
                            </div>
                          </div>

                          {/* Metadata */}
                          <div className="flex items-center justify-between text-sm text-primary-400">
                            <div className="flex items-center gap-4">
                              <span>
                                建立於：
                                {new Date(epic.createdAt).toLocaleDateString(
                                  'zh-TW'
                                )}
                              </span>
                              {epic.dueDate && (
                                <span>
                                  目標完成：
                                  {new Date(epic.dueDate).toLocaleDateString(
                                    'zh-TW'
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span>{epic.estimatedStoryPoints} 預估點數</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-primary-900 border border-primary-700 rounded-lg p-8 text-center">
                      <div className="text-primary-400 mb-4">
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
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                          />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-primary-200 mb-2">
                        尚無 Epic
                      </h3>
                      <p className="text-primary-400 text-sm mb-4">
                        建立您的第一個 Epic 來組織專案功能
                      </p>
                      <button
                        onClick={() => setEpicCreateModalOpen(true)}
                        className="px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700"
                      >
                        建立第一個 Epic
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stories Management Tab */}
            <div
              className={`h-full ${activeTab === 'stories' ? 'block' : 'hidden'} flex flex-col`}
            >
              <div className="p-6 flex-1 overflow-hidden min-h-0">
                <KanbanBoard projectId={project.id} />
              </div>
            </div>

            {/* Tasks Tracking Tab */}
            <div
              className={`h-full ${activeTab === 'tasks' ? 'block' : 'hidden'} flex flex-col`}
            >
              <div className="p-6 flex-1 overflow-y-auto min-h-0">
                <div className="max-w-7xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-accent-50">
                        任務執行
                      </h2>
                      <p className="text-primary-300 mt-1">
                        監控代理程式執行的任務狀態與進度
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 text-sm border border-primary-600 text-primary-300 rounded hover:bg-primary-800">
                        全部
                      </button>
                      <button className="px-3 py-1 text-sm border border-primary-600 text-primary-300 rounded hover:bg-primary-800">
                        進行中
                      </button>
                      <button className="px-3 py-1 text-sm border border-primary-600 text-primary-300 rounded hover:bg-primary-800">
                        已完成
                      </button>
                    </div>
                  </div>

                  {/* Task List Placeholder */}
                  <div className="bg-primary-900 border border-primary-700 rounded-lg p-8 text-center">
                    <div className="text-primary-400 mb-4">
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
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-primary-200 mb-2">
                      尚無執行任務
                    </h3>
                    <p className="text-primary-400 text-sm">
                      代理程式執行的任務將顯示在這裡
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* TDD Cycles Tab */}
            <div
              className={`h-full ${activeTab === 'cycles' ? 'block' : 'hidden'} flex flex-col`}
            >
              <div className="p-6 flex-1 overflow-y-auto min-h-0">
                <div className="max-w-7xl mx-auto">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-accent-50">
                      TDD 週期管理
                    </h2>
                    <p className="text-primary-300 mt-1">
                      追蹤測試驅動開發的 RED-GREEN-REFACTOR-REVIEW 週期
                    </p>
                  </div>

                  {/* TDD Cycle Phases */}
                  <div className="grid grid-cols-4 gap-4 mb-8">
                    {[
                      {
                        name: 'RED',
                        desc: '編寫失敗測試',
                        color: 'bg-red-900 border-red-700 text-red-200',
                      },
                      {
                        name: 'GREEN',
                        desc: '實作最少代碼',
                        color: 'bg-green-900 border-green-700 text-green-200',
                      },
                      {
                        name: 'REFACTOR',
                        desc: '重構優化代碼',
                        color: 'bg-blue-900 border-blue-700 text-blue-200',
                      },
                      {
                        name: 'REVIEW',
                        desc: '代碼審查',
                        color:
                          'bg-purple-900 border-purple-700 text-purple-200',
                      },
                    ].map((phase, index) => (
                      <div
                        key={index}
                        className={`border rounded-lg p-4 ${phase.color}`}
                      >
                        <h3 className="font-bold text-lg mb-2">{phase.name}</h3>
                        <p className="text-sm opacity-90">{phase.desc}</p>
                        <div className="mt-3 text-center py-4">
                          <p className="text-xs opacity-75">無進行中週期</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cycle History Placeholder */}
                  <div className="bg-primary-900 border border-primary-700 rounded-lg p-8 text-center">
                    <div className="text-primary-400 mb-4">
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
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-primary-200 mb-2">
                      尚無 TDD 週期
                    </h3>
                    <p className="text-primary-400 text-sm">
                      開始您的第一個測試驅動開發週期
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Primary: Conversation Interface */}
            <div
              className={`h-full ${activeTab === 'queries' ? 'block' : 'hidden'} flex flex-col`}
            >
              <div className="p-6 flex-1 overflow-y-auto min-h-0">
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Phase-specific guidance */}
                  {projectPhase === 'REQUIREMENTS' && (
                    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-6">
                      <h2 className="text-xl font-bold text-blue-300 mb-3 flex items-center gap-2">
                        🔍 需求獲取階段
                      </h2>
                      <p className="text-blue-200 mb-4">
                        歡迎來到 CodeHive！我是您的專案代理，將透過對話幫助您探索和定義專案需求。
                      </p>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="font-medium text-blue-300 mb-2">我們可以討論：</h4>
                          <ul className="space-y-1 text-blue-200">
                            <li>• 專案目標和願景</li>
                            <li>• 核心功能需求</li>
                            <li>• 目標用戶和使用場景</li>
                            <li>• 技術限制和偏好</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium text-blue-300 mb-2">接下來：</h4>
                          <ul className="space-y-1 text-blue-200">
                            <li>• 建立專案提案</li>
                            <li>• 定義 MVP 範圍</li>
                            <li>• 規劃開發階段</li>
                            <li>• 進入 MVP 開發</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {projectPhase === 'MVP' && (
                    <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-6 mb-6">
                      <h2 className="text-xl font-bold text-purple-300 mb-3 flex items-center gap-2">
                        🚀 MVP 開發階段
                      </h2>
                      <p className="text-purple-200 mb-4">
                        正在建立最小可行產品。我將循序執行各個史詩和故事，確保每個功能都經過適當的測試和驗證。
                      </p>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="font-medium text-purple-300 mb-2">當前執行模式：</h4>
                          <ul className="space-y-1 text-purple-200">
                            <li>• 史詩 → 故事 → 任務</li>
                            <li>• ATDD 循環驗證</li>
                            <li>• 循序執行確保品質</li>
                            <li>• 代幣使用追蹤</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium text-purple-300 mb-2">您可以：</h4>
                          <ul className="space-y-1 text-purple-200">
                            <li>• 調整功能優先級</li>
                            <li>• 提出新需求</li>
                            <li>• 檢視開發進度</li>
                            <li>• 討論技術決策</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {projectPhase === 'CONTINUOUS' && (
                    <div className="bg-green-900/20 border border-green-700 rounded-lg p-6 mb-6">
                      <h2 className="text-xl font-bold text-green-300 mb-3 flex items-center gap-2">
                        🔄 持續整合階段
                      </h2>
                      <p className="text-green-200 mb-4">
                        專案已進入持續改進階段。我可以協助您實現新功能、修復錯誤、進行重構或處理任何開發需求。
                      </p>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <h4 className="font-medium text-green-300 mb-2">支援類型：</h4>
                          <ul className="space-y-1 text-green-200">
                            <li>• 功能開發</li>
                            <li>• 錯誤修復</li>
                            <li>• 代碼重構</li>
                            <li>• 性能優化</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium text-green-300 mb-2">工作方式：</h4>
                          <ul className="space-y-1 text-green-200">
                            <li>• 基於對話的需求收集</li>
                            <li>• 相同的史詩-故事-任務結構</li>
                            <li>• 持續的品質保證</li>
                            <li>• 靈活的迭代週期</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <ProjectAgentChat 
                    projectId={project.id} 
                    projectPhase={projectPhase}
                    onPhaseChange={handlePhaseChange}
                  />
                  
                  {/* Optional: Keep queries panel for advanced users */}
                  <details className="mt-6">
                    <summary className="cursor-pointer text-primary-400 hover:text-accent-50 mb-4">
                      📋 進階：管理現有查詢 (展開)
                    </summary>
                    <UserQueriesPanel projectId={project.id} />
                  </details>
                </div>
              </div>
            </div>

            {/* CLAUDE.md Viewer */}
            <div
              className={`h-full ${activeTab === 'claude-md' ? 'block' : 'hidden'}`}
            >
              <ClaudeMdViewer
                projectId={project.id}
                onClaudeMdUpdate={fetchClaudeMdStatus}
              />
            </div>
          </div>
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

      {/* Epic Create Modal */}
      <EpicCreateModal
        projectId={project.id}
        isOpen={epicCreateModalOpen}
        onClose={() => setEpicCreateModalOpen(false)}
        onEpicCreated={handleEpicCreated}
      />
    </div>
  );
}
