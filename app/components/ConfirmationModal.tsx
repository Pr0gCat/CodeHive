'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmationModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: 'text-red-400',
          confirmButton: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
          border: 'border-red-700',
        };
      case 'warning':
        return {
          icon: 'text-yellow-400',
          confirmButton: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
          border: 'border-yellow-700',
        };
      case 'info':
        return {
          icon: 'text-blue-400',
          confirmButton: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
          border: 'border-blue-700',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className={`
          relative w-full max-w-md rounded-lg bg-primary-900 shadow-xl
          border ${styles.border}
          transform transition-all duration-200 ease-out
        `}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4">
            <div className="flex items-center">
              <AlertTriangle className={`w-6 h-6 mr-3 ${styles.icon}`} />
              <h3 className="text-lg font-semibold text-accent-50">
                {title}
              </h3>
            </div>
            {!isLoading && (
              <button
                onClick={onClose}
                className="text-primary-400 hover:text-accent-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            <p className="text-primary-300 whitespace-pre-line">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 px-6 pb-6">
            <button
              onClick={onClose}
              disabled={isLoading}
              className={`
                px-4 py-2 text-primary-200 bg-primary-800 border border-primary-700 
                rounded-md transition-colors
                ${
                  isLoading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-primary-700 hover:text-accent-50 focus:outline-none focus:ring-2 focus:ring-primary-500'
                }
              `}
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`
                px-4 py-2 text-white font-medium rounded-md transition-colors
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary-900
                ${styles.confirmButton}
                ${
                  isLoading
                    ? 'opacity-75 cursor-not-allowed'
                    : ''
                }
              `}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Processing...
                </span>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}