'use client';

import { useSocket } from '@/lib/socket/client';
import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import ConfirmationModal from '../ConfirmationModal';

export interface InitializationPhase {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  progress: number;
  details: string[];
}

interface HiveInitializationAnimationSocketProps {
  isVisible: boolean;
  onComplete?: () => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  projectName?: string;
  taskId?: string;
}

export default function HiveInitializationAnimationSocket({
  isVisible,
  onComplete,
  onError,
  onCancel,
  projectName = 'New Project',
  taskId,
}: HiveInitializationAnimationSocketProps) {
  const [showContent, setShowContent] = useState(false);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Use WebSocket hook
  const {
    connected,
    error: socketError,
    phases,
    taskStatus,
    events,
    subscribeToTask,
    clearError,
  } = useSocket(taskId);

  const currentPhase = phases[currentPhaseIndex];
  const isComplete =
    phases.length > 0 && phases.every(phase => phase.status === 'completed');
  const hasError =
    phases.some(phase => phase.status === 'error') || !!socketError;

  // Show cancel confirmation
  const handleCancelClick = () => {
    if (!taskId || isCancelling) return;
    setShowConfirmModal(true);
  };

  // Cancel task function
  const handleConfirmCancel = async () => {
    setShowConfirmModal(false);

    setIsCancelling(true);

    try {
      const response = await fetch(`/api/tasks/${taskId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Task cancelled successfully:', result);
        onCancel?.();
      } else {
        console.error('❌ Failed to cancel task:', result.error);
        alert(`Failed to cancel task: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error cancelling task:', error);
      alert('Error cancelling task. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Debug log
  console.log('🎯 HiveInitializationAnimationSocket:', {
    isVisible,
    taskId,
    connected,
    projectName,
    phasesLength: phases.length,
    currentPhaseIndex,
    isComplete,
    hasError,
  });

  // Handle visibility changes
  useEffect(() => {
    if (isVisible) {
      setShowContent(true);
    } else {
      const timer = setTimeout(() => setShowContent(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Update current phase index when phases change
  useEffect(() => {
    // First, try to find an active phase
    const activePhaseIndex = phases.findIndex(
      phase => phase.status === 'active'
    );
    
    if (activePhaseIndex >= 0) {
      console.log('🎯 Setting active phase index:', activePhaseIndex);
      setCurrentPhaseIndex(activePhaseIndex);
    } else {
      // If no active phase, find the last completed phase and show the next one
      const completedPhases = phases.filter(phase => phase.status === 'completed');
      const nextPhaseIndex = completedPhases.length;
      
      if (nextPhaseIndex < phases.length && nextPhaseIndex !== currentPhaseIndex) {
        console.log('🎯 Setting next phase index after completion:', nextPhaseIndex);
        setCurrentPhaseIndex(nextPhaseIndex);
      } else if (completedPhases.length > 0 && completedPhases.length === phases.length) {
        // All phases completed, show the last phase
        console.log('🎯 All phases completed, showing last phase');
        setCurrentPhaseIndex(phases.length - 1);
      }
    }
  }, [phases, currentPhaseIndex]);

  // Handle completion
  useEffect(() => {
    console.log('⚡ Completion check:', {
      isComplete,
      hasError,
      phasesLength: phases.length,
      phases: phases.map(p => `${p.id}:${p.status}`),
    });
    if (isComplete && !hasError) {
      console.log('🎯 Task completed, calling onComplete in 2 seconds...');
      const timer = setTimeout(() => {
        console.log('🎯 Calling onComplete callback');
        onComplete?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, hasError, onComplete, phases]);

  // Handle errors
  useEffect(() => {
    if (hasError) {
      const errorPhase = phases.find(phase => phase.status === 'error');
      const errorMessage =
        errorPhase?.details.join(', ') ||
        socketError ||
        'Unknown error occurred';
      console.error('❌ Error in initialization:', errorMessage);
      onError?.(errorMessage);
    }
  }, [hasError, phases, socketError, onError]);

  // Handle WebSocket events
  useEffect(() => {
    const completedEvent = events.find(e => e.type === 'task_completed');
    const errorEvent = events.find(e => e.type === 'task_error');

    if (completedEvent) {
      console.log('🎉 Task completed via WebSocket event:', completedEvent);
      setTimeout(() => {
        onComplete?.();
      }, 2000);
    } else if (errorEvent) {
      console.error('❌ Task failed via WebSocket event:', errorEvent);
      onError?.(errorEvent.data?.error || 'Task failed');
    }
  }, [events, onComplete, onError]);

  const getOverallProgress = () => {
    if (!phases.length) {
      console.log('No phases available for progress calculation');
      return 0;
    }

    const completedPhases = phases.filter(
      phase => phase.status === 'completed'
    ).length;
    
    // If we have a current phase that's active, use its progress
    const currentProgress = currentPhase?.status === 'active' ? currentPhase.progress : 0;
    
    // Calculate total progress: completed phases + current phase progress
    let totalProgress = (completedPhases / phases.length) * 100;
    
    // Add current phase progress if there's an active phase
    if (currentPhase?.status === 'active') {
      totalProgress += (currentProgress / 100) * (100 / phases.length);
    }

    console.log('Progress calculation:', {
      totalPhases: phases.length,
      completedPhases,
      currentPhaseProgress: currentProgress,
      currentPhaseStatus: currentPhase?.status,
      totalProgress: Math.round(totalProgress),
      currentPhaseId: currentPhase?.id,
      currentPhaseTitle: currentPhase?.title,
    });

    return isNaN(totalProgress) ? 0 : Math.min(100, Math.max(0, totalProgress));
  };

  if (!showContent) return null;

  return (
    <div
      className={`
        fixed inset-0 z-50 overflow-y-auto
        transition-all duration-500 bg-primary-950
        ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
    >
      {/* Connection Status */}
      {!connected && (
        <div className="absolute top-4 right-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <div className="text-yellow-400 text-sm flex items-center">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse mr-2" />
            正在連接...
          </div>
        </div>
      )}

      {connected && (
        <div className="absolute top-4 right-4 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <div className="text-green-400 text-sm flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2" />
            已連接 WebSocket
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <div className="relative z-10 min-h-screen flex items-center justify-center py-8">
        <div className="max-w-3xl mx-auto px-6 text-center">
          {/* CodeHive Logo */}
          <div className="mb-8">
            <div className="relative inline-block">
              <h1 className="text-4xl font-bold text-accent-50 mb-2">
                CodeHive
              </h1>
              <p className="text-lg text-primary-300 mb-4">
                AI 原生專案管理 (WebSocket)
              </p>
            </div>
          </div>

          {/* Project Name */}
          <div className="mb-8">
            <p className="text-xl text-primary-400">正在初始化專案：</p>
            <p className="text-2xl font-mono text-accent-400 mt-2">
              {projectName}
            </p>
          </div>

          {/* Current Phase Status */}
          {currentPhase && (
            <div className="bg-primary-900/80 border border-primary-700 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold text-accent-50 mb-2">
                當前階段：{currentPhase.title}
              </h3>
              <p className="text-primary-300 mb-4">
                {currentPhase.description}
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-primary-800 rounded-full h-3 mb-4">
                <div
                  className="bg-gradient-to-r from-accent-600 to-accent-400 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${currentPhase.status === 'completed' ? 100 : currentPhase.progress}%` 
                  }}
                />
              </div>

              {/* Phase Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                {currentPhase.details.map((detail: unknown, index: number) => {
                  // Calculate completed items based on progress or completed status
                  const effectiveProgress = currentPhase.status === 'completed' ? 100 : currentPhase.progress;
                  const completedItems = Math.floor(
                    (effectiveProgress / 100) * currentPhase.details.length
                  );
                  const isCompleted = index < completedItems || currentPhase.status === 'completed';
                  
                  return (
                    <div
                      key={index}
                      className={`
                        flex items-center space-x-2 p-2 rounded
                        ${
                          isCompleted
                            ? 'text-accent-400 bg-accent-500/10'
                            : 'text-primary-400 bg-primary-800/50'
                        }
                      `}
                    >
                      <span className="text-xs">
                        {isCompleted ? '✓' : '○'}
                      </span>
                      <span>{String(detail)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overall Progress */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-primary-400 mb-2">
              <span>整體進度</span>
              <span>{Math.round(getOverallProgress())}%</span>
            </div>
            <div className="w-full bg-primary-800 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-accent-600 to-accent-400 h-4 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${getOverallProgress()}%` }}
              />
            </div>
          </div>

          {/* Cancel Button */}
          {!isComplete && !hasError && taskId && (
            <div className="text-center mb-6">
              <button
                onClick={handleCancelClick}
                disabled={isCancelling}
                className={`
                  inline-flex items-center px-6 py-3 border border-red-600 
                  text-red-400 font-medium rounded-lg transition-all duration-200
                  ${
                    isCancelling
                      ? 'bg-red-600/10 cursor-not-allowed opacity-50'
                      : 'hover:bg-red-600/20 hover:border-red-500 hover:text-red-300'
                  }
                `}
              >
                <X className="w-5 h-5 mr-2" />
                {isCancelling ? 'Cancelling...' : 'Cancel Initialization'}
              </button>
            </div>
          )}

          {/* Status Messages */}
          {isComplete && !hasError && (
            <div className="text-center">
              <div className="text-accent-400 text-2xl font-bold mb-2">
                🍯 初始化完成！
              </div>
              <div className="text-primary-300">正在導向您的專案...</div>
            </div>
          )}

          {hasError && (
            <div className="text-center">
              <div className="text-red-400 text-2xl font-bold mb-2 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 mr-2" />
                初始化錯誤
              </div>
              <div className="text-primary-300">請檢查日誌以獲取更多資訊</div>
              {socketError && (
                <div className="text-red-400 text-sm mt-2">
                  WebSocket Error: {socketError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmCancel}
        title="Cancel Project Initialization"
        message={`Are you sure you want to cancel the initialization of "${projectName}"?\n\nThis will stop the process and clean up all created files and database records.`}
        confirmText="Cancel Initialization"
        cancelText="Keep Initializing"
        variant="danger"
        isLoading={isCancelling}
      />
    </div>
  );
}
