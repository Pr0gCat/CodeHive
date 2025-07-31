'use client';

import { useEffect, useRef, useState } from 'react';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
  metadata?: Record<string, any>;
}

interface ProjectLogsModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectLogsModal({
  projectId,
  isOpen,
  onClose,
}: ProjectLogsModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<
    'all' | 'info' | 'warn' | 'error' | 'debug'
  >('all');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !projectId) return;

    // Fetch initial logs
    const fetchInitialLogs = async () => {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/logs?limit=100`
        );
        const data = await response.json();

        if (data.success && data.data && Array.isArray(data.data.logs)) {
          setLogs(data.data.logs);
        } else {
          console.warn('收到無效的記錄資料：', data);
          setLogs([]);
        }
      } catch (error) {
        console.error('無法載入初始記錄：', error);
        setLogs([]);
      }
    };

    // Connect to Server-Sent Events for real-time logs
    const connectSSE = () => {
      const eventSource = new EventSource(
        `/api/projects/${projectId}/logs/stream`
      );

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log('已連接到專案記錄串流');
      };

      eventSource.onmessage = event => {
        try {
          const logEntry: LogEntry = JSON.parse(event.data);
          // Validate log entry has required fields
          if (
            logEntry.id &&
            logEntry.timestamp &&
            logEntry.level &&
            logEntry.message &&
            logEntry.source
          ) {
            setLogs(prev => [...prev, logEntry]);
          }
        } catch (error) {
          console.error('無法解析記錄項目：', error);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        console.log('已從專案記錄串流斷線');
        eventSource.close();

        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (isOpen) {
            connectSSE();
          }
        }, 3000);
      };

      eventSourceRef.current = eventSource;
    };

    fetchInitialLogs();
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isOpen, projectId]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!logsContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;

    setAutoScroll(isAtBottom);
  };

  const clearLogs = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/logs`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const data = await response.json();
        setLogs([]);
        console.log(`已從資料庫清除 ${data.data?.deletedCount || 0} 筆記錄`);
      } else {
        console.error('清除記錄失敗');
      }
    } catch (error) {
      console.error('清除記錄時發生錯誤：', error);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      case 'debug':
        return 'text-purple-400';
      default:
        return 'text-primary-300';
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-900 text-red-300 border-red-700';
      case 'warn':
        return 'bg-yellow-900 text-yellow-300 border-yellow-700';
      case 'info':
        return 'bg-blue-900 text-blue-300 border-blue-700';
      case 'debug':
        return 'bg-purple-900 text-purple-300 border-purple-700';
      default:
        return 'bg-primary-800 text-primary-300 border-primary-600';
    }
  };

  const filteredLogs = Array.isArray(logs)
    ? filter === 'all'
      ? logs
      : logs.filter(log => log.level === filter)
    : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-primary-900 rounded-lg w-full max-w-6xl h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-primary-700 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-accent-50">專案記錄</h2>
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
              ></div>
              <span className="text-sm text-primary-400">
                {isConnected ? '已連接' : '已斷線'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Filter */}
            <select
              value={filter}
              onChange={e => setFilter(e.target.value as any)}
              className="px-3 py-1 bg-primary-800 border border-primary-600 rounded text-accent-50 text-sm focus:outline-none focus:border-accent-500"
            >
              <option value="all">全部</option>
              <option value="error">錯誤</option>
              <option value="warn">警告</option>
              <option value="info">資訊</option>
              <option value="debug">除錯</option>
            </select>

            {/* Auto-scroll toggle */}
            <label className="flex items-center text-sm text-primary-300">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
                className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500 mr-2"
              />
              自動捲動
            </label>

            {/* Clear logs */}
            <button
              onClick={clearLogs}
              className="px-3 py-1 text-sm text-primary-300 border border-primary-600 rounded hover:bg-primary-800 hover:text-accent-50"
            >
              清除記錄
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="text-primary-400 hover:text-accent-50"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Logs content */}
        <div
          ref={logsContainerRef}
          onScroll={handleScroll}
          className="p-4 flex-1 overflow-y-auto bg-primary-950 font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-primary-400">
              {logs.length === 0 ? '無可用記錄' : `沒有符合目前篩選條件的記錄`}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map(log => (
                <div
                  key={log.id}
                  className="flex items-start space-x-3 p-2 hover:bg-primary-900/50 rounded"
                >
                  <span className="text-primary-500 text-xs whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded border ${getLevelBadgeColor(log.level || 'info')} whitespace-nowrap`}
                  >
                    {(log.level || 'info').toUpperCase()}
                  </span>
                  <span className="text-primary-400 text-xs whitespace-nowrap">
                    {log.source || 'system'}
                  </span>
                  <span
                    className={`flex-1 ${getLevelColor(log.level || 'info')} break-words`}
                  >
                    {log.message || '無訊息'}
                  </span>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <details className="text-xs text-primary-500">
                      <summary className="cursor-pointer">中繼資料</summary>
                      <pre className="mt-1 text-primary-600">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-primary-700 bg-primary-900 flex-shrink-0">
          <div className="text-sm text-primary-400">
            {filteredLogs.length} 項目{' '}
            {filter !== 'all' && `(${logs.length} 總計)`}
          </div>
          <div className="text-xs text-primary-500">
            記錄更新透過 Server-Sent Events 即時傳送
          </div>
        </div>
      </div>
    </div>
  );
}
