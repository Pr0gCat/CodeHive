'use client';

import React from 'react';
import Slider from './Slider';

interface PrioritySliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export default function PrioritySlider({
  value,
  onChange,
  disabled = false,
  className = '',
}: PrioritySliderProps) {
  const formatValue = (val: number): string => {
    return val.toString();
  };

  const getPriorityLabel = (val: number): string => {
    if (val <= 3) return 'Low';
    if (val <= 7) return 'Medium';
    return 'High';
  };

  const getPriorityColor = (val: number): 'green' | 'yellow' | 'red' => {
    if (val <= 3) return 'green';
    if (val <= 7) return 'yellow';
    return 'red';
  };

  // Define markers for priority levels
  const markers = [
    { value: 1, label: '1' },
    { value: 5, label: '5' },
    { value: 10, label: '10' },
  ];

  return (
    <div className={className}>
      <div className="mb-2">
        <Slider
          min={1}
          max={10}
          value={value}
          onChange={onChange}
          step={1}
          disabled={disabled}
          color={getPriorityColor(value)}
          size="md"
          formatLabel={formatValue}
          showValue={true}
          markers={markers}
          aria-label="Task Priority"
        />
      </div>
      <div className="text-center text-sm text-primary-400">
        Priority: <span className="font-medium">{getPriorityLabel(value)}</span>
      </div>
    </div>
  );
}
