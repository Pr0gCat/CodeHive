'use client';

import { useState, useEffect } from 'react';
import { ConversationalInput } from './ConversationalInput';
import { AlertTriangle, CheckCircle, Clock, Zap, Target, Play, Pause, Settings } from 'lucide-react';

interface Epic {
  id: string;
  title: string;
  progress: number;
  status: string;
  currentWork: string;
}

interface Query {
  id: string;
  question: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  blockedCycles: number;
  context?: string;
  createdAt: string;
}

interface Resources {
  tokensUsed: number;
  tokensRemaining: number;
  status: 'ACTIVE' | 'WARNING' | 'CRITICAL';
}

interface ProgressOverview {
  epics: Epic[];
  queries: Query[];
  resources: Resources;
  project: {
    id: string;
    lastActivity: string;
  };
}

interface WorkflowState {
  currentPhase: 'PLANNING' | 'DEVELOPMENT' | 'REVIEW' | 'BLOCKED' | 'COMPLETED';
  activeAgents: string[];
  blockedWork: string[];
  pendingQueries: string[];
  tokenStatus: 'ACTIVE' | 'WARNING' | 'CRITICAL' | 'BLOCKED';
}


interface ImprovedProjectOverviewProps {
  projectId: string;
}

export function ImprovedProjectOverview({ projectId }: ImprovedProjectOverviewProps) {
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [coordinationActive, setCoordinationActive] = useState(false);

  useEffect(() => {
    fetchOverview();
    fetchWorkflowState();
    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      fetchOverview();
      fetchWorkflowState();
    }, 30000);
    return () => clearInterval(interval);
  }, [projectId]);

  const fetchOverview = async () => {
    try {
      const response = await fetch(`/api/progress/overview?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setOverview(data);
      }
    } catch (error) {
      console.error('Error fetching overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowState = async () => {
    try {
      const response = await fetch(`/api/development/coordinate?projectId=${projectId}`);
      if (response.ok) {
        const result = await response.json();
        setWorkflowState(result.data);
      }
    } catch (error) {
      console.error('Error fetching workflow state:', error);
    }
  };

  const handleUserInput = async (message: string) => {
    setInputDisabled(true);
    try {
      const response = await fetch('/api/input', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          projectId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Feature request processed:', result);
        // Refresh overview after processing
        await fetchOverview();
      } else {
        const error = await response.json();
        console.error('Error processing input:', error);
        // TODO: Show user-friendly error message
      }
    } catch (error) {
      console.error('Error submitting input:', error);
    } finally {
      setInputDisabled(false);
    }
  };

  const handleStartCoordination = async () => {
    setCoordinationActive(true);
    try {
      const response = await fetch('/api/development/coordinate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          action: 'coordinate',
        }),
      });

      if (response.ok) {
        console.log('Development coordination started');
        await fetchWorkflowState();
      }
    } catch (error) {
      console.error('Error starting coordination:', error);
    } finally {
      setCoordinationActive(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500"></div>
      </div>
    );
  }

  const urgentQueries = overview?.queries.filter(q => q.priority === 'HIGH') || [];

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'PLANNING': return 'bg-blue-100 text-blue-800';
      case 'DEVELOPMENT': return 'bg-green-100 text-green-800';
      case 'REVIEW': return 'bg-purple-100 text-purple-800';
      case 'BLOCKED': return 'bg-red-100 text-red-800';
      case 'COMPLETED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTokenStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-400';
      case 'WARNING': return 'text-yellow-400';
      case 'CRITICAL': return 'text-red-400';
      case 'BLOCKED': return 'text-red-300';
      default: return 'text-gray-400';
    }
  };

  const renderOverviewContent = () => (
    <div className="space-y-6">
      {/* AI Development Coordination Panel */}
      {workflowState && (
        <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-accent-400" />
              <h3 className="text-lg font-semibold text-accent-50">AI 開發協調</h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPhaseColor(workflowState.currentPhase)}`}>
                {workflowState.currentPhase}
              </span>
            </div>
            <button
              onClick={handleStartCoordination}
              disabled={coordinationActive}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-accent-50 bg-accent-600 hover:bg-accent-700 disabled:bg-primary-700 disabled:cursor-not-allowed"
            >
              {coordinationActive ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  協調中...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  開始協調
                </>
              )}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-primary-800 rounded-lg p-4">
              <h4 className="font-medium text-accent-50 mb-2">活躍代理</h4>
              <div className="space-y-1">
                {workflowState.activeAgents.length > 0 ? (
                  workflowState.activeAgents.map((agent) => (
                    <span key={agent} className="inline-flex items-center px-2 py-1 rounded text-xs bg-accent-800 text-accent-100">
                      {agent}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-primary-400">無活躍代理</span>
                )}
              </div>
            </div>
            
            <div className="bg-primary-800 rounded-lg p-4">
              <h4 className="font-medium text-accent-50 mb-2">工作狀態</h4>
              <div className="space-y-2">
                {workflowState.blockedWork.length > 0 && (
                  <div className="text-sm">
                    <span className="text-red-400 font-medium">{workflowState.blockedWork.length} 已阻塞</span>
                  </div>
                )}
                {workflowState.pendingQueries.length > 0 && (
                  <div className="text-sm">
                    <span className="text-yellow-400 font-medium">{workflowState.pendingQueries.length} 查詢待處理</span>
                  </div>
                )}
                {workflowState.blockedWork.length === 0 && workflowState.pendingQueries.length === 0 && (
                  <span className="text-sm text-green-400">全部正常</span>
                )}
              </div>
            </div>
            
            <div className="bg-primary-800 rounded-lg p-4">
              <h4 className="font-medium text-accent-50 mb-2">Token 預算</h4>
              <div className={`text-sm font-medium ${getTokenStatusColor(workflowState.tokenStatus)}`}>
                {workflowState.tokenStatus}
              </div>
              {workflowState.tokenStatus === 'BLOCKED' && (
                <p className="text-xs text-primary-400 mt-1">
                  因 Token 限制工作已暫停
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Urgent Queries Section */}
      {urgentQueries.length > 0 && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h3 className="text-lg font-semibold text-red-100">
              {urgentQueries.length} 個緊急問題阻塞開發
            </h3>
          </div>
          <div className="space-y-2">
            {urgentQueries.slice(0, 3).map((query) => (
              <div key={query.id} className="bg-primary-900 rounded p-3 border border-red-600">
                <p className="text-sm text-accent-50 mb-2">{query.question}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-red-400">
                    {query.blockedCycles} 個循環已阻塞
                  </span>
                  <button className="text-sm bg-red-600 text-accent-50 px-3 py-1 rounded hover:bg-red-700">
                    立即回答
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Input */}
      <div>
        <h3 className="text-lg font-semibold text-accent-50 mb-3">您想建構什麼？</h3>
        <ConversationalInput
          onSubmit={handleUserInput}
          disabled={inputDisabled}
          placeholder="描述功能、改進或任何您想要我建構的內容..."
        />
      </div>

      {/* Epics Progress */}
      {overview?.epics && overview.epics.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-accent-50 mb-3">開發進度</h3>
          <div className="space-y-3">
            {overview.epics.map((epic) => (
              <div key={epic.id} className="bg-primary-900 rounded-lg border border-primary-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-accent-50">{epic.title}</h4>
                  <span className="text-sm text-primary-300">{Math.round(epic.progress * 100)}%</span>
                </div>
                <div className="w-full bg-primary-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-accent-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${epic.progress * 100}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-primary-300">
                  <Clock className="h-4 w-4" />
                  <span>{epic.currentWork}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resources Status */}
      {overview?.resources && (
        <div className="bg-primary-900 rounded-lg border border-primary-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-accent-50">資源</h3>
            <div className={`flex items-center gap-2 text-sm font-medium ${
              overview.resources.status === 'ACTIVE' ? 'text-green-400' :
              overview.resources.status === 'WARNING' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              <Zap className="h-4 w-4" />
              {overview.resources.status}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-primary-300">已使用 Token</span>
              <span className="font-medium text-accent-50">{overview.resources.tokensUsed.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-primary-300">剩餘 Token</span>
              <span className="font-medium text-accent-50">{overview.resources.tokensRemaining.toLocaleString()}</span>
            </div>
            <div className="w-full bg-primary-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  overview.resources.status === 'ACTIVE' ? 'bg-green-500' :
                  overview.resources.status === 'WARNING' ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ 
                  width: `${Math.max(5, (overview.resources.tokensRemaining / (overview.resources.tokensUsed + overview.resources.tokensRemaining)) * 100)}%`
                }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500"></div>
      </div>
    );
  }

  return renderOverviewContent();
}