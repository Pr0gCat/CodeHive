'use client';

import { Project, ProjectSettings } from '@/lib/db';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AgentStatusPanel from '../../components/AgentStatusPanel';
import ProjectLogsModal from '../../components/ProjectLogsModal';
import ProjectSettingsModal from '../../components/ProjectSettingsModal';
import { useToast } from '@/components/ui/ToastManager';
import ClaudeMdViewer from '../../components/ClaudeMdViewer';
import { UnifiedProjectOverview } from '../../components/UnifiedProjectOverview';
import UserQueriesPanel from '../../components/UserQueriesPanel';

interface ProjectPageProps {
  params: { id: string };
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const { showToast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [projectSettings, setProjectSettings] =
    useState<ProjectSettings | null>(null);
  const [agentStatus, setAgentStatus] = useState<string>('unknown');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'epics' | 'stories' | 'tasks' | 'cycles' | 'queries' | 'claude-md'
  >('overview');
  const [claudeMdLastUpdate, setClaudeMdLastUpdate] = useState<Date | null>(
    null
  );
  const [initializationProgress, setInitializationProgress] = useState<{
    currentPhase?: string;
    progress?: number;
    message?: string;
  } | null>(null);

  // Check URL parameters for tab selection
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'claude-md') {
      setActiveTab('claude-md');
    } else if (tab === 'queries') {
      setActiveTab('queries');
    } else if (tab === 'epics') {
      setActiveTab('epics');
    } else if (tab === 'stories') {
      setActiveTab('stories');
    } else if (tab === 'tasks') {
      setActiveTab('tasks');
    } else if (tab === 'cycles') {
      setActiveTab('cycles');
    } else {
      setActiveTab('overview');
    }
  }, []);

  const fetchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${params.id}`);
      const data = await response.json();

      if (data.success) {
        setProject(data.data);

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
      const response = await fetch(`/api/projects/progress/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setInitializationProgress({
            currentPhase: data.data.currentPhase,
            progress: data.data.progress,
            message: data.data.message,
          });
        }
      }
    } catch (err) {
      // Silently fail - progress is optional
      console.warn('Failed to fetch initialization progress:', err);
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

  useEffect(() => {
    fetchProject();
    fetchAgentStatus();
    fetchClaudeMdStatus();

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-accent-100 text-accent-800';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800';
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
          <Link
            href="/projects"
            className="inline-block px-6 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 transition-colors font-medium"
          >
            返回專案列表
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

      <div className="h-[calc(100vh-120px)] flex">
        {/* Agent Status Panel - Always Visible */}
        <div className="w-64 lg:w-72 xl:w-80 2xl:w-96 p-4 bg-primary-950 border-r border-primary-800 h-full overflow-y-auto flex-shrink-0">
          <AgentStatusPanel projectId={project.id} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Tabs - Organized by Workflow */}
          <div className="border-b border-primary-800 bg-primary-950">
            <div className="flex overflow-x-auto">
              {/* 1. PLANNING PHASE */}
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
                專案總覽
              </button>
              
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
                Epic 規劃
              </button>
              
              {/* 2. DEVELOPMENT PHASE */}
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
                Story 開發
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
                TDD 週期
              </button>
              
              {/* 3. EXECUTION PHASE */}
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
                任務執行
              </button>
              
              {/* 4. COMMUNICATION PHASE */}
              <button
                onClick={() => setActiveTab('queries')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'queries'
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
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                AI 諮詢
              </button>
              
              {/* 5. DOCUMENTATION PHASE */}
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
          <div className="flex-1">
            {/* Unified Project Overview */}
            <div
              className={`h-full ${activeTab === 'overview' ? 'block' : 'hidden'}`}
            >
              <div className="p-6 h-full overflow-y-auto">
                <UnifiedProjectOverview projectId={project.id} />
              </div>
            </div>

            {/* Epics Management Tab */}
            <div
              className={`h-full ${activeTab === 'epics' ? 'block' : 'hidden'}`}
            >
              <div className="p-6 h-full overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-accent-50">Epic 規劃</h2>
                      <p className="text-primary-300 mt-1">規劃專案的主要功能模組和大型需求</p>
                    </div>
                    <button className="px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      新增 Epic
                    </button>
                  </div>
                  
                  {/* Epic List Placeholder */}
                  <div className="bg-primary-900 border border-primary-700 rounded-lg p-8 text-center">
                    <div className="text-primary-400 mb-4">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-primary-200 mb-2">尚無 Epic</h3>
                    <p className="text-primary-400 text-sm">建立您的第一個 Epic 來組織專案功能</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stories Management Tab */}
            <div
              className={`h-full ${activeTab === 'stories' ? 'block' : 'hidden'}`}
            >
              <div className="p-6 h-full overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-accent-50">Story 開發</h2>
                      <p className="text-primary-300 mt-1">開發用戶故事和具體任務</p>
                    </div>
                    <button className="px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      新增 Story
                    </button>
                  </div>
                  
                  {/* Story Kanban Board Placeholder */}
                  <div className="grid grid-cols-4 gap-4">
                    {['待辦', '進行中', '審查', '完成'].map((status, index) => (
                      <div key={index} className="bg-primary-900 border border-primary-700 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-accent-50 mb-4">{status}</h3>
                        <div className="text-center py-8 text-primary-400">
                          <p className="text-sm">無 Story</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Tasks Tracking Tab */}
            <div
              className={`h-full ${activeTab === 'tasks' ? 'block' : 'hidden'}`}
            >
              <div className="p-6 h-full overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-accent-50">任務執行</h2>
                      <p className="text-primary-300 mt-1">監控代理程式執行的任務狀態與進度</p>
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
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-primary-200 mb-2">尚無執行任務</h3>
                    <p className="text-primary-400 text-sm">代理程式執行的任務將顯示在這裡</p>
                  </div>
                </div>
              </div>
            </div>

            {/* TDD Cycles Tab */}
            <div
              className={`h-full ${activeTab === 'cycles' ? 'block' : 'hidden'}`}
            >
              <div className="p-6 h-full overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-accent-50">TDD 週期管理</h2>
                      <p className="text-primary-300 mt-1">追蹤測試驅動開發的 RED-GREEN-REFACTOR-REVIEW 週期</p>
                    </div>
                    <button className="px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      新增週期
                    </button>
                  </div>
                  
                  {/* TDD Cycle Phases */}
                  <div className="grid grid-cols-4 gap-4 mb-8">
                    {[
                      { name: 'RED', desc: '編寫失敗測試', color: 'bg-red-900 border-red-700 text-red-200' },
                      { name: 'GREEN', desc: '實作最少代碼', color: 'bg-green-900 border-green-700 text-green-200' },
                      { name: 'REFACTOR', desc: '重構優化代碼', color: 'bg-blue-900 border-blue-700 text-blue-200' },
                      { name: 'REVIEW', desc: '代碼審查', color: 'bg-purple-900 border-purple-700 text-purple-200' }
                    ].map((phase, index) => (
                      <div key={index} className={`border rounded-lg p-4 ${phase.color}`}>
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
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-primary-200 mb-2">尚無 TDD 週期</h3>
                    <p className="text-primary-400 text-sm">開始您的第一個測試驅動開發週期</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Queries Tab */}
            <div
              className={`h-full ${activeTab === 'queries' ? 'block' : 'hidden'}`}
            >
              <div className="p-6 h-full overflow-y-auto">
                <UserQueriesPanel projectId={project.id} />
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
    </div>
  );
}