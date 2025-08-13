'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { Textarea } from '@/app/components/ui/textarea';
import { Input } from '@/app/components/ui/input';
import { 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  PlayCircle,
  Settings,
  Target,
  ListChecks
} from 'lucide-react';
import { Task, Instruction, ModelStatus, Priority } from '@/lib/models/types';

interface TaskWithInstructions extends Task {
  instructions?: Instruction[];
}

interface TaskTrackingProps {
  storyId: string;
  onCreateTask?: () => void;
  onTaskClick?: (task: Task) => void;
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

const StatusIcon = ({ status }: { status: ModelStatus }) => {
  switch (status) {
    case ModelStatus.COMPLETED:
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case ModelStatus.IN_PROGRESS:
      return <Clock className="h-4 w-4 text-blue-600" />;
    case ModelStatus.FAILED:
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Target className="h-4 w-4 text-gray-600" />;
  }
};

export default function TaskTracking({ storyId, onCreateTask, onTaskClick }: TaskTrackingProps) {
  const [tasks, setTasks] = useState<TaskWithInstructions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    acceptanceCriteria: '',
    estimatedHours: 1,
    priority: Priority.MEDIUM
  });

  useEffect(() => {
    fetchTasks();
  }, [storyId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hierarchy/tasks?storyId=${storyId}&includeRelations=true`);
      const result = await response.json();

      if (result.success) {
        setTasks(result.data);
      } else {
        setError(result.error || '載入任務失敗');
      }
    } catch (err) {
      setError('網路錯誤');
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;

    try {
      const response = await fetch('/api/hierarchy/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId,
          ...newTask
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setTasks([...tasks, result.data]);
        setNewTask({
          title: '',
          description: '',
          acceptanceCriteria: '',
          estimatedHours: 1,
          priority: Priority.MEDIUM
        });
        setShowCreateForm(false);
      } else {
        setError(result.error || '創建任務失敗');
      }
    } catch (err) {
      setError('網路錯誤');
    }
  };

  const generateInstructions = async (taskId: string) => {
    try {
      const response = await fetch('/api/hierarchy/agent/coordinate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: storyId, // 需要從 story 取得 projectId
          action: 'generate_instructions',
          data: { taskId }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // 重新載入任務以更新指令列表
        await fetchTasks();
      } else {
        setError(result.error || '生成指令失敗');
      }
    } catch (err) {
      setError('網路錯誤');
    }
  };

  const calculateTaskProgress = (task: TaskWithInstructions): number => {
    if (!task.instructions || task.instructions.length === 0) return 0;
    const completedInstructions = task.instructions.filter(
      i => i.status === ModelStatus.COMPLETED
    ).length;
    return Math.round((completedInstructions / task.instructions.length) * 100);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold">任務追蹤</h3>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-2 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">任務追蹤</h3>
          <p className="text-sm text-gray-600 mt-1">
            監控故事中各項任務的執行進度和狀態
          </p>
        </div>
        <div className="flex gap-2">
          {onCreateTask && (
            <Button onClick={onCreateTask} variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-1" />
              生成任務
            </Button>
          )}
          <Button 
            onClick={() => setShowCreateForm(!showCreateForm)} 
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            手動新增
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
            <Button onClick={() => setError(null)} variant="outline" size="sm" className="mt-2">
              關閉
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Task Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>新增任務</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                任務標題 *
              </label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="輸入任務標題..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                任務描述
              </label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="詳細描述任務內容..."
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                接受標準
              </label>
              <Textarea
                value={newTask.acceptanceCriteria}
                onChange={(e) => setNewTask({ ...newTask, acceptanceCriteria: e.target.value })}
                placeholder="- 完成條件1&#10;- 完成條件2"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  預估時數
                </label>
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={newTask.estimatedHours}
                  onChange={(e) => setNewTask({ ...newTask, estimatedHours: parseFloat(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  優先級
                </label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: parseInt(e.target.value) as Priority })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={Priority.LOW}>低</option>
                  <option value={Priority.MEDIUM}>中</option>
                  <option value={Priority.HIGH}>高</option>
                  <option value={Priority.CRITICAL}>重要</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreateTask}>
                創建任務
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">還沒有任務</h4>
            <p className="text-gray-600 mb-4">
              創建任務來細分故事的具體執行步驟
            </p>
            <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              創建第一個任務
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const progress = calculateTaskProgress(task);
            return (
              <Card 
                key={task.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onTaskClick?.(task)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3 flex-1">
                      <StatusIcon status={task.status} />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold truncate">
                          {task.title}
                        </CardTitle>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 ml-2">
                      <Badge className={priorityColors[task.priority]}>
                        {priorityLabels[task.priority]}
                      </Badge>
                      <Badge className={statusColors[task.status]}>
                        {statusLabels[task.status]}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* Task Progress */}
                  {task.instructions && task.instructions.length > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">執行進度</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}

                  {/* Acceptance Criteria */}
                  {task.acceptanceCriteria && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-700 mb-1">完成標準：</p>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {task.acceptanceCriteria}
                      </p>
                    </div>
                  )}

                  {/* Task Stats */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 text-sm">
                      {task.estimatedHours && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">{task.estimatedHours}h</span>
                        </div>
                      )}
                      {task.instructions && (
                        <div className="flex items-center gap-1">
                          <ListChecks className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">
                            {task.instructions.filter(i => i.status === ModelStatus.COMPLETED).length}/{task.instructions.length} 指令
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {(!task.instructions || task.instructions.length === 0) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateInstructions(task.id);
                          }}
                          className="text-xs"
                        >
                          <PlayCircle className="h-3 w-3 mr-1" />
                          生成指令
                        </Button>
                      )}
                      <div className="text-xs text-gray-500">
                        {new Date(task.createdAt).toLocaleDateString('zh-TW')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}