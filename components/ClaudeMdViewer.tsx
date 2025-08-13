'use client';

import { useToast } from '@/components/ui/ToastManager';
import { Eye, EyeOff, FileText, RefreshCw, Settings } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

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

export default function ClaudeMdViewer({
  projectId,
  onClaudeMdUpdate,
}: ClaudeMdViewerProps) {
  const { showToast } = useToast();
  const [claudeMdData, setClaudeMdData] = useState<ClaudeMdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');

  const fetchClaudeMd = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/claude-md`);
      if (!response.ok) {
        throw new Error('Failed to fetch CLAUDE.md');
      }
      const result = await response.json();
      if (result.success) {
        setClaudeMdData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch CLAUDE.md');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleUpdateClaudeMd = async () => {
    setIsUpdating(true);
    try {
      await fetchClaudeMd(); // Just refetch the file content
      showToast('CLAUDE.md content reloaded', 'success');
      onClaudeMdUpdate?.(); // Notify parent component
    } catch (err) {
      showToast('Error reloading CLAUDE.md', 'error');
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
      const timeoutId = setTimeout(() => controller.abort(), 1800000); // 30 minutes timeout

      const response = await fetch(`/api/projects/${projectId}/claude-md`, {
        method: 'POST',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.success) {
        showToast('CLAUDE.md regenerated successfully', 'success');
        await fetchClaudeMd(); // Refresh content
        onClaudeMdUpdate?.(); // Notify parent component
      } else {
        showToast(`Regeneration failed: ${data.error}`, 'error');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        showToast('CLAUDE.md regeneration timed out, please retry', 'error');
      } else {
        showToast('Error regenerating CLAUDE.md', 'error');
      }
      console.error('Error regenerating CLAUDE.md:', err);
    } finally {
      setIsRegenerating(false);
    }
  };


  useEffect(() => {
    fetchClaudeMd();
  }, [projectId, fetchClaudeMd]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-500"></div>
          <span className="text-primary-400">Loading CLAUDE.md...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-red-400 text-center">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="font-medium">Loading Failed</p>
          <p className="text-sm text-red-300">{error}</p>
        </div>
        <button
          onClick={fetchClaudeMd}
          className="px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-primary-800 bg-primary-900 flex-shrink-0">
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
            onClick={() =>
              setViewMode(viewMode === 'rendered' ? 'raw' : 'rendered')
            }
            className="p-2 text-primary-400 hover:text-accent-50 hover:bg-primary-800 rounded transition-colors"
            title={
              viewMode === 'rendered'
                ? 'Show raw text'
                : 'Show rendered content'
            }
          >
            {viewMode === 'rendered' ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>

          {/* Update Button */}
          <button
            onClick={handleUpdateClaudeMd}
            disabled={isUpdating}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-primary-300 border border-primary-600 rounded hover:bg-primary-800 hover:text-accent-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`}
            />
            <span>{isUpdating ? 'Loading...' : 'Refresh'}</span>
          </button>

          {/* Regenerate Button */}
          <button
            onClick={handleRegenerateClaudeMd}
            disabled={isRegenerating}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-accent-50 bg-accent-600 rounded hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Settings
              className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`}
            />
            <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {claudeMdData?.content ? (
          <div className="p-6">
            {viewMode === 'rendered' ? (
              <div className="prose prose-invert max-w-none prose-headings:text-accent-50 prose-strong:text-accent-50 prose-code:text-accent-200 prose-pre:bg-primary-800 prose-pre:text-primary-200 prose-p:text-primary-300 prose-li:text-primary-300 prose-em:text-accent-100">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    strong: ({ children }) => (
                      <strong className="font-bold text-accent-50">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic text-accent-100">{children}</em>
                    ),
                    code: ({ children, className, ...rest }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      const isInline = !match;
                      
                      if (isInline) {
                        return <code className="bg-primary-800 text-accent-200 px-1 py-0.5 rounded text-sm font-mono" {...rest}>{children}</code>;
                      }
                      
                      return <code className={className} {...rest}>{children}</code>;
                    },
                    h1: ({ children }) => (
                      <h1 className="text-2xl font-bold text-accent-50 mb-4">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-xl font-bold text-accent-50 mb-3">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-lg font-bold text-accent-50 mb-2">{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-primary-300 mb-3 leading-relaxed">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="text-primary-300 mb-3 list-disc list-inside space-y-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="text-primary-300 mb-3 list-decimal list-inside space-y-1">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-primary-300">{children}</li>
                    ),
                  }}
                >
                  {claudeMdData.content}
                </ReactMarkdown>
              </div>
            ) : (
              <pre className="bg-primary-800 rounded p-4 text-sm text-primary-200 font-mono whitespace-pre-wrap overflow-x-auto">
                {claudeMdData.content}
              </pre>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)] text-center space-y-4">
            <FileText className="w-16 h-16 text-primary-600" />
            <div>
              <h3 className="text-lg font-medium text-primary-300 mb-2">
                CLAUDE.md does not exist yet
              </h3>
              <p className="text-primary-400 mb-4">
                {claudeMdData?.message ||
                  'This project has not generated a CLAUDE.md file yet'}
              </p>
              <button
                onClick={handleRegenerateClaudeMd}
                disabled={isRegenerating}
                className="flex items-center space-x-2 px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mx-auto"
              >
                <Settings
                  className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`}
                />
                <span>
                  {isRegenerating ? 'Generating...' : 'Generate CLAUDE.md'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      {claudeMdData?.lastModified && (
        <div className="p-3 border-t border-primary-800 bg-primary-900 flex-shrink-0">
          <p className="text-xs text-primary-500">
            Last modified:{' '}
            {new Date(claudeMdData.lastModified).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
