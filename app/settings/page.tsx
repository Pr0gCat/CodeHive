'use client';

import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import BudgetAllocationSlider from '../components/ui/BudgetAllocationSlider';
import DualRangeSlider from '../components/ui/DualRangeSlider';
import PercentageSlider from '../components/ui/PercentageSlider';
import TokenLimitSlider from '../components/ui/TokenLimitSlider';

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
  // Global settings (sliders - immediate save)
  const [globalSettings, setGlobalSettings] = useState({
    dailyTokenLimit: 100000000,
    warningThreshold: 0.75,
    criticalThreshold: 0.9,
    allocationStrategy: 0.5,
  });

  // Auto management settings (toggles - immediate save)
  const [autoSettings, setAutoSettings] = useState({
    autoResumeEnabled: true,
    pauseOnWarning: false,
  });

  // Note: Claude API and App settings are now managed via config files
  // and environment variables for better security and deployment flexibility

  const [budgetData, setBudgetData] = useState<BudgetData>({
    globalDailyLimit: 100000000, // Match with globalSettings default
    projects: [],
    totalAllocated: 0,
  });

  const [loading, setLoading] = useState(true);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

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
        // Split settings into different categories
        setGlobalSettings({
          dailyTokenLimit: settings.dailyTokenLimit,
          warningThreshold: settings.warningThreshold,
          criticalThreshold: settings.criticalThreshold,
          allocationStrategy: settings.allocationStrategy,
        });

        setAutoSettings({
          autoResumeEnabled: settings.autoResumeEnabled,
          pauseOnWarning: settings.pauseOnWarning,
        });
      } else {
        setMessage({ type: 'error', text: '無法載入設定' });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage({ type: 'error', text: '無法載入設定' });
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
        console.error('無法載入預算資料：', data.error);
      }
    } catch (error) {
      console.error('Error fetching budget data:', error);
    }
  };

  // Handle global settings (sliders) - immediate save
  const handleGlobalSettingChange = async (key: string, value: any) => {
    setGlobalSettings(prev => ({
      ...prev,
      [key]: value,
    }));

    // Immediate save for sliders
    await saveGlobalSetting(key, value);
  };

  const handleThresholdChange = async (warning: number, critical: number) => {
    setGlobalSettings(prev => ({
      ...prev,
      warningThreshold: warning,
      criticalThreshold: critical,
    }));

    // Immediate save for thresholds
    await saveGlobalSettings({
      ...globalSettings,
      warningThreshold: warning,
      criticalThreshold: critical,
    });
  };

  // Handle auto management settings (toggles) - immediate save
  const handleAutoSettingChange = async (key: string, value: boolean) => {
    setAutoSettings(prev => ({
      ...prev,
      [key]: value,
    }));

    // Immediate save for toggles
    await saveGlobalSetting(key, value);
  };

  // Note: Claude and App settings are now managed via config files
  // and environment variables for better security and deployment flexibility

  // Save individual global setting (immediate)
  const saveGlobalSetting = async (key: string, value: any) => {
    try {
      const allSettings = {
        ...globalSettings,
        ...autoSettings,
        [key]: value,
      };

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(allSettings),
      });

      if (!response.ok) {
        console.error('Failed to save setting:', key);
      }
    } catch (error) {
      console.error('Error saving setting:', error);
    }
  };

  // Save all global settings (for thresholds)
  const saveGlobalSettings = async (updatedGlobalSettings: any) => {
    try {
      const allSettings = {
        ...updatedGlobalSettings,
        ...autoSettings,
      };

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(allSettings),
      });

      if (!response.ok) {
        console.error('Failed to save global settings');
      }
    } catch (error) {
      console.error('Error saving global settings:', error);
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
      } else {
        setMessage({ type: 'error', text: '更新預算分配失敗' });
      }
    } catch (error) {
      console.error('Error updating budget allocations:', error);
      setMessage({ type: 'error', text: '更新預算分配失敗' });
    } finally {
      setBudgetSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-primary-950 overflow-hidden">
        <Navbar />
        <div className="py-8 h-full overflow-y-auto">
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
    <div className="h-screen bg-primary-950 overflow-hidden">
      <Navbar />
      <div className="py-8 h-full overflow-y-auto">
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

          {message && (
            <div
              className={`mb-6 p-4 rounded-md ${
                message.type === 'success'
                  ? 'bg-green-900 border border-green-700 text-green-300'
                  : 'bg-red-900 border border-red-700 text-red-300'
              }`}
            >
              {message.text}
            </div>
          )}

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
                    disabled={false}
                  />
                </div>

                {/* Warning and Critical Thresholds */}
                <div className="mb-8">
                  <DualRangeSlider
                    minValue={globalSettings.warningThreshold}
                    maxValue={globalSettings.criticalThreshold}
                    onChange={handleThresholdChange}
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
                    disabled={false}
                    label="分配策略"
                    help="設定專案間的 Token 分配策略。較高的值會更積極地分配 Token 給活躍的專案。"
                    color="blue"
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

              {/* Configuration Info */}
              <div className="bg-primary-900 border border-primary-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-accent-50">
                    配置資訊
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-primary-800 rounded-md border border-primary-700">
                    <h4 className="text-md font-medium text-accent-100 mb-2">
                      Claude API 與應用程式配置
                    </h4>
                    <p className="text-sm text-primary-400 mb-3">
                      這些重要配置現在通過配置文件和環境變數管理，以提供更好的安全性和部署靈活性。
                    </p>
                    <div className="text-xs text-primary-500 space-y-1">
                      <p>• Claude Code 路徑和速率限制</p>
                      <p>• 應用程式 URL 和 WebSocket URL</p>
                      <p>• 資料庫連接配置</p>
                    </div>
                    <p className="text-xs text-yellow-400 mt-3">
                      如需修改這些配置，請編輯 config/app.config.ts
                      文件或設置相應的環境變數。
                    </p>
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
        </div>
      </div>
    </div>
  );
}
