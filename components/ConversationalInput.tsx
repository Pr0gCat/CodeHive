'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ConversationalInputProps {
  onSubmit: (message: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
}

export function ConversationalInput({
  onSubmit,
  placeholder = 'Tell me what you want to build...',
  disabled = false,
}: ConversationalInputProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;

    const message = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      await onSubmit(message);
    } catch (error) {
      console.error('Error submitting message:', error);
      // In a real app, show user-friendly error
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-primary-900 rounded-lg border border-primary-700 shadow-sm">
      <form onSubmit={handleSubmit} className="flex items-end gap-3 p-4">
        <div className="flex-1">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={3}
            className="w-full resize-none border-0 focus:ring-0 text-accent-50 placeholder-primary-400 bg-transparent"
            style={{ outline: 'none' }}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isLoading || disabled}
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-accent-600 text-accent-50 hover:bg-accent-700 disabled:bg-primary-700 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </form>

      {/* Helper text */}
      <div className="px-4 pb-3 text-xs text-primary-400">
        按下{' '}
        <kbd className="px-1 py-0.5 bg-primary-800 rounded text-primary-300">
          Enter
        </kbd>{' '}
        發送,
        <kbd className="px-1 py-0.5 bg-primary-800 rounded text-primary-300 ml-1">
          Shift+Enter
        </kbd>{' '}
        換行
      </div>
    </div>
  );
}
