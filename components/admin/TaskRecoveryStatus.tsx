'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface RecoveryStats {
  totalInitializing: number;
  recovered: number;
  failed: number;
  orphaned: number;
}

interface SystemStatus {
  projects: {
    total: number;
    initializing: number;
    active: number;
    archived: number;
  };
  tasks: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
}

interface TaskRecoveryData {
  systemStatus: SystemStatus;
  recoveryStats: RecoveryStats;
  needsRecovery: boolean;
}

export default function TaskRecoveryStatus() {
  const [data, setData] = useState<TaskRecoveryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/task-recovery');
      const result = await response.json();

      if (result.success) {
        setData(result);
        setLastUpdate(new Date());
      } else {
        setError(result.error || 'Failed to fetch status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const triggerRecovery = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/task-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recover' }),
      });

      const result = await response.json();

      if (result.success) {
        await fetchStatus(); // Refresh status after recovery
        console.log('Recovery completed:', result);
      } else {
        setError(result.error || 'Recovery failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery failed');
    } finally {
      setLoading(false);
    }
  };

  const cleanupOldTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/task-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup' }),
      });

      const result = await response.json();

      if (result.success) {
        await fetchStatus(); // Refresh status after cleanup
        console.log('Cleanup completed:', result);
      } else {
        setError(result.error || 'Cleanup failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!data && loading) {
    return (
      <div className="bg-primary-900 border border-primary-800 rounded-lg p-6">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin text-accent-400" />
          <span className="text-primary-300">載入任務恢復狀態...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary-900 border border-primary-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-accent-50 flex items-center">
          <RefreshCw className="w-5 h-5 mr-2" />
          任務恢復狀態
        </h2>

        <div className="flex space-x-2">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="px-3 py-1 bg-primary-800 hover:bg-primary-700 border border-primary-700 rounded text-sm text-primary-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={triggerRecovery}
            disabled={loading || !data?.needsRecovery}
            className="px-3 py-1 bg-accent-600 hover:bg-accent-700 rounded text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            手動恢復
          </button>

          <button
            onClick={cleanupOldTasks}
            disabled={loading}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm text-white disabled:opacity-50"
          >
            清理舊任務
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* System Status */}
          <div>
            <h3 className="text-lg font-medium text-accent-50 mb-3">
              系統狀態
            </h3>

            {/* Recovery Status Indicator */}
            <div className="mb-4 p-3 rounded-lg border flex items-center space-x-3 ${data.needsRecovery ? 'bg-yellow-900/20 border-yellow-700' : 'bg-green-900/20 border-green-700'}">
              {data.needsRecovery ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <div>
                    <span className="text-yellow-400 font-medium">
                      需要恢復
                    </span>
                    <p className="text-yellow-300 text-sm">
                      發現 {data.systemStatus.projects.initializing}{' '}
                      個初始化中的專案或 {data.systemStatus.tasks.pending}{' '}
                      個待處理任務
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <span className="text-green-400 font-medium">系統正常</span>
                    <p className="text-green-300 text-sm">沒有需要恢復的任務</p>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Projects */}
              <div className="bg-primary-800 rounded-lg p-4">
                <h4 className="text-accent-50 font-medium mb-2">專案</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-primary-300">總計</span>
                    <span className="text-accent-50">
                      {data.systemStatus.projects.total}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-400">初始化中</span>
                    <span className="text-yellow-400">
                      {data.systemStatus.projects.initializing}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-400">活躍</span>
                    <span className="text-green-400">
                      {data.systemStatus.projects.active}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">已歸檔</span>
                    <span className="text-gray-400">
                      {data.systemStatus.projects.archived}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="bg-primary-800 rounded-lg p-4">
                <h4 className="text-accent-50 font-medium mb-2">任務</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-primary-300">總計</span>
                    <span className="text-accent-50">
                      {data.systemStatus.tasks.total}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-400">待處理</span>
                    <span className="text-yellow-400">
                      {data.systemStatus.tasks.pending}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-400">執行中</span>
                    <span className="text-blue-400">
                      {data.systemStatus.tasks.running}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-400">已完成</span>
                    <span className="text-green-400">
                      {data.systemStatus.tasks.completed}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-400">失敗</span>
                    <span className="text-red-400">
                      {data.systemStatus.tasks.failed}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Last Update */}
          {lastUpdate && (
            <div className="text-xs text-primary-500">
              最後更新: {lastUpdate.toLocaleString('zh-TW')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
