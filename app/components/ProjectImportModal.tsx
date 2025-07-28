'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProjectImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  globalSettings?: {
    preferredFramework?: string;
    preferredLanguage?: string;
    preferredPackageManager?: string;
    preferredTestFramework?: string;
    preferredLintTool?: string;
    preferredBuildTool?: string;
  };
}

export default function ProjectImportModal({ 
  isOpen, 
  onClose,
  globalSettings = {} 
}: ProjectImportModalProps) {
  const router = useRouter();
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    gitUrl: '',
    projectName: '',
    branch: '',
    framework: globalSettings?.preferredFramework || '',
    language: globalSettings?.preferredLanguage || '',
    packageManager: globalSettings?.preferredPackageManager || '',
    testFramework: globalSettings?.preferredTestFramework || '',
    lintTool: globalSettings?.preferredLintTool || '',
    buildTool: globalSettings?.preferredBuildTool || '',
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
      projectName: prev.projectName || extractProjectName(url)
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsImporting(true);

    try {
      const response = await fetch('/api/projects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(`/projects/${data.project.id}`);
        onClose();
      } else {
        setError(data.error || 'Failed to import project');
      }
    } catch (err) {
      setError('Network error: Unable to import project');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-primary-800 border border-primary-700 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-accent-50">Import Project from Git</h2>
          <button
            onClick={onClose}
            className="text-primary-400 hover:text-accent-50 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
            <label htmlFor="gitUrl" className="block text-sm font-medium text-accent-50 mb-2">
              Git Repository URL <span className="text-red-400">*</span>
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
              Supports GitHub, GitLab, and other Git hosting services
            </p>
          </div>

          {/* Project Name */}
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium text-accent-50 mb-2">
              Project Name <span className="text-red-400">*</span>
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
            <label htmlFor="branch" className="block text-sm font-medium text-accent-50 mb-2">
              Branch (optional)
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
              Leave empty to use the default branch
            </p>
          </div>

          {/* Tech Stack Configuration */}
          <div className="space-y-4 pt-4 border-t border-primary-700">
            <h3 className="text-lg font-semibold text-accent-50">Tech Stack Configuration</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="framework" className="block text-sm font-medium text-accent-50 mb-2">
                  Framework
                </label>
                <input
                  type="text"
                  id="framework"
                  name="framework"
                  value={formData.framework}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-primary-900 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                  placeholder="e.g., Next.js, React, Vue"
                />
              </div>

              <div>
                <label htmlFor="language" className="block text-sm font-medium text-accent-50 mb-2">
                  Language
                </label>
                <input
                  type="text"
                  id="language"
                  name="language"
                  value={formData.language}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-primary-900 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                  placeholder="e.g., typescript, javascript"
                />
              </div>

              <div>
                <label htmlFor="packageManager" className="block text-sm font-medium text-accent-50 mb-2">
                  Package Manager
                </label>
                <input
                  type="text"
                  id="packageManager"
                  name="packageManager"
                  value={formData.packageManager}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-primary-900 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                  placeholder="e.g., npm, yarn, pnpm, bun"
                />
              </div>

              <div>
                <label htmlFor="testFramework" className="block text-sm font-medium text-accent-50 mb-2">
                  Test Framework
                </label>
                <input
                  type="text"
                  id="testFramework"
                  name="testFramework"
                  value={formData.testFramework}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-primary-900 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                  placeholder="e.g., jest, vitest, cypress"
                />
              </div>

              <div>
                <label htmlFor="lintTool" className="block text-sm font-medium text-accent-50 mb-2">
                  Lint Tool
                </label>
                <input
                  type="text"
                  id="lintTool"
                  name="lintTool"
                  value={formData.lintTool}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-primary-900 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                  placeholder="e.g., eslint, tslint"
                />
              </div>

              <div>
                <label htmlFor="buildTool" className="block text-sm font-medium text-accent-50 mb-2">
                  Build Tool
                </label>
                <input
                  type="text"
                  id="buildTool"
                  name="buildTool"
                  value={formData.buildTool}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-primary-900 border border-primary-700 text-accent-50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder-primary-400"
                  placeholder="e.g., webpack, vite, rollup"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-primary-300 hover:text-accent-50 transition-colors"
              disabled={isImporting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isImporting}
              className="px-4 py-2 bg-accent-600 text-white rounded-md hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isImporting ? 'Importing...' : 'Import Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}