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
    criticalThreshold: 0.90,
    allocationStrategy: 0.5,
  });

  // Auto management settings (toggles - immediate save)
  const [autoSettings, setAutoSettings] = useState({
    autoResumeEnabled: true,
    pauseOnWarning: false,
  });

  // Claude API settings (text fields - manual save)
  const [claudeSettings, setClaudeSettings] = useState({
    claudeCodePath: 'claude',
    rateLimitPerMinute: 50,
  });

  // App settings (text fields - manual save)
  const [appSettings, setAppSettings] = useState({
    appUrl: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000',
    databaseUrl: 'file:./prisma/codehive.db',
  });
  
  const [budgetData, setBudgetData] = useState<BudgetData>({
    globalDailyLimit: 100000000, // Match with globalSettings default
    projects: [],
    totalAllocated: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Combined saving state and change tracking
  const [combinedSaving, setCombinedSaving] = useState(false);
  const [claudeHasChanges, setClaudeHasChanges] = useState(false);
  const [appHasChanges, setAppHasChanges] = useState(false);

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
        
        setClaudeSettings({
          claudeCodePath: settings.claudeCodePath,
          rateLimitPerMinute: settings.rateLimitPerMinute,
        });
        
        setAppSettings({
          appUrl: settings.appUrl,
          wsUrl: settings.wsUrl,
          databaseUrl: settings.databaseUrl,
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

  // Handle Claude settings (text) - manual save
  const handleClaudeSettingChange = (key: string, value: any) => {
    setClaudeSettings(prev => ({
      ...prev,
      [key]: value,
    }));
    setClaudeHasChanges(true);
    setMessage(null);
  };

  // Handle app settings (text) - manual save
  const handleAppSettingChange = (key: string, value: any) => {
    setAppSettings(prev => ({
      ...prev,
      [key]: value,
    }));
    setAppHasChanges(true);
    setMessage(null);
  };

  // Save individual global setting (immediate)
  const saveGlobalSetting = async (key: string, value: any) => {
    try {
      const allSettings = {
        ...globalSettings,
        ...autoSettings,
        ...claudeSettings,
        ...appSettings,
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
        ...claudeSettings,
        ...appSettings,
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


  // Save combined API and app settings
  const handleSaveCombinedSettings = async () => {
    setCombinedSaving(true);
    setMessage(null);

    try {
      const allSettings = {
        ...globalSettings,
        ...autoSettings,
        ...claudeSettings,
        ...appSettings,
      };

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(allSettings),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: '配置設定已儲存！' });
        setClaudeHasChanges(false);
        setAppHasChanges(false);
      } else {
        setMessage({ type: 'error', text: '儲存配置設定失敗' });
      }
    } catch (error) {
      console.error('Error saving combined settings:', error);
      setMessage({ type: 'error', text: '儲存配置設定失敗' });
    } finally {
      setCombinedSaving(false);
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

          {message && (
            <div className={`mb-6 p-4 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-900 border border-green-700 text-green-300'
                : 'bg-red-900 border border-red-700 text-red-300'
            }`}>
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Global Settings */}
            <div className="space-y-6">
              {/* Token Limits */}
              <div className="bg-primary-900 border border-primary-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-accent-50 mb-6">全域限制設定</h2>
                
                {/* Daily Token Limit */}
                <div className="mb-8">
                  <TokenLimitSlider
                    value={globalSettings.dailyTokenLimit}
                    onChange={(value) => handleGlobalSettingChange('dailyTokenLimit', value)}
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
                    onChange={(value) => handleGlobalSettingChange('allocationStrategy', value)}
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

            {/* Auto Management & API Configuration */}
            <div className="space-y-6">
              {/* Auto Management Settings */}
              <div className="bg-primary-900 border border-primary-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-accent-50">自動管理</h3>
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
                        onChange={(e) => handleAutoSettingChange('autoResumeEnabled', e.target.checked)}
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
                        onChange={(e) => handleAutoSettingChange('pauseOnWarning', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-primary-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* API 與應用程式配置 */}
              <div className="bg-primary-900 border border-primary-800 rounded-lg shadow p-6 h-fit">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-accent-50">API 與應用程式配置</h3>
              </div>
              
              {/* Claude API Settings Section */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-accent-100 mb-4 border-b border-primary-700 pb-2">
                  Claude API 配置
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-300 mb-2">
                      Claude Code 路徑
                    </label>
                    <input
                      type="text"
                      value={claudeSettings.claudeCodePath}
                      onChange={(e) => handleClaudeSettingChange('claudeCodePath', e.target.value)}
                      disabled={combinedSaving}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 rounded-md text-accent-50 placeholder-primary-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                      placeholder="claude"
                    />
                    <p className="text-xs text-primary-500 mt-1">
                      Claude Code 命令的路徑（例如：claude 或 /usr/local/bin/claude）
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-300 mb-2">
                      每分鐘請求限制
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={claudeSettings.rateLimitPerMinute}
                      onChange={(e) => handleClaudeSettingChange('rateLimitPerMinute', parseInt(e.target.value))}
                      disabled={combinedSaving}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 rounded-md text-accent-50 placeholder-primary-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                    />
                    <p className="text-xs text-primary-500 mt-1">
                      控制對 Claude API 的請求頻率
                    </p>
                  </div>
                </div>
              </div>

              {/* Application Settings Section */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-accent-100 mb-4 border-b border-primary-700 pb-2">
                  應用程式配置
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-300 mb-2">
                      應用程式 URL
                    </label>
                    <input
                      type="url"
                      value={appSettings.appUrl}
                      onChange={(e) => handleAppSettingChange('appUrl', e.target.value)}
                      disabled={combinedSaving}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 rounded-md text-accent-50 placeholder-primary-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                      placeholder="http://localhost:3000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-300 mb-2">
                      WebSocket URL
                    </label>
                    <input
                      type="text"
                      value={appSettings.wsUrl}
                      onChange={(e) => handleAppSettingChange('wsUrl', e.target.value)}
                      disabled={combinedSaving}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 rounded-md text-accent-50 placeholder-primary-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                      placeholder="ws://localhost:3000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-300 mb-2">
                      資料庫 URL
                    </label>
                    <input
                      type="text"
                      value={appSettings.databaseUrl}
                      onChange={(e) => handleAppSettingChange('databaseUrl', e.target.value)}
                      disabled={combinedSaving}
                      className="w-full px-3 py-2 bg-primary-800 border border-primary-700 rounded-md text-accent-50 placeholder-primary-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                      placeholder="file:./prisma/codehive.db"
                    />
                    <p className="text-xs text-primary-500 mt-1">
                      重新啟動應用程式後生效
                    </p>
                  </div>
                </div>
              </div>

              {/* Single Save Button */}
              <div className="pt-4 border-t border-primary-700">
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveCombinedSettings}
                    disabled={combinedSaving || (!claudeHasChanges && !appHasChanges)}
                    className="px-4 py-2 bg-accent-600 text-accent-50 rounded-md hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {combinedSaving ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-50 mr-2"></div>
                        儲存中...
                      </div>
                    ) : (
                      '儲存配置設定'
                    )}
                  </button>
                </div>
                
                {(claudeHasChanges || appHasChanges) && (
                  <p className="text-xs text-yellow-400 mt-2 text-right">
                    有未儲存的變更
                  </p>
                )}
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