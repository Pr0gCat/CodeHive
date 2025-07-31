'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/ToastManager';

interface QueryComment {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

interface Cycle {
  id: string;
  title: string;
  phase: string;
}

interface Query {
  id: string;
  type: string;
  title: string;
  question: string;
  context: string;
  urgency: string;
  priority: string;
  status: string;
  answer?: string;
  answeredAt?: string;
  createdAt: string;
  updatedAt: string;
  cycle?: Cycle;
  comments: QueryComment[];
}

interface UserQueriesPanelProps {
  projectId: string;
}

export default function UserQueriesPanel({ projectId }: UserQueriesPanelProps) {
  const { showToast } = useToast();
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [commentText, setCommentText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');
  const [filterUrgency, setFilterUrgency] = useState<string>('');

  const fetchQueries = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterUrgency) params.append('urgency', filterUrgency);

      const response = await fetch(
        `/api/projects/${projectId}/queries?${params}`
      );
      const data = await response.json();

      if (data.success) {
        setQueries(data.data);
      } else {
        showToast(data.error || '無法載入查詢', 'error');
      }
    } catch (error) {
      showToast('無法載入查詢', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueries();
  }, [projectId, filterStatus, filterUrgency]);

  const handleAddComment = async (queryId: string) => {
    if (!commentText.trim()) return;

    try {
      const response = await fetch(`/api/queries/${queryId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText }),
      });

      const data = await response.json();
      if (data.success) {
        setCommentText('');
        fetchQueries();
        showToast('評論已添加', 'success');
      } else {
        showToast(data.error || '無法添加評論', 'error');
      }
    } catch (error) {
      showToast('無法添加評論', 'error');
    }
  };

  const handleAnswerQuery = async (queryId: string) => {
    if (!answerText.trim()) return;

    try {
      const response = await fetch(`/api/queries/${queryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer: answerText,
          status: 'ANSWERED',
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAnswerText('');
        setSelectedQuery(null);
        fetchQueries();
        showToast('查詢已回答', 'success');
      } else {
        showToast(data.error || '無法回答查詢', 'error');
      }
    } catch (error) {
      showToast('無法回答查詢', 'error');
    }
  };

  const handleDismissQuery = async (queryId: string) => {
    try {
      const response = await fetch(`/api/queries/${queryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISMISSED' }),
      });

      const data = await response.json();
      if (data.success) {
        fetchQueries();
        showToast('查詢已忽略', 'success');
      } else {
        showToast(data.error || '無法忽略查詢', 'error');
      }
    } catch (error) {
      showToast('無法忽略查詢', 'error');
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'BLOCKING':
        return 'text-red-500 bg-red-100';
      case 'ADVISORY':
        return 'text-blue-500 bg-blue-100';
      default:
        return 'text-gray-500 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'text-red-600';
      case 'MEDIUM':
        return 'text-yellow-600';
      case 'LOW':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'ARCHITECTURE':
        return '架構';
      case 'BUSINESS_LOGIC':
        return '業務邏輯';
      case 'UI_UX':
        return '用戶界面';
      case 'INTEGRATION':
        return '集成';
      case 'CLARIFICATION':
        return '澄清';
      default:
        return type;
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
            <div className="h-4 bg-primary-700 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-accent-50">諮詢</h2>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1 bg-primary-700 border border-primary-600 text-accent-50 rounded text-sm"
          >
            <option value="">所有狀態</option>
            <option value="PENDING">待處理</option>
            <option value="ANSWERED">已回答</option>
            <option value="DISMISSED">已忽略</option>
          </select>
          <select
            value={filterUrgency}
            onChange={e => setFilterUrgency(e.target.value)}
            className="px-3 py-1 bg-primary-700 border border-primary-600 text-accent-50 rounded text-sm"
          >
            <option value="">所有緊急程度</option>
            <option value="BLOCKING">阻塞</option>
            <option value="ADVISORY">建議</option>
          </select>
        </div>
      </div>

      {queries.length === 0 ? (
        <div className="text-center py-8 text-primary-400">
          <p>目前沒有查詢</p>
        </div>
      ) : (
        <div className="space-y-4">
          {queries.map(query => (
            <div
              key={query.id}
              className="bg-primary-700 rounded-lg p-4 border border-primary-600"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getUrgencyColor(query.urgency)}`}
                    >
                      {query.urgency === 'BLOCKING' ? '阻塞' : '建議'}
                    </span>
                    <span
                      className={`text-xs font-medium ${getPriorityColor(query.priority)}`}
                    >
                      {query.priority === 'HIGH'
                        ? '高'
                        : query.priority === 'MEDIUM'
                          ? '中'
                          : '低'}
                      優先級
                    </span>
                    <span className="text-xs text-primary-400 bg-primary-600 px-2 py-1 rounded">
                      {getTypeLabel(query.type)}
                    </span>
                    {query.cycle && (
                      <span className="text-xs text-accent-400 bg-accent-900 px-2 py-1 rounded">
                        {query.cycle.title} ({query.cycle.phase})
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-medium text-accent-50 mb-2">
                    {query.title}
                  </h3>
                  <p className="text-primary-300 text-sm mb-3">
                    {query.question}
                  </p>
                  <div className="text-xs text-primary-400">
                    創建於 {new Date(query.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {query.answer && (
                <div className="bg-green-900 border border-green-700 rounded p-3 mb-3">
                  <div className="text-sm font-medium text-green-300 mb-1">
                    回答：
                  </div>
                  <p className="text-green-200 text-sm">{query.answer}</p>
                  <div className="text-xs text-green-400 mt-2">
                    回答於 {new Date(query.answeredAt!).toLocaleString()}
                  </div>
                </div>
              )}

              {query.comments.length > 0 && (
                <div className="mb-3">
                  <div className="text-sm font-medium text-primary-300 mb-2">
                    評論：
                  </div>
                  <div className="space-y-2">
                    {query.comments.map(comment => (
                      <div
                        key={comment.id}
                        className="bg-primary-600 rounded p-2"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-accent-400">
                            {comment.author === 'user'
                              ? '用戶'
                              : comment.author}
                          </span>
                          <span className="text-xs text-primary-400">
                            {new Date(comment.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-primary-200">
                          {comment.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {query.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => setSelectedQuery(query)}
                      className="px-3 py-1 bg-accent-600 text-accent-50 text-sm rounded hover:bg-accent-700"
                    >
                      回答
                    </button>
                    <button
                      onClick={() => handleDismissQuery(query.id)}
                      className="px-3 py-1 bg-gray-600 text-gray-200 text-sm rounded hover:bg-gray-700"
                    >
                      忽略
                    </button>
                  </>
                )}
                <button
                  onClick={() =>
                    setSelectedQuery(
                      selectedQuery?.id === query.id ? null : query
                    )
                  }
                  className="px-3 py-1 bg-primary-600 text-primary-200 text-sm rounded hover:bg-primary-700"
                >
                  {selectedQuery?.id === query.id ? '隱藏評論' : '添加評論'}
                </button>
              </div>

              {selectedQuery?.id === query.id && (
                <div className="mt-3 p-3 bg-primary-600 rounded">
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="添加評論..."
                    className="w-full p-2 bg-primary-700 border border-primary-600 text-accent-50 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent-500"
                    rows={3}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleAddComment(query.id)}
                      className="px-3 py-1 bg-accent-600 text-accent-50 text-sm rounded hover:bg-accent-700"
                    >
                      發送評論
                    </button>
                    <button
                      onClick={() => setCommentText('')}
                      className="px-3 py-1 bg-gray-600 text-gray-200 text-sm rounded hover:bg-gray-700"
                    >
                      清除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 回答查詢的模態框 */}
      {selectedQuery && selectedQuery.status === 'PENDING' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-primary-800 rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold text-accent-50 mb-4">
              回答查詢：{selectedQuery.title}
            </h3>
            <div className="mb-4">
              <p className="text-primary-300 mb-2">{selectedQuery.question}</p>
              {selectedQuery.context && (
                <div className="bg-primary-700 p-3 rounded text-sm text-primary-300">
                  <strong>上下文：</strong>
                  <pre className="whitespace-pre-wrap mt-1">
                    {selectedQuery.context}
                  </pre>
                </div>
              )}
            </div>
            <textarea
              value={answerText}
              onChange={e => setAnswerText(e.target.value)}
              placeholder="輸入您的回答..."
              className="w-full p-3 bg-primary-700 border border-primary-600 text-accent-50 rounded resize-none focus:outline-none focus:ring-2 focus:ring-accent-500"
              rows={6}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleAnswerQuery(selectedQuery.id)}
                className="px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700"
              >
                提交回答
              </button>
              <button
                onClick={() => {
                  setSelectedQuery(null);
                  setAnswerText('');
                }}
                className="px-4 py-2 bg-gray-600 text-gray-200 rounded hover:bg-gray-700"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
