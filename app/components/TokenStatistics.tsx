'use client';

import { useState, useEffect } from 'react';
import { formatShortNumber } from '@/lib/utils';

interface TokenStats {
  total: {
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    requests: number;
  };
  today: {
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    requests: number;
  };
  week: {
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    requests: number;
  };
  byAgent: Array<{
    agentType: string;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    requests: number;
  }>;
}

export default function TokenStatistics() {
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTokenStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchTokenStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchTokenStats = async () => {
    try {
      const response = await fetch('/api/tokens/total');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch token statistics');
      }
    } catch (err) {
      setError('Failed to fetch token statistics');
    } finally {
      setLoading(false);
    }
  };


  const getAgentIcon = (agentType: string): string => {
    switch (agentType) {
      case 'code-analyzer': return '🔍';
      case 'test-runner': return '🧪';
      case 'git-operations': return '📚';
      case 'documentation': return '📝';
      case 'project-manager-review': return '📋';
      case 'file-writer': return '💾';
      default: return '🤖';
    }
  };

  if (loading) {
    return (
      <div className="bg-primary-900 rounded-lg p-6 border border-primary-700">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-600 mx-auto mb-4"></div>
          <p className="text-primary-400">Loading token statistics...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-primary-900 rounded-lg p-6 border border-primary-700">
        <div className="text-center text-red-400">
          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary-900 rounded-lg p-6 border border-primary-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-accent-50 flex items-center">
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Token Usage Statistics
        </h2>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Total Tokens */}
        <div className="bg-primary-800 rounded-lg p-4 border border-primary-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-primary-300">Total Tokens</p>
              <p className="text-2xl font-bold text-accent-50">{formatShortNumber(stats.total.tokens)}</p>
              <p className="text-xs text-primary-400">{stats.total.requests} requests</p>
            </div>
            <div className="text-3xl text-accent-500">🔥</div>
          </div>
        </div>

        {/* Today's Tokens */}
        <div className="bg-primary-800 rounded-lg p-4 border border-primary-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-primary-300">Today</p>
              <p className="text-2xl font-bold text-accent-50">{formatShortNumber(stats.today.tokens)}</p>
              <p className="text-xs text-primary-400">{stats.today.requests} requests</p>
            </div>
            <div className="text-3xl text-blue-500">📅</div>
          </div>
        </div>

        {/* This Week */}
        <div className="bg-primary-800 rounded-lg p-4 border border-primary-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-primary-300">This Week</p>
              <p className="text-2xl font-bold text-accent-50">{formatShortNumber(stats.week.tokens)}</p>
              <p className="text-xs text-primary-400">{stats.week.requests} requests</p>
            </div>
            <div className="text-3xl text-green-500">📊</div>
          </div>
        </div>
      </div>

      {/* Token Breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-primary-800 rounded-lg p-4 border border-primary-600">
          <p className="text-sm text-primary-300 mb-2">Input Tokens</p>
          <p className="text-lg font-semibold text-accent-50">{formatShortNumber(stats.total.inputTokens)}</p>
          <div className="w-full bg-primary-700 rounded-full h-2 mt-2">
            <div 
              className="bg-blue-500 h-2 rounded-full" 
              style={{ 
                width: `${stats.total.tokens > 0 ? (stats.total.inputTokens / stats.total.tokens) * 100 : 0}%` 
              }}
            ></div>
          </div>
        </div>

        <div className="bg-primary-800 rounded-lg p-4 border border-primary-600">
          <p className="text-sm text-primary-300 mb-2">Output Tokens</p>
          <p className="text-lg font-semibold text-accent-50">{formatShortNumber(stats.total.outputTokens)}</p>
          <div className="w-full bg-primary-700 rounded-full h-2 mt-2">
            <div 
              className="bg-green-500 h-2 rounded-full" 
              style={{ 
                width: `${stats.total.tokens > 0 ? (stats.total.outputTokens / stats.total.tokens) * 100 : 0}%` 
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Agent Usage */}
      {stats.byAgent.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-accent-50 mb-4">Usage by Agent</h3>
          <div className="space-y-3">
            {stats.byAgent.slice(0, 5).map((agent, index) => (
              <div key={agent.agentType} className="flex items-center justify-between bg-primary-800 rounded-lg p-3 border border-primary-600">
                <div className="flex items-center">
                  <span className="text-xl mr-3">{getAgentIcon(agent.agentType)}</span>
                  <div>
                    <p className="text-sm font-medium text-accent-50 capitalize">
                      {agent.agentType.replace('-', ' ')}
                    </p>
                    <p className="text-xs text-primary-400">{agent.requests} requests</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-accent-50">{formatShortNumber(agent.tokens)}</p>
                  <p className="text-xs text-primary-400">
                    {formatShortNumber(agent.inputTokens)}↑ {formatShortNumber(agent.outputTokens)}↓
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}