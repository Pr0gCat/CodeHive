import { forwardRef, HTMLAttributes } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline';
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
    const variantClasses = variant === 'outline' 
      ? 'border border-gray-200 bg-white text-gray-900'
      : 'bg-gray-100 text-gray-800';
    
    return (
      <div
        ref={ref}
        className={`${baseClasses} ${variantClasses} ${className}`}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';