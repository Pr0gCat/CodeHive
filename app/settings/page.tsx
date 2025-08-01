'use client';

import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import BudgetAllocationSlider from '@/components/ui/BudgetAllocationSlider';
import DualRangeSlider from '@/components/ui/DualRangeSlider';
import PercentageSlider from '@/components/ui/PercentageSlider';
import TokenLimitSlider from '@/components/ui/TokenLimitSlider';
import RateLimitSlider from '@/components/ui/RateLimitSlider';
import { useToast } from '@/components/ui/ToastManager';
import SocketIOTest from '../components/SocketIOTest';

interface ProjectBudget {
  projectId: string;
  projectName: string;
  allocatedPercentage: number;
  dailyTokenBudget: number;
  usedTokens: number;
  usagePercentage: number;
}

interface BudgetData {
  globalDailyLimit: number;
  projects: ProjectBudget[];
  totalAllocated: number;
}

export default function SettingsPage() {
  const { showToast } = useToast();

  // All settings combined
  const [allSettings, setAllSettings] = useState({
    // Global settings
    dailyTokenLimit: 100000000,
    warningThreshold: 0.75,
    criticalThreshold: 0.9,
    allocationStrategy: 0.5,
    // Auto management settings
    autoResumeEnabled: true,
    pauseOnWarning: false,
    // Claude Code settings
    claudeCodePath: 'claude',
    rateLimitPerMinute: 50,
  });

  // Derived states for UI convenience
  const globalSettings = {
    dailyTokenLimit: allSettings.dailyTokenLimit,
    warningThreshold: allSettings.warningThreshold,
    criticalThreshold: allSettings.criticalThreshold,
    allocationStrategy: allSettings.allocationStrategy,
  };

  const autoSettings = {
    autoResumeEnabled: allSettings.autoResumeEnabled,
    pauseOnWarning: allSettings.pauseOnWarning,
  };

  const claudeSettings = {
    claudeCodePath: allSettings.claudeCodePath,
    rateLimitPerMinute: allSettings.rateLimitPerMinute,
  };

  // Test connection state
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message?: string;
  }>({ status: 'idle' });

  const [budgetData, setBudgetData] = useState<BudgetData>({
    globalDailyLimit: 100000000, // Match with globalSettings default
    projects: [],
    totalAllocated: 0,
  });

  const [loading, setLoading] = useState(true);
  const [budgetSaving, setBudgetSaving] = useState(false);

  // Combined saving state and change tracking
  const [combinedSaving, setCombinedSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchBudgetData();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();

      if (data.success) {
        const settings = data.data;
        // Update all settings at once
        setAllSettings({
          dailyTokenLimit: settings.dailyTokenLimit,
          warningThreshold: settings.warningThreshold,
          criticalThreshold: settings.criticalThreshold,
          allocationStrategy: settings.allocationStrategy,
          autoResumeEnabled: settings.autoResumeEnabled,
          pauseOnWarning: settings.pauseOnWarning,
          claudeCodePath: settings.claudeCodePath,
          rateLimitPerMinute: settings.rateLimitPerMinute,
        });
      } else {
        showToast('無法載入設定', 'error');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      showToast('無法載入設定', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetData = async () => {
    try {
      const response = await fetch('/api/projects/budgets');
      const data = await response.json();

      if (data.success) {
        setBudgetData(data.data);
      } else {
        showToast('無法載入預算資料', 'error');
      }
    } catch (error) {
      console.error('Error fetching budget data:', error);
      showToast('無法載入預算資料', 'error');
    }
  };

  // Handle global settings changes (visual updates only)
  const handleGlobalSettingChange = (key: string, value: any) => {
    setAllSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle global settings save (on drag end)
  const handleGlobalSettingSave = async (key: string, value: any) => {
    await saveGlobalSetting(key, value);
  };

  const handleThresholdChange = (warning: number, critical: number) => {
    setAllSettings(prev => ({
      ...prev,
      warningThreshold: warning,
      criticalThreshold: critical,
    }));
  };

  const handleThresholdSave = async (warning: number, critical: number) => {
    await saveGlobalSettings({
      ...allSettings,
      warningThreshold: warning,
      criticalThreshold: critical,
    });
  };

  // Handle auto management settings (toggles) - immediate save
  const handleAutoSettingChange = async (key: string, value: boolean) => {
    setAllSettings(prev => ({
      ...prev,
      [key]: value,
    }));

    // Immediate save for toggles
    await saveGlobalSetting(key, value);
  };

  // Handle Claude Code settings changes (visual updates only)
  const handleClaudeSettingChange = (key: string, value: string | number) => {
    setAllSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle Claude Code settings save (on drag end or input blur)
  const handleClaudeSettingSave = async (key: string, value: string | number) => {
    await saveGlobalSetting(key, value);
  };

  // Test Claude Code connection
  const testClaudeConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus({ status: 'testing', message: '測試連接中...' });

    try {
      const response = await fetch('/api/claude-code/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: claudeSettings.claudeCodePath }),
      });

      const data = await response.json();

      if (data.success) {
        setConnectionStatus({
          status: 'success',
          message: `連接成功！Claude Code 版本: ${data.version || '未知'}`,
        });
        showToast(`Claude Code 連接成功！版本: ${data.version || '未知'}`, 'success');
      } else {
        setConnectionStatus({
          status: 'error',
          message: data.error || '連接失敗',
        });
        showToast(data.error || 'Claude Code 連接失敗', 'error');
      }
    } catch (error) {
      setConnectionStatus({
        status: 'error',
        message: '無法測試連接',
      });
      showToast('無法測試 Claude Code 連接', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  // Save individual global setting
  const saveGlobalSetting = async (key: string, value: any) => {
    try {
      const updatedSettings = {
        ...allSettings,
        [key]: value,
      };

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSettings),
      });

      if (!response.ok) {
        console.error('Failed to save setting:', key);
        showToast('設定保存失敗', 'error');
      }
    } catch (error) {
      console.error('Error saving setting:', error);
      showToast('設定保存失敗', 'error');
    }
  };

  // Save all global settings (for thresholds)
  const saveGlobalSettings = async (updatedSettings: any) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSettings),
      });

      if (!response.ok) {
        console.error('Failed to save global settings');
        showToast('全局設定保存失敗', 'error');
      }
    } catch (error) {
      console.error('Error saving global settings:', error);
      showToast('全局設定保存失敗', 'error');
    }
  };

  // Note: Combined settings save function removed as Claude and App settings
  // are now managed via config files and environment variables

  const handleBudgetAllocationChange = async (
    allocations: Array<{ projectId: string; allocatedPercentage: number }>
  ) => {
    setBudgetSaving(true);

    try {
      const response = await fetch('/api/projects/budgets', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(allocations),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh budget data to show updated values
        await fetchBudgetData();
        showToast('預算分配已更新', 'success');
      } else {
        showToast('更新預算分配失敗', 'error');
      }
    } catch (error) {
      console.error('Error updating budget allocations:', error);
      showToast('更新預算分配失敗', 'error');
    } finally {
      setBudgetSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-950">
        <Navbar />
        <div className="py-8">
          <div className="max-w-4xl mx-auto px-4 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600 mx-auto mb-4"></div>
              <p className="text-primary-300">載入設定中...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-950">
      <Navbar />
      <div className="py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-accent-50">系統設定</h1>
                <p className="text-primary-300 mt-2">
                  管理全域限制、自動管理、API 配置和專案預算分配
                </p>
              </div>
            </div>
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Global Settings */}
            <div className="space-y-6">
              {/* Token Limits */}
              <div className="bg-primary-900 border border-primary-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-accent-50 mb-6">
                  全域限制設定
                </h2>

                {/* Daily Token Limit */}
                <div className="mb-8">
                  <TokenLimitSlider
                    value={globalSettings.dailyTokenLimit}
                    onChange={value =>
                      handleGlobalSettingChange('dailyTokenLimit', value)
                    }
                    onChangeEnd={value =>
                      handleGlobalSettingSave('dailyTokenLimit', value)
                    }
                    disabled={false}
                  />
                </div>

                {/* Warning and Critical Thresholds */}
                <div className="mb-8">
                  <DualRangeSlider
                    minValue={globalSettings.warningThreshold}
                    maxValue={globalSettings.criticalThreshold}
                    onChange={handleThresholdChange}
                    onChangeEnd={handleThresholdSave}
                    min={0.1}
                    max={0.99}
                    step={0.01}
                    disabled={false}
                    label="預警閾值設定"
                    help="設定觸發警告和危險狀態的使用百分比。系統會在達到警告閾值時發出提醒，達到危險閾值時考慮暫停。"
                  />
                </div>

                {/* Allocation Strategy */}
                <div className="mb-4">
                  <PercentageSlider
                    value={globalSettings.allocationStrategy}
                    onChange={value =>
                      handleGlobalSettingChange('allocationStrategy', value)
                    }
                    onChangeEnd={value =>
                      handleGlobalSettingSave('allocationStrategy', value)
                    }
                    disabled={false}
                    label="分配策略"
                    help="設定專案間的 Token 分配策略。較高的值會更積極地分配 Token 給活躍的專案。"
                    color="accent"
                    markers={[
                      { value: 0, label: '均等' },
                      { value: 0.5, label: '混合' },
                      { value: 1, label: '使用量' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Auto Management Settings */}
            <div className="space-y-6">
              <div className="bg-primary-900 border border-primary-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-accent-50">
                    自動管理
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-primary-800 rounded-md border border-primary-700">
                    <div>
                      <label className="text-sm font-medium text-primary-300">
                        自動恢復
                      </label>
                      <p className="text-xs text-primary-500">
                        當 Token 使用量降至安全範圍時自動恢復 Agent 執行
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSettings.autoResumeEnabled}
                        onChange={e =>
                          handleAutoSettingChange(
                            'autoResumeEnabled',
                            e.target.checked
                          )
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-primary-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-primary-800 rounded-md border border-primary-700">
                    <div>
                      <label className="text-sm font-medium text-primary-300">
                        警告時暫停
                      </label>
                      <p className="text-xs text-primary-500">
                        在達到警告閾值時暫停所有 Agent 執行
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSettings.pauseOnWarning}
                        onChange={e =>
                          handleAutoSettingChange(
                            'pauseOnWarning',
                            e.target.checked
                          )
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-primary-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Claude Code Configuration */}
              <div className="bg-primary-900 border border-primary-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-accent-50">
                    Claude Code 配置
                  </h3>
                  <button
                    onClick={testClaudeConnection}
                    disabled={testingConnection}
                    className="px-3 py-1 text-sm bg-accent-600 text-white rounded hover:bg-accent-700 disabled:bg-primary-700 disabled:text-primary-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {testingConnection ? '測試中...' : '測試連接'}
                  </button>
                </div>

                {/* Connection Status */}
                {connectionStatus.status !== 'idle' && (
                  <div
                    className={`mb-4 p-3 rounded-md text-sm ${
                      connectionStatus.status === 'testing'
                        ? 'bg-blue-900 border border-blue-700 text-blue-300'
                        : connectionStatus.status === 'success'
                        ? 'bg-green-900 border border-green-700 text-green-300'
                        : 'bg-red-900 border border-red-700 text-red-300'
                    }`}
                  >
                    {connectionStatus.message}
                  </div>
                )}

                <div className="space-y-6">
                  {/* Claude Code Path */}
                  <div>
                    <label className="text-sm font-medium text-primary-300 block mb-2">
                      Claude Code 執行檔路徑
                    </label>
                    <input
                      type="text"
                      value={claudeSettings.claudeCodePath}
                      onChange={e =>
                        handleClaudeSettingChange('claudeCodePath', e.target.value)
                      }
                      onBlur={e =>
                        handleClaudeSettingSave('claudeCodePath', e.target.value)
                      }
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 rounded-md text-primary-100 focus:outline-none focus:ring-2 focus:ring-accent-600 focus:border-accent-600"
                      placeholder="claude"
                    />
                    <p className="text-xs text-primary-500 mt-1">
                      Claude Code CLI 的執行檔路徑。預設為 "claude"（需要在 PATH 中）
                    </p>
                  </div>

                  {/* Rate Limit */}
                  <div>
                    <label className="text-sm font-medium text-primary-300 block mb-2">
                      API 速率限制
                    </label>
                    <p className="text-xs text-primary-500 mb-4">
                      每分鐘最多可執行的 Claude Code API 呼叫次數
                    </p>
                    <RateLimitSlider
                      value={claudeSettings.rateLimitPerMinute}
                      onChange={value =>
                        handleClaudeSettingChange('rateLimitPerMinute', value)
                      }
                      onChangeEnd={value =>
                        handleClaudeSettingSave('rateLimitPerMinute', value)
                      }
                      disabled={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Budget Allocation */}
          <div className="mt-8 bg-primary-900 border border-primary-800 rounded-lg shadow p-6">
            <BudgetAllocationSlider
              projects={budgetData.projects}
              globalDailyLimit={budgetData.globalDailyLimit}
              onChange={handleBudgetAllocationChange}
              disabled={budgetSaving}
            />

            {budgetSaving && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center text-accent-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-400 mr-2"></div>
                  更新預算分配中...
                </div>
              </div>
            )}
          </div>

          {/* WebSocket Test */}
          <div className="mt-8">
            <SocketIOTest />
          </div>
        </div>
      </div>
    </div>
  );
}
