'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/ToastManager';

interface Test {
  id: string;
  name: string;
  status: string;
  duration?: number;
  lastRun?: string;
}

interface Artifact {
  id: string;
  type: string;
  name: string;
  phase: string;
  createdAt: string;
}

interface Cycle {
  id: string;
  title: string;
  description?: string;
  phase: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  tests: Test[];
  artifacts: Artifact[];
}

interface TDDDashboardProps {
  projectId: string;
}

export default function TDDDashboard({ projectId }: TDDDashboardProps) {
  const { showToast } = useToast();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  const fetchCycles = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/cycles`);
      const data = await response.json();

      if (data.success) {
        setCycles(data.data);
        // Set active cycle if exists
        const active = data.data.find((c: Cycle) => c.status === 'ACTIVE');
        setActiveCycle(active || null);
      } else {
        showToast(data.error || '無法載入 TDD 週期', 'error');
      }
    } catch (error) {
      showToast('無法載入 TDD 週期', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
    
    // Set up SSE connection for real-time updates
    if (!projectId) return;
    
    console.log(`🔗 Connecting to TDD Cycles SSE for project: ${projectId}`);
    const eventSource = new EventSource(`/api/projects/${projectId}/cycles/live`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 TDD Cycles SSE Event received:', data);
        
        if (data.type === 'connected') {
          console.log(`✅ Connected to TDD cycles stream for project: ${data.projectId}`);
        } else if (data.type === 'cycles_state') {
          // Handle initial cycles state
          setCycles(data.cycles || []);
        } else if (data.type === 'cycles_updated') {
          // Handle cycle updates
          setCycles(data.cycles || []);
        }
      } catch (error) {
        console.error('Error parsing TDD cycles SSE event:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('TDD Cycles SSE connection error:', error);
      // Fallback to manual fetch on error
      setTimeout(fetchCycles, 5000);
    };
    
    return () => {
      console.log('🔌 Closing TDD Cycles SSE connection');
      eventSource.close();
    };
  }, [projectId]);

  const executePhase = async (cycleId: string) => {
    setExecuting(true);
    try {
      const response = await fetch(`/api/cycles/${cycleId}/execute`, {
        method: 'PUT',
      });
      const data = await response.json();

      if (data.success) {
        showToast(`執行階段成功：${data.data.nextPhase || '完成'}`, 'success');
        fetchCycles();
      } else {
        showToast(data.error || '執行階段失敗', 'error');
      }
    } catch (error) {
      showToast('執行階段失敗', 'error');
    } finally {
      setExecuting(false);
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'RED':
        return 'text-red-500 bg-red-900';
      case 'GREEN':
        return 'text-green-500 bg-green-900';
      case 'REFACTOR':
        return 'text-blue-500 bg-blue-900';
      case 'REVIEW':
        return 'text-purple-500 bg-purple-900';
      default:
        return 'text-gray-500 bg-gray-900';
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'RED':
        return (
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
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'GREEN':
        return (
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
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'REFACTOR':
        return (
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        );
      case 'REVIEW':
        return (
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
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const getTestStatusIcon = (status: string) => {
    switch (status) {
      case 'PASSING':
        return <span className="text-green-500">✓</span>;
      case 'FAILING':
        return <span className="text-red-500">✗</span>;
      case 'SKIPPED':
        return <span className="text-yellow-500">⚠</span>;
      default:
        return <span className="text-gray-500">○</span>;
    }
  };

  if (loading) {
    return (
      <div className="bg-primary-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-primary-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-primary-700 rounded"></div>
            <div className="h-4 bg-primary-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-accent-50 mb-6">
        TDD 開發儀表板
      </h2>

      {activeCycle ? (
        <div className="space-y-6">
          {/* Active Cycle Overview */}
          <div className="bg-primary-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-accent-50">
                  {activeCycle.title}
                </h3>
                {activeCycle.description && (
                  <p className="text-sm text-primary-300 mt-1">
                    {activeCycle.description}
                  </p>
                )}
              </div>
              <div
                className={`flex items-center gap-2 px-3 py-1 rounded-full ${getPhaseColor(activeCycle.phase)}`}
              >
                {getPhaseIcon(activeCycle.phase)}
                <span className="font-medium">{activeCycle.phase}</span>
              </div>
            </div>

            {/* TDD Phase Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-primary-400 mb-2">
                <span>進度</span>
                <span>{activeCycle.phase} 階段</span>
              </div>
              <div className="flex gap-2">
                {['RED', 'GREEN', 'REFACTOR', 'REVIEW'].map((phase, index) => (
                  <div
                    key={phase}
                    className={`flex-1 h-2 rounded-full transition-colors ${
                      index <=
                      ['RED', 'GREEN', 'REFACTOR', 'REVIEW'].indexOf(
                        activeCycle.phase
                      )
                        ? getPhaseColor(phase)
                            .split(' ')[0]
                            .replace('text', 'bg')
                        : 'bg-primary-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Tests Status */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-accent-50 mb-2">
                測試狀態
              </h4>
              <div className="space-y-2">
                {activeCycle.tests.length > 0 ? (
                  activeCycle.tests.map(test => (
                    <div
                      key={test.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {getTestStatusIcon(test.status)}
                        <span className="text-primary-300">{test.name}</span>
                      </div>
                      {test.duration && (
                        <span className="text-primary-400">
                          {test.duration}ms
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-primary-400">尚未生成測試</p>
                )}
              </div>
            </div>

            {/* Execute Phase Button */}
            <button
              onClick={() => executePhase(activeCycle.id)}
              disabled={executing || activeCycle.status !== 'ACTIVE'}
              className="w-full px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {executing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-50"></div>
                  執行中...
                </>
              ) : (
                <>
                  執行 {activeCycle.phase} 階段
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
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Recent Artifacts */}
          <div className="bg-primary-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-accent-50 mb-3">
              最近生成的檔案
            </h4>
            <div className="space-y-2">
              {activeCycle.artifacts.slice(-5).map(artifact => (
                <div
                  key={artifact.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        artifact.type === 'CODE'
                          ? 'bg-blue-900 text-blue-300'
                          : artifact.type === 'TEST'
                            ? 'bg-green-900 text-green-300'
                            : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {artifact.type}
                    </span>
                    <span className="text-primary-300">{artifact.name}</span>
                  </div>
                  <span className="text-primary-400 text-xs">
                    {new Date(artifact.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-primary-400">目前沒有活躍的 TDD 週期</p>
        </div>
      )}

      {/* Completed Cycles */}
      {cycles.filter(c => c.status === 'COMPLETED').length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-accent-50 mb-3">
            已完成的週期
          </h3>
          <div className="space-y-2">
            {cycles
              .filter(c => c.status === 'COMPLETED')
              .map(cycle => (
                <div
                  key={cycle.id}
                  className="bg-primary-700 rounded p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm text-accent-50">{cycle.title}</p>
                    <p className="text-xs text-primary-400">
                      完成於 {new Date(cycle.completedAt!).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-green-500">
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-sm">已完成</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
