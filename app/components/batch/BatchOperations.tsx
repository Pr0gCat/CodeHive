'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { Textarea } from '@/app/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useSocket } from '@/lib/hooks/useSocket';
import { 
  Play,
  Pause,
  Square,
  RefreshCw,
  Plus,
  Settings,
  FileText,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Zap
} from 'lucide-react';

interface BatchOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'execute' | 'workflow';
  targetType: 'epic' | 'story' | 'task' | 'instruction';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  errors: Array<{
    itemId: string;
    error: string;
    timestamp: Date;
  }>;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  metadata: Record<string, any>;
  createdBy: string;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  triggers: Array<{
    type: string;
    conditions: Record<string, any>;
  }>;
  steps: Array<{
    id: string;
    type: string;
    config: Record<string, any>;
    dependsOn?: string[];
  }>;
  isActive: boolean;
}

interface BatchStats {
  totalOperations: number;
  runningOperations: number;
  completedOperations: number;
  failedOperations: number;
  totalItemsProcessed: number;
  successRate: number;
}

interface BatchOperationsProps {
  projectId?: string;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800'
};

const statusLabels = {
  pending: '待處理',
  running: '執行中',
  completed: '已完成',
  failed: '失敗',
  cancelled: '已取消'
};

const typeLabels = {
  create: '創建',
  update: '更新',
  delete: '刪除',
  execute: '執行',
  workflow: '工作流程'
};

const targetTypeLabels = {
  epic: '史詩',
  story: '故事',
  task: '任務',
  instruction: '指令'
};

