'use client';

import { useState, useEffect } from 'react';
import { 
  Database,
  Users,
  Shield,
  Zap,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  Server,
  Activity,
  Clock,
  HardDrive
} from 'lucide-react';

interface SystemSettings {
  global: {
    dailyTokenLimit: number;
    warningThreshold: number;
    criticalThreshold: number;
    allocationStrategy: number;
    autoResumeEnabled: boolean;
    pauseOnWarning: boolean;
    claudeCodePath: string;
    rateLimitPerMinute: number;
  };
  agents: {
    maxConcurrentTasks: number;
    timeoutDuration: number;
    retryAttempts: number;
    healthCheckInterval: number;
  };
  database: {
    size: string;
    backupSchedule: string;
    lastBackup: string;
    autoCleanup: boolean;
    retentionDays: number;
  };
  system: {
    uptime: string;
    memoryUsage: number;
    diskUsage: number;
    activeConnections: number;
    version: string;
  };
}

interface MaintenanceTask {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  lastRun: string;
  nextRun: string;
  duration: string;
}

export function SystemManagement() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'maintenance' | 'monitoring'>('maintenance');

  useEffect(() => {
    fetchSystemData();
  }, []);

  const fetchSystemData = async () => {
    try {
      const [settingsRes, tasksRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/admin/maintenance-tasks')
      ]);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings({
          global: settingsData.data,
          agents: {
            maxConcurrentTasks: 5,
            timeoutDuration: 1800000,
            retryAttempts: 3,
            healthCheckInterval: 30000
          },
          database: {
            size: '150MB',
            backupSchedule: 'daily',
            lastBackup: new Date().toISOString(),
            autoCleanup: true,
            retentionDays: 90
          },
          system: {
            uptime: '7d 12h 30m',
            memoryUsage: 67,
            diskUsage: 23,
            activeConnections: 42,
            version: '1.0.0'
          }
        });
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setMaintenanceTasks(tasksData.data || [
          {
            id: '1',
            name: '任務恢復',
            description: '恢復中斷的任務和循環',
            status: 'completed',
            lastRun: new Date(Date.now() - 86400000).toISOString(),
            nextRun: new Date(Date.now() + 86400000).toISOString(),
            duration: '2m 15s'
          },
          {
            id: '2',
            name: '資料庫清理',
            description: '清理過期的日誌和臨時資料',
            status: 'pending',
            lastRun: new Date(Date.now() - 172800000).toISOString(),
            nextRun: new Date(Date.now() + 3600000).toISOString(),
            duration: '5m 30s'
          },
          {
            id: '3',
            name: '效能優化',
            description: '分析和優化系統效能',
            status: 'completed',
            lastRun: new Date(Date.now() - 259200000).toISOString(),
            nextRun: new Date(Date.now() + 604800000).toISOString(),
            duration: '15m 45s'
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching system data:', error);
    } finally {
      setLoading(false);
    }
  };


  const runMaintenanceTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/admin/maintenance-tasks/${taskId}/run`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchSystemData();
      }
    } catch (error) {
      console.error('Error running maintenance task:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'running':
        return 'text-blue-400';
      case 'failed':
        return 'text-red-400';
      case 'pending':
      default:
        return 'text-yellow-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4" />;
      case 'pending':
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-primary-900 rounded-lg border border-primary-700">
        <div className="flex">
          {[
            { key: 'maintenance', label: '系統維護', icon: Server },
            { key: 'monitoring', label: '系統監控', icon: Activity }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'text-accent-50 border-accent-500 bg-primary-800'
                  : 'text-primary-300 border-transparent hover:text-accent-50 hover:bg-primary-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>


      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          {/* Maintenance Tasks */}
          <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
            <h3 className="text-lg font-semibold text-accent-50 mb-4">維護任務</h3>
            <div className="space-y-4">
              {maintenanceTasks.map((task) => (
                <div key={task.id} className="bg-primary-800 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={getStatusColor(task.status)}>
                        {getStatusIcon(task.status)}
                      </span>
                      <div>
                        <h4 className="font-medium text-accent-50">{task.name}</h4>
                        <p className="text-sm text-primary-300">{task.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-primary-400">
                          <span>上次執行: {new Date(task.lastRun).toLocaleString()}</span>
                          <span>下次執行: {new Date(task.nextRun).toLocaleString()}</span>
                          <span>耗時: {task.duration}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => runMaintenanceTask(task.id)}
                      disabled={task.status === 'running'}
                      className="px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700 disabled:bg-primary-700 disabled:cursor-not-allowed text-sm"
                    >
                      立即執行
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Database Management */}
          <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
            <h3 className="text-lg font-semibold text-accent-50 mb-4">資料庫管理</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-primary-300">資料庫大小</span>
                  <span className="text-accent-50">{settings?.database.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-300">上次備份</span>
                  <span className="text-accent-50">
                    {new Date(settings?.database.lastBackup || '').toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-300">自動清理</span>
                  <span className="text-accent-50">
                    {settings?.database.autoCleanup ? '啟用' : '停用'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-300">保留天數</span>
                  <span className="text-accent-50">{settings?.database.retentionDays} 天</span>
                </div>
              </div>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700">
                  <Download className="h-4 w-4" />
                  立即備份
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-700 text-primary-300 rounded hover:bg-primary-600">
                  <Upload className="h-4 w-4" />
                  恢復備份
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-red-50 rounded hover:bg-red-700">
                  <Trash2 className="h-4 w-4" />
                  清理舊資料
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Monitoring Tab */}
      {activeTab === 'monitoring' && settings && (
        <div className="space-y-6">
          {/* System Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-primary-300">運行時間</h3>
                  <p className="text-2xl font-bold text-accent-50">{settings.system.uptime}</p>
                </div>
                <Clock className="h-8 w-8 text-accent-400" />
              </div>
            </div>

            <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-primary-300">記憶體使用</h3>
                  <p className="text-2xl font-bold text-accent-50">{settings.system.memoryUsage}%</p>
                </div>
                <Activity className="h-8 w-8 text-accent-400" />
              </div>
              <div className="mt-2 w-full bg-primary-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    settings.system.memoryUsage >= 90 ? 'bg-red-500' :
                    settings.system.memoryUsage >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${settings.system.memoryUsage}%` }}
                />
              </div>
            </div>

            <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-primary-300">磁碟使用</h3>
                  <p className="text-2xl font-bold text-accent-50">{settings.system.diskUsage}%</p>
                </div>
                <HardDrive className="h-8 w-8 text-accent-400" />
              </div>
              <div className="mt-2 w-full bg-primary-700 rounded-full h-2">
                <div
                  className="bg-accent-500 h-2 rounded-full"
                  style={{ width: `${settings.system.diskUsage}%` }}
                />
              </div>
            </div>

            <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-primary-300">活躍連接</h3>
                  <p className="text-2xl font-bold text-accent-50">{settings.system.activeConnections}</p>
                </div>
                <Users className="h-8 w-8 text-accent-400" />
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
            <h3 className="text-lg font-semibold text-accent-50 mb-4">系統資訊</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-primary-300">版本</span>
                  <span className="text-accent-50">{settings.system.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-300">Node.js</span>
                  <span className="text-accent-50">{process.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-300">平台</span>
                  <span className="text-accent-50">{typeof window !== 'undefined' ? 'Browser' : 'Server'}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-primary-300">啟動時間</span>
                  <span className="text-accent-50">{new Date().toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-300">環境</span>
                  <span className="text-accent-50">Production</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-300">時區</span>
                  <span className="text-accent-50">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}