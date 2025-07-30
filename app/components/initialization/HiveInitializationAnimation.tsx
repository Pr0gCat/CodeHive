'use client';

import { useEffect, useState } from 'react';

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
  phases: InitializationPhase[];
  currentPhaseIndex: number;
  onComplete?: () => void;
  onError?: (error: string) => void;
  projectName?: string;
}

export default function HiveInitializationAnimation({
  isVisible,
  phases,
  currentPhaseIndex,
  onComplete,
  onError,
  projectName = 'New Project',
}: HiveInitializationAnimationProps) {
  const [showContent, setShowContent] = useState(false);
  const [animatedBees, setAnimatedBees] = useState<number[]>([]);

  const currentPhase = phases[currentPhaseIndex];
  const isComplete = currentPhaseIndex >= phases.length;
  const hasError = phases.some(phase => phase.status === 'error');

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
      }, 2000);
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

  // Animate bees based on current phase
  useEffect(() => {
    if (currentPhaseIndex >= 0) {
      const beesToAnimate = Array.from(
        { length: Math.min(currentPhaseIndex + 1, 6) },
        (_, i) => i
      );
      setAnimatedBees(beesToAnimate);
    }
  }, [currentPhaseIndex]);

  const getOverallProgress = () => {
    const completedPhases = phases.filter(
      phase => phase.status === 'completed'
    ).length;
    const currentProgress = currentPhase?.progress || 0;
    return ((completedPhases + currentProgress / 100) / phases.length) * 100;
  };

  if (!showContent) return null;

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        transition-all duration-500 bg-primary-950
        ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
    >
      {/* Main Content Container */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        {/* CodeHive Logo with Hexagon */}
        <div className="mb-8">
          <div className="relative inline-block">
            {/* Hexagon Container */}
            <div className="relative w-32 h-32 mx-auto mb-6">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Hexagon Base */}
                <polygon
                  points="50,5 85,25 85,65 50,85 15,65 15,25"
                  className="fill-accent-600/20 stroke-accent-500 stroke-2"
                />

                {/* Inner Hexagons for Hive Effect */}
                {[0, 1, 2, 3, 4, 5].map(index => (
                  <polygon
                    key={index}
                    points={`50,${15 + index * 8} ${75 - index * 4},${25 + index * 5} ${75 - index * 4},${55 - index * 5} 50,${75 - index * 8} ${25 + index * 4},${55 - index * 5} ${25 + index * 4},${25 + index * 5}`}
                    className={`fill-accent-500/10 stroke-accent-400 stroke-1 transition-all duration-500 ${
                      animatedBees.includes(index)
                        ? 'opacity-100'
                        : 'opacity-30'
                    }`}
                    style={{
                      animationDelay: `${index * 0.2}s`,
                    }}
                  />
                ))}

                {/* Animated Bees */}
                {animatedBees.map(beeIndex => (
                  <g key={beeIndex}>
                    <circle
                      cx="50"
                      cy="50"
                      r="2"
                      className="fill-yellow-400"
                      style={{
                        animation: `bee-flight-${beeIndex} 3s ease-in-out infinite`,
                        transformOrigin: '50px 50px',
                      }}
                    />
                  </g>
                ))}
              </svg>
            </div>

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
            <div className="text-red-400 text-2xl font-bold mb-2">
              ⚠️ 初始化錯誤
            </div>
            <div className="text-primary-300">請檢查日誌以獲取更多資訊</div>
          </div>
        )}

      </div>

      {/* CSS Animations for Bees */}
      <style jsx>{`
        @keyframes bee-flight-0 {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(15px, -10px) rotate(45deg);
          }
          50% {
            transform: translate(0, -20px) rotate(90deg);
          }
          75% {
            transform: translate(-15px, -10px) rotate(135deg);
          }
        }

        @keyframes bee-flight-1 {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(20px, 0) rotate(60deg);
          }
          66% {
            transform: translate(-20px, 0) rotate(120deg);
          }
        }

        @keyframes bee-flight-2 {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(-10px, 15px) rotate(-45deg);
          }
          50% {
            transform: translate(0, 25px) rotate(-90deg);
          }
          75% {
            transform: translate(10px, 15px) rotate(-135deg);
          }
        }

        @keyframes bee-flight-3 {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          50% {
            transform: translate(25px, -15px) rotate(180deg);
          }
        }

        @keyframes bee-flight-4 {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(-20px, -15px) rotate(-60deg);
          }
          75% {
            transform: translate(20px, 15px) rotate(60deg);
          }
        }

        @keyframes bee-flight-5 {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(0, -25px) rotate(120deg);
          }
          66% {
            transform: translate(0, 25px) rotate(240deg);
          }
        }
      `}</style>
    </div>
  );
}
