'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';

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
    fetchGlobalSettings();
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

  const fetchGlobalSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      if (data.success) {
        setGlobalSettings(data.data);
        // Pre-populate form with global defaults
        setFormData(prev => ({
          ...prev,
          framework: data.data?.preferredFramework || '',
          language: data.data?.preferredLanguage || '',
          packageManager: data.data?.preferredPackageManager || '',
          testFramework: data.data?.preferredTestFramework || '',
          lintTool: data.data?.preferredLintTool || '',
          buildTool: data.data?.preferredBuildTool || '',
        }));
      }
    } catch (error) {
      console.error('Error fetching global settings:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
        name: prev.name || repo.name // Auto-fill name if empty
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/projects/${data.data.id}`);
      } else {
        setError(data.error || 'Failed to create project');
      }
    } catch {
      setError('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary-950">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-accent-50 mb-2">Create New Project</h1>
            <p className="text-primary-300">Set up a new project for multi-agent development</p>
          </div>

          <div className="bg-primary-900 rounded-lg shadow-sm border border-primary-800 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-900 border border-red-700 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-300">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-primary-300 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-primary-300 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                  placeholder="Describe your project"
                />
              </div>

              <div>
                <label htmlFor="repoSelect" className="block text-sm font-medium text-primary-300 mb-2">
                  Select Repository *
                </label>
                {loadingRepos ? (
                  <div className="w-full px-3 py-2 bg-primary-800 border border-primary-700 rounded-md">
                    <div className="text-primary-400 text-sm">Loading available repositories...</div>
                  </div>
                ) : availableRepos.length === 0 ? (
                  <div className="w-full px-3 py-2 bg-primary-800 border border-primary-700 rounded-md">
                    <div className="text-primary-400 text-sm">No available repositories found in repos/ directory</div>
                  </div>
                ) : (
                  <select
                    id="repoSelect"
                    value={selectedRepo?.path || ''}
                    onChange={handleRepoSelect}
                    required
                    className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                  >
                    <option value="">Select a repository folder...</option>
                    {availableRepos.map((repo) => (
                      <option key={repo.path} value={repo.path}>
                        {repo.name} ({repo.projectType}) {repo.hasGit ? '🔗' : ''}
                      </option>
                    ))}
                  </select>
                )}
                
                {selectedRepo && (
                  <div className="mt-2 p-3 bg-primary-800 border border-primary-700 rounded-md">
                    <div className="text-sm space-y-1">
                      <div className="text-primary-300">
                        <span className="font-medium">Path:</span> <span className="font-mono text-primary-400">{selectedRepo.path}</span>
                      </div>
                      <div className="text-primary-300">
                        <span className="font-medium">Type:</span> <span className="text-accent-50">{selectedRepo.projectType}</span>
                      </div>
                      <div className="text-primary-300">
                        <span className="font-medium">Files:</span> <span className="text-accent-50">{selectedRepo.fileCount}</span>
                      </div>
                      {selectedRepo.hasGit && (
                        <div className="text-primary-300">
                          <span className="font-medium">Git:</span> <span className="text-green-400">✓ Repository detected</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <p className="mt-1 text-sm text-primary-400">
                  Choose from available folders in the repos/ directory that aren&apos;t already indexed as projects
                </p>
              </div>

              <div>
                <label htmlFor="gitUrl" className="block text-sm font-medium text-primary-300 mb-2">
                  Git Repository URL
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
                    ? 'Git URL automatically detected from repository' 
                    : 'Optional: Git repository URL for version control integration'
                  }
                </p>
              </div>

              {/* Tech Stack Configuration */}
              <div className="space-y-4 pt-4 border-t border-primary-700">
                <h3 className="text-lg font-semibold text-accent-50">Tech Stack Configuration</h3>
                <p className="text-sm text-primary-400">
                  Specify the tools and frameworks for this project. Leave empty to use global defaults.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="framework" className="block text-sm font-medium text-primary-300 mb-2">
                      Framework
                    </label>
                    <input
                      type="text"
                      id="framework"
                      name="framework"
                      value={formData.framework}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                      placeholder="e.g., Next.js, React, Vue"
                    />
                  </div>

                  <div>
                    <label htmlFor="language" className="block text-sm font-medium text-primary-300 mb-2">
                      Language
                    </label>
                    <input
                      type="text"
                      id="language"
                      name="language"
                      value={formData.language}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                      placeholder="e.g., typescript, javascript"
                    />
                  </div>

                  <div>
                    <label htmlFor="packageManager" className="block text-sm font-medium text-primary-300 mb-2">
                      Package Manager
                    </label>
                    <input
                      type="text"
                      id="packageManager"
                      name="packageManager"
                      value={formData.packageManager}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                      placeholder="e.g., npm, yarn, pnpm, bun"
                    />
                  </div>

                  <div>
                    <label htmlFor="testFramework" className="block text-sm font-medium text-primary-300 mb-2">
                      Test Framework
                    </label>
                    <input
                      type="text"
                      id="testFramework"
                      name="testFramework"
                      value={formData.testFramework}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                      placeholder="e.g., jest, vitest, cypress"
                    />
                  </div>

                  <div>
                    <label htmlFor="lintTool" className="block text-sm font-medium text-primary-300 mb-2">
                      Lint Tool
                    </label>
                    <input
                      type="text"
                      id="lintTool"
                      name="lintTool"
                      value={formData.lintTool}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                      placeholder="e.g., eslint, tslint, pylint"
                    />
                  </div>

                  <div>
                    <label htmlFor="buildTool" className="block text-sm font-medium text-primary-300 mb-2">
                      Build Tool
                    </label>
                    <input
                      type="text"
                      id="buildTool"
                      name="buildTool"
                      value={formData.buildTool}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                      placeholder="e.g., webpack, vite, rollup"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-4 pt-6 border-t border-primary-700">
                <Link
                  href="/projects"
                  className="px-4 py-2 text-primary-200 bg-primary-800 border border-primary-700 rounded-md hover:bg-primary-700 hover:text-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-accent-600 text-accent-50 rounded-md hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-accent-50" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    'Create Project'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}