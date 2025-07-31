'use client';

import { Project, ProjectSettings } from '@/lib/db';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AgentStatusPanel from '../../components/AgentStatusPanel';
import AIAssistant from '../../components/AIAssistant';
import EpicDashboard from '../../components/EpicDashboard';
import HierarchicalProjectView from '../../components/HierarchicalProjectView';
import ProjectLogsModal from '../../components/ProjectLogsModal';
import ProjectSettingsModal from '../../components/ProjectSettingsModal';
import TDDDashboard from '../../components/TDDDashboard';
import { useToast } from '@/components/ui/ToastManager';
import UserQueriesPanel from '../../components/UserQueriesPanel';
import ClaudeMdViewer from '../../components/ClaudeMdViewer';

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
    'overview' | 'development' | 'queries' | 'claude-md'
  >('overview');
  const [devSubTab, setDevSubTab] = useState<'epics' | 'tdd'>('epics');
  const [claudeMdLastUpdate, setClaudeMdLastUpdate] = useState<Date | null>(null);

  // Check URL parameters for tab selection
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'development') {
      setActiveTab('development');
    } else if (tab === 'queries') {
      setActiveTab('queries');
    } else if (tab === 'claude-md') {
      setActiveTab('claude-md');
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
      } else {
        setError(data.error || '無法載入專案');
      }
    } catch {
      setError('無法載入專案');
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
      
      eventSource.onmessage = (event) => {
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
      
      eventSource.onerror = (error) => {
        const eventSourceState = eventSource?.readyState;
        
        // Only log error if it's not a normal close (readyState 2)
        if (eventSourceState !== EventSource.CLOSED) {
          console.warn('Agent Queue SSE connection interrupted, attempting to reconnect...');
        }
        
        // Close current connection
        eventSource?.close();
        
        // Attempt to reconnect if under limit
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);
          
          console.log(`🔄 Reconnecting Agent Queue SSE in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
          
          reconnectTimeout = setTimeout(() => {
            connectAgentSSE();
          }, delay);
        } else {
          console.error('Agent Queue SSE max reconnection attempts reached, falling back to polling');
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
          {/* Tabs */}
          <div className="border-b border-primary-800 bg-primary-950">
            <div className="flex">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-8 py-4 text-base font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'overview'
                    ? 'text-accent-50 border-accent-500'
                    : 'text-primary-400 hover:text-accent-50 border-transparent hover:border-primary-600'
                }`}
              >
                <svg
                  className="w-5 h-5"
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
                總覽
              </button>
              <button
                onClick={() => setActiveTab('development')}
                className={`px-8 py-4 text-base font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'development'
                    ? 'text-accent-50 border-accent-500'
                    : 'text-primary-400 hover:text-accent-50 border-transparent hover:border-primary-600'
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
                開發
              </button>
              <button
                onClick={() => setActiveTab('queries')}
                className={`px-8 py-4 text-base font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'queries'
                    ? 'text-accent-50 border-accent-500'
                    : 'text-primary-400 hover:text-accent-50 border-transparent hover:border-primary-600'
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                諮詢
              </button>
              <button
                onClick={() => setActiveTab('claude-md')}
                className={`px-8 py-4 text-base font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'claude-md'
                    ? 'text-accent-50 border-accent-500'
                    : 'text-primary-400 hover:text-accent-50 border-transparent hover:border-primary-600'
                }`}
              >
                <svg
                  className="w-5 h-5"
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
                  <span>CLAUDE.md</span>
                  {claudeMdLastUpdate && (
                    <span className="text-xs text-primary-500 font-normal">
                      {claudeMdLastUpdate.toLocaleDateString('zh-TW', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1">
            {/* Project Overview */}
            <div
              className={`h-full ${activeTab === 'overview' ? 'block' : 'hidden'}`}
            >
              <div className="p-6 h-full overflow-y-auto">
                <HierarchicalProjectView projectId={project.id} />
              </div>
            </div>

            {/* Development Tab with Sub-navigation */}
            <div
              className={`h-full flex flex-col ${activeTab === 'development' ? 'block' : 'hidden'}`}
            >
              {/* Sub-tabs */}
              <div className="bg-primary-900 border-b border-primary-800">
                <div className="flex px-6">
                  <button
                    onClick={() => setDevSubTab('epics')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      devSubTab === 'epics'
                        ? 'text-accent-50 border-accent-500'
                        : 'text-primary-400 hover:text-accent-50 border-transparent'
                    }`}
                  >
                    Epic 管理
                  </button>
                  <button
                    onClick={() => setDevSubTab('tdd')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      devSubTab === 'tdd'
                        ? 'text-accent-50 border-accent-500'
                        : 'text-primary-400 hover:text-accent-50 border-transparent'
                    }`}
                  >
                    TDD 開發
                  </button>
                </div>
              </div>

              {/* Sub-tab Content */}
              <div className="flex-1">
                {/* Epic Dashboard */}
                <div
                  className={`h-full ${devSubTab === 'epics' ? 'block' : 'hidden'}`}
                >
                  <div className="p-6 h-full overflow-y-auto">
                    <EpicDashboard projectId={project.id} />
                  </div>
                </div>

                {/* TDD Dashboard */}
                <div
                  className={`h-full ${devSubTab === 'tdd' ? 'block' : 'hidden'}`}
                >
                  <div className="p-6 h-full overflow-y-auto">
                    <TDDDashboard projectId={project.id} />
                  </div>
                </div>
              </div>
            </div>

            {/* User Queries Panel */}
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

      {/* AI Assistant */}
      <AIAssistant projectId={project.id} />
    </div>
  );
}
