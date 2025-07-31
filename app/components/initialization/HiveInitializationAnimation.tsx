'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface InitializationPhase {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  progress: number;
  details: string[];
}

interface HiveInitializationAnimationProps {
  isVisible: boolean;
  phases?: InitializationPhase[]; // Optional for backward compatibility
  currentPhaseIndex?: number; // Optional for backward compatibility
  onComplete?: () => void;
  onError?: (error: string) => void;
  projectName?: string;
  taskId?: string; // For real-time progress tracking
  useRealTimeProgress?: boolean; // Enable real-time mode
}

export default function HiveInitializationAnimation({
  isVisible,
  phases: initialPhases = [],
  currentPhaseIndex: initialCurrentPhaseIndex = 0,
  onComplete,
  onError,
  projectName = 'New Project',
  taskId,
  useRealTimeProgress = false,
}: HiveInitializationAnimationProps) {
  const [showContent, setShowContent] = useState(false);
  const [phases, setPhases] = useState<InitializationPhase[]>(initialPhases);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(initialCurrentPhaseIndex);
  const [realTimeEvents, setRealTimeEvents] = useState<any[]>([]);

  // Update phases when initialPhases prop changes (for static mode)
  useEffect(() => {
    if (!useRealTimeProgress && initialPhases.length > 0) {
      console.log('📋 Updating phases from props:', initialPhases.length);
      setPhases(initialPhases);
    }
  }, [initialPhases, useRealTimeProgress]);

  // Update current phase index when prop changes (for static mode)
  useEffect(() => {
    if (!useRealTimeProgress) {
      setCurrentPhaseIndex(initialCurrentPhaseIndex);
    }
  }, [initialCurrentPhaseIndex, useRealTimeProgress]);

  // Debug log
  console.log('🎯 HiveInitializationAnimation props:', {
    isVisible,
    taskId,
    useRealTimeProgress,
    projectName,
    initialPhasesLength: initialPhases.length,
    phasesInState: phases.length
  });

  const currentPhase = phases[currentPhaseIndex];
  const isComplete = phases.length > 0 && phases.every(phase => phase.status === 'completed');
  const hasError = phases.some(phase => phase.status === 'error');

  // Handle real-time progress connection
  useEffect(() => {
    console.log('🔌 SSE useEffect triggered:', {
      useRealTimeProgress,
      taskId,
      isVisible,
      shouldConnect: useRealTimeProgress && taskId && isVisible
    });
    
    if (!useRealTimeProgress || !taskId || !isVisible) {
      console.log('❌ SSE connection skipped due to missing conditions');
      return;
    }

    console.log(`🔗 Connecting to SSE for task: ${taskId}`);
    const eventSource = new EventSource(`/api/projects/progress/${taskId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 SSE Event received:', data);
        
        if (data.type === 'connected') {
          console.log(`✅ Connected to progress stream for task: ${data.taskId}`);
        } else if (data.type === 'task_status') {
          // Handle initial task status
          const task = data.task;
          console.log('📊 Received task status:', task);
        } else if (data.type === 'phase_status') {
          // Handle individual phase status
          const phase = data.phase;
          console.log('🔄 Received phase status:', phase);
          
          // Update or add phase
          setPhases(prevPhases => {
            const phaseIndex = prevPhases.findIndex(p => p.id === phase.phaseId);
            
            const phaseData = {
              id: phase.phaseId,
              title: phase.title,
              description: phase.description,
              status: phase.status.toLowerCase(), // Convert ACTIVE to active, etc.
              progress: phase.progress || 0,
              details: phase.details ? (typeof phase.details === 'string' ? JSON.parse(phase.details) : phase.details) : [],
            };
            
            console.log('📝 Processing phase:', phaseData);
            
            if (phaseIndex >= 0) {
              // Update existing phase
              const updatedPhases = [...prevPhases];
              updatedPhases[phaseIndex] = phaseData;
              console.log('📝 Updated existing phase:', updatedPhases);
              return updatedPhases;
            } else {
              // Add new phase in correct order
              const newPhases = [...prevPhases, phaseData];
              // Sort by order field from database
              const sortedPhases = newPhases.sort((a, b) => {
                // Get order from the phase data that was sent from SSE
                // We need to find the corresponding phase data for each phaseData
                const findPhaseOrder = (phaseId: string) => {
                  // If we have the order from the current phase being processed
                  if (phase.phaseId === phaseId && phase.order !== undefined) {
                    return phase.order;
                  }
                  // Fallback to common ordering
                  const phaseOrder: { [key: string]: number } = {
                    'validation': 0,
                    'git_clone': 1,
                    'analysis': 2,
                    'setup': 3,
                    'completion': 4,
                  };
                  return phaseOrder[phaseId] || 999;
                };
                
                const orderA = findPhaseOrder(a.id);
                const orderB = findPhaseOrder(b.id);
                return orderA - orderB;
              });
              console.log('📝 Added new phase, total phases:', sortedPhases.length);
              console.log('📝 Phase IDs:', sortedPhases.map(p => `${p.id}(${p.title})`));
              return sortedPhases;
            }
          });
          
          // Update current phase index if this phase is active
          if (phase.status === 'ACTIVE') {
            console.log('🎯 Phase is ACTIVE, updating current phase index for:', phase.phaseId);
            // Use setTimeout to ensure phases state is updated first
            setTimeout(() => {
              setPhases(currentPhases => {
                const newIndex = currentPhases.findIndex(p => p.id === phase.phaseId);
                console.log('🎯 Found phase index:', newIndex, 'for phase:', phase.phaseId, 'in phases:', currentPhases.map(p => p.id));
                if (newIndex >= 0) {
                  setCurrentPhaseIndex(newIndex);
                  console.log('🎯 Set current phase index to:', newIndex);
                }
                return currentPhases;
              });
            }, 100); // Small delay to ensure state update
          }
        } else if (data.type === 'event') {
          // Handle real-time events
          const event = data.event;
          console.log('📡 Received event:', event);
          
          // Update phase progress based on event
          if (event.phaseId) {
            setPhases(prevPhases => {
              return prevPhases.map(phase => {
                if (phase.id === event.phaseId) {
                  return {
                    ...phase,
                    progress: event.progress || phase.progress,
                    status: event.type === 'PHASE_START' ? 'active' : 
                           event.type === 'PHASE_COMPLETE' ? 'completed' : 
                           event.type === 'ERROR' ? 'error' : phase.status,
                  };
                }
                return phase;
              });
            });
          }
          
          setRealTimeEvents(prev => [...prev, event]);
        } else if (data.type === 'completed') {
          console.log('🎉 Task completed:', data.result);
          // Wait a moment to show 100% completion, then trigger completion
          setTimeout(() => {
            // Always call onComplete to let the parent handle navigation
            onComplete?.();
          }, 2000);
        } else if (data.type === 'error') {
          console.error('❌ Task failed:', data.error);
          onError?.(data.error);
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };

    return () => {
      console.log('🔌 Closing SSE connection for task:', taskId);
      eventSource.close();
    };
  }, [useRealTimeProgress, taskId, isVisible, onComplete, onError]);

  // Handle visibility changes
  useEffect(() => {
    if (isVisible) {
      setShowContent(true);
    } else {
      const timer = setTimeout(() => setShowContent(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Handle completion
  useEffect(() => {
    console.log('⚡ Completion check:', { 
      isComplete, 
      hasError, 
      phasesLength: phases.length,
      phases: phases.map(p => `${p.id}:${p.status}`)
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
      if (errorPhase) {
        onError?.(errorPhase.details.join(', ') || 'Unknown error occurred');
      }
    }
  }, [hasError, phases, onError]);


  const getOverallProgress = () => {
    if (!phases.length) {
      console.log('📊 No phases available for progress calculation');
      return 0;
    }
    
    const completedPhases = phases.filter(
      phase => phase.status === 'completed'
    ).length;
    const currentProgress = currentPhase?.progress || 0;
    const totalProgress = ((completedPhases + currentProgress / 100) / phases.length) * 100;
    
    console.log('📊 Progress calculation:', {
      totalPhases: phases.length,
      completedPhases,
      currentPhaseProgress: currentProgress,
      totalProgress: Math.round(totalProgress),
      currentPhaseId: currentPhase?.id
    });
    
    // Ensure we return a valid number
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
      {/* Main Content Container */}
      <div className="relative z-10 min-h-screen flex items-center justify-center py-8">
        <div className="max-w-3xl mx-auto px-6 text-center">
        {/* CodeHive Logo with Hexagon */}
        <div className="mb-8">
          <div className="relative inline-block">

            <h1 className="text-4xl font-bold text-accent-50 mb-2">CodeHive</h1>
            <p className="text-lg text-primary-300 mb-4">
              AI-Native Project Management
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
              {currentPhase.title}
            </h3>
            <p className="text-primary-300 mb-4">{currentPhase.description}</p>

            {/* Progress Bar */}
            <div className="w-full bg-primary-800 rounded-full h-3 mb-4">
              <div
                className="bg-gradient-to-r from-accent-600 to-accent-400 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${currentPhase.progress}%` }}
              />
            </div>

            {/* Phase Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              {currentPhase.details.map((detail, index) => (
                <div
                  key={index}
                  className={`
                    flex items-center space-x-2 p-2 rounded
                    ${
                      index <
                      Math.floor(
                        (currentPhase.progress / 100) *
                          currentPhase.details.length
                      )
                        ? 'text-accent-400 bg-accent-500/10'
                        : 'text-primary-400 bg-primary-800/50'
                    }
                  `}
                >
                  <span className="text-xs">
                    {index <
                    Math.floor(
                      (currentPhase.progress / 100) *
                        currentPhase.details.length
                    )
                      ? '✓'
                      : '○'}
                  </span>
                  <span>{detail}</span>
                </div>
              ))}
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
          </div>
        )}

        </div>
      </div>
    </div>
  );
}
