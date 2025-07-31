'use client';

import React from 'react';
import Slider from './Slider';

interface RateLimitSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
}

export default function RateLimitSlider({
  value,
  onChange,
  disabled = false,
  className = '',
  min = 10,
  max = 100,
  step = 5,
}: RateLimitSliderProps) {
  const formatValue = (val: number): string => {
    return `${val} 次/分鐘`;
  };

  // Define markers for common rate limits
  const markers = [
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 80, label: '80' },
  ];

  return (
    <div className={className}>
      <Slider
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        step={step}
        disabled={disabled}
        color="accent"
        size="md"
        formatLabel={formatValue}
        showValue={true}
        markers={markers}
        aria-label="API 速率限制"
      />
    </div>
  );
}