'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { Progress } from '@/app/components/ui/progress';
import { 
  Settings, 
  User, 
  Shield, 
  Bell, 
  Palette, 
  Globe, 
  Database,
  Zap,
  Monitor,
  Save,
  RotateCcw,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  Key,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Edit3
} from 'lucide-react';

interface SettingValue {
  value: any;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiSelect' | 'json' | 'password';
  label: string;
  description?: string;
  options?: { value: string; label: string }[];
  category: string;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  sensitive?: boolean;
  readonly?: boolean;
  defaultValue?: any;
}

interface SettingsGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  settings: Record<string, SettingValue>;
}

interface SettingsManagerProps {
  projectId?: string;
  onSettingsChange?: (settings: Record<string, any>) => void;
}

const defaultSettings: Record<string, SettingsGroup> = {
  user: {
    id: 'user',
    label: '使用者設定',
    icon: <User className="h-5 w-5" />,
    description: '個人資料和偏好設定',
    settings: {
      displayName: {
        value: 'Claude User',
        type: 'string',
        label: '顯示名稱',
        description: '在系統中顯示的名稱',
        category: 'user',
        validation: { required: true, min: 2, max: 50 }
      },
      email: {
        value: 'claude@example.com',
        type: 'string',
        label: '電子郵件',
        description: '用於通知和登入',
        category: 'user',
        validation: { required: true, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' }
      },
      timezone: {
        value: 'Asia/Taipei',
        type: 'select',
        label: '時區',
        description: '用於顯示時間和日期',
        category: 'user',
        options: [
          { value: 'Asia/Taipei', label: '台北時間 (UTC+8)' },
          { value: 'America/New_York', label: '紐約時間 (UTC-5)' },
          { value: 'Europe/London', label: '倫敦時間 (UTC+0)' },
          { value: 'Asia/Tokyo', label: '東京時間 (UTC+9)' }
        ]
      },
      language: {
        value: 'zh-TW',
        type: 'select',
        label: '介面語言',
        description: '系統介面顯示語言',
        category: 'user',
        options: [
          { value: 'zh-TW', label: '繁體中文' },
          { value: 'zh-CN', label: '简体中文' },
          { value: 'en-US', label: 'English' },
          { value: 'ja-JP', label: '日本語' }
        ]
      }
    }
  },
  appearance: {
    id: 'appearance',
    label: '外觀設定',
    icon: <Palette className="h-5 w-5" />,
    description: '主題、色彩和視覺偏好',
    settings: {
      theme: {
        value: 'light',
        type: 'select',
        label: '主題模式',
        description: '選擇淺色或深色主題',
        category: 'appearance',
        options: [
          { value: 'light', label: '淺色主題' },
          { value: 'dark', label: '深色主題' },
          { value: 'auto', label: '跟隨系統' }
        ]
      },
      primaryColor: {
        value: 'blue',
        type: 'select',
        label: '主要顏色',
        description: '系統主要顏色方案',
        category: 'appearance',
        options: [
          { value: 'blue', label: '藍色' },
          { value: 'green', label: '綠色' },
          { value: 'purple', label: '紫色' },
          { value: 'orange', label: '橙色' }
        ]
      },
      fontSize: {
        value: 14,
        type: 'number',
        label: '字體大小',
        description: '介面字體大小 (px)',
        category: 'appearance',
        validation: { min: 12, max: 20 }
      },
      compactMode: {
        value: false,
        type: 'boolean',
        label: '緊湊模式',
        description: '使用更緊湊的介面佈局',
        category: 'appearance'
      },
      showAnimations: {
        value: true,
        type: 'boolean',
        label: '顯示動畫',
        description: '啟用介面動畫效果',
        category: 'appearance'
      }
    }
  },
  notifications: {
    id: 'notifications',
    label: '通知設定',
    icon: <Bell className="h-5 w-5" />,
    description: '通知偏好和頻率設定',
    settings: {
      enableNotifications: {
        value: true,
        type: 'boolean',
        label: '啟用通知',
        description: '接收系統通知',
        category: 'notifications'
      },
      emailNotifications: {
        value: true,
        type: 'boolean',
        label: '郵件通知',
        description: '透過郵件接收通知',
        category: 'notifications'
      },
      notificationTypes: {
        value: ['task_completed', 'task_assigned', 'mentions'],
        type: 'multiSelect',
        label: '通知類型',
        description: '選擇要接收的通知類型',
        category: 'notifications',
        options: [
          { value: 'task_completed', label: '任務完成' },
          { value: 'task_assigned', label: '任務指派' },
          { value: 'task_overdue', label: '任務逾期' },
          { value: 'mentions', label: '被提及' },
          { value: 'system_updates', label: '系統更新' }
        ]
      },
      quietHours: {
        value: { start: '22:00', end: '08:00' },
        type: 'json',
        label: '勿擾時段',
        description: '在此時段內不發送通知',
        category: 'notifications'
      }
    }
  },
  privacy: {
    id: 'privacy',
    label: '隱私與安全',
    icon: <Shield className="h-5 w-5" />,
    description: '隱私和安全相關設定',
    settings: {
      profileVisibility: {
        value: 'team',
        type: 'select',
        label: '個人資料可見性',
        description: '控制誰可以看到您的個人資料',
        category: 'privacy',
        options: [
          { value: 'public', label: '所有人' },
          { value: 'team', label: '團隊成員' },
          { value: 'private', label: '僅自己' }
        ]
      },
      activityTracking: {
        value: true,
        type: 'boolean',
        label: '活動追蹤',
        description: '允許系統追蹤活動以改善體驗',
        category: 'privacy'
      },
      dataRetention: {
        value: 365,
        type: 'number',
        label: '數據保留天數',
        description: '系統保留活動記錄的天數',
        category: 'privacy',
        validation: { min: 30, max: 1095 }
      },
      twoFactorAuth: {
        value: false,
        type: 'boolean',
        label: '兩步驟驗證',
        description: '啟用兩步驟驗證以增強安全性',
        category: 'privacy'
      },
      apiKeyAccess: {
        value: true,
        type: 'boolean',
        label: 'API 金鑰存取',
        description: '允許使用 API 金鑰存取系統',
        category: 'privacy'
      }
    }
  },
  system: {
    id: 'system',
    label: '系統設定',
    icon: <Monitor className="h-5 w-5" />,
    description: '系統級配置和偏好',
    settings: {
      autoSave: {
        value: true,
        type: 'boolean',
        label: '自動保存',
        description: '自動保存編輯中的內容',
        category: 'system'
      },
      autoSaveInterval: {
        value: 30,
        type: 'number',
        label: '自動保存間隔',
        description: '自動保存間隔時間（秒）',
        category: 'system',
        validation: { min: 10, max: 300 }
      },
      maxUndoLevels: {
        value: 50,
        type: 'number',
        label: '最大撤銷層數',
        description: '可撤銷操作的最大次數',
        category: 'system',
        validation: { min: 10, max: 100 }
      },
      enableDebugMode: {
        value: false,
        type: 'boolean',
        label: '除錯模式',
        description: '啟用除錯模式（開發者選項）',
        category: 'system'
      },
      logLevel: {
        value: 'info',
        type: 'select',
        label: '日誌等級',
        description: '系統日誌記錄等級',
        category: 'system',
        options: [
          { value: 'error', label: '錯誤' },
          { value: 'warn', label: '警告' },
          { value: 'info', label: '資訊' },
          { value: 'debug', label: '除錯' }
        ]
      }
    }
  }
};

export default function SettingsManager({ projectId, onSettingsChange }: SettingsManagerProps) {
  const [settings, setSettings] = useState<Record<string, SettingsGroup>>(defaultSettings);
  const [activeTab, setActiveTab] = useState('user');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSettings();
  }, [projectId]);

  const loadSettings = async () => {
    try {
      // 嘗試從 API 載入設定
      if (projectId) {
        const response = await fetch(`/api/projects/${projectId}/settings`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setSettings(result.data);
          }
        }
      } else {
        // 載入全域設定
        const response = await fetch('/api/settings');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setSettings(result.data);
          }
        }
      }
      
      // 從 localStorage 載入設定
      const stored = localStorage.getItem(projectId ? `project-settings-${projectId}` : 'global-settings');
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        mergeSettings(parsedSettings);
      }
    } catch (error) {
      console.warn('載入設定失敗，使用預設設定:', error);
    }
  };

  const mergeSettings = (newSettings: Record<string, any>) => {
    setSettings(prev => {
      const merged = { ...prev };
      
      Object.entries(newSettings).forEach(([groupId, groupSettings]) => {
        if (merged[groupId]) {
          Object.entries(groupSettings as Record<string, any>).forEach(([settingKey, settingValue]) => {
            if (merged[groupId].settings[settingKey]) {
              merged[groupId].settings[settingKey].value = settingValue;
            }
          });
        }
      });
      
      return merged;
    });
  };

  const updateSetting = (groupId: string, settingKey: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        settings: {
          ...prev[groupId].settings,
          [settingKey]: {
            ...prev[groupId].settings[settingKey],
            value
          }
        }
      }
    }));
    
    setUnsavedChanges(true);
    
    // 清除該設定的錯誤
    if (errors[`${groupId}.${settingKey}`]) {
      const newErrors = { ...errors };
      delete newErrors[`${groupId}.${settingKey}`];
      setErrors(newErrors);
    }
  };

  const validateSetting = (groupId: string, settingKey: string, value: any): string | null => {
    const setting = settings[groupId]?.settings[settingKey];
    if (!setting?.validation) return null;

    const { required, min, max, pattern } = setting.validation;

    if (required && (!value || value === '')) {
      return '此欄位為必填';
    }

    if (setting.type === 'string' && value) {
      if (min && value.length < min) {
        return `最少需要 ${min} 個字符`;
      }
      if (max && value.length > max) {
        return `最多允許 ${max} 個字符`;
      }
      if (pattern && !new RegExp(pattern).test(value)) {
        return '格式不正確';
      }
    }

    if (setting.type === 'number' && value !== null) {
      if (min !== undefined && value < min) {
        return `最小值為 ${min}`;
      }
      if (max !== undefined && value > max) {
        return `最大值為 ${max}`;
      }
    }

    return null;
  };

  const validateAllSettings = (): boolean => {
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    Object.entries(settings).forEach(([groupId, group]) => {
      Object.entries(group.settings).forEach(([settingKey, setting]) => {
        const error = validateSetting(groupId, settingKey, setting.value);
        if (error) {
          newErrors[`${groupId}.${settingKey}`] = error;
          hasErrors = true;
        }
      });
    });

    setErrors(newErrors);
    return !hasErrors;
  };

  const saveSettings = async () => {
    if (!validateAllSettings()) {
      return;
    }

    setSaving(true);

    try {
      // 準備保存的數據
      const settingsData: Record<string, Record<string, any>> = {};
      Object.entries(settings).forEach(([groupId, group]) => {
        settingsData[groupId] = {};
        Object.entries(group.settings).forEach(([settingKey, setting]) => {
          settingsData[groupId][settingKey] = setting.value;
        });
      });

      // 保存到 localStorage
      localStorage.setItem(
        projectId ? `project-settings-${projectId}` : 'global-settings',
        JSON.stringify(settingsData)
      );

      // 嘗試保存到 API
      try {
        const endpoint = projectId ? `/api/projects/${projectId}/settings` : '/api/settings';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsData)
        });
        
        if (!response.ok) {
          console.warn('API 保存失敗，已保存到本地');
        }
      } catch (apiError) {
        console.warn('API 不可用，已保存到本地:', apiError);
      }

      setUnsavedChanges(false);
      onSettingsChange?.(settingsData);
      
    } catch (error) {
      console.error('保存設定失敗:', error);
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    setUnsavedChanges(true);
    setErrors({});
  };

  const resetGroup = (groupId: string) => {
    if (defaultSettings[groupId]) {
      setSettings(prev => ({
        ...prev,
        [groupId]: { ...defaultSettings[groupId] }
      }));
      setUnsavedChanges(true);
    }
  };

  const exportSettings = () => {
    const settingsData: Record<string, Record<string, any>> = {};
    Object.entries(settings).forEach(([groupId, group]) => {
      settingsData[groupId] = {};
      Object.entries(group.settings).forEach(([settingKey, setting]) => {
        if (!setting.sensitive) { // 不導出敏感設定
          settingsData[groupId][settingKey] = setting.value;
        }
      });
    });

    const blob = new Blob([JSON.stringify(settingsData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settings-${projectId || 'global'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target?.result as string);
        mergeSettings(importedSettings);
        setUnsavedChanges(true);
      } catch (error) {
        console.error('導入設定失敗:', error);
      }
    };
    reader.readAsText(file);
    
    // 重置檔案輸入
    event.target.value = '';
  };

  const toggleSensitiveVisibility = (key: string) => {
    setShowSensitive(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const renderSettingInput = (groupId: string, settingKey: string, setting: SettingValue) => {
    const value = setting.value;
    const errorKey = `${groupId}.${settingKey}`;
    const hasError = !!errors[errorKey];
    const inputClassName = `w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
      hasError ? 'border-red-500' : 'border-gray-300'
    } ${setting.readonly ? 'bg-gray-100' : ''}`;

    switch (setting.type) {
      case 'string':
        return (
          <div>
            <input
              type="text"
              value={value || ''}
              onChange={(e) => updateSetting(groupId, settingKey, e.target.value)}
              className={inputClassName}
              readOnly={setting.readonly}
            />
            {hasError && <p className="text-red-500 text-sm mt-1">{errors[errorKey]}</p>}
          </div>
        );

      case 'password':
        return (
          <div>
            <div className="relative">
              <input
                type={showSensitive[`${groupId}.${settingKey}`] ? 'text' : 'password'}
                value={value || ''}
                onChange={(e) => updateSetting(groupId, settingKey, e.target.value)}
                className={inputClassName + ' pr-10'}
                readOnly={setting.readonly}
              />
              <button
                type="button"
                onClick={() => toggleSensitiveVisibility(`${groupId}.${settingKey}`)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                {showSensitive[`${groupId}.${settingKey}`] ? 
                  <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {hasError && <p className="text-red-500 text-sm mt-1">{errors[errorKey]}</p>}
          </div>
        );

      case 'number':
        return (
          <div>
            <input
              type="number"
              value={value || ''}
              onChange={(e) => updateSetting(groupId, settingKey, parseFloat(e.target.value) || 0)}
              min={setting.validation?.min}
              max={setting.validation?.max}
              className={inputClassName}
              readOnly={setting.readonly}
            />
            {hasError && <p className="text-red-500 text-sm mt-1">{errors[errorKey]}</p>}
          </div>
        );

      case 'boolean':
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => updateSetting(groupId, settingKey, e.target.checked)}
              className="mr-2"
              disabled={setting.readonly}
            />
            <span className={setting.readonly ? 'text-gray-500' : ''}>
              {value ? '啟用' : '停用'}
            </span>
          </div>
        );

      case 'select':
        return (
          <div>
            <Select
              value={value || ''}
              onValueChange={(newValue) => updateSetting(groupId, settingKey, newValue)}
              disabled={setting.readonly}
            >
              <SelectTrigger className={hasError ? 'border-red-500' : ''}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {setting.options?.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasError && <p className="text-red-500 text-sm mt-1">{errors[errorKey]}</p>}
          </div>
        );

      case 'multiSelect':
        return (
          <div>
            <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
              {setting.options?.map(option => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={(value || []).includes(option.value)}
                    onChange={(e) => {
                      const current = value || [];
                      const updated = e.target.checked
                        ? [...current, option.value]
                        : current.filter((v: string) => v !== option.value);
                      updateSetting(groupId, settingKey, updated);
                    }}
                    className="mr-2"
                    disabled={setting.readonly}
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
            {hasError && <p className="text-red-500 text-sm mt-1">{errors[errorKey]}</p>}
          </div>
        );

      case 'json':
        return (
          <div>
            <Textarea
              value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value || ''}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateSetting(groupId, settingKey, parsed);
                } catch (error) {
                  // 允許無效 JSON 暫時存在
                  updateSetting(groupId, settingKey, e.target.value);
                }
              }}
              className={`font-mono text-sm ${hasError ? 'border-red-500' : ''}`}
              rows={4}
              readOnly={setting.readonly}
            />
            {hasError && <p className="text-red-500 text-sm mt-1">{errors[errorKey]}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  // 過濾設定（如果有搜尋查詢）
  const filteredSettings = Object.entries(settings).reduce((acc, [groupId, group]) => {
    if (!searchQuery) {
      acc[groupId] = group;
    } else {
      const query = searchQuery.toLowerCase();
      const filteredGroupSettings: Record<string, SettingValue> = {};
      
      Object.entries(group.settings).forEach(([settingKey, setting]) => {
        if (
          setting.label.toLowerCase().includes(query) ||
          setting.description?.toLowerCase().includes(query) ||
          settingKey.toLowerCase().includes(query)
        ) {
          filteredGroupSettings[settingKey] = setting;
        }
      });
      
      if (Object.keys(filteredGroupSettings).length > 0) {
        acc[groupId] = {
          ...group,
          settings: filteredGroupSettings
        };
      }
    }
    
    return acc;
  }, {} as Record<string, SettingsGroup>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="h-6 w-6" />
            設定管理
          </h2>
          <p className="text-gray-600 mt-1">
            {projectId ? '專案設定' : '全域設定'}和偏好配置
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportSettings}
          >
            <Download className="h-4 w-4 mr-1" />
            導出
          </Button>
          
          <label className="cursor-pointer">
            <Button variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4 mr-1" />
                導入
              </span>
            </Button>
            <input
              type="file"
              accept=".json"
              onChange={importSettings}
              className="hidden"
            />
          </label>
          
          <Button
            variant="outline"
            onClick={resetSettings}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            重置
          </Button>
          
          <Button
            onClick={saveSettings}
            disabled={!unsavedChanges || saving}
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            保存
          </Button>
        </div>
      </div>

      {/* 搜尋列 */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Settings className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋設定項目..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </CardContent>
      </Card>

      {/* 未保存更改提示 */}
      {unsavedChanges && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <p className="text-orange-800">您有未保存的更改</p>
              <Button
                size="sm"
                onClick={saveSettings}
                disabled={saving}
                className="ml-auto"
              >
                立即保存
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-6">
        {/* 側邊導航 */}
        <div className="w-64 space-y-2">
          {Object.entries(filteredSettings).map(([groupId, group]) => (
            <Button
              key={groupId}
              variant={activeTab === groupId ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab(groupId)}
            >
              {group.icon}
              <span className="ml-2">{group.label}</span>
              {Object.keys(group.settings).length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {Object.keys(group.settings).length}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* 設定內容 */}
        <div className="flex-1">
          {Object.entries(filteredSettings).map(([groupId, group]) => (
            activeTab === groupId && (
              <Card key={groupId}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {group.icon}
                        {group.label}
                      </CardTitle>
                      <p className="text-gray-600 mt-1">{group.description}</p>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resetGroup(groupId)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      重置群組
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(group.settings).map(([settingKey, setting]) => (
                    <div key={settingKey} className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700">
                            {setting.label}
                            {setting.validation?.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                            {setting.sensitive && (
                              <Lock className="inline h-3 w-3 ml-1 text-gray-400" />
                            )}
                            {setting.readonly && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                唯讀
                              </Badge>
                            )}
                          </label>
                          
                          {setting.description && (
                            <p className="text-sm text-gray-500 mt-1">
                              {setting.description}
                            </p>
                          )}
                        </div>
                        
                        {setting.defaultValue !== undefined && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateSetting(groupId, settingKey, setting.defaultValue)}
                            className="text-xs"
                          >
                            預設值
                          </Button>
                        )}
                      </div>
                      
                      <div className="mt-2">
                        {renderSettingInput(groupId, settingKey, setting)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          ))}
          
          {Object.keys(filteredSettings).length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Settings className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  找不到符合的設定
                </h3>
                <p className="text-gray-600">
                  請嘗試調整搜尋關鍵字或選擇其他設定群組
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}