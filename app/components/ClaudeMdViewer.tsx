'use client';

import { useEffect, useState } from 'react';
import { FileText, RefreshCw, Settings, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/components/ui/ToastManager';

interface ClaudeMdViewerProps {
  projectId: string;
  onClaudeMdUpdate?: () => void;
}

interface ClaudeMdData {
  content: string | null;
  path: string;
  lastModified?: string;
  message?: string;
}

export default function ClaudeMdViewer({ projectId, onClaudeMdUpdate }: ClaudeMdViewerProps) {
  const { showToast } = useToast();
  const [claudeMdData, setClaudeMdData] = useState<ClaudeMdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');

  const fetchClaudeMd = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/projects/${projectId}/claude-md`);
      const data = await response.json();

      if (data.success) {
        setClaudeMdData(data.data);
      } else {
        setError(data.error || '無法載入 CLAUDE.md');
      }
    } catch (err) {
      setError('載入 CLAUDE.md 時發生錯誤');
      console.error('Error fetching CLAUDE.md:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClaudeMd = async () => {
    setIsUpdating(true);
    try {
      await fetchClaudeMd(); // Just refetch the file content
      showToast('CLAUDE.md 內容已重新載入', 'success');
      onClaudeMdUpdate?.(); // Notify parent component
    } catch (err) {
      showToast('重新載入 CLAUDE.md 時發生錯誤', 'error');
      console.error('Error refreshing CLAUDE.md:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRegenerateClaudeMd = async () => {
    setIsRegenerating(true);
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 200000); // 200 seconds timeout

      const response = await fetch(`/api/projects/${projectId}/claude-md`, {
        method: 'POST',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.success) {
        showToast('CLAUDE.md 已重新生成', 'success');
        await fetchClaudeMd(); // Refresh content
        onClaudeMdUpdate?.(); // Notify parent component
      } else {
        showToast(`重新生成失敗：${data.error}`, 'error');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        showToast('重新生成 CLAUDE.md 超時，請重試', 'error');
      } else {
        showToast('重新生成 CLAUDE.md 時發生錯誤', 'error');
      }
      console.error('Error regenerating CLAUDE.md:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const renderMarkdown = (content: string) => {
    // Simple markdown rendering for basic formatting
    // For a production app, you might want to use a proper markdown parser like 'react-markdown'
    return content
      .split('\n')
      .map((line, index) => {
        if (line.startsWith('# ')) {
          return (
            <h1 key={index} className="text-2xl font-bold text-accent-50 mb-4 mt-6">
              {line.substring(2)}
            </h1>
          );
        } else if (line.startsWith('## ')) {
          return (
            <h2 key={index} className="text-xl font-semibold text-accent-50 mb-3 mt-5">
              {line.substring(3)}
            </h2>
          );
        } else if (line.startsWith('### ')) {
          return (
            <h3 key={index} className="text-lg font-medium text-accent-50 mb-2 mt-4">
              {line.substring(4)}
            </h3>
          );
        } else if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <p key={index} className="text-primary-200 mb-2 font-semibold">
              {line.substring(2, line.length - 2)}
            </p>
          );
        } else if (line.startsWith('- ')) {
          return (
            <li key={index} className="text-primary-300 mb-1 ml-4">
              {line.substring(2)}
            </li>
          );
        } else if (line.startsWith('```')) {
          return (
            <div key={index} className="bg-primary-800 rounded p-3 my-2 font-mono text-sm text-primary-200">
              Code block
            </div>
          );
        } else if (line.trim() === '') {
          return <br key={index} />;
        } else {
          return (
            <p key={index} className="text-primary-300 mb-2">
              {line}
            </p>
          );
        }
      });
  };

  useEffect(() => {
    fetchClaudeMd();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-500"></div>
          <span className="text-primary-400">載入 CLAUDE.md 中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-red-400 text-center">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="font-medium">載入失敗</p>
          <p className="text-sm text-red-300">{error}</p>
        </div>
        <button
          onClick={fetchClaudeMd}
          className="px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700 transition-colors"
        >
          重試
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-primary-800 bg-primary-900">
        <div className="flex items-center space-x-3">
          <FileText className="w-6 h-6 text-accent-500" />
          <div>
            <h2 className="text-lg font-semibold text-accent-50">CLAUDE.md</h2>
            <p className="text-sm text-primary-400">
              {claudeMdData?.path && (
                <span className="font-mono">{claudeMdData.path}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'rendered' ? 'raw' : 'rendered')}
            className="p-2 text-primary-400 hover:text-accent-50 hover:bg-primary-800 rounded transition-colors"
            title={viewMode === 'rendered' ? '顯示原始文本' : '顯示渲染內容'}
          >
            {viewMode === 'rendered' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          {/* Update Button */}
          <button
            onClick={handleUpdateClaudeMd}
            disabled={isUpdating}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-primary-300 border border-primary-600 rounded hover:bg-primary-800 hover:text-accent-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? '載入中...' : '重新載入'}</span>
          </button>

          {/* Regenerate Button */}
          <button
            onClick={handleRegenerateClaudeMd}
            disabled={isRegenerating}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-accent-50 bg-accent-600 rounded hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Settings className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
            <span>{isRegenerating ? '重新生成中...' : '重新生成'}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {claudeMdData?.content ? (
          <div className="p-6">
            {viewMode === 'rendered' ? (
              <div className="prose prose-invert max-w-none">
                {renderMarkdown(claudeMdData.content)}
              </div>
            ) : (
              <pre className="bg-primary-800 rounded p-4 text-sm text-primary-200 font-mono whitespace-pre-wrap overflow-x-auto">
                {claudeMdData.content}
              </pre>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <FileText className="w-16 h-16 text-primary-600" />
            <div>
              <h3 className="text-lg font-medium text-primary-300 mb-2">
                CLAUDE.md 尚未存在
              </h3>
              <p className="text-primary-400 mb-4">
                {claudeMdData?.message || '此專案尚未生成 CLAUDE.md 文件'}
              </p>
              <button
                onClick={handleRegenerateClaudeMd}
                disabled={isRegenerating}
                className="flex items-center space-x-2 px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Settings className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                <span>{isRegenerating ? '生成中...' : '生成 CLAUDE.md'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      {claudeMdData?.lastModified && (
        <div className="p-3 border-t border-primary-800 bg-primary-900">
          <p className="text-xs text-primary-500">
            最後修改：{new Date(claudeMdData.lastModified).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}