export default function BatchOperations({ projectId }: BatchOperationsProps) {
  const [operations, setOperations] = useState<BatchOperation[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新建操作表單狀態
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOperation, setNewOperation] = useState({
    type: 'create' as BatchOperation['type'],
    targetType: 'epic' as BatchOperation['targetType'],
    items: '',
    options: {
      continueOnError: true,
      maxConcurrency: 5,
      delay: 100,
      validateFirst: false
    }
  });

  // WebSocket 連接
  const { isConnected } = useSocket({
    onSystemNotification: (data) => {
      if (data.message?.includes('批量操作')) {
        fetchBatchData();
      }
    }
  });

  useEffect(() => {
    fetchBatchData();
    
    // 設置定期更新
    const interval = setInterval(fetchBatchData, 10000); // 每10秒更新
    
    return () => clearInterval(interval);
  }, []);

  const fetchBatchData = async () => {
    try {
      setLoading(true);
      
      // 並行獲取所有數據
      const [
        operationsResponse,
        workflowsResponse,
        statsResponse
      ] = await Promise.all([
        fetch('/api/batch/operations?action=list_operations'),
        fetch('/api/batch/operations?action=list_workflows'),
        fetch('/api/batch/operations?action=get_stats')
      ]);

      const [operationsResult, workflowsResult, statsResult] = await Promise.all([
        operationsResponse.json(),
        workflowsResponse.json(),
        statsResponse.json()
      ]);

      if (operationsResult.success) {
        setOperations(operationsResult.data.operations);
      }
      
      if (workflowsResult.success) {
        setWorkflows(workflowsResult.data.workflows);
      }
      
      if (statsResult.success) {
        setStats(statsResult.data.stats);
      }

    } catch (err) {
      setError('載入批量操作數據失敗');
      console.error('Error fetching batch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const createBatchOperation = async () => {
    try {
      setError(null);

      let items;
      try {
        items = JSON.parse(newOperation.items);
      } catch {
        setError('項目數據格式錯誤，請輸入有效的 JSON 格式');
        return;
      }

      const response = await fetch('/api/batch/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_batch',
          type: newOperation.type,
          targetType: newOperation.targetType,
          items,
          options: newOperation.options,
          metadata: {
            projectId,
            source: 'ui'
          },
          createdBy: 'system'
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('批量操作創建成功:', result.data.operationId);
        setShowCreateForm(false);
        setNewOperation({
          type: 'create',
          targetType: 'epic',
          items: '',
          options: {
            continueOnError: true,
            maxConcurrency: 5,
            delay: 100,
            validateFirst: false
          }
        });
        await fetchBatchData();
      } else {
        setError(result.error || '創建批量操作失敗');
      }
    } catch (err) {
      setError('批量操作請求失敗');
      console.error('Error creating batch operation:', err);
    }
  };

  const cancelOperation = async (operationId: string) => {
    try {
      const response = await fetch('/api/batch/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_operation',
          operationId
        })
      });

      const result = await response.json();

      if (result.success) {
        await fetchBatchData();
      } else {
        setError(result.error || '取消操作失敗');
      }
    } catch (err) {
      setError('取消操作請求失敗');
      console.error('Error cancelling operation:', err);
    }
  };

  const executeWorkflow = async (workflowId: string) => {
    try {
      const response = await fetch('/api/batch/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute_workflow',
          workflowId,
          context: { projectId }
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('工作流程執行開始:', result.data.executionId);
        await fetchBatchData();
      } else {
        setError(result.error || '執行工作流程失敗');
      }
    } catch (err) {
      setError('工作流程執行請求失敗');
      console.error('Error executing workflow:', err);
    }
  };

  if (loading && !stats) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
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
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-900">批量操作中心</h2>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
                 title={isConnected ? '即時連線中' : '離線'}></div>
          </div>
          <p className="text-gray-600 mt-1">
            管理批量處理操作和自動化工作流程
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            新建操作
          </Button>
          <Button
            variant="outline"
            onClick={fetchBatchData}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            重新整理
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

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">總操作數</p>
                  <p className="text-2xl font-bold">{stats.totalOperations}</p>
                  <p className="text-xs text-blue-600">
                    {stats.runningOperations} 執行中
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">完成操作</p>
                  <p className="text-2xl font-bold">{stats.completedOperations}</p>
                  <p className="text-xs text-gray-600">
                    {stats.failedOperations} 失敗
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">處理項目</p>
                  <p className="text-2xl font-bold">{stats.totalItemsProcessed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">成功率</p>
                  <p className="text-2xl font-bold">
                    {Math.round(stats.successRate * 100)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Operation Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>創建批量操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">操作類型</label>
                <Select 
                  value={newOperation.type} 
                  onValueChange={(value) => setNewOperation(prev => ({ ...prev, type: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create">創建</SelectItem>
                    <SelectItem value="update">更新</SelectItem>
                    <SelectItem value="delete">刪除</SelectItem>
                    <SelectItem value="execute">執行</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">目標類型</label>
                <Select 
                  value={newOperation.targetType} 
                  onValueChange={(value) => setNewOperation(prev => ({ ...prev, targetType: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="epic">史詩</SelectItem>
                    <SelectItem value="story">故事</SelectItem>
                    <SelectItem value="task">任務</SelectItem>
                    <SelectItem value="instruction">指令</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">項目數據 (JSON 格式)</label>
              <Textarea
                value={newOperation.items}
                onChange={(e) => setNewOperation(prev => ({ ...prev, items: e.target.value }))}
                placeholder="[{&quot;title&quot;: &quot;項目1&quot;, &quot;projectId&quot;: &quot;123&quot;}, {&quot;title&quot;: &quot;項目2&quot;, &quot;projectId&quot;: &quot;123&quot;}]"
                rows={6}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                取消
              </Button>
              <Button onClick={createBatchOperation}>
                創建操作
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Operations */}
      <Card>
        <CardHeader>
          <CardTitle>進行中的操作</CardTitle>
        </CardHeader>
        <CardContent>
          {operations.filter(op => op.status === 'running').length === 0 ? (
            <p className="text-gray-500 text-center py-4">目前沒有執行中的操作</p>
          ) : (
            <div className="space-y-4">
              {operations.filter(op => op.status === 'running').map((operation) => (
                <div key={operation.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={statusColors[operation.status]}>
                          {statusLabels[operation.status]}
                        </Badge>
                        <span className="font-medium">
                          {typeLabels[operation.type]} {targetTypeLabels[operation.targetType]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {operation.processedItems} / {operation.totalItems} 項目已處理
                      </p>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelOperation(operation.id)}
                    >
                      <Square className="h-3 w-3 mr-1" />
                      取消
                    </Button>
                  </div>

                  <div className="mb-2">
                    <Progress value={operation.progress} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{operation.progress}%</span>
                      <span>
                        成功: {operation.successfulItems} / 失敗: {operation.failedItems}
                      </span>
                    </div>
                  </div>

                  {operation.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-sm text-red-600 cursor-pointer">
                        {operation.errors.length} 個錯誤
                      </summary>
                      <div className="mt-2 space-y-1">
                        {operation.errors.slice(-3).map((error, index) => (
                          <div key={index} className="text-xs text-red-500 bg-red-50 p-2 rounded">
                            <strong>{error.itemId}:</strong> {error.error}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Workflows */}
      <Card>
        <CardHeader>
          <CardTitle>可用工作流程</CardTitle>
        </CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <p className="text-gray-500 text-center py-4">沒有可用的工作流程</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {workflows.filter(wf => wf.isActive).map((workflow) => (
                <div key={workflow.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{workflow.name}</h3>
                    <Button 
                      size="sm" 
                      onClick={() => executeWorkflow(workflow.id)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      執行
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{workflow.description}</p>
                  
                  <div className="text-xs text-gray-500">
                    <div>觸發器: {workflow.triggers.length}</div>
                    <div>步驟: {workflow.steps.length}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Operations */}
      <Card>
        <CardHeader>
          <CardTitle>最近操作</CardTitle>
        </CardHeader>
        <CardContent>
          {operations.length === 0 ? (
            <p className="text-gray-500 text-center py-4">沒有操作記錄</p>
          ) : (
            <div className="space-y-2">
              {operations.slice(-10).reverse().map((operation) => (
                <div key={operation.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <Badge className={statusColors[operation.status]}>
                      {statusLabels[operation.status]}
                    </Badge>
                    <span className="text-sm">
                      {typeLabels[operation.type]} {targetTypeLabels[operation.targetType]}
                    </span>
                    <span className="text-xs text-gray-500">
                      {operation.totalItems} 項目
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    {operation.startedAt && new Date(operation.startedAt).toLocaleString('zh-TW')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}