'use client';

import { useState, useEffect } from 'react';
import {
  Code,
  Clock,
  CheckCircle,
  Play,
  Pause,
  RotateCcw,
  Star,
} from 'lucide-react';

interface TDDCycle {
  id: string;
  title: string;
  goal: string;
  phase: 'RED' | 'GREEN' | 'REFACTOR' | 'REVIEW' | 'COMPLETED';
  status: 'PENDING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED';
  taskTitle: string;
  storyTitle: string;
  startedAt?: string;
  completedAt?: string;
  tokensUsed: number;
}

interface DevelopmentTabProps {
  projectId: string;
}

export function DevelopmentTab({ projectId }: DevelopmentTabProps) {
  const [cycles, setCycles] = useState<TDDCycle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for now
    setTimeout(() => {
      setCycles([]);
      setLoading(false);
    }, 1000);
  }, [projectId]);

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'RED':
        return 'bg-red-100 text-red-800';
      case 'GREEN':
        return 'bg-green-100 text-green-800';
      case 'REFACTOR':
        return 'bg-blue-100 text-blue-800';
      case 'REVIEW':
        return 'bg-purple-100 text-purple-800';
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'RED':
        return <div className="w-3 h-3 rounded-full bg-red-500" />;
      case 'GREEN':
        return <div className="w-3 h-3 rounded-full bg-green-500" />;
      case 'REFACTOR':
        return <RotateCcw className="h-4 w-4" />;
      case 'REVIEW':
        return <Star className="h-4 w-4" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return <Play className="h-4 w-4 text-green-600" />;
      case 'PAUSED':
        return <Pause className="h-4 w-4 text-yellow-600" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-500"></div>
      </div>
    );
  }

  if (cycles.length === 0) {
    return (
      <div className="text-center py-12">
        <Code className="h-12 w-12 text-primary-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-accent-50 mb-2">
          無開發活動
        </h3>
        <p className="text-primary-300 mb-4">
          開發開始時，TDD 循環將顯示在此處。
        </p>
        <div className="bg-primary-900 rounded-lg border border-primary-700 p-6 max-w-md mx-auto">
          <h4 className="font-medium text-accent-50 mb-3">TDD 循環階段</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-primary-300">RED: 編寫失敗測試</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-primary-300">GREEN: 實現程式碼</span>
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="h-3 w-3 text-blue-400" />
              <span className="text-primary-300">REFACTOR: 改進程式碼</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-3 w-3 text-purple-400" />
              <span className="text-primary-300">REVIEW: 程式碼審查</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Development Overview */}
      <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
        <h3 className="text-lg font-semibold text-accent-50 mb-4">開發概覽</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-primary-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-primary-300">
              {cycles.filter(c => c.status === 'PENDING').length}
            </div>
            <div className="text-sm text-primary-400">待處理</div>
          </div>
          <div className="bg-blue-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-300">
              {cycles.filter(c => c.status === 'IN_PROGRESS').length}
            </div>
            <div className="text-sm text-blue-400">進行中</div>
          </div>
          <div className="bg-yellow-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-300">
              {cycles.filter(c => c.status === 'PAUSED').length}
            </div>
            <div className="text-sm text-yellow-400">已暫停</div>
          </div>
          <div className="bg-green-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-300">
              {cycles.filter(c => c.status === 'COMPLETED').length}
            </div>
            <div className="text-sm text-green-400">已完成</div>
          </div>
        </div>
      </div>

      {/* Live TDD Cycles */}
      <div className="bg-primary-900 rounded-lg border border-primary-700 p-6">
        <h3 className="text-lg font-semibold text-accent-50 mb-4">
          即時 TDD 循環
        </h3>
        <div className="space-y-4">
          {cycles.map(cycle => (
            <div
              key={cycle.id}
              className="border border-primary-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h4 className="font-medium text-accent-50">{cycle.title}</h4>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPhaseColor(cycle.phase)}`}
                  >
                    {getPhaseIcon(cycle.phase)}
                    <span className="ml-1">{cycle.phase}</span>
                  </span>
                  {getStatusIcon(cycle.status)}
                </div>
                <div className="text-sm text-primary-400">
                  {cycle.tokensUsed} tokens 已使用
                </div>
              </div>

              <p className="text-primary-300 text-sm mb-2">{cycle.goal}</p>

              <div className="flex items-center gap-4 text-xs text-primary-400">
                <span>Story: {cycle.storyTitle}</span>
                <span>任務: {cycle.taskTitle}</span>
                {cycle.startedAt && (
                  <span>
                    開始時間: {new Date(cycle.startedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
