'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import HiveInitializationAnimation, {
  InitializationPhase,
} from './initialization/HiveInitializationAnimation';

interface ProjectImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectImportModal({
  isOpen,
  onClose,
}: ProjectImportModalProps) {
  const router = useRouter();
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInitialization, setShowInitialization] = useState(false);
  const [initializationPhases, setInitializationPhases] = useState<any[]>([]);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);

  const [formData, setFormData] = useState({
    gitUrl: '',
    projectName: '',
    branch: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const extractProjectName = (url: string) => {
    // Extract project name from Git URL
    const match = url.match(/\/([^\/]+?)(\.git)?$/);
    if (match) {
      return match[1];
    }
    return '';
  };

  const handleGitUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFormData(prev => ({
      ...prev,
      gitUrl: url,
      projectName: prev.projectName || extractProjectName(url),
    }));
    setError(null);
  };

  const simulateInitializationPhases = (
    projectName: string
  ): InitializationPhase[] => [
    {
      id: 'cloning',
      title: '克隆儲存庫',
      description: `正在從 Git 儲存庫克隆 ${projectName}...`,
      status: 'pending',
      progress: 0,
      details: ['建立本地連接', '下載儲存庫內容', '驗證完整性'],
    },
    {
      id: 'analyzing',
      title: '分析項目結構',
      description: 'Claude Code 正在分析項目架構和技術棧...',
      status: 'pending',
      progress: 0,
      details: ['掃描檔案結構', '識別框架和語言', '分析依賴關係'],
    },
    {
      id: 'generating',
      title: '生成 CLAUDE.md',
      description: '為項目生成專用的 AI 上下文檔案...',
      status: 'pending',
      progress: 0,
      details: ['生成項目描述', '建立開發指南', '配置 Agent 上下文'],
    },
    {
      id: 'initializing',
      title: '初始化項目管理',
      description: '建立 Epic 和 Story 結構，準備 TDD 工作流程...',
      status: 'pending',
      progress: 0,
      details: ['創建初始 Epic', '建立設置任務', '準備 Agent 系統'],
    },
  ];

  const updatePhaseProgress = (
    phaseId: string,
    progress: number,
    status: 'pending' | 'active' | 'completed' | 'error' = 'active'
  ) => {
    setInitializationPhases(phases =>
      phases.map(phase =>
        phase.id === phaseId ? { ...phase, progress, status } : phase
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsImporting(true);

    // Initialize phases
    const phases = simulateInitializationPhases(formData.projectName);
    setInitializationPhases(phases);
    setShowInitialization(true);
    setCurrentPhaseIndex(0);

    try {
      // Phase 1: Start import
      updatePhaseProgress('cloning', 0, 'active');
      setCurrentPhaseIndex(0);

      // Simulate cloning progress
      for (let i = 0; i <= 100; i += 20) {
        updatePhaseProgress('cloning', i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      updatePhaseProgress('cloning', 100, 'completed');

      // Phase 2: Actual API call
      setCurrentPhaseIndex(1);
      updatePhaseProgress('analyzing', 0, 'active');

      const response = await fetch('/api/projects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        updatePhaseProgress('analyzing', 50, 'error');
        setError(data.error || '無法匯入專案');
        return;
      }

      // Simulate analysis progress
      for (let i = 0; i <= 100; i += 25) {
        updatePhaseProgress('analyzing', i);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      updatePhaseProgress('analyzing', 100, 'completed');

      // Phase 3: Generate CLAUDE.md
      setCurrentPhaseIndex(2);
      updatePhaseProgress('generating', 0, 'active');

      for (let i = 0; i <= 100; i += 33) {
        updatePhaseProgress('generating', i);
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      updatePhaseProgress('generating', 100, 'completed');

      // Phase 4: Initialize project management
      setCurrentPhaseIndex(3);
      updatePhaseProgress('initializing', 0, 'active');

      for (let i = 0; i <= 100; i += 25) {
        updatePhaseProgress('initializing', i);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      updatePhaseProgress('initializing', 100, 'completed');

      // Complete
      setCurrentPhaseIndex(4);
      await new Promise(resolve => setTimeout(resolve, 1000));

      router.push(`/projects/${data.project.id}`);
      onClose();
    } catch (err) {
      updatePhaseProgress(
        phases[currentPhaseIndex]?.id || 'cloning',
        0,
        'error'
      );
      setError('網路錯誤：無法匯入專案');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Initialization Overlay */}
      <HiveInitializationAnimation
        isVisible={showInitialization}
        phases={initializationPhases}
        currentPhaseIndex={currentPhaseIndex}
        projectName={formData.projectName}
        onComplete={() => {
          setShowInitialization(false);
          // Navigation is handled in handleSubmit
        }}
        onError={error => {
          setShowInitialization(false);
          setError(error);
          setIsImporting(false);
        }}
      />

      {/* Original Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-primary-800 border border-primary-700 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-accent-50">
              從 Git 匯入專案
            </h2>
            <button
              onClick={onClose}
              className="text-primary-400 hover:text-accent-50 transition-colors"
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

          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-md text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Git URL */}
            <div>
              <label
                htmlFor="gitUrl"
                className="block text-sm font-medium text-accent-50 mb-2"
              >
                Git 儲存庫網址 <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                id="gitUrl"
                name="gitUrl"
                value={formData.gitUrl}
                onChange={handleGitUrlChange}
                className="w-full px-3 py-2 bg-primary-900 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                placeholder="https://github.com/username/repository.git"
                required
              />
              <p className="mt-1 text-sm text-primary-400">
                支援 GitHub、GitLab 和其他 Git 託管服務
              </p>
            </div>

            {/* Project Name */}
            <div>
              <label
                htmlFor="projectName"
                className="block text-sm font-medium text-accent-50 mb-2"
              >
                專案名稱 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="projectName"
                name="projectName"
                value={formData.projectName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-primary-900 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                placeholder="my-awesome-project"
                required
              />
            </div>

            {/* Branch (optional) */}
            <div>
              <label
                htmlFor="branch"
                className="block text-sm font-medium text-accent-50 mb-2"
              >
                分支（選填）
              </label>
              <input
                type="text"
                id="branch"
                name="branch"
                value={formData.branch}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-primary-900 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                placeholder="main"
              />
              <p className="mt-1 text-sm text-primary-400">
                留空則使用預設分支
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-primary-300 hover:text-accent-50 transition-colors"
                disabled={isImporting}
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isImporting}
                className="px-4 py-2 bg-accent-600 text-white rounded-md hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isImporting ? '匯入中...' : '匯入專案'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
