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
  const [activeTab, setActiveTab] = useState<'tokens' | 'agents' | 'queue' | 'notifications' | 'behavior' | 'advanced'>('tokens');

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
          <div className="flex h-[calc(90vh-208px)]">
            {/* Sidebar */}
            <div className="w-64 bg-primary-950 border-r border-primary-700 p-4">
              <nav className="space-y-2">
                {[
                  { id: 'tokens', label: 'Token & Rate Limits', icon: '⚡' },
                  { id: 'agents', label: 'Agent Execution', icon: '🤖' },
                  { id: 'queue', label: 'Task Queue', icon: '📋' },
                  { id: 'notifications', label: 'Notifications', icon: '🔔' },
                  { id: 'behavior', label: 'Agent Behavior', icon: '⚙️' },
                  { id: 'advanced', label: 'Advanced', icon: '🔧' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center space-x-3 ${
                      activeTab === tab.id
                        ? 'bg-accent-600 text-accent-50'
                        : 'text-primary-300 hover:bg-primary-800 hover:text-accent-50'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span className="text-sm">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto min-h-0">
              {activeTab === 'tokens' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-accent-50">Token & Rate Limits</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Max Tokens Per Day
                      </label>
                      <input
                        type="number"
                        value={settings.maxTokensPerDay}
                        onChange={(e) => updateSetting('maxTokensPerDay', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                        min="100"
                        max="100000"
                      />
                      <p className="text-xs text-primary-400 mt-1">Daily token usage limit</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Max Tokens Per Request
                      </label>
                      <input
                        type="number"
                        value={settings.maxTokensPerRequest}
                        onChange={(e) => updateSetting('maxTokensPerRequest', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                        min="100"
                        max="10000"
                      />
                      <p className="text-xs text-primary-400 mt-1">Max tokens per single request</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Max Requests Per Minute
                      </label>
                      <input
                        type="number"
                        value={settings.maxRequestsPerMinute}
                        onChange={(e) => updateSetting('maxRequestsPerMinute', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                        min="1"
                        max="100"
                      />
                      <p className="text-xs text-primary-400 mt-1">Rate limit per minute</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Max Requests Per Hour
                      </label>
                      <input
                        type="number"
                        value={settings.maxRequestsPerHour}
                        onChange={(e) => updateSetting('maxRequestsPerHour', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                        min="10"
                        max="1000"
                      />
                      <p className="text-xs text-primary-400 mt-1">Rate limit per hour</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'agents' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-accent-50">Agent Execution Settings</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Agent Timeout (seconds)
                      </label>
                      <input
                        type="number"
                        value={Math.round(settings.agentTimeout / 1000)}
                        onChange={(e) => updateSetting('agentTimeout', (parseInt(e.target.value) || 0) * 1000)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                        min="30"
                        max="1800"
                      />
                      <p className="text-xs text-primary-400 mt-1">Maximum execution time per agent</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Max Retries
                      </label>
                      <input
                        type="number"
                        value={settings.maxRetries}
                        onChange={(e) => updateSetting('maxRetries', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                        min="0"
                        max="10"
                      />
                      <p className="text-xs text-primary-400 mt-1">Retry attempts on failure</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Parallel Agent Limit
                      </label>
                      <input
                        type="number"  
                        value={settings.parallelAgentLimit}
                        onChange={(e) => updateSetting('parallelAgentLimit', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                        min="1"
                        max="10"
                      />
                      <p className="text-xs text-primary-400 mt-1">Max agents running simultaneously</p>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="autoReviewOnImport"
                        checked={settings.autoReviewOnImport}
                        onChange={(e) => updateSetting('autoReviewOnImport', e.target.checked)}
                        className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500"
                      />
                      <label htmlFor="autoReviewOnImport" className="ml-2 text-sm text-primary-300">
                        Auto-review on import
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'queue' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-accent-50">Task Queue Settings</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Max Queue Size
                      </label>
                      <input
                        type="number"
                        value={settings.maxQueueSize}
                        onChange={(e) => updateSetting('maxQueueSize', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                        min="5"
                        max="500"
                      />
                      <p className="text-xs text-primary-400 mt-1">Maximum tasks in queue</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Default Task Priority
                      </label>
                      <select
                        value={settings.taskPriority}
                        onChange={(e) => updateSetting('taskPriority', e.target.value)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                      >
                        <option value="LOW">Low</option>
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                      <p className="text-xs text-primary-400 mt-1">Default priority for new tasks</p>
                    </div>

                    <div className="flex items-center col-span-2">
                      <input
                        type="checkbox"
                        id="autoExecuteTasks"
                        checked={settings.autoExecuteTasks}
                        onChange={(e) => updateSetting('autoExecuteTasks', e.target.checked)}
                        className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500"
                      />
                      <label htmlFor="autoExecuteTasks" className="ml-2 text-sm text-primary-300">
                        Auto-execute queued tasks
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-accent-50">Notification Settings</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="emailNotifications"
                        checked={settings.emailNotifications}
                        onChange={(e) => updateSetting('emailNotifications', e.target.checked)}
                        className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500"
                      />
                      <label htmlFor="emailNotifications" className="ml-2 text-sm text-primary-300">
                        Email notifications
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Slack Webhook URL
                      </label>
                      <input
                        type="url"
                        value={settings.slackWebhookUrl || ''}
                        onChange={(e) => updateSetting('slackWebhookUrl', e.target.value || null)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                        placeholder="https://hooks.slack.com/services/..."
                      />
                      <p className="text-xs text-primary-400 mt-1">Optional Slack integration</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Discord Webhook URL
                      </label>
                      <input
                        type="url"
                        value={settings.discordWebhookUrl || ''}
                        onChange={(e) => updateSetting('discordWebhookUrl', e.target.value || null)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                        placeholder="https://discord.com/api/webhooks/..."
                      />
                      <p className="text-xs text-primary-400 mt-1">Optional Discord integration</p>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="notifyOnTaskComplete"
                          checked={settings.notifyOnTaskComplete}
                          onChange={(e) => updateSetting('notifyOnTaskComplete', e.target.checked)}
                          className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500"
                        />
                        <label htmlFor="notifyOnTaskComplete" className="ml-2 text-sm text-primary-300">
                          Notify on task completion
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="notifyOnTaskFail"
                          checked={settings.notifyOnTaskFail}
                          onChange={(e) => updateSetting('notifyOnTaskFail', e.target.checked)}
                          className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500"
                        />
                        <label htmlFor="notifyOnTaskFail" className="ml-2 text-sm text-primary-300">
                          Notify on task failure
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'behavior' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-accent-50">Agent Behavior Settings</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Code Analysis Depth
                      </label>
                      <select
                        value={settings.codeAnalysisDepth}
                        onChange={(e) => updateSetting('codeAnalysisDepth', e.target.value)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                      >
                        <option value="LIGHT">Light - Quick surface analysis</option>
                        <option value="STANDARD">Standard - Balanced analysis</option>
                        <option value="DEEP">Deep - Comprehensive analysis</option>
                      </select>
                      <p className="text-xs text-primary-400 mt-1">Analysis thoroughness level</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Test Coverage Threshold (%)
                      </label>
                      <input
                        type="number"
                        value={settings.testCoverageThreshold}
                        onChange={(e) => updateSetting('testCoverageThreshold', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                      <p className="text-xs text-primary-400 mt-1">Minimum test coverage target</p>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="enforceTypeChecking"
                        checked={settings.enforceTypeChecking}
                        onChange={(e) => updateSetting('enforceTypeChecking', e.target.checked)}
                        className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500"
                      />
                      <label htmlFor="enforceTypeChecking" className="ml-2 text-sm text-primary-300">
                        Enforce TypeScript checking
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="autoFixLintErrors"
                        checked={settings.autoFixLintErrors}
                        onChange={(e) => updateSetting('autoFixLintErrors', e.target.checked)}
                        className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500"
                      />
                      <label htmlFor="autoFixLintErrors" className="ml-2 text-sm text-primary-300">
                        Auto-fix lint errors
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'advanced' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-accent-50">Advanced Settings</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Claude Model
                      </label>
                      <select
                        value={settings.claudeModel}
                        onChange={(e) => updateSetting('claudeModel', e.target.value)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                      >
                        <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Latest)</option>
                        <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                        <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                      </select>
                      <p className="text-xs text-primary-400 mt-1">AI model to use for agents</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Custom Instructions
                      </label>
                      <textarea
                        value={settings.customInstructions || ''}
                        onChange={(e) => updateSetting('customInstructions', e.target.value || null)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                        rows={4}
                        placeholder="Additional instructions for all agents in this project..."
                      />
                      <p className="text-xs text-primary-400 mt-1">Custom prompts added to all agent requests</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        Exclude Patterns (JSON Array)
                      </label>
                      <textarea
                        value={settings.excludePatterns || ''}
                        onChange={(e) => updateSetting('excludePatterns', e.target.value || null)}
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded-lg text-accent-50 focus:outline-none focus:border-accent-500"
                        rows={3}
                        placeholder='["node_modules/**", "*.log", "dist/**"]'
                      />
                      <p className="text-xs text-primary-400 mt-1">File patterns to exclude from analysis</p>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="includeDependencies"
                        checked={settings.includeDependencies}
                        onChange={(e) => updateSetting('includeDependencies', e.target.checked)}
                        className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500"
                      />
                      <label htmlFor="includeDependencies" className="ml-2 text-sm text-primary-300">
                        Include dependency analysis
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-red-400">Failed to load settings</p>
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