'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/lib/hooks/useSocket';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { Input } from '@/app/components/ui/input';
import { 
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  Code,
  Zap,
  FileText,
  Plus,
  Eye
} from 'lucide-react';
import { Instruction, ModelStatus, Priority } from '@/lib/models/types';

interface InstructionExecutionProps {
  taskId: string;
  onCreateInstruction?: () => void;
  onInstructionExecute?: (instruction: Instruction) => void;
}

const statusColors = {
  [ModelStatus.PENDING]: 'bg-gray-100 text-gray-800',
  [ModelStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
  [ModelStatus.COMPLETED]: 'bg-green-100 text-green-800',
  [ModelStatus.FAILED]: 'bg-red-100 text-red-800'
};

const statusLabels = {
  [ModelStatus.PENDING]: '待執行',
  [ModelStatus.IN_PROGRESS]: '執行中',
  [ModelStatus.COMPLETED]: '已完成',
  [ModelStatus.FAILED]: '執行失敗'
};

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

const StatusIcon = ({ status }: { status: ModelStatus }) => {
  switch (status) {
    case ModelStatus.COMPLETED:
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case ModelStatus.IN_PROGRESS:
      return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
    case ModelStatus.FAILED:
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Terminal className="h-4 w-4 text-gray-600" />;
  }
};

export default function InstructionExecution({ 
  taskId, 
  onCreateInstruction, 
  onInstructionExecute 
}: InstructionExecutionProps) {
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<Record<string, boolean>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const [newInstruction, setNewInstruction] = useState({
    content: '',
    context: '',
    priority: Priority.MEDIUM,
    expectedOutput: ''
  });

  // 用於自動滾動到最新執行的指令
  const executingRef = useRef<Record<string, HTMLDivElement | null>>({});

  // WebSocket 事件處理器
  const handleInstructionExecuting = useCallback((data: any) => {
    setExecuting(prev => ({ ...prev, [data.instructionId]: true }));
    
    // 自動滾動到執行中的指令
    if (executingRef.current[data.instructionId]) {
      executingRef.current[data.instructionId]?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, []);

  const handleInstructionCompleted = useCallback((data: any) => {
    setExecuting(prev => ({ ...prev, [data.instructionId]: false }));
    
    // 更新指令狀態
    setInstructions(prev => prev.map(inst => 
      inst.id === data.instructionId 
        ? { ...inst, status: ModelStatus.COMPLETED, output: data.result?.output }
        : inst
    ));
    
    onInstructionExecute?.(data);
  }, [onInstructionExecute]);

  const handleInstructionFailed = useCallback((data: any) => {
    setExecuting(prev => ({ ...prev, [data.instructionId]: false }));
    
    // 更新指令狀態
    setInstructions(prev => prev.map(inst => 
      inst.id === data.instructionId 
        ? { ...inst, status: ModelStatus.FAILED, error: data.error }
        : inst
    ));
  }, []);

  const handleInstructionUpdated = useCallback((data: any) => {
    setInstructions(prev => prev.map(inst => 
      inst.id === data.instructionId 
        ? { ...inst, ...data.instruction }
        : inst
    ));
  }, []);

  // 設置 WebSocket 連接
  const { isConnected, executeInstruction } = useSocket({
    onInstructionExecuting: handleInstructionExecuting,
    onInstructionCompleted: handleInstructionCompleted,
    onInstructionFailed: handleInstructionFailed,
    onInstructionUpdated: handleInstructionUpdated
  });

  useEffect(() => {
    fetchInstructions();
  }, [taskId]);

  const fetchInstructions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hierarchy/instructions?taskId=${taskId}`);
      const result = await response.json();

      if (result.success) {
        setInstructions(result.data);
      } else {
        setError(result.error || '載入指令失敗');
      }
    } catch (err) {
      setError('網路錯誤');
      console.error('Error fetching instructions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstruction = async () => {
    if (!newInstruction.content.trim()) return;

    try {
      const response = await fetch('/api/hierarchy/instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          ...newInstruction
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setInstructions([...instructions, result.data]);
        setNewInstruction({
          content: '',
          context: '',
          priority: Priority.MEDIUM,
          expectedOutput: ''
        });
        setShowCreateForm(false);
      } else {
        setError(result.error || '創建指令失敗');
      }
    } catch (err) {
      setError('網路錯誤');
    }
  };

  const handleExecuteInstruction = (instructionId: string) => {
    if (!isConnected) {
      setError('WebSocket 連接中斷，無法執行指令');
      return;
    }
    
    // 使用 WebSocket 執行指令
    executeInstruction(instructionId);
  };

  const toggleDetails = (instructionId: string) => {
    setShowDetails(prev => ({
      ...prev,
      [instructionId]: !prev[instructionId]
    }));
  };

  const formatOutput = (output: string | null, maxLength: number = 200): string => {
    if (!output) return '無輸出';
    if (output.length <= maxLength) return output;
    return output.substring(0, maxLength) + '...';
  };

  const formatExecutionTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold">指令執行</h3>
        </div>
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
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
          <h3 className="text-xl font-semibold text-gray-900">指令執行</h3>
          <p className="text-sm text-gray-600 mt-1">
            即時執行和監控 AI 指令的執行過程
          </p>
        </div>
        <div className="flex gap-2">
          {onCreateInstruction && (
            <Button onClick={onCreateInstruction} variant="outline" size="sm">
              <Zap className="h-4 w-4 mr-1" />
              生成指令
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

      {/* Create Instruction Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>新增指令</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                指令內容 *
              </label>
              <Textarea
                value={newInstruction.content}
                onChange={(e) => setNewInstruction({ ...newInstruction, content: e.target.value })}
                placeholder="輸入要執行的指令內容..."
                rows={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                執行上下文
              </label>
              <Textarea
                value={newInstruction.context}
                onChange={(e) => setNewInstruction({ ...newInstruction, context: e.target.value })}
                placeholder="提供執行環境和相關背景資訊..."
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                預期輸出
              </label>
              <Input
                value={newInstruction.expectedOutput}
                onChange={(e) => setNewInstruction({ ...newInstruction, expectedOutput: e.target.value })}
                placeholder="描述預期的執行結果..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                優先級
              </label>
              <select
                value={newInstruction.priority}
                onChange={(e) => setNewInstruction({ ...newInstruction, priority: parseInt(e.target.value) as Priority })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={Priority.LOW}>低</option>
                <option value={Priority.MEDIUM}>中</option>
                <option value={Priority.HIGH}>高</option>
                <option value={Priority.CRITICAL}>重要</option>
              </select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreateInstruction}>
                創建指令
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions List */}
      {instructions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Terminal className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">還沒有指令</h4>
            <p className="text-gray-600 mb-4">
              創建 AI 執行指令來自動化任務處理
            </p>
            <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              創建第一個指令
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {instructions.map((instruction) => (
            <Card 
              key={instruction.id}
              ref={(el) => { executingRef.current[instruction.id] = el; }}
              className={`transition-all duration-300 ${
                instruction.status === ModelStatus.IN_PROGRESS 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : ''
              }`}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3 flex-1">
                    <StatusIcon status={instruction.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Code className="h-4 w-4 text-gray-500" />
                        <CardTitle className="text-sm font-medium text-gray-800">
                          指令 #{instruction.orderIndex || ''}
                        </CardTitle>
                      </div>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap line-clamp-3">
                        {instruction.content}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    <Badge className={priorityColors[instruction.priority]}>
                      {priorityLabels[instruction.priority]}
                    </Badge>
                    <Badge className={statusColors[instruction.status]}>
                      {statusLabels[instruction.status]}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {/* Context */}
                {instruction.context && (
                  <div className="mb-3 p-3 bg-gray-50 rounded-md">
                    <p className="text-xs font-medium text-gray-700 mb-1">執行上下文：</p>
                    <p className="text-xs text-gray-600">
                      {instruction.context}
                    </p>
                  </div>
                )}

                {/* Expected Output */}
                {instruction.expectedOutput && (
                  <div className="mb-3 p-3 bg-blue-50 rounded-md">
                    <p className="text-xs font-medium text-blue-700 mb-1">預期輸出：</p>
                    <p className="text-xs text-blue-600">
                      {instruction.expectedOutput}
                    </p>
                  </div>
                )}

                {/* Execution Results */}
                {instruction.status !== ModelStatus.PENDING && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-3 w-3 text-gray-500" />
                      <p className="text-xs font-medium text-gray-700">執行結果：</p>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => toggleDetails(instruction.id)}
                        className="text-xs h-6 px-2"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {showDetails[instruction.id] ? '收起' : '詳細'}
                      </Button>
                    </div>
                    
                    <div className={`p-3 rounded-md text-xs font-mono ${
                      instruction.status === ModelStatus.COMPLETED 
                        ? 'bg-green-50 border border-green-200'
                        : instruction.status === ModelStatus.FAILED
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-gray-50 border border-gray-200'
                    }`}>
                      {showDetails[instruction.id] ? (
                        <pre className="whitespace-pre-wrap text-xs">
                          {instruction.output || instruction.error || '執行中...'}
                        </pre>
                      ) : (
                        <p className="text-xs">
                          {formatOutput(instruction.output || instruction.error || '執行中...')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons and Stats */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    {instruction.executionTime && instruction.executionTime > 0 && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatExecutionTime(instruction.executionTime)}</span>
                      </div>
                    )}
                    {instruction.tokenUsage && instruction.tokenUsage > 0 && (
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        <span>{instruction.tokenUsage.toLocaleString()} tokens</span>
                      </div>
                    )}
                    {instruction.executedBy && (
                      <div className="flex items-center gap-1">
                        <Terminal className="h-3 w-3" />
                        <span>by {instruction.executedBy}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {instruction.status === ModelStatus.PENDING && (
                      <Button
                        size="sm"
                        onClick={() => handleExecuteInstruction(instruction.id)}
                        disabled={executing[instruction.id] || !isConnected}
                        className="text-xs"
                      >
                        {executing[instruction.id] ? (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            執行中
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3 mr-1" />
                            {isConnected ? '執行' : '離線'}
                          </>
                        )}
                      </Button>
                    )}
                    {instruction.status === ModelStatus.FAILED && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExecuteInstruction(instruction.id)}
                        disabled={executing[instruction.id] || !isConnected}
                        className="text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        {isConnected ? '重試' : '離線'}
                      </Button>
                    )}
                    <div className="text-xs text-gray-500">
                      {new Date(instruction.createdAt).toLocaleString('zh-TW')}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}