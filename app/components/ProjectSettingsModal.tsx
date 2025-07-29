'use client';

import { useState, useEffect } from 'react';
import { ProjectSettings, TaskPriority, CodeAnalysisDepth } from '@/lib/db';

interface ProjectSettingsModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdate?: (settings: ProjectSettings) => void;
}

export default function ProjectSettingsModal({
  projectId,
  isOpen,
  onClose,
  onSettingsUpdate,
}: ProjectSettingsModalProps) {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  // Removed tab system for simplicity

  useEffect(() => {
    if (isOpen && projectId) {
      fetchSettings();
    }
  }, [isOpen, projectId]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/settings`);
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      } else {
        console.error('Failed to fetch settings:', data.error);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      if (data.success) {
        if (onSettingsUpdate) {
          onSettingsUpdate(data.data);
        }
        onClose();
      } else {
        alert(`Failed to save settings: ${data.error}`);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
        if (onSettingsUpdate) {
          onSettingsUpdate(data.data);
        }
      } else {
        alert(`Failed to reset settings: ${data.error}`);
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      alert('Failed to reset settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof ProjectSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

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
        alert(`Failed to remove project: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error removing project:', error);
      alert('Failed to remove project. Please try again.');
    } finally {
      setRemoving(false);
      setShowRemoveConfirm(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-primary-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-primary-700">
          <h2 className="text-xl font-bold text-accent-50">Project Settings</h2>
          <button
            onClick={onClose}
            className="text-primary-400 hover:text-accent-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600 mx-auto mb-4"></div>
            <p className="text-primary-400">Loading settings...</p>
          </div>
        ) : settings ? (
          <div className="p-6 max-h-[calc(90vh-208px)] overflow-y-auto">
            {/* Essential Settings */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-accent-50 mb-4">Project Settings</h3>
              
              {/* Token Limits */}
              <div>
                <h4 className="text-sm font-medium text-primary-300 mb-3">Token & Rate Limits</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-primary-400 mb-1">Max Tokens Per Day</label>
                    <input
                      type="number"
                      value={settings.maxTokensPerDay}
                      onChange={(e) => updateSetting('maxTokensPerDay', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500 text-sm"
                      min="100"
                      max="100000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-primary-400 mb-1">Max Requests Per Hour</label>
                    <input
                      type="number"
                      value={settings.maxRequestsPerHour}
                      onChange={(e) => updateSetting('maxRequestsPerHour', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500 text-sm"
                      min="10"
                      max="1000"
                    />
                  </div>
                </div>
              </div>

              {/* Agent Settings */}
              <div>
                <h4 className="text-sm font-medium text-primary-300 mb-3">Agent Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-primary-400 mb-1">Agent Timeout (seconds)</label>
                    <input
                      type="number"
                      value={Math.round(settings.agentTimeout / 1000)}
                      onChange={(e) => updateSetting('agentTimeout', (parseInt(e.target.value) || 0) * 1000)}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500 text-sm"
                      min="30"
                      max="1800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-primary-400 mb-1">Parallel Agent Limit</label>
                    <input
                      type="number"
                      value={settings.parallelAgentLimit}
                      onChange={(e) => updateSetting('parallelAgentLimit', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500 text-sm"
                      min="1"
                      max="10"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mt-3">
                  <label className="flex items-center text-sm text-primary-300">
                    <input
                      type="checkbox"
                      checked={settings.autoReviewOnImport}
                      onChange={(e) => updateSetting('autoReviewOnImport', e.target.checked)}
                      className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500 mr-2"
                    />
                    Auto-review on import
                  </label>
                  <label className="flex items-center text-sm text-primary-300">
                    <input
                      type="checkbox"
                      checked={settings.autoExecuteTasks}
                      onChange={(e) => updateSetting('autoExecuteTasks', e.target.checked)}
                      className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500 mr-2"
                    />
                    Auto-execute tasks
                  </label>
                </div>
              </div>

              {/* Analysis Settings */}
              <div>
                <h4 className="text-sm font-medium text-primary-300 mb-3">Analysis & Quality</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-primary-400 mb-1">Code Analysis Depth</label>
                    <select
                      value={settings.codeAnalysisDepth}
                      onChange={(e) => updateSetting('codeAnalysisDepth', e.target.value)}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500 text-sm"
                    >
                      <option value="LIGHT">Light</option>
                      <option value="STANDARD">Standard</option>
                      <option value="DEEP">Deep</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-primary-400 mb-1">Test Coverage (%)</label>
                    <input
                      type="number"
                      value={settings.testCoverageThreshold}
                      onChange={(e) => updateSetting('testCoverageThreshold', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500 text-sm"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div>
                <h4 className="text-sm font-medium text-primary-300 mb-3">Notifications</h4>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center text-sm text-primary-300">
                      <input
                        type="checkbox"
                        checked={settings.notifyOnTaskComplete}
                        onChange={(e) => updateSetting('notifyOnTaskComplete', e.target.checked)}
                        className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500 mr-2"
                      />
                      Task completion
                    </label>
                    <label className="flex items-center text-sm text-primary-300">
                      <input
                        type="checkbox"
                        checked={settings.notifyOnTaskFail}
                        onChange={(e) => updateSetting('notifyOnTaskFail', e.target.checked)}
                        className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500 mr-2"
                      />
                      Task failures
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs text-primary-400 mb-1">Slack Webhook (optional)</label>
                    <input
                      type="url"
                      value={settings.slackWebhookUrl || ''}
                      onChange={(e) => updateSetting('slackWebhookUrl', e.target.value || null)}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500 text-sm"
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-red-400">Failed to load settings</p>
          </div>
        )}

        {/* Danger Zone */}
        <div className="border-t border-red-800 bg-red-950/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-red-300">Remove Project</h4>
              <p className="text-xs text-red-400">Removes from database, keeps code files</p>
            </div>
            <button
              onClick={() => setShowRemoveConfirm(true)}
              disabled={removing}
              className="px-3 py-1.5 text-xs font-medium text-red-300 border border-red-600 rounded hover:bg-red-600 hover:text-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove
            </button>
          </div>
        </div>

        {/* Remove Confirmation Modal */}
        {showRemoveConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-primary-900 rounded-lg border border-red-700 p-6 max-w-md w-full mx-4">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-red-400">Remove Project</h3>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-primary-300 mb-3">
                  Are you sure you want to remove this project from CodeHive?
                </p>
                <div className="bg-primary-800 border border-primary-700 rounded-md p-3">
                  <ul className="text-xs text-primary-400 space-y-1">
                    <li>✅ Database record will be deleted</li>
                    <li>✅ Project settings will be removed</li>
                    <li>✅ Code files will remain in repos/ directory</li>
                    <li>⚠️ This action cannot be undone</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowRemoveConfirm(false)}
                  disabled={removing}
                  className="px-4 py-2 text-sm font-medium text-primary-300 border border-primary-600 rounded-lg hover:bg-primary-800 hover:text-accent-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveProject}
                  disabled={removing}
                  className="px-4 py-2 text-sm font-medium text-red-50 bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {removing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-50"></div>
                      <span>Removing...</span>
                    </>
                  ) : (
                    <span>Remove Project</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-primary-700 flex-shrink-0">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-red-400 border border-red-400 rounded-lg hover:bg-red-400 hover:text-primary-900 disabled:opacity-50"
          >
            Reset to Defaults
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-primary-300 border border-primary-600 rounded-lg hover:bg-primary-800 hover:text-accent-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !settings}
              className="px-4 py-2 text-sm font-medium text-accent-50 bg-accent-600 rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-50"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Settings</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}