'use client';

import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastManager';
import { ProjectSettings } from '@/lib/db';
import { Bell, Bot, Lock, Settings, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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
  const { showToast } = useToast();
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/settings`);
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      } else {
        console.error('無法載入設定：', data.error);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchSettings();
    }
  }, [isOpen, projectId, fetchSettings]);

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
        showToast('設定已成功儲存', 'success');
        onClose();
      } else {
        showToast(`儲存設定失敗：${data.error}`, 'error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('儲存設定失敗，請重試。', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
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
        showToast('設定已重設為預設值', 'success');
      } else {
        showToast(`重設設定失敗：${data.error}`, 'error');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      showToast('重設設定失敗，請重試。', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof ProjectSettings, value: ProjectSettings[keyof ProjectSettings]) => {
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

  const tabs = [
    { id: 'general', name: '一般設定', icon: Settings },
    { id: 'limits', name: '限制設定', icon: Lock },
    { id: 'agents', name: '代理設定', icon: Bot },
    { id: 'notifications', name: '通知設定', icon: Bell },
    { id: 'advanced', name: '進階設定', icon: Wrench },
  ];

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

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600 mx-auto mb-4"></div>
            <p className="text-primary-400">載入設定中...</p>
          </div>
        ) : settings ? (
          <div className="flex h-[calc(90vh-208px)]">
            {/* Sidebar */}
            <div className="w-64 bg-primary-950 border-r border-primary-700 p-4">
              <nav className="space-y-2">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-accent-600 text-accent-50'
                        : 'text-primary-300 hover:bg-primary-800 hover:text-accent-50'
                    }`}
                  >
                    <tab.icon className="w-4 h-4 mr-2" />
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-accent-50 mb-4">
                    一般設定
                  </h3>

                  {/* Basic Settings */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        每日 Token 限制
                      </label>
                      <input
                        type="number"
                        value={settings.maxTokensPerDay}
                        onChange={e =>
                          updateSetting(
                            'maxTokensPerDay',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                        min="1000"
                        max="1000000"
                      />
                      <p className="text-xs text-primary-400 mt-1">
                        建議值：10,000 - 100,000
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        每次請求 Token 限制
                      </label>
                      <input
                        type="number"
                        value={settings.maxTokensPerRequest}
                        onChange={e =>
                          updateSetting(
                            'maxTokensPerRequest',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                        min="100"
                        max="8000"
                      />
                      <p className="text-xs text-primary-400 mt-1">
                        建議值：1,000 - 4,000
                      </p>
                    </div>
                  </div>

                  {/* Auto-execution Settings */}
                  <div>
                    <h4 className="text-sm font-medium text-primary-300 mb-3">
                      自動執行設定
                    </h4>
                    <div className="space-y-3">
                      <label className="flex items-center text-sm text-primary-300">
                        <input
                          type="checkbox"
                          checked={settings.autoReviewOnImport}
                          onChange={e =>
                            updateSetting(
                              'autoReviewOnImport',
                              e.target.checked
                            )
                          }
                          className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500 mr-3"
                        />
                        匯入專案時自動檢視
                      </label>
                      <label className="flex items-center text-sm text-primary-300">
                        <input
                          type="checkbox"
                          checked={settings.autoExecuteTasks}
                          onChange={e =>
                            updateSetting('autoExecuteTasks', e.target.checked)
                          }
                          className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500 mr-3"
                        />
                        自動執行任務
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'limits' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-accent-50 mb-4">
                    限制設定
                  </h3>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        每分鐘請求限制
                      </label>
                      <input
                        type="number"
                        value={settings.maxRequestsPerMinute}
                        onChange={e =>
                          updateSetting(
                            'maxRequestsPerMinute',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                        min="1"
                        max="100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        每小時請求限制
                      </label>
                      <input
                        type="number"
                        value={settings.maxRequestsPerHour}
                        onChange={e =>
                          updateSetting(
                            'maxRequestsPerHour',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                        min="10"
                        max="1000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-300 mb-2">
                      佇列大小限制
                    </label>
                    <input
                      type="number"
                      value={settings.maxQueueSize}
                      onChange={e =>
                        updateSetting(
                          'maxQueueSize',
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                      min="10"
                      max="200"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'agents' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-accent-50 mb-4">
                    代理設定
                  </h3>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        代理逾時（秒）
                      </label>
                      <input
                        type="number"
                        value={Math.round(settings.agentTimeout / 1000)}
                        onChange={e =>
                          updateSetting(
                            'agentTimeout',
                            (parseInt(e.target.value) || 0) * 1000
                          )
                        }
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                        min="30"
                        max="1800"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        並行代理限制
                      </label>
                      <input
                        type="number"
                        value={settings.parallelAgentLimit}
                        onChange={e =>
                          updateSetting(
                            'parallelAgentLimit',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                        min="1"
                        max="10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        最大重試次數
                      </label>
                      <input
                        type="number"
                        value={settings.maxRetries}
                        onChange={e =>
                          updateSetting(
                            'maxRetries',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                        min="0"
                        max="10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-primary-300 mb-2">
                        任務優先級
                      </label>
                      <select
                        value={settings.taskPriority}
                        onChange={e =>
                          updateSetting('taskPriority', e.target.value)
                        }
                        className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                      >
                        <option value="LOW">低</option>
                        <option value="NORMAL">一般</option>
                        <option value="HIGH">高</option>
                        <option value="CRITICAL">緊急</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-primary-300 mb-3">
                      程式碼分析設定
                    </h4>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-primary-300 mb-2">
                          分析深度
                        </label>
                        <select
                          value={settings.codeAnalysisDepth}
                          onChange={e =>
                            updateSetting('codeAnalysisDepth', e.target.value)
                          }
                          className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                        >
                          <option value="LIGHT">輕量</option>
                          <option value="STANDARD">標準</option>
                          <option value="DEEP">深度</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-primary-300 mb-2">
                          測試覆蓋率閾值（%）
                        </label>
                        <input
                          type="number"
                          value={settings.testCoverageThreshold}
                          onChange={e =>
                            updateSetting(
                              'testCoverageThreshold',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                          min="0"
                          max="100"
                          step="0.1"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-primary-300 mb-3">
                      品質控制
                    </h4>
                    <div className="space-y-3">
                      <label className="flex items-center text-sm text-primary-300">
                        <input
                          type="checkbox"
                          checked={settings.enforceTypeChecking}
                          onChange={e =>
                            updateSetting(
                              'enforceTypeChecking',
                              e.target.checked
                            )
                          }
                          className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500 mr-3"
                        />
                        強制型別檢查
                      </label>
                      <label className="flex items-center text-sm text-primary-300">
                        <input
                          type="checkbox"
                          checked={settings.autoFixLintErrors}
                          onChange={e =>
                            updateSetting('autoFixLintErrors', e.target.checked)
                          }
                          className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500 mr-3"
                        />
                        自動修復 Lint 錯誤
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-accent-50 mb-4">
                    通知設定
                  </h3>

                  <div>
                    <h4 className="text-sm font-medium text-primary-300 mb-3">
                      通知事件
                    </h4>
                    <div className="space-y-3">
                      <label className="flex items-center text-sm text-primary-300">
                        <input
                          type="checkbox"
                          checked={settings.notifyOnTaskComplete}
                          onChange={e =>
                            updateSetting(
                              'notifyOnTaskComplete',
                              e.target.checked
                            )
                          }
                          className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500 mr-3"
                        />
                        任務完成時通知
                      </label>
                      <label className="flex items-center text-sm text-primary-300">
                        <input
                          type="checkbox"
                          checked={settings.notifyOnTaskFail}
                          onChange={e =>
                            updateSetting('notifyOnTaskFail', e.target.checked)
                          }
                          className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500 mr-3"
                        />
                        任務失敗時通知
                      </label>
                      <label className="flex items-center text-sm text-primary-300">
                        <input
                          type="checkbox"
                          checked={settings.emailNotifications}
                          onChange={e =>
                            updateSetting(
                              'emailNotifications',
                              e.target.checked
                            )
                          }
                          className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500 mr-3"
                        />
                        啟用電子郵件通知
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-300 mb-2">
                      Slack Webhook URL
                    </label>
                    <input
                      type="url"
                      value={settings.slackWebhookUrl || ''}
                      onChange={e =>
                        updateSetting('slackWebhookUrl', e.target.value || null)
                      }
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-300 mb-2">
                      Discord Webhook URL
                    </label>
                    <input
                      type="url"
                      value={settings.discordWebhookUrl || ''}
                      onChange={e =>
                        updateSetting(
                          'discordWebhookUrl',
                          e.target.value || null
                        )
                      }
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                      placeholder="https://discord.com/api/webhooks/..."
                    />
                  </div>
                </div>
              )}

              {activeTab === 'advanced' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-accent-50 mb-4">
                    進階設定
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-primary-300 mb-2">
                      Claude 模型
                    </label>
                    <select
                      value={settings.claudeModel}
                      onChange={e =>
                        updateSetting('claudeModel', e.target.value)
                      }
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                    >
                      <option value="claude-3-5-sonnet-20241022">
                        Claude 3.5 Sonnet
                      </option>
                      <option value="claude-3-opus-20240229">
                        Claude 3 Opus
                      </option>
                      <option value="claude-3-sonnet-20240229">
                        Claude 3 Sonnet
                      </option>
                      <option value="claude-3-haiku-20240307">
                        Claude 3 Haiku
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-300 mb-2">
                      自訂指令
                    </label>
                    <textarea
                      value={settings.customInstructions || ''}
                      onChange={e =>
                        updateSetting(
                          'customInstructions',
                          e.target.value || null
                        )
                      }
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500 resize-none"
                      rows={4}
                      placeholder="輸入自訂的 Claude 指令..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-300 mb-2">
                      排除檔案模式
                    </label>
                    <input
                      type="text"
                      value={settings.excludePatterns || ''}
                      onChange={e =>
                        updateSetting('excludePatterns', e.target.value || null)
                      }
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-600 rounded text-accent-50 focus:outline-none focus:border-accent-500"
                      placeholder='["node_modules/**", "dist/**", "*.log"]'
                    />
                    <p className="text-xs text-primary-400 mt-1">
                      JSON 陣列格式的 glob 模式
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center text-sm text-primary-300">
                      <input
                        type="checkbox"
                        checked={settings.includeDependencies}
                        onChange={e =>
                          updateSetting('includeDependencies', e.target.checked)
                        }
                        className="w-4 h-4 text-accent-600 bg-primary-800 border-primary-600 rounded focus:ring-accent-500 mr-3"
                      />
                      包含依賴項目分析
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-red-400">無法載入設定</p>
          </div>
        )}

        {/* Danger Zone */}
        <div className="border-t border-red-800 bg-red-950/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-red-300">移除專案</h4>
              <p className="text-xs text-red-400">
                移除資料庫記錄，保留程式碼檔案
              </p>
            </div>
            <button
              onClick={() => setShowRemoveConfirm(true)}
              disabled={removing}
              className="px-3 py-1.5 text-xs font-medium text-red-300 border border-red-600 rounded hover:bg-red-600 hover:text-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              移除
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-primary-700 flex-shrink-0">
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-red-400 border border-red-400 rounded-lg hover:bg-red-400 hover:text-primary-900 disabled:opacity-50"
          >
            重設為預設值
          </button>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-primary-300 border border-primary-600 rounded-lg hover:bg-primary-800 hover:text-accent-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !settings}
              className="px-4 py-2 text-sm font-medium text-accent-50 bg-accent-600 rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-50"></div>
                  <span>儲存中...</span>
                </>
              ) : (
                <span>儲存設定</span>
              )}
            </button>
          </div>
        </div>

        {/* Confirmation Dialogs */}
        <ConfirmDialog
          isOpen={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          onConfirm={handleReset}
          title="重設設定"
          message="確定要將所有設定重設為預設值嗎？此操作無法復原。"
          confirmText="重設"
          cancelText="取消"
          type="warning"
          isLoading={saving}
        />

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
