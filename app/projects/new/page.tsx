'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import HiveInitializationAnimation from '../../components/initialization/HiveInitializationAnimation';

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
  const [taskId, setTaskId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gitUrl: '', // Optional remote URL
    localPath: '',
    framework: '',
    language: '',
    packageManager: '',
    testFramework: '',
    lintTool: '',
    buildTool: '',
  });
  
  const [creationMode, setCreationMode] = useState<'new' | 'existing'>('new');

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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Generate task ID for real-time tracking
    const newTaskId = `create-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setTaskId(newTaskId);
    
    // Show initialization animation with real-time progress
    setShowInitialization(true);

    try {
      // Prepare form data based on creation mode
      const projectData = { ...formData, taskId: newTaskId };
      
      // If creating new project and no localPath specified, let the API generate it
      if (creationMode === 'new' && !projectData.localPath.trim()) {
        projectData.localPath = ''; // API will generate path based on project name
      }

      const response = await fetch('/api/projects/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...projectData,
          initializeGit: true, // Always initialize as Git repo
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '無法建立專案');
        setShowInitialization(false);
        return;
      }

      // Success - the real-time progress tracking will handle the animation
      // The onComplete callback will be triggered when the task is done
      console.log('🎉 Project creation started with task ID:', data.data.taskId);
      
      // Don't set loading to false here - let the animation handle completion
      // setLoading(false); // Removed - will be handled by onComplete
    } catch (err) {
      setError('網路錯誤：無法建立專案');
      setShowInitialization(false);
      setLoading(false);
    }
  };

  return (
    <>
      {/* Initialization Overlay - Now using real-time progress */}
      <HiveInitializationAnimation
        isVisible={showInitialization}
        taskId={taskId}
        useRealTimeProgress={true}
        projectName={formData.name}
        onComplete={async () => {
          setShowInitialization(false);
          setLoading(false); // Now set loading to false when animation completes
          
          // Get the created project info from the task result
          try {
            // Fetch the latest projects to find the newly created one
            const response = await fetch('/api/projects');
            const data = await response.json();
            
            if (data.success && data.data.length > 0) {
              // Find the most recently created project (assuming it's the first one)
              const newestProject = data.data[0];
              if (newestProject.name === formData.name) {
                // Navigate to the newly created project
                router.push(`/projects/${newestProject.id}`);
                return;
              }
            }
          } catch (error) {
            console.error('Failed to get project info:', error);
          }
          
          // Fallback: navigate to projects list
          router.push('/projects');
        }}
        onError={error => {
          setShowInitialization(false);
          setError(error);
          setLoading(false);
        }}
      />

      {/* Main Page */}
      <div className="min-h-screen bg-primary-950">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
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

                {/* Creation Mode Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-300 mb-3">
                      專案建立方式 *
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setCreationMode('new');
                          setSelectedRepo(null);
                          setFormData(prev => ({ ...prev, localPath: '', gitUrl: '' }));
                        }}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          creationMode === 'new'
                            ? 'border-accent-500 bg-accent-900/20'
                            : 'border-primary-700 bg-primary-800 hover:border-primary-600'
                        }`}
                      >
                        <div className="font-medium text-accent-50 mb-1">
                          🆕 建立新專案
                        </div>
                        <div className="text-sm text-primary-300">
                          建立全新的 Git 倉庫和專案結構
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setCreationMode('existing');
                          setFormData(prev => ({ ...prev, localPath: '', gitUrl: '' }));
                        }}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          creationMode === 'existing'
                            ? 'border-accent-500 bg-accent-900/20'
                            : 'border-primary-700 bg-primary-800 hover:border-primary-600'
                        }`}
                      >
                        <div className="font-medium text-accent-50 mb-1">
                          📁 導入現有專案
                        </div>
                        <div className="text-sm text-primary-300">
                          從現有的本地資料夾建立專案
                        </div>
                      </button>
                    </div>
                  </div>

                {creationMode === 'new' ? (
                  /* New Project Path */
                  <div>
                    <label
                      htmlFor="localPath"
                      className="block text-sm font-medium text-primary-300 mb-2"
                    >
                      專案資料夾路徑 *
                    </label>
                    <input
                      type="text"
                      id="localPath"
                      name="localPath"
                      required
                      value={formData.localPath}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                      placeholder="例如：/Users/yourname/my-project 或留空自動生成"
                    />
                    <p className="mt-1 text-sm text-primary-400">
                      留空將在 repos/ 目錄中自動建立資料夾。將初始化為 Git 倉庫。
                    </p>
                  </div>
                ) : (
                  /* Existing Repository Selection */
                  <div>
                    <label
                      htmlFor="repoSelect"
                      className="block text-sm font-medium text-primary-300 mb-2"
                    >
                      選擇現有資料夾 *
                    </label>
                    {loadingRepos ? (
                      <div className="w-full px-3 py-2 bg-primary-800 border border-primary-700 rounded-md">
                        <div className="text-primary-400 text-sm">
                          載入可用資料夾中...
                        </div>
                      </div>
                    ) : availableRepos.length === 0 ? (
                      <div className="w-full px-3 py-2 bg-primary-800 border border-primary-700 rounded-md">
                        <div className="text-primary-400 text-sm">
                          在 repos/ 目錄中找不到可用的資料夾
                        </div>
                      </div>
                    ) : (
                      <select
                        id="repoSelect"
                        value={selectedRepo?.path || ''}
                        onChange={handleRepoSelect}
                        required={creationMode === 'existing'}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                      >
                        <option value="">選擇資料夾...</option>
                        {availableRepos.map(repo => (
                          <option key={repo.path} value={repo.path}>
                            {repo.name} ({repo.projectType}){' '}
                            {repo.hasGit ? '🔗' : '⚠️'}
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
                          <div className="text-primary-300">
                            <span className="font-medium">Git：</span>{' '}
                            {selectedRepo.hasGit ? (
                              <span className="text-green-400">
                                ✓ 已偵測到 Git 倉庫
                              </span>
                            ) : (
                              <span className="text-yellow-400">
                                ⚠️ 將初始化為 Git 倉庫
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="mt-1 text-sm text-primary-400">
                      選擇 repos/ 目錄中的資料夾。如果不是 Git 倉庫，將自動初始化。
                    </p>
                  </div>
                )}
                </div>

                <div>
                  <label
                    htmlFor="gitUrl"
                    className="block text-sm font-medium text-primary-300 mb-2"
                  >
                    遠端 Git 儲存庫網址
                  </label>
                  <input
                    type="url"
                    id="gitUrl"
                    name="gitUrl"
                    value={formData.gitUrl}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                    placeholder="https://github.com/username/repository.git（選填）"
                    disabled={!!(selectedRepo?.hasGit && selectedRepo?.gitUrl)}
                  />
                  <p className="mt-1 text-sm text-primary-400">
                    {selectedRepo?.hasGit && selectedRepo?.gitUrl
                      ? '已自動從現有倉庫偵測到遠端網址'
                      : '選填：遠端 Git 倉庫網址，可以之後再設定。所有專案都會建立為本地 Git 倉庫。'}
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
