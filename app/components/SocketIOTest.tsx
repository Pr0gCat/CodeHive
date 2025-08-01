'use client';

import { useState } from 'react';
import { useSocket } from '@/lib/socket/client';

export default function SocketIOTest() {
  const [testTaskId, setTestTaskId] = useState('test-task-123');
  const {
    connected,
    error,
    events,
    phases,
    taskStatus,
    subscribeToTask,
    unsubscribeFromTask,
    clearEvents,
    clearError,
  } = useSocket();

  const handleSubscribe = () => {
    if (testTaskId) {
      subscribeToTask(testTaskId);
    }
  };

  const handleUnsubscribe = () => {
    if (testTaskId) {
      unsubscribeFromTask(testTaskId);
    }
  };

  const triggerTestEvent = async () => {
    // This would be called by your backend when a real task event occurs
    // For testing, we can simulate it by calling the task event emitter
    try {
      const response = await fetch('/api/test-websocket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: testTaskId }),
      });
      const data = await response.json();
      console.log('Test event triggered:', data);
    } catch (error) {
      console.error('Failed to trigger test event:', error);
    }
  };

  return (
    <div className="bg-primary-900 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold text-accent-50">Socket.IO 測試</h2>
      
      {/* Connection Status */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <div 
            className={`w-3 h-3 rounded-full ${
              connected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-primary-300">
            狀態: {connected ? '已連接' : '未連接'}
          </span>
        </div>
        
        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded p-2">
            <span className="text-red-400 text-sm">錯誤: {error}</span>
            <button 
              onClick={clearError}
              className="ml-2 text-red-300 hover:text-red-100 text-xs underline"
            >
              清除
            </button>
          </div>
        )}
      </div>

      {/* Task ID Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-primary-300">
          測試任務 ID:
        </label>
        <input
          type="text"
          value={testTaskId}
          onChange={(e) => setTestTaskId(e.target.value)}
          className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
          placeholder="輸入任務 ID"
        />
      </div>

      {/* Controls */}
      <div className="flex space-x-2">
        <button
          onClick={handleSubscribe}
          disabled={!connected || !testTaskId}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          訂閱任務
        </button>
        <button
          onClick={handleUnsubscribe}
          disabled={!connected || !testTaskId}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          取消訂閱
        </button>
        <button
          onClick={triggerTestEvent}
          disabled={!connected || !testTaskId}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          觸發測試事件
        </button>
        <button
          onClick={clearEvents}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          清除事件
        </button>
      </div>

      {/* Task Status */}
      {taskStatus && (
        <div className="bg-primary-800 rounded p-3">
          <h3 className="text-lg font-semibold text-accent-50 mb-2">任務狀態:</h3>
          <pre className="text-sm text-primary-300 overflow-auto">
            {JSON.stringify(taskStatus, null, 2)}
          </pre>
        </div>
      )}

      {/* Phases */}
      {phases.length > 0 && (
        <div className="bg-primary-800 rounded p-3">
          <h3 className="text-lg font-semibold text-accent-50 mb-2">
            階段 ({phases.length}):
          </h3>
          <div className="space-y-2">
            {phases.map((phase, index) => (
              <div key={phase.id} className="bg-primary-700 rounded p-2">
                <div className="flex justify-between items-center">
                  <span className="text-accent-50 font-medium">{phase.title}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    phase.status === 'completed' ? 'bg-green-600 text-white' :
                    phase.status === 'active' ? 'bg-blue-600 text-white' :
                    phase.status === 'error' ? 'bg-red-600 text-white' :
                    'bg-gray-600 text-white'
                  }`}>
                    {phase.status}
                  </span>
                </div>
                <div className="text-sm text-primary-300 mt-1">
                  {phase.description}
                </div>
                <div className="mt-2">
                  <div className="bg-primary-600 rounded-full h-2">
                    <div 
                      className="bg-accent-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${phase.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-primary-400 mt-1">
                    {phase.progress}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events */}
      <div className="bg-primary-800 rounded p-3">
        <h3 className="text-lg font-semibold text-accent-50 mb-2">
          接收到的事件 ({events.length}):
        </h3>
        {events.length === 0 ? (
          <p className="text-primary-400 text-sm">尚無事件</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {events.slice(-10).reverse().map((event, index) => (
              <div key={index} className="bg-primary-700 rounded p-2">
                <div className="flex justify-between items-start">
                  <span className="text-accent-50 font-medium">{event.type}</span>
                  <span className="text-xs text-primary-400">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {event.data && (
                  <pre className="text-xs text-primary-300 mt-1 overflow-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}