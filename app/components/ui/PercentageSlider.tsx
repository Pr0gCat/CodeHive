'use client';

import React from 'react';
import Slider from './Slider';

interface PercentageSliderProps {
  value: number; // 0.0 to 1.0
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  label: string;
  help?: string;
  color?: 'accent' | 'blue' | 'green' | 'red' | 'yellow';
  min?: number;
  max?: number;
  step?: number;
  markers?: Array<{ value: number; label: string }>;
}

export default function PercentageSlider({
  value,
  onChange,
  disabled = false,
  className = '',
  label,
  help,
  color = 'accent',
  min = 0,
  max = 1,
  step = 0.01,
  markers = [],
}: PercentageSliderProps) {
  const formatPercentage = (decimal: number): string => {
    return `${Math.round(decimal * 100)}%`;
  };

  const defaultMarkers = markers.length > 0 ? markers : [
    { value: 0.25, label: '25%' },
    { value: 0.5, label: '50%' },
    { value: 0.75, label: '75%' },
  ];

  return (
    <div className={className}>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-primary-300">
            {label}
          </label>
          <div className="text-xs text-primary-400">
            {formatPercentage(min)} - {formatPercentage(max)}
          </div>
        </div>
        {help && (
          <p className="text-xs text-primary-500 mb-4">
            {help}
          </p>
        )}
      </div>

      <Slider
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        step={step}
        disabled={disabled}
        color={color}
        size="md"
        formatLabel={formatPercentage}
        showValue={true}
        markers={defaultMarkers}
        aria-label={label}
      />
    </div>
  );
}