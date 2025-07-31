'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface DualRangeSliderProps {
  minValue: number;
  maxValue: number;
  onChange: (min: number, max: number) => void;
  onChangeEnd?: (min: number, max: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  label: string;
  help?: string;
  formatLabel?: (value: number) => string;
}

export default function DualRangeSlider({
  minValue,
  maxValue,
  onChange,
  onChangeEnd,
  min = 0,
  max = 1,
  step = 0.01,
  disabled = false,
  className = '',
  label,
  help,
  formatLabel = (value: number) => `${Math.round(value * 100)}%`,
}: DualRangeSliderProps) {
  const [isDraggingMin, setIsDraggingMin] = useState(false);
  const [isDraggingMax, setIsDraggingMax] = useState(false);
  const [tempMinValue, setTempMinValue] = useState(minValue);
  const [tempMaxValue, setTempMaxValue] = useState(maxValue);
  const railRef = useRef<HTMLDivElement>(null);

  // Update temp values when prop values change
  useEffect(() => {
    if (!isDraggingMin && !isDraggingMax) {
      setTempMinValue(minValue);
      setTempMaxValue(maxValue);
    }
  }, [minValue, maxValue, isDraggingMin, isDraggingMax]);

  const calculateValue = useCallback(
    (clientX: number) => {
      if (!railRef.current) return min;

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
    [min, max, step]
  );

  const handleMinMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (disabled) return;

      event.preventDefault();
      setIsDraggingMin(true);

      const newValue = calculateValue(event.clientX);
      const constrainedValue = Math.min(newValue, tempMaxValue - step);
      setTempMinValue(constrainedValue);
      onChange(constrainedValue, tempMaxValue);
    },
    [disabled, calculateValue, tempMaxValue, step, onChange]
  );

  const handleMaxMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (disabled) return;

      event.preventDefault();
      setIsDraggingMax(true);

      const newValue = calculateValue(event.clientX);
      const constrainedValue = Math.max(newValue, tempMinValue + step);
      setTempMaxValue(constrainedValue);
      onChange(tempMinValue, constrainedValue);
    },
    [disabled, calculateValue, tempMinValue, step, onChange]
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (disabled) return;

      const newValue = calculateValue(event.clientX);

      if (isDraggingMin) {
        const constrainedValue = Math.min(newValue, tempMaxValue - step);
        setTempMinValue(constrainedValue);
        onChange(constrainedValue, tempMaxValue);
      } else if (isDraggingMax) {
        const constrainedValue = Math.max(newValue, tempMinValue + step);
        setTempMaxValue(constrainedValue);
        onChange(tempMinValue, constrainedValue);
      }
    },
    [
      disabled,
      calculateValue,
      isDraggingMin,
      isDraggingMax,
      tempMinValue,
      tempMaxValue,
      step,
      onChange,
    ]
  );

  const handleMouseUp = useCallback(() => {
    if ((isDraggingMin || isDraggingMax) && onChangeEnd) {
      onChangeEnd(tempMinValue, tempMaxValue);
    }
    setIsDraggingMin(false);
    setIsDraggingMax(false);
  }, [isDraggingMin, isDraggingMax, onChangeEnd, tempMinValue, tempMaxValue]);

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (isDraggingMin || isDraggingMax) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingMin, isDraggingMax, handleMouseMove, handleMouseUp]);

  const minPercentage = ((tempMinValue - min) / (max - min)) * 100;
  const maxPercentage = ((tempMaxValue - min) / (max - min)) * 100;

  return (
    <div className={className}>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-primary-300">
            {label}
          </label>
          <div className="text-xs text-primary-400 space-x-2">
            <span className="bg-yellow-600 px-2 py-1 rounded text-xs text-white">
              {formatLabel(tempMinValue)}
            </span>
            <span className="bg-red-600 px-2 py-1 rounded text-xs text-white">
              {formatLabel(tempMaxValue)}
            </span>
          </div>
        </div>
        {help && <p className="text-xs text-primary-500 mb-4">{help}</p>}
      </div>

      {/* Slider container */}
      <div className="relative py-3">
        {/* Rail (background track) */}
        <div
          ref={railRef}
          className="relative w-full h-2 bg-primary-700 rounded-full"
        >
          {/* Active track between thumbs */}
          <div
            className="absolute top-0 h-2 bg-gradient-to-r from-yellow-600 to-red-600 rounded-full"
            style={{
              left: `${minPercentage}%`,
              right: `${100 - maxPercentage}%`,
            }}
          />

          {/* Min thumb */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 
              ${isDraggingMin ? 'bg-yellow-400 shadow-lg shadow-yellow-500/30' : 'bg-yellow-500 hover:bg-yellow-400'} 
              border-2 border-yellow-400 rounded-full cursor-grab transition-all duration-200 
              ${isDraggingMin ? 'cursor-grabbing scale-110' : 'hover:scale-105'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-primary-900`}
            style={{ left: `${minPercentage}%` }}
            onMouseDown={handleMinMouseDown}
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-label={`${label} 最小值`}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={tempMinValue}
            aria-valuetext={formatLabel(tempMinValue)}
          />

          {/* Max thumb */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 
              ${isDraggingMax ? 'bg-red-400 shadow-lg shadow-red-500/30' : 'bg-red-500 hover:bg-red-400'} 
              border-2 border-red-400 rounded-full cursor-grab transition-all duration-200 
              ${isDraggingMax ? 'cursor-grabbing scale-110' : 'hover:scale-105'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-primary-900`}
            style={{ left: `${maxPercentage}%` }}
            onMouseDown={handleMaxMouseDown}
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-label={`${label} 最大值`}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={tempMaxValue}
            aria-valuetext={formatLabel(tempMaxValue)}
          />
        </div>

        {/* Labels */}
        <div className="flex justify-between mt-2 text-xs text-primary-400">
          <span>{formatLabel(min)}</span>
          <span>{formatLabel(max)}</span>
        </div>
      </div>

      {/* Value explanation */}
      <div className="mt-3 p-3 bg-primary-800 rounded-md border border-primary-700">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-primary-300">
              警告閾值: {formatLabel(tempMinValue)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-primary-300">
              危險閾值: {formatLabel(tempMaxValue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
