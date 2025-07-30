'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import HiveInitializationAnimation, {
  InitializationPhase,
} from '../../components/initialization/HiveInitializationAnimation';

interface AvailableRepo {
  name: string;
  path: string;
  relativePath: string;
  hasGit: boolean;
  gitUrl: string | null;
  projectType: string;
  fileCount: number;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState<AvailableRepo | null>(null);
  const [showInitialization, setShowInitialization] = useState(false);
  const [initializationPhases, setInitializationPhases] = useState<
    InitializationPhase[]
  >([]);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gitUrl: '',
    localPath: '',
    framework: '',
    language: '',
    packageManager: '',
    testFramework: '',
    lintTool: '',
    buildTool: '',
  });

  useEffect(() => {
    fetchAvailableRepos();
  }, []);

  const fetchAvailableRepos = async () => {
    try {
      const response = await fetch('/api/repos/available');
      const data = await response.json();

      if (data.success) {
        setAvailableRepos(data.data);
      } else {
        console.error('Failed to fetch available repos:', data.error);
      }
    } catch (error) {
      console.error('Error fetching available repos:', error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRepoSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPath = e.target.value;
    if (!selectedPath) {
      setSelectedRepo(null);
      setFormData(prev => ({ ...prev, localPath: '', gitUrl: '' }));
      return;
    }

    const repo = availableRepos.find(r => r.path === selectedPath);
    if (repo) {
      setSelectedRepo(repo);
      setFormData(prev => ({
        ...prev,
        localPath: repo.path,
        gitUrl: repo.gitUrl || '',
        name: prev.name || repo.name, // Auto-fill name if empty
      }));
    }
  };

  const simulateInitializationPhases = (
    projectName: string
  ): InitializationPhase[] => [
    {
      id: 'setup',
      title: '建立專案結構',
      description: `正在初始化 ${projectName} 專案環境...`,
      status: 'pending',
      progress: 0,
      details: ['建立資料庫記錄', '配置專案設定', '驗證儲存庫路徑'],
    },
    {
      id: 'analyzing',
      title: '分析技術堆疊',
      description: 'Project Manager 正在分析項目技術架構...',
      status: 'pending',
      progress: 0,
      details: ['掃描專案檔案', '識別開發工具', '建立技術檔案'],
    },
    {
      id: 'generating',
      title: '生成 CLAUDE.md',
      description: '建立專案專用的 AI 上下文檔案...',
      status: 'pending',
      progress: 0,
      details: ['生成項目描述', '建立開發指南', '配置 Agent 上下文'],
    },
    {
      id: 'initializing',
      title: '啟動 Agent 系統',
      description: '初始化多 Agent 協作環境和 TDD 工作流程...',
      status: 'pending',
      progress: 0,
      details: ['配置 Agent 能力', '建立任務佇列', '準備開發環境'],
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
    setLoading(true);

    // Initialize phases
    const phases = simulateInitializationPhases(formData.name);
    setInitializationPhases(phases);
    setShowInitialization(true);
    setCurrentPhaseIndex(0);

    try {
      // Phase 1: Project setup
      updatePhaseProgress('setup', 0, 'active');
      setCurrentPhaseIndex(0);

      // Simulate setup progress
      for (let i = 0; i <= 100; i += 25) {
        updatePhaseProgress('setup', i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      updatePhaseProgress('setup', 100, 'completed');

      // Phase 2: Create project (actual API call)
      setCurrentPhaseIndex(1);
      updatePhaseProgress('analyzing', 0, 'active');

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        updatePhaseProgress('analyzing', 50, 'error');
        setError(data.error || '無法建立專案');
        return;
      }

      // Simulate tech stack analysis progress
      for (let i = 0; i <= 100; i += 20) {
        updatePhaseProgress('analyzing', i);
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      updatePhaseProgress('analyzing', 100, 'completed');

      // Phase 3: Generate CLAUDE.md
      setCurrentPhaseIndex(2);
      updatePhaseProgress('generating', 0, 'active');

      for (let i = 0; i <= 100; i += 33) {
        updatePhaseProgress('generating', i);
        await new Promise(resolve => setTimeout(resolve, 350));
      }
      updatePhaseProgress('generating', 100, 'completed');

      // Phase 4: Initialize Agent system
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

      router.push(`/projects/${data.data.id}`);
    } catch (err) {
      updatePhaseProgress(phases[currentPhaseIndex]?.id || 'setup', 0, 'error');
      setError('網路錯誤：無法建立專案');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Initialization Overlay */}
      <HiveInitializationAnimation
        isVisible={showInitialization}
        phases={initializationPhases}
        currentPhaseIndex={currentPhaseIndex}
        projectName={formData.name}
        onComplete={() => {
          setShowInitialization(false);
          // Navigation is handled in handleSubmit
        }}
        onError={error => {
          setShowInitialization(false);
          setError(error);
          setLoading(false);
        }}
      />

      {/* Main Page */}
      <div className="h-screen bg-primary-950 overflow-hidden">
        <Navbar />
        <div className="container mx-auto px-4 py-8 h-full overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-accent-50 mb-2">
                建立新專案
              </h1>
              <p className="text-primary-300">設定新的多 Agent 開發專案</p>
            </div>

            <div className="bg-primary-900 rounded-lg shadow-sm border border-primary-800 p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-900 border border-red-700 rounded-md p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-red-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-red-300">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-primary-300 mb-2"
                  >
                    專案名稱 *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                    placeholder="輸入專案名稱"
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-primary-300 mb-2"
                  >
                    描述
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={4}
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                    placeholder="描述您的專案"
                  />
                </div>

                <div>
                  <label
                    htmlFor="repoSelect"
                    className="block text-sm font-medium text-primary-300 mb-2"
                  >
                    選擇儲存庫 *
                  </label>
                  {loadingRepos ? (
                    <div className="w-full px-3 py-2 bg-primary-800 border border-primary-700 rounded-md">
                      <div className="text-primary-400 text-sm">
                        載入可用儲存庫中...
                      </div>
                    </div>
                  ) : availableRepos.length === 0 ? (
                    <div className="w-full px-3 py-2 bg-primary-800 border border-primary-700 rounded-md">
                      <div className="text-primary-400 text-sm">
                        在 repos/ 目錄中找不到可用的儲存庫
                      </div>
                    </div>
                  ) : (
                    <select
                      id="repoSelect"
                      value={selectedRepo?.path || ''}
                      onChange={handleRepoSelect}
                      required
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                    >
                      <option value="">選擇儲存庫資料夾...</option>
                      {availableRepos.map(repo => (
                        <option key={repo.path} value={repo.path}>
                          {repo.name} ({repo.projectType}){' '}
                          {repo.hasGit ? '🔗' : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {selectedRepo && (
                    <div className="mt-2 p-3 bg-primary-800 border border-primary-700 rounded-md">
                      <div className="text-sm space-y-1">
                        <div className="text-primary-300">
                          <span className="font-medium">路徑：</span>{' '}
                          <span className="font-mono text-primary-400">
                            {selectedRepo.path}
                          </span>
                        </div>
                        <div className="text-primary-300">
                          <span className="font-medium">類型：</span>{' '}
                          <span className="text-accent-50">
                            {selectedRepo.projectType}
                          </span>
                        </div>
                        <div className="text-primary-300">
                          <span className="font-medium">檔案：</span>{' '}
                          <span className="text-accent-50">
                            {selectedRepo.fileCount}
                          </span>
                        </div>
                        {selectedRepo.hasGit && (
                          <div className="text-primary-300">
                            <span className="font-medium">Git：</span>{' '}
                            <span className="text-green-400">
                              ✓ 已偵測到儲存庫
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="mt-1 text-sm text-primary-400">
                    從 repos/ 目錄中選擇尚未建立為專案的可用資料夾
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="gitUrl"
                    className="block text-sm font-medium text-primary-300 mb-2"
                  >
                    Git 儲存庫網址
                  </label>
                  <input
                    type="url"
                    id="gitUrl"
                    name="gitUrl"
                    value={formData.gitUrl}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                    placeholder="https://github.com/username/repository.git"
                    disabled={!!(selectedRepo?.hasGit && selectedRepo?.gitUrl)}
                  />
                  <p className="mt-1 text-sm text-primary-400">
                    {selectedRepo?.hasGit && selectedRepo?.gitUrl
                      ? '已自動從儲存庫偵測到 Git 網址'
                      : '選填：用於版本控制整合的 Git 儲存庫網址'}
                  </p>
                </div>

                {/* Tech Stack Configuration */}
                <div className="space-y-4 pt-4 border-t border-primary-700">
                  <h3 className="text-lg font-semibold text-accent-50">
                    技術堆疊設定
                  </h3>
                  <p className="text-sm text-primary-400">
                    指定此專案的工具和框架。留空則使用全域預設值。
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="framework"
                        className="block text-sm font-medium text-primary-300 mb-2"
                      >
                        框架
                      </label>
                      <input
                        type="text"
                        id="framework"
                        name="framework"
                        value={formData.framework}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                        placeholder="例如：Next.js、React、Vue"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="language"
                        className="block text-sm font-medium text-primary-300 mb-2"
                      >
                        語言
                      </label>
                      <input
                        type="text"
                        id="language"
                        name="language"
                        value={formData.language}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                        placeholder="例如：typescript、javascript"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="packageManager"
                        className="block text-sm font-medium text-primary-300 mb-2"
                      >
                        套件管理器
                      </label>
                      <input
                        type="text"
                        id="packageManager"
                        name="packageManager"
                        value={formData.packageManager}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                        placeholder="例如：npm、yarn、pnpm、bun"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="testFramework"
                        className="block text-sm font-medium text-primary-300 mb-2"
                      >
                        測試框架
                      </label>
                      <input
                        type="text"
                        id="testFramework"
                        name="testFramework"
                        value={formData.testFramework}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                        placeholder="例如：jest、vitest、cypress"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="lintTool"
                        className="block text-sm font-medium text-primary-300 mb-2"
                      >
                        程式碼檢查工具
                      </label>
                      <input
                        type="text"
                        id="lintTool"
                        name="lintTool"
                        value={formData.lintTool}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                        placeholder="例如：eslint、tslint、pylint"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="buildTool"
                        className="block text-sm font-medium text-primary-300 mb-2"
                      >
                        建置工具
                      </label>
                      <input
                        type="text"
                        id="buildTool"
                        name="buildTool"
                        value={formData.buildTool}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                        placeholder="例如：webpack、vite、rollup"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-primary-700">
                  <Link
                    href="/projects"
                    className="px-4 py-2 text-primary-200 bg-primary-800 border border-primary-700 rounded-md hover:bg-primary-700 hover:text-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                  >
                    取消
                  </Link>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-accent-600 text-accent-50 rounded-md hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-accent-50"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        建立中...
                      </span>
                    ) : (
                      '建立專案'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
