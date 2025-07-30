'use client';

import { useEffect, useState } from 'react';
import ParticleSystem from './ParticleSystem';
import NeuralNetworkProgress from './NeuralNetworkProgress';
import HolographicDisplay from './HolographicDisplay';
import './animations.css';

export interface InitializationPhase {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  progress: number;
  details: string[];
}

interface ProjectInitializationOverlayProps {
  isVisible: boolean;
  phases: InitializationPhase[];
  currentPhaseIndex: number;
  onComplete?: () => void;
  onError?: (error: string) => void;
  projectName?: string;
  className?: string;
}

export default function ProjectInitializationOverlay({
  isVisible,
  phases,
  currentPhaseIndex,
  onComplete,
  onError,
  projectName = 'New Project',
  className = '',
}: ProjectInitializationOverlayProps) {
  const [showContent, setShowContent] = useState(false);
  const [displayMode, setDisplayMode] = useState<'neural' | 'holographic'>(
    'neural'
  );
  const [backgroundPhase, setBackgroundPhase] = useState<
    'analyzing' | 'processing' | 'creating' | 'finalizing' | 'complete'
  >('analyzing');

  const currentPhase = phases[currentPhaseIndex];
  const isComplete = currentPhaseIndex >= phases.length;
  const hasError = phases.some(phase => phase.status === 'error');

  // Map phase index to background animation phase
  useEffect(() => {
    if (currentPhaseIndex < phases.length) {
      const phaseMapping: {
        [key: number]: 'analyzing' | 'processing' | 'creating' | 'finalizing';
      } = {
        0: 'analyzing' as const,
        1: 'processing' as const,
        2: 'creating' as const,
        3: 'finalizing' as const,
      };
      setBackgroundPhase(phaseMapping[currentPhaseIndex] || 'processing');
    } else {
      setBackgroundPhase('complete');
    }
  }, [currentPhaseIndex, phases.length]);

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
    if (isComplete && !hasError) {
      const timer = setTimeout(() => {
        onComplete?.();
      }, 2000); // Wait for celebration animation
      return () => clearTimeout(timer);
    }
  }, [isComplete, hasError, onComplete]);

  // Handle errors
  useEffect(() => {
    if (hasError) {
      const errorPhase = phases.find(phase => phase.status === 'error');
      if (errorPhase) {
        onError?.(errorPhase.details.join(', ') || 'Unknown error occurred');
      }
    }
  }, [hasError, phases, onError]);

  // Toggle display mode periodically for visual interest
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayMode(prev => (prev === 'neural' ? 'holographic' : 'neural'));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  if (!showContent) return null;

  const getOverallProgress = () => {
    const completedPhases = phases.filter(
      phase => phase.status === 'completed'
    ).length;
    const currentProgress = currentPhase?.progress || 0;
    return ((completedPhases + currentProgress / 100) / phases.length) * 100;
  };

  const getPhaseForDisplay = ():
    | 'analyzing'
    | 'processing'
    | 'creating'
    | 'finalizing'
    | 'complete'
    | 'error' => {
    if (hasError) return 'error';
    if (isComplete) return 'complete';
    return backgroundPhase;
  };

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        transition-all duration-500
        ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        ${className}
      `}
      style={{
        background: 'rgba(4, 8, 16, 0.98)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Particle System Background */}
      <ParticleSystem
        count={150}
        phase={backgroundPhase}
        className="absolute inset-0"
      />

      {/* Main Content Container */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 breathing-glow">
        {/* Project Title */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4 text-accent-50">CodeHive</h1>
          <p className="text-xl text-primary-300 mb-2">
            AI-Native Project Management
          </p>
          <p className="text-lg text-primary-400">
            正在初始化：{' '}
            <span className="text-accent-400 font-mono">{projectName}</span>
          </p>
        </div>

        {/* Main Display Area */}
        <div className="relative">
          {displayMode === 'neural' ? (
            <div className="flex items-center justify-between space-x-8">
              {/* Neural Network Progress */}
              <div className="flex-1">
                <NeuralNetworkProgress
                  currentPhase={currentPhaseIndex}
                  totalPhases={phases.length}
                  phaseLabels={phases.map(phase => phase.title)}
                  className="mb-6"
                />
              </div>

              {/* Status Panel */}
              <div className="flex-1">
                <HolographicDisplay
                  title={currentPhase?.title || 'Initialization Complete'}
                  subtitle={`Step ${currentPhaseIndex + 1} of ${phases.length}`}
                  status={currentPhase?.description || 'All systems ready'}
                  details={currentPhase?.details || []}
                  progress={currentPhase?.progress || 100}
                  phase={getPhaseForDisplay()}
                  className="max-w-md"
                />
              </div>
            </div>
          ) : (
            /* Holographic Mode - Full Width Display */
            <div className="max-w-2xl mx-auto">
              <HolographicDisplay
                title={currentPhase?.title || 'System Initialized'}
                subtitle={`Processing Phase ${currentPhaseIndex + 1}/${phases.length}`}
                status={currentPhase?.description || 'Ready for development'}
                details={
                  currentPhase?.details || ['All components operational']
                }
                progress={getOverallProgress()}
                phase={getPhaseForDisplay()}
              />

              {/* Mini Neural Network */}
              <div className="mt-8 scale-75 opacity-75">
                <NeuralNetworkProgress
                  currentPhase={currentPhaseIndex}
                  totalPhases={phases.length}
                  phaseLabels={phases.map(phase => phase.title)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Overall Progress */}
        <div className="mt-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="flex justify-between text-sm text-primary-400 mb-2">
              <span>整體進度</span>
              <span>{Math.round(getOverallProgress())}%</span>
            </div>
            <div className="w-full h-3 bg-primary-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-600 to-accent-400 transition-all duration-1000 ease-out"
                style={{
                  width: `${getOverallProgress()}%`,
                  boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {isComplete && !hasError && (
          <div className="mt-8 text-center">
            <div className="text-accent-400 text-2xl font-bold mb-2">
              🎉 初始化完成！
            </div>
            <div className="text-primary-300">正在導向您的專案...</div>
          </div>
        )}

        {hasError && (
          <div className="mt-8 text-center">
            <div className="text-red-400 text-2xl font-bold mb-2">
              ⚠️ 初始化錯誤
            </div>
            <div className="text-primary-300">請檢查日誌以獲取更多資訊</div>
          </div>
        )}

        {/* Skip Button */}
        {!isComplete && !hasError && (
          <div className="absolute bottom-8 right-8">
            <button
              onClick={onComplete}
              className="px-4 py-2 text-primary-400 hover:text-accent-50 transition-colors text-sm border border-primary-600 hover:border-accent-500 rounded"
            >
              跳過動畫
            </button>
          </div>
        )}
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-4 left-4 text-primary-500 text-xs font-mono">
        CODEHIVE_INIT_v2.1.0
      </div>
      <div className="absolute top-4 right-4 text-primary-500 text-xs font-mono">
        {new Date().toISOString().split('T')[0]}
      </div>
      <div className="absolute bottom-4 left-4 text-primary-500 text-xs font-mono">
        AI_AGENT_SYSTEM_ONLINE
      </div>
      <div className="absolute bottom-4 right-4 text-primary-500 text-xs font-mono">
        NEURAL_NETWORK_ACTIVE
      </div>
    </div>
  );
}
