'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Target, Calendar, AlertCircle, TrendingUp, Clock } from 'lucide-react';

interface ActiveSprint {
  id: string;
  name: string;
  status: string;
  health: string;
  metrics: {
    totalStoryPoints: number;
    completedStoryPoints: number;
    timeElapsedPercentage: number;
    workCompletedPercentage: number;
    daysRemaining: number;
  };
  _count: {
    stories: number;
  };
}

interface ActiveSprintWidgetProps {
  projectId: string;
}

export function ActiveSprintWidget({ projectId }: ActiveSprintWidgetProps) {
  const [activeSprint, setActiveSprint] = useState<ActiveSprint | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveSprint();
    // Refresh every minute
    const interval = setInterval(fetchActiveSprint, 60000);
    return () => clearInterval(interval);
  }, [projectId]);

  const fetchActiveSprint = async () => {
    try {
      // First try to get active sprint
      const activeResponse = await fetch(`/api/sprints/active?projectId=${projectId}`);
      const activeData = await activeResponse.json();
      
      if (activeData.active) {
        setActiveSprint(activeData.sprint);
      } else {
        // If no active sprint, try to get planning sprints
        const planningResponse = await fetch(`/api/sprints?projectId=${projectId}&status=PLANNING`);
        const planningData = await planningResponse.json();
        
        if (planningData.length > 0) {
          // Show the first planning sprint
          setActiveSprint({
            ...planningData[0],
            metrics: {
              totalStoryPoints: planningData[0].plannedStoryPoints || 0,
              completedStoryPoints: 0,
              timeElapsedPercentage: 0,
              workCompletedPercentage: 0,
              daysRemaining: Math.ceil((new Date(planningData[0].endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            },
            _count: {
              stories: planningData[0].stories?.length || 0
            }
          });
        } else {
          setActiveSprint(null);
        }
      }
    } catch (error) {
      console.error('Error fetching sprint:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-primary-700 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-primary-600 rounded w-1/2 mb-3"></div>
        <div className="h-20 bg-primary-600 rounded"></div>
      </div>
    );
  }

  if (!activeSprint) {
    return (
      <div className="bg-primary-700 rounded-lg p-4">
        <p className="text-sm text-primary-300 mb-3">沒有進行中的 Sprint</p>
        <Link
          href={`/projects/${projectId}/sprints/new`}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-accent-50 bg-accent-600 rounded hover:bg-accent-700"
        >
          創建新 Sprint
        </Link>
      </div>
    );
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'ON_TRACK':
        return 'text-green-400';
      case 'AT_RISK':
        return 'text-yellow-400';
      case 'OFF_TRACK':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'ON_TRACK':
        return <TrendingUp className="h-4 w-4" />;
      case 'AT_RISK':
      case 'OFF_TRACK':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-primary-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-accent-50">
          {activeSprint.status === 'ACTIVE' ? '進行中的 Sprint' : '待開始的 Sprint'}
        </h3>
        {activeSprint.status === 'ACTIVE' && (
          <div className={`flex items-center gap-1 ${getHealthColor(activeSprint.health)}`}>
            {getHealthIcon(activeSprint.health)}
            <span className="text-xs font-medium">
              {activeSprint.health === 'ON_TRACK' ? '正常' :
               activeSprint.health === 'AT_RISK' ? '有風險' : '落後'}
            </span>
          </div>
        )}
        {activeSprint.status === 'PLANNING' && (
          <div className="flex items-center gap-1 text-yellow-400">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">規劃中</span>
          </div>
        )}
      </div>

      <Link
        href={`/projects/${projectId}/sprints/${activeSprint.id}`}
        className="block hover:bg-primary-650 rounded-lg transition-colors"
      >
        <h4 className="font-medium text-accent-50 mb-2">{activeSprint.name}</h4>

        {/* Progress Bars */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-primary-400">
                {activeSprint.status === 'PLANNING' ? '規劃故事點' : '工作進度'}
              </span>
              <span className="text-primary-300">
                {activeSprint.status === 'PLANNING' 
                  ? `${activeSprint.metrics.totalStoryPoints} 點已規劃`
                  : `${activeSprint.metrics.completedStoryPoints}/${activeSprint.metrics.totalStoryPoints} 點`
                }
              </span>
            </div>
            <div className="w-full bg-primary-600 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  activeSprint.status === 'PLANNING' ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                style={{ 
                  width: activeSprint.status === 'PLANNING' 
                    ? '100%' 
                    : `${activeSprint.metrics.workCompletedPercentage}%` 
                }}
              />
            </div>
          </div>

          {activeSprint.status === 'ACTIVE' && (
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-primary-400">時間進度</span>
                <span className="text-primary-300">
                  剩餘 {activeSprint.metrics.daysRemaining} 天
                </span>
              </div>
              <div className="w-full bg-primary-600 rounded-full h-2">
                <div
                  className="bg-gray-400 h-2 rounded-full transition-all"
                  style={{ width: `${activeSprint.metrics.timeElapsedPercentage}%` }}
                />
              </div>
            </div>
          )}
          
          {activeSprint.status === 'PLANNING' && (
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-primary-400">計劃期間</span>
                <span className="text-primary-300">
                  {activeSprint.metrics.daysRemaining > 0 
                    ? `${activeSprint.metrics.daysRemaining} 天後開始`
                    : '準備開始'
                  }
                </span>
              </div>
              <div className="w-full bg-primary-600 rounded-full h-2">
                <div className="bg-yellow-500 h-2 rounded-full w-full" />
              </div>
            </div>
          )}
        </div>

        {/* Sprint Stats */}
        <div className="mt-3 pt-3 border-t border-primary-600 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-primary-300">
            <Target className="h-3 w-3" />
            <span>{activeSprint._count.stories} 個故事</span>
          </div>
          <div className="flex items-center gap-1 text-primary-300">
            <Calendar className="h-3 w-3" />
            <span>
              {activeSprint.status === 'PLANNING' 
                ? '待開始' 
                : `${activeSprint.metrics.workCompletedPercentage}% 完成`
              }
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}