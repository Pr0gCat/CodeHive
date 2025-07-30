'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ProjectImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectImportModal({ 
  isOpen, 
  onClose
}: ProjectImportModalProps) {
  const router = useRouter();
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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
        setError(data.error || '無法匯入專案');
      }
    } catch (err) {
      setError('網路錯誤：無法匯入專案');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-primary-800 border border-primary-700 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-accent-50">從 Git 匯入專案</h2>
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
            <label htmlFor="projectName" className="block text-sm font-medium text-accent-50 mb-2">
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
            <label htmlFor="branch" className="block text-sm font-medium text-accent-50 mb-2">
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
  );
}