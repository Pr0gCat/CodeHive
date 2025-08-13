'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { useSocket } from '@/lib/hooks/useSocket';
import { 
  Activity, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Settings, 
  Play,
  Pause,
  BarChart3,
  Zap
} from 'lucide-react';

interface AgentCapability {
  id: string;
  name: string;
  description: string;
  taskTypes: string[];
  maxConcurrentTasks: number;
  avgExecutionTime: number;
  successRate: number;
  specializations: string[];
}

interface AgentInstance {
  id: string;
  capabilityId: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTaskId?: string;
  currentInstructionId?: string;
  startedAt?: Date;
  lastHeartbeat: Date;
  performance: {
    tasksCompleted: number;
    taskssFailed: number;
    avgExecutionTime: number;
    totalTokenUsage: number;
  };
}

interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: Date;
  estimatedCompletion: Date;
  priority: number;
  status: 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
}

interface CoordinationStats {
  totalAgents: number;
  activeAgents: number;
  totalAssignments: number;
  completedAssignments: number;
  failedAssignments: number;
  avgExecutionTime: number;
}

interface AgentMonitorProps {
  projectId?: string;
}

const statusColors = {
  idle: 'bg-green-100 text-green-800',
  busy: 'bg-blue-100 text-blue-800',
  error: 'bg-red-100 text-red-800',
  offline: 'bg-gray-100 text-gray-800'
};

const statusLabels = {
  idle: '空閒',
  busy: '忙碌',
  error: '錯誤',
  offline: '離線'
};

const taskTypeColors = {
  DEV: 'bg-purple-100 text-purple-800',
  TEST: 'bg-green-100 text-green-800',
  REVIEW: 'bg-blue-100 text-blue-800',
  DEPLOY: 'bg-orange-100 text-orange-800',
  DOCUMENT: 'bg-gray-100 text-gray-800'
};

export default function AgentMonitor({ projectId }: AgentMonitorProps) {
  const [stats, setStats] = useState<CoordinationStats | null>(null);
  const [capabilities, setCapabilities] = useState<AgentCapability[]>([]);
  const [agents, setAgents] = useState<AgentInstance[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coordinating, setCoordinating] = useState(false);

  // WebSocket 連接
  const { isConnected } = useSocket({
    onSystemNotification: (data) => {
      console.log('代理系統通知:', data);
      if (data.type === 'agent_status_change') {
        fetchAgentData();
      }
    }
  });

  useEffect(() => {
    fetchAgentData();
    
    // 設置定期更新
    const interval = setInterval(fetchAgentData, 30000); // 每30秒更新
    
    return () => clearInterval(interval);
  }, []);

  const fetchAgentData = async () => {
    try {
      setLoading(true);
      
      // 並行獲取所有數據
      const [
        statsResponse,
        capabilitiesResponse,
        agentsResponse,
        assignmentsResponse
      ] = await Promise.all([
        fetch('/api/agents/coordinator'),
        fetch('/api/agents/coordinator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            projectId: projectId || 'system',
            action: 'get_capabilities' 
          })
        }),
        fetch('/api/agents/coordinator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            projectId: projectId || 'system',
            action: 'get_agents' 
          })
        }),
        fetch('/api/agents/coordinator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            projectId: projectId || 'system',
            action: 'get_assignments' 
          })
        })
      ]);

      const [statsResult, capabilitiesResult, agentsResult, assignmentsResult] = await Promise.all([
        statsResponse.json(),
        capabilitiesResponse.json(),
        agentsResponse.json(),
        assignmentsResponse.json()
      ]);

      if (statsResult.success) {
        setStats(statsResult.data.stats);
      }
      
      if (capabilitiesResult.success) {
        setCapabilities(capabilitiesResult.data.capabilities);
      }
      
      if (agentsResult.success) {
        setAgents(agentsResult.data.agents);
      }
      
      if (assignmentsResult.success) {
        setAssignments(assignmentsResult.data.assignments);
      }

    } catch (err) {
      setError('載入代理數據失敗');
      console.error('Error fetching agent data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCoordinate = async (strategy: string = 'skill-matched') => {
    if (!projectId) {
      setError('需要專案 ID 才能執行協調');
      return;
    }

    try {
      setCoordinating(true);
      setError(null);

      const response = await fetch('/api/agents/coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          action: 'coordinate',
          strategy,
          options: {
            urgency: 'medium',
            maxParallelTasks: 10
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('協調結果:', result.data.result);
        // 重新載入數據以顯示新的分配
        await fetchAgentData();
      } else {
        setError(result.error || '協調失敗');
      }
    } catch (err) {
      setError('協調請求失敗');
      console.error('Error coordinating tasks:', err);
    } finally {
      setCoordinating(false);
    }
  };

  const registerAgent = async (capabilityId: string) => {
    try {
      const response = await fetch('/api/agents/coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId || 'system',
          action: 'register_agent',
          capabilityId
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('代理註冊成功:', result.data.agentId);
        await fetchAgentData();
      } else {
        setError(result.error || '代理註冊失敗');
      }
    } catch (err) {
      setError('代理註冊請求失敗');
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
            <h2 className="text-2xl font-bold text-gray-900">代理監控中心</h2>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
                 title={isConnected ? '即時連線中' : '離線'}></div>
          </div>
          <p className="text-gray-600 mt-1">
            監控和管理 AI 代理的狀態與任務分配
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => handleCoordinate('skill-matched')}
            disabled={!projectId || coordinating}
            className="flex items-center gap-2"
          >
            {coordinating ? (
              <>
                <Settings className="h-4 w-4 animate-spin" />
                協調中
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                開始協調
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={fetchAgentData}
            disabled={loading}
          >
            <Activity className="h-4 w-4 mr-1" />
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
                <Users className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">總代理數</p>
                  <p className="text-2xl font-bold">{stats.totalAgents}</p>
                  <p className="text-xs text-green-600">
                    {stats.activeAgents} 個活躍
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">任務分配</p>
                  <p className="text-2xl font-bold">{stats.totalAssignments}</p>
                  <p className="text-xs text-gray-600">
                    {stats.completedAssignments} 已完成
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">成功率</p>
                  <p className="text-2xl font-bold">
                    {stats.totalAssignments > 0 
                      ? Math.round((stats.completedAssignments / stats.totalAssignments) * 100)
                      : 0}%
                  </p>
                  <p className="text-xs text-red-600">
                    {stats.failedAssignments} 失敗
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">平均執行時間</p>
                  <p className="text-2xl font-bold">
                    {Math.round(stats.avgExecutionTime / 1000)}s
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agent Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle>可用代理能力</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {capabilities.map((capability) => (
              <div key={capability.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{capability.name}</h3>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => registerAgent(capability.id)}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    啟動
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mb-2">{capability.description}</p>
                
                <div className="flex flex-wrap gap-1 mb-2">
                  {capability.taskTypes.map((type) => (
                    <Badge key={type} className={taskTypeColors[type as keyof typeof taskTypeColors]}>
                      {type}
                    </Badge>
                  ))}
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>併發: {capability.maxConcurrentTasks}</div>
                  <div>成功率: {Math.round(capability.successRate * 100)}%</div>
                  <div>平均時間: {Math.round(capability.avgExecutionTime / 1000)}s</div>
                  <div>技能: {capability.specializations.slice(0, 2).join(', ')}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Agents */}
      <Card>
        <CardHeader>
          <CardTitle>活躍代理實例</CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-gray-500 text-center py-4">目前沒有活躍的代理實例</p>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => {
                const capability = capabilities.find(c => c.id === agent.capabilityId);
                const successRate = agent.performance.tasksCompleted > 0
                  ? (agent.performance.tasksCompleted / (agent.performance.tasksCompleted + agent.performance.taskssFailed)) * 100
                  : 0;
                
                return (
                  <div key={agent.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          agent.status === 'idle' ? 'bg-green-500' :
                          agent.status === 'busy' ? 'bg-blue-500' :
                          agent.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                        }`}></div>
                        <div>
                          <p className="font-medium">{agent.id}</p>
                          <p className="text-sm text-gray-600">{capability?.name}</p>
                        </div>
                      </div>
                      
                      <Badge className={statusColors[agent.status]}>
                        {statusLabels[agent.status]}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-medium">{agent.performance.tasksCompleted}</p>
                        <p className="text-gray-600">已完成</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{Math.round(successRate)}%</p>
                        <p className="text-gray-600">成功率</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium">{Math.round(agent.performance.avgExecutionTime / 1000)}s</p>
                        <p className="text-gray-600">平均時間</p>
                      </div>
                      {agent.currentTaskId && (
                        <div className="text-center">
                          <p className="font-medium text-blue-600">執行中</p>
                          <p className="text-gray-600 text-xs">{agent.currentTaskId.slice(-8)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>最近任務分配</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-gray-500 text-center py-4">目前沒有任務分配</p>
          ) : (
            <div className="space-y-2">
              {assignments.slice(-10).reverse().map((assignment) => {
                const agent = agents.find(a => a.id === assignment.agentId);
                return (
                  <div key={`${assignment.taskId}-${assignment.agentId}`} 
                       className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        {assignment.taskId.slice(-8)}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        → {agent?.id || assignment.agentId}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={
                        assignment.status === 'completed' ? 'bg-green-100 text-green-800' :
                        assignment.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        assignment.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {assignment.status}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(assignment.assignedAt).toLocaleTimeString('zh-TW')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}