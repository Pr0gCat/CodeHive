'use client';

import { useState } from 'react';
import { EpicType, MVPPriority } from '@/lib/db';
import { useToast } from './ui/ToastManager';

interface EpicCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onEpicCreated?: () => void;
}

export default function EpicCreateModal({
  isOpen,
  onClose,
  projectId,
  onEpicCreated,
}: EpicCreateModalProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'FEATURE' as keyof typeof EpicType,
    mvpPriority: 'MEDIUM' as keyof typeof MVPPriority,
    coreValue: '',
    estimatedStoryPoints: 0,
    startDate: '',
    dueDate: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/epics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          projectId,
          startDate: formData.startDate || undefined,
          dueDate: formData.dueDate || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showToast(`Epic「${formData.title}」已建立成功`, 'success');
        onEpicCreated?.();
        handleClose();
      } else {
        showToast(data.error || '建立 Epic 失敗', 'error');
      }
    } catch (error) {
      showToast('建立 Epic 失敗', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      type: 'FEATURE',
      mvpPriority: 'MEDIUM',
      coreValue: '',
      estimatedStoryPoints: 0,
      startDate: '',
      dueDate: '',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-primary-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-accent-50">建立新 Epic</h2>
          <button
            onClick={handleClose}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 標題 */}
          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              標題 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full bg-primary-700 border border-primary-600 rounded-lg px-3 py-2 text-accent-50 placeholder-primary-400 focus:outline-none focus:border-accent-500"
              placeholder="例如：電商購物車系統"
              required
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              描述
            </label>
            <textarea
              value={formData.description}
              onChange={e =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full bg-primary-700 border border-primary-600 rounded-lg px-3 py-2 text-accent-50 placeholder-primary-400 focus:outline-none focus:border-accent-500"
              placeholder="詳細描述這個 Epic 的目標和範圍..."
              rows={3}
            />
          </div>

          {/* 類型和優先級 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-300 mb-2">
                類型
              </label>
              <select
                value={formData.type}
                onChange={e =>
                  setFormData({
                    ...formData,
                    type: e.target.value as keyof typeof EpicType,
                  })
                }
                className="w-full bg-primary-700 border border-primary-600 rounded-lg px-3 py-2 text-accent-50 focus:outline-none focus:border-accent-500"
              >
                <option value="MVP">MVP 核心功能</option>
                <option value="FEATURE">新功能</option>
                <option value="ENHANCEMENT">功能增強</option>
                <option value="BUGFIX">錯誤修復</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-300 mb-2">
                MVP 優先級
              </label>
              <select
                value={formData.mvpPriority}
                onChange={e =>
                  setFormData({
                    ...formData,
                    mvpPriority: e.target.value as keyof typeof MVPPriority,
                  })
                }
                className="w-full bg-primary-700 border border-primary-600 rounded-lg px-3 py-2 text-accent-50 focus:outline-none focus:border-accent-500"
              >
                <option value="CRITICAL">🔴 關鍵</option>
                <option value="HIGH">🟠 高</option>
                <option value="MEDIUM">🟡 中</option>
                <option value="LOW">🔵 低</option>
                <option value="FUTURE">⚫ 未來</option>
              </select>
            </div>
          </div>

          {/* 核心價值 */}
          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              核心價值
            </label>
            <input
              type="text"
              value={formData.coreValue}
              onChange={e =>
                setFormData({ ...formData, coreValue: e.target.value })
              }
              className="w-full bg-primary-700 border border-primary-600 rounded-lg px-3 py-2 text-accent-50 placeholder-primary-400 focus:outline-none focus:border-accent-500"
              placeholder="這個 Epic 為用戶帶來什麼價值？"
            />
          </div>

          {/* 預估工作量 */}
          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              預估故事點數
            </label>
            <input
              type="number"
              min="0"
              value={formData.estimatedStoryPoints}
              onChange={e =>
                setFormData({
                  ...formData,
                  estimatedStoryPoints: parseInt(e.target.value) || 0,
                })
              }
              className="w-full bg-primary-700 border border-primary-600 rounded-lg px-3 py-2 text-accent-50 placeholder-primary-400 focus:outline-none focus:border-accent-500"
              placeholder="0"
            />
          </div>

          {/* 時間範圍 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-300 mb-2">
                開始日期
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={e =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full bg-primary-700 border border-primary-600 rounded-lg px-3 py-2 text-accent-50 focus:outline-none focus:border-accent-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-300 mb-2">
                目標完成日期
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={e =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
                className="w-full bg-primary-700 border border-primary-600 rounded-lg px-3 py-2 text-accent-50 focus:outline-none focus:border-accent-500"
              />
            </div>
          </div>

          {/* 按鈕 */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-primary-300 border border-primary-600 rounded-lg hover:bg-primary-700"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title}
              className="px-4 py-2 bg-accent-600 text-accent-50 rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-50"></div>
                  建立中...
                </>
              ) : (
                <>
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  建立 Epic
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
