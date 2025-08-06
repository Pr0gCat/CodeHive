'use client';

import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastManager';
import { useState } from 'react';

interface ProjectSettingsModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectSettingsModal({
  projectId,
  isOpen,
  onClose,
}: ProjectSettingsModalProps) {
  const { showToast } = useToast();
  const [removing, setRemoving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);


  const handleRemoveProject = async () => {
    if (!projectId) return;

    setRemoving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Close modal and redirect to projects page
        onClose();
        window.location.href = '/projects';
      } else {
        const errorData = await response.json();
        showToast(`刪除專案失敗：${errorData.error || '未知錯誤'}`, 'error');
      }
    } catch (error) {
      console.error('Error removing project:', error);
      showToast('刪除專案失敗，請重試。', 'error');
    } finally {
      setRemoving(false);
      setShowRemoveConfirm(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-primary-900 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-primary-700">
          <h2 className="text-xl font-bold text-accent-50">專案設定</h2>
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

        {/* Remove Project Section */}
        <div className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-medium text-red-300 mb-2">移除專案</h3>
              <p className="text-sm text-primary-400">
                此操作將移除專案的資料庫記錄，但會保留程式碼檔案。
              </p>
            </div>
            <button
              onClick={() => setShowRemoveConfirm(true)}
              disabled={removing}
              className="px-6 py-2 text-sm font-medium text-red-300 border border-red-600 rounded-lg hover:bg-red-600 hover:text-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {removing ? '移除中...' : '移除專案'}
            </button>
          </div>
        </div>

        {/* Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showRemoveConfirm}
          onClose={() => setShowRemoveConfirm(false)}
          onConfirm={handleRemoveProject}
          title="移除專案"
          message="確定要移除這個專案嗎？此操作無法復原。"
          confirmText="移除"
          cancelText="取消"
          type="danger"
          isLoading={removing}
        />
      </div>
    </div>
  );
}
