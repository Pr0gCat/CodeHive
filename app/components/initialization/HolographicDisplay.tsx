'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface HolographicDisplayProps {
  title: string;
  subtitle?: string;
  status: string;
  details?: string[];
  progress?: number;
  phase:
    | 'analyzing'
    | 'processing'
    | 'creating'
    | 'finalizing'
    | 'complete'
    | 'error';
  className?: string;
}

export default function HolographicDisplay({
  title,
  subtitle,
  status,
  details = [],
  progress = 0,
  phase,
  className = '',
}: HolographicDisplayProps) {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);

  const phaseColors = {
    analyzing: {
      primary: '#a855f7',
      secondary: '#7c3aed',
      glow: 'rgba(168, 85, 247, 0.5)',
    },
    processing: {
      primary: '#a855f7',
      secondary: '#7c3aed',
      glow: 'rgba(168, 85, 247, 0.6)',
    },
    creating: {
      primary: '#10b981',
      secondary: '#059669',
      glow: 'rgba(16, 185, 129, 0.5)',
    },
    finalizing: {
      primary: '#f59e0b',
      secondary: '#d97706',
      glow: 'rgba(245, 158, 11, 0.5)',
    },
    complete: {
      primary: '#10b981',
      secondary: '#059669',
      glow: 'rgba(16, 185, 129, 0.8)',
    },
    error: {
      primary: '#ef4444',
      secondary: '#dc2626',
      glow: 'rgba(239, 68, 68, 0.5)',
    },
  };

  const currentColors = phaseColors[phase];

  // Typewriter effect for status text
  useEffect(() => {
    setIsTyping(true);
    setDisplayText('');

    let index = 0;
    const typewriterInterval = setInterval(() => {
      if (index <= status.length) {
        setDisplayText(status.slice(0, index));
        index++;
      } else {
        clearInterval(typewriterInterval);
        setIsTyping(false);
      }
    }, 50);

    return () => clearInterval(typewriterInterval);
  }, [status]);

  // Random glitch effect
  useEffect(() => {
    const glitchInterval = setInterval(() => {
      if (Math.random() < 0.1) {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 100);
      }
    }, 2000);

    return () => clearInterval(glitchInterval);
  }, []);

  const GlitchText = ({
    children,
    intensity = 1,
  }: {
    children: string;
    intensity?: number;
  }) => {
    const [glitchedText, setGlitchedText] = useState(children);

    useEffect(() => {
      if (!glitchActive) {
        setGlitchedText(children);
        return;
      }

      const chars = '!@#$%^&*()_+-=[]{}|;:,.<>?~`';
      let glitched = '';

      for (let i = 0; i < children.length; i++) {
        if (Math.random() < 0.1 * intensity) {
          glitched += chars[Math.floor(Math.random() * chars.length)];
        } else {
          glitched += children[i];
        }
      }

      setGlitchedText(glitched);
    }, [children, glitchActive, intensity]);

    return <>{glitchedText}</>;
  };

  const ScanLine = () => (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `linear-gradient(90deg, transparent 0%, ${currentColors.glow} 50%, transparent 100%)`,
        transform: 'translateX(-100%)',
        animation: 'data-flow 3s linear infinite',
        height: '2px',
        top: '50%',
      }}
    />
  );

  return (
    <div
      className={`relative bg-primary-900/80 border border-primary-700 rounded-lg p-8 backdrop-blur-sm ${className}`}
    >
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(${currentColors.primary} 1px, transparent 1px),
            linear-gradient(90deg, ${currentColors.primary} 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Scan line effect */}
      <ScanLine />

      {/* Title */}
      <div className="relative mb-6">
        <h1
          className={`text-4xl font-bold mb-2 ${glitchActive ? 'animate-pulse' : ''}`}
          style={{
            color: currentColors.primary,
            textShadow: `0 0 20px ${currentColors.glow}, 0 0 40px ${currentColors.glow}`,
            filter: glitchActive ? 'hue-rotate(180deg)' : 'none',
          }}
        >
          <GlitchText intensity={0.3}>{title}</GlitchText>
        </h1>

        {subtitle && (
          <p
            className="text-lg opacity-80"
            style={{ color: currentColors.secondary }}
          >
            <GlitchText intensity={0.1}>{subtitle}</GlitchText>
          </p>
        )}

        {/* Holographic projection lines */}
        <div className="absolute -left-4 top-0 bottom-0 w-1 opacity-30">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-full"
              style={{
                height: '1px',
                backgroundColor: currentColors.primary,
                top: `${(i / 7) * 100}%`,
                animation: `holographic-flicker ${2 + i * 0.2}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Status display */}
      <div className="relative mb-6">
        <div className="flex items-center space-x-4">
          {/* Status indicator */}
          <div
            className="w-4 h-4 rounded-full animate-pulse"
            style={{
              backgroundColor: currentColors.primary,
              boxShadow: `0 0 10px ${currentColors.glow}`,
            }}
          />

          {/* Status text */}
          <div
            className="text-xl font-mono"
            style={{
              color: currentColors.primary,
              textShadow: `0 0 10px ${currentColors.glow}`,
            }}
          >
            <GlitchText intensity={0.05}>{displayText}</GlitchText>
            {isTyping && (
              <span
                className="animate-pulse ml-1"
                style={{ color: currentColors.primary }}
              >
                |
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {progress > 0 && (
          <div className="mt-4">
            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500 ease-out"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${currentColors.secondary}, ${currentColors.primary})`,
                  boxShadow: `0 0 10px ${currentColors.glow}`,
                }}
              />
            </div>
            <div
              className="text-sm mt-1 font-mono"
              style={{ color: currentColors.secondary }}
            >
              {progress.toFixed(1)}% Complete
            </div>
          </div>
        )}
      </div>

      {/* Details list */}
      {details.length > 0 && (
        <div className="space-y-2">
          {details.map((detail, index) => (
            <div
              key={index}
              className="flex items-center space-x-3 text-sm font-mono opacity-80"
              style={{
                animation: `fade-in-up 0.5s ease-out ${index * 0.1}s both`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: currentColors.secondary,
                  boxShadow: `0 0 5px ${currentColors.glow}`,
                }}
              />
              <span style={{ color: currentColors.secondary }}>
                <GlitchText intensity={0.02}>{detail}</GlitchText>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Phase-specific decorative elements */}
      {phase === 'analyzing' && (
        <div className="absolute top-4 right-4">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{
              borderColor: `${currentColors.primary} transparent ${currentColors.primary} transparent`,
            }}
          />
        </div>
      )}

      {phase === 'processing' && (
        <div className="absolute top-4 right-4 flex space-x-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-6 rounded-full animate-pulse"
              style={{
                backgroundColor: currentColors.primary,
                animationDelay: `${i * 0.2}s`,
                opacity: 0.7,
              }}
            />
          ))}
        </div>
      )}

      {phase === 'complete' && (
        <div className="absolute top-4 right-4">
          <div
            className="text-2xl animate-bounce"
            style={{ color: currentColors.primary }}
          >
            ✨
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="absolute top-4 right-4">
          <div
            className="animate-pulse"
            style={{ color: currentColors.primary }}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      )}

      {/* Corner brackets for sci-fi look */}
      <div className="absolute top-0 left-0 w-6 h-6">
        <div
          className="absolute top-0 left-0 w-full h-0.5"
          style={{ backgroundColor: currentColors.primary }}
        />
        <div
          className="absolute top-0 left-0 w-0.5 h-full"
          style={{ backgroundColor: currentColors.primary }}
        />
      </div>
      <div className="absolute top-0 right-0 w-6 h-6">
        <div
          className="absolute top-0 right-0 w-full h-0.5"
          style={{ backgroundColor: currentColors.primary }}
        />
        <div
          className="absolute top-0 right-0 w-0.5 h-full"
          style={{ backgroundColor: currentColors.primary }}
        />
      </div>
      <div className="absolute bottom-0 left-0 w-6 h-6">
        <div
          className="absolute bottom-0 left-0 w-full h-0.5"
          style={{ backgroundColor: currentColors.primary }}
        />
        <div
          className="absolute bottom-0 left-0 w-0.5 h-full"
          style={{ backgroundColor: currentColors.primary }}
        />
      </div>
      <div className="absolute bottom-0 right-0 w-6 h-6">
        <div
          className="absolute bottom-0 right-0 w-full h-0.5"
          style={{ backgroundColor: currentColors.primary }}
        />
        <div
          className="absolute bottom-0 right-0 w-0.5 h-full"
          style={{ backgroundColor: currentColors.primary }}
        />
      </div>
    </div>
  );
}
