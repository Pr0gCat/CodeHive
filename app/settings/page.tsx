'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import BudgetAllocationSlider from '../components/ui/BudgetAllocationSlider';
import DualRangeSlider from '../components/ui/DualRangeSlider';
import PercentageSlider from '../components/ui/PercentageSlider';
import TokenLimitSlider from '../components/ui/TokenLimitSlider';

interface GlobalSettings {
  dailyTokenLimit: number;
  warningThreshold: number;
  criticalThreshold: number;
  allocationStrategy: number;
  autoResumeEnabled: boolean;
  pauseOnWarning: boolean;
}

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
  const [settings, setSettings] = useState<GlobalSettings>({
    dailyTokenLimit: 10000000,
    warningThreshold: 0.75,
    criticalThreshold: 0.90,
    allocationStrategy: 0.5,
    autoResumeEnabled: true,
    pauseOnWarning: false,
  });
  
  const [budgetData, setBudgetData] = useState<BudgetData>({
    globalDailyLimit: 10000000,
    projects: [],
    totalAllocated: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchBudgetData();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data);
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

  const handleSettingChange = (key: keyof GlobalSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
    setHasUnsavedChanges(true);
    setMessage(null);
  };

  const handleThresholdChange = (warning: number, critical: number) => {
    setSettings(prev => ({
      ...prev,
      warningThreshold: warning,
      criticalThreshold: critical,
    }));
    setHasUnsavedChanges(true);
    setMessage(null);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: '設定已儲存！' });
        setHasUnsavedChanges(false);
        // Refresh budget data as it might have changed
        await fetchBudgetData();
      } else {
        setMessage({ type: 'error', text: '儲存設定失敗' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: '儲存設定失敗' });
    } finally {
      setSaving(false);
    }
  };

  const handleBudgetAllocationChange = async (allocations: Array<{ projectId: string; allocatedPercentage: number }>) => {
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

  const resetToDefaults = () => {
    setSettings({
      dailyTokenLimit: 10000000,
      warningThreshold: 0.75,
      criticalThreshold: 0.90,
      allocationStrategy: 0.5,
      autoResumeEnabled: true,
      pauseOnWarning: false,
    });
    setHasUnsavedChanges(true);
    setMessage(null);
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
                <h1 className="text-3xl font-bold text-accent-50">Token 限制設定</h1>
                <p className="text-primary-300 mt-2">
                  管理全域 Token 限制、預警閾值和專案預算分配
                </p>
              </div>
              <Link
                href="/"
                className="px-4 py-2 bg-primary-800 text-primary-200 rounded-md hover:bg-primary-700 border border-primary-700"
              >
                返回主頁
              </Link>
            </div>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-900 border border-green-700 text-green-300'
                : 'bg-red-900 border border-red-700 text-red-300'
            }`}>
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Global Settings */}
            <div className="space-y-6">
              <div className="bg-primary-900 border border-primary-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-accent-50 mb-6">全域限制設定</h2>
                
                {/* Daily Token Limit */}
                <div className="mb-8">
                  <TokenLimitSlider
                    value={settings.dailyTokenLimit}
                    onChange={(value) => handleSettingChange('dailyTokenLimit', value)}
                    disabled={saving}
                  />
                </div>

                {/* Warning and Critical Thresholds */}
                <div className="mb-8">
                  <DualRangeSlider
                    minValue={settings.warningThreshold}
                    maxValue={settings.criticalThreshold}
                    onChange={handleThresholdChange}
                    min={0.1}
                    max={0.99}
                    step={0.01}
                    disabled={saving}
                    label="預警閾值設定"
                    help="設定觸發警告和危險狀態的使用百分比。系統會在達到警告閾值時發出提醒，達到危險閾值時考慮暫停。"
                  />
                </div>

                {/* Allocation Strategy */}
                <div className="mb-8">
                  <PercentageSlider
                    value={settings.allocationStrategy}
                    onChange={(value) => handleSettingChange('allocationStrategy', value)}
                    disabled={saving}
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

                {/* Auto Management Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-accent-50">自動管理</h3>
                  
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
                        checked={settings.autoResumeEnabled}
                        onChange={(e) => handleSettingChange('autoResumeEnabled', e.target.checked)}
                        disabled={saving}
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
                        checked={settings.pauseOnWarning}
                        onChange={(e) => handleSettingChange('pauseOnWarning', e.target.checked)}
                        disabled={saving}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-primary-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-600"></div>
                    </label>
                  </div>
                </div>

                {/* Save Button */}
                <div className="mt-8 pt-6 border-t border-primary-700">
                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={resetToDefaults}
                      disabled={saving}
                      className="px-4 py-2 text-primary-200 bg-primary-800 border border-primary-700 rounded-md hover:bg-primary-700 hover:text-accent-50 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50"
                    >
                      重設為預設值
                    </button>
                    <button
                      onClick={handleSaveSettings}
                      disabled={saving || !hasUnsavedChanges}
                      className="px-6 py-2 bg-accent-600 text-accent-50 rounded-md hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-50 mr-2"></div>
                          儲存中...
                        </div>
                      ) : (
                        '儲存設定'
                      )}
                    </button>
                  </div>
                  {hasUnsavedChanges && (
                    <p className="text-xs text-yellow-400 mt-2 text-right">
                      有未儲存的變更
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Budget Allocation */}
            <div>
              <div className="bg-primary-900 border border-primary-800 rounded-lg shadow p-6">
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
      </div>
    </div>
  );
}