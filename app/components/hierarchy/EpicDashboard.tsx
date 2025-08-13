'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/lib/hooks/useSocket';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import { Button } from '@/app/components/ui/button';
import { Plus, BarChart3, Users, Clock, Target } from 'lucide-react';
import { Epic, Story, ModelStatus, Priority } from '@/lib/models/types';

interface EpicWithStats extends Epic {
  statistics?: {
    totalStories: number;
    completedStories: number;
    totalTasks: number;
    completedTasks: number;
    progress: number;
    totalTokenUsage: number;
  };
  stories?: Story[];
}

interface EpicDashboardProps {
  projectId: string;
  onCreateEpic?: () => void;
  onEpicClick?: (epic: Epic) => void;
}

const priorityColors = {
  [Priority.LOW]: 'bg-gray-100 text-gray-800',
  [Priority.MEDIUM]: 'bg-blue-100 text-blue-800', 
  [Priority.HIGH]: 'bg-yellow-100 text-yellow-800',
  [Priority.CRITICAL]: 'bg-red-100 text-red-800'
};

const priorityLabels = {
  [Priority.LOW]: '低',
  [Priority.MEDIUM]: '中',
  [Priority.HIGH]: '高',
  [Priority.CRITICAL]: '重要'
};

const statusColors = {
  [ModelStatus.PENDING]: 'bg-gray-100 text-gray-800',
  [ModelStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
  [ModelStatus.COMPLETED]: 'bg-green-100 text-green-800',
  [ModelStatus.FAILED]: 'bg-red-100 text-red-800'
};

const statusLabels = {
  [ModelStatus.PENDING]: '待開始',
  [ModelStatus.IN_PROGRESS]: '進行中',
  [ModelStatus.COMPLETED]: '已完成',
  [ModelStatus.FAILED]: '失敗'
};

export default function EpicDashboard({ projectId, onCreateEpic, onEpicClick }: EpicDashboardProps) {
  const [epics, setEpics] = useState<EpicWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<any>(null);

  // 處理即時更新的回調函數
  const handleProjectStatistics = useCallback((data: any) => {
    if (data.projectId === projectId) {
      setStatistics(data.stats);
    }
  }, [projectId]);

  const handleEpicUpdated = useCallback((data: any) => {
    setEpics(prev => prev.map(epic => 
      epic.id === data.epicId 
        ? { ...epic, ...data.epic }
        : epic
    ));
  }, []);

  // 設置 WebSocket 連接
  const { isConnected, joinProject, leaveProject } = useSocket({
    onProjectStatistics: handleProjectStatistics,
    onEpicUpdated: handleEpicUpdated,
    onSystemNotification: (data) => {
      console.log('系統通知:', data);
      // 可以在這裡顯示通知
    }
  });

  useEffect(() => {
    if (isConnected && projectId) {
      joinProject(projectId);
    }
    
    return () => {
      if (projectId) {
        leaveProject(projectId);
      }
    };
  }, [isConnected, projectId, joinProject, leaveProject]);

  useEffect(() => {
    fetchEpics();
  }, [projectId]);

  const fetchEpics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hierarchy/epics?projectId=${projectId}&includeRelations=true`);
      const result = await response.json();

      if (result.success) {
        setEpics(result.data);
      } else {
        setError(result.error || '載入史詩失敗');
      }
    } catch (err) {
      setError('網路錯誤');
      console.error('Error fetching epics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">專案史詩</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={fetchEpics} variant="outline">
          重新載入
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-900">專案史詩</h2>
            {/* 連接狀態指示器 */}
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
                 title={isConnected ? '即時連線中' : '離線'}></div>
          </div>
          <p className="text-gray-600 mt-1">
            管理專案的主要功能史詩和開發階段
            {isConnected && <span className="text-green-600 text-xs ml-2">• 即時更新</span>}
          </p>
        </div>
        {onCreateEpic && (
          <Button onClick={onCreateEpic} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            新增史詩
          </Button>
        )}
      </div>

      {/* Summary Stats */}
      {epics.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">總史詩</p>
                  <p className="text-2xl font-bold">{epics.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">已完成</p>
                  <p className="text-2xl font-bold">
                    {epics.filter(e => e.status === ModelStatus.COMPLETED).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">進行中</p>
                  <p className="text-2xl font-bold">
                    {epics.filter(e => e.status === ModelStatus.IN_PROGRESS).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">總故事</p>
                  <p className="text-2xl font-bold">
                    {epics.reduce((sum, e) => sum + (e.statistics?.totalStories || 0), 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Epic Cards */}
      {epics.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">還沒有史詩</h3>
            <p className="text-gray-600 mb-4">
              創建第一個史詩來開始管理專案的主要功能
            </p>
            {onCreateEpic && (
              <Button onClick={onCreateEpic} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                創建史詩
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {epics.map((epic) => (
            <Card 
              key={epic.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => onEpicClick?.(epic)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-semibold truncate flex-1 mr-2">
                    {epic.title}
                  </CardTitle>
                  <div className="flex gap-1 flex-shrink-0">
                    <Badge className={priorityColors[epic.priority]}>
                      {priorityLabels[epic.priority]}
                    </Badge>
                    <Badge className={statusColors[epic.status]}>
                      {statusLabels[epic.status]}
                    </Badge>
                  </div>
                </div>
                {epic.phase && (
                  <Badge variant="outline" className="w-fit">
                    {epic.phase}
                  </Badge>
                )}
              </CardHeader>
              
              <CardContent>
                {epic.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {epic.description}
                  </p>
                )}

                {epic.statistics && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>進度</span>
                        <span>{epic.statistics.progress}%</span>
                      </div>
                      <Progress value={epic.statistics.progress} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">故事</p>
                        <p className="font-medium">
                          {epic.statistics.completedStories}/{epic.statistics.totalStories}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">任務</p>
                        <p className="font-medium">
                          {epic.statistics.completedTasks}/{epic.statistics.totalTasks}
                        </p>
                      </div>
                    </div>

                    {epic.statistics.totalTokenUsage > 0 && (
                      <div className="text-sm">
                        <p className="text-gray-500">Token 使用量</p>
                        <p className="font-medium">{epic.statistics.totalTokenUsage.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs text-gray-500 mt-4">
                  建立時間：{new Date(epic.createdAt).toLocaleDateString('zh-TW')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}