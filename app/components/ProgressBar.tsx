'use client';

interface ProgressBarProps {
  total: number;
  completed: number;
  className?: string;
  showPercentage?: boolean;
}

export default function ProgressBar({ 
  total, 
  completed, 
  className = '', 
  showPercentage = true 
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="flex-1 bg-primary-800 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-accent-600 to-accent-500 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showPercentage && (
        <span className="text-xs text-primary-400 font-medium min-w-[3rem] text-right">
          {percentage}%
        </span>
      )}
    </div>
  );
}