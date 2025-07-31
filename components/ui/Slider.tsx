'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface SliderMarker {
  value: number;
  label: string;
  color?: string;
}

interface SliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  disabled?: boolean;
  className?: string;

  // Visual customization
  color?: 'accent' | 'blue' | 'green' | 'red' | 'yellow';
  size?: 'sm' | 'md' | 'lg';

  // Labels and formatting
  formatLabel?: (value: number) => string;
  showValue?: boolean;
  showMinMax?: boolean;

  // Markers for suggested values
  markers?: SliderMarker[];

  // Accessibility
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const colorClasses = {
  accent: {
    track: 'bg-accent-600',
    rail: 'bg-primary-700',
    thumb: 'bg-accent-500 border-accent-400 hover:bg-accent-400',
    thumbActive: 'bg-accent-400 shadow-accent-500/30',
  },
  blue: {
    track: 'bg-blue-600',
    rail: 'bg-primary-700',
    thumb: 'bg-blue-500 border-blue-400 hover:bg-blue-400',
    thumbActive: 'bg-blue-400 shadow-blue-500/30',
  },
  green: {
    track: 'bg-green-600',
    rail: 'bg-primary-700',
    thumb: 'bg-green-500 border-green-400 hover:bg-green-400',
    thumbActive: 'bg-green-400 shadow-green-500/30',
  },
  red: {
    track: 'bg-red-600',
    rail: 'bg-primary-700',
    thumb: 'bg-red-500 border-red-400 hover:bg-red-400',
    thumbActive: 'bg-red-400 shadow-red-500/30',
  },
  yellow: {
    track: 'bg-yellow-600',
    rail: 'bg-primary-700',
    thumb: 'bg-yellow-500 border-yellow-400 hover:bg-yellow-400',
    thumbActive: 'bg-yellow-400 shadow-yellow-500/30',
  },
};

const sizeClasses = {
  sm: {
    rail: 'h-1',
    thumb: 'w-4 h-4',
    container: 'py-2',
  },
  md: {
    rail: 'h-2',
    thumb: 'w-5 h-5',
    container: 'py-3',
  },
  lg: {
    rail: 'h-3',
    thumb: 'w-6 h-6',
    container: 'py-4',
  },
};

export default function Slider({
  min,
  max,
  value,
  onChange,
  step = 1,
  disabled = false,
  className = '',
  color = 'accent',
  size = 'md',
  formatLabel,
  showValue = true,
  showMinMax = false,
  markers = [],
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: SliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const railRef = useRef<HTMLDivElement>(null);

  const colors = colorClasses[color];
  const sizes = sizeClasses[size];

  // Update temp value when prop value changes
  useEffect(() => {
    if (!isDragging) {
      setTempValue(value);
    }
  }, [value, isDragging]);

  const calculateValue = useCallback(
    (clientX: number) => {
      if (!railRef.current) return value;

      const rect = railRef.current.getBoundingClientRect();
      const percentage = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width)
      );
      const rawValue = min + percentage * (max - min);

      // Snap to step
      const steppedValue = Math.round(rawValue / step) * step;
      return Math.max(min, Math.min(max, steppedValue));
    },
    [min, max, step, value]
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (disabled) return;

      event.preventDefault();
      setIsDragging(true);

      const newValue = calculateValue(event.clientX);
      setTempValue(newValue);
      onChange(newValue);
    },
    [disabled, calculateValue, onChange]
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging || disabled) return;

      const newValue = calculateValue(event.clientX);
      setTempValue(newValue);
      onChange(newValue);
    },
    [isDragging, disabled, calculateValue, onChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;

      let newValue = value;
      const largeStep = (max - min) / 10;

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          newValue = Math.max(min, value - step);
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          newValue = Math.min(max, value + step);
          break;
        case 'PageDown':
          newValue = Math.max(min, value - largeStep);
          break;
        case 'PageUp':
          newValue = Math.min(max, value + largeStep);
          break;
        case 'Home':
          newValue = min;
          break;
        case 'End':
          newValue = max;
          break;
        default:
          return; // Don't prevent default for other keys
      }

      event.preventDefault();
      setTempValue(newValue);
      onChange(newValue);
    },
    [disabled, value, min, max, step, onChange]
  );

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const percentage = ((tempValue - min) / (max - min)) * 100;
  const displayValue = formatLabel
    ? formatLabel(tempValue)
    : tempValue.toString();

  return (
    <div className={`relative ${sizes.container} ${className}`}>
      {/* Value display */}
      {showValue && (
        <div className="flex justify-center mb-2">
          <span
            className={`text-2xl font-bold text-accent-50 transition-all duration-200 ${
              isDragging ? 'scale-110' : ''
            }`}
          >
            {displayValue}
          </span>
        </div>
      )}

      {/* Slider container */}
      <div className="relative cursor-pointer" onMouseDown={handleMouseDown}>
        {/* Rail (background track) */}
        <div
          ref={railRef}
          className={`relative w-full ${sizes.rail} ${colors.rail} rounded-full transition-colors duration-200`}
        >
          {/* Track (filled portion) */}
          <div
            className={`absolute left-0 top-0 ${sizes.rail} ${colors.track} rounded-full transition-all duration-200`}
            style={{ width: `${percentage}%` }}
          />

          {/* Markers */}
          {markers.map((marker, index) => {
            const markerPercentage = ((marker.value - min) / (max - min)) * 100;
            return (
              <div
                key={index}
                className="absolute top-1/2 w-0.5 h-4 -translate-y-1/2 -translate-x-0.5 bg-primary-300 opacity-60"
                style={{ left: `${markerPercentage}%` }}
                title={marker.label}
              />
            );
          })}
        </div>

        {/* Thumb */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 ${sizes.thumb} 
            ${isDragging ? colors.thumbActive : colors.thumb} 
            border-2 rounded-full cursor-grab transition-all duration-200 
            ${isDragging ? 'cursor-grabbing scale-110 shadow-lg' : 'hover:scale-105'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 focus:ring-offset-primary-900`}
          style={{ left: `${percentage}%` }}
          tabIndex={disabled ? -1 : 0}
          role="slider"
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={tempValue}
          aria-valuetext={displayValue}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Min/Max labels or markers */}
      <div className="flex justify-between mt-2">
        {showMinMax && (
          <>
            <span className="text-xs text-primary-400">
              {formatLabel ? formatLabel(min) : min}
            </span>
            <span className="text-xs text-primary-400">
              {formatLabel ? formatLabel(max) : max}
            </span>
          </>
        )}
        {!showMinMax && markers.length > 0 && (
          <div className="flex justify-between w-full text-xs text-primary-400">
            {markers.map((marker, index) => (
              <span
                key={index}
                className="opacity-60"
                style={{
                  position: 'absolute',
                  left: `${((marker.value - min) / (max - min)) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                {marker.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
