'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, CheckCircle, XCircle, MoreVertical } from 'lucide-react';

interface SprintActionsProps {
  sprint: {
    id: string;
    status: string;
    projectId: string;
  };
}

export function SprintActions({ sprint }: SprintActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleStartSprint = async () => {
    if (!confirm('確定要開始這個 Sprint 嗎？')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/sprints/${sprint.id}/start`, {
        method: 'POST',
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || '無法開始 Sprint');
      }
    } catch (error) {
      console.error('Error starting sprint:', error);
      alert('開始 Sprint 時發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSprint = async () => {
    if (!confirm('確定要完成這個 Sprint 嗎？未完成的故事將移回待辦清單。')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/sprints/${sprint.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          moveUnfinishedToBacklog: true,
        }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || '無法完成 Sprint');
      }
    } catch (error) {
      console.error('Error completing sprint:', error);
      alert('完成 Sprint 時發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBurndown = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sprints/${sprint.id}/burndown`, {
        method: 'POST',
      });

      if (response.ok) {
        router.refresh();
        alert('燃盡圖已更新');
      } else {
        alert('更新燃盡圖時發生錯誤');
      }
    } catch (error) {
      console.error('Error updating burndown:', error);
      alert('更新燃盡圖時發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {sprint.status === 'PLANNING' && (
        <button
          onClick={handleStartSprint}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400"
        >
          <Play className="h-4 w-4 mr-2" />
          {loading ? '開始中...' : '開始 Sprint'}
        </button>
      )}

      {sprint.status === 'ACTIVE' && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdateBurndown}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-100"
          >
            更新燃盡圖
          </button>
          <button
            onClick={handleCompleteSprint}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {loading ? '完成中...' : '完成 Sprint'}
          </button>
        </div>
      )}

      {sprint.status === 'COMPLETED' && (
        <div className="inline-flex items-center px-4 py-2 text-sm font-medium text-green-700">
          <CheckCircle className="h-5 w-5 mr-2" />
          Sprint 已完成
        </div>
      )}

      {sprint.status === 'CANCELLED' && (
        <div className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700">
          <XCircle className="h-5 w-5 mr-2" />
          Sprint 已取消
        </div>
      )}
    </div>
  );
}