'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';

interface ImprovedArchitectureLinkProps {
  projectId: string;
}

export function ImprovedArchitectureLink({
  projectId,
}: ImprovedArchitectureLinkProps) {
  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Sparkles className="h-8 w-8 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Try the New AI-Native Interface
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Experience the improved architecture with conversational
              development, autonomous AI agents, and real-time coordination.
            </p>
          </div>
        </div>
        <Link
          href={`/projects/${projectId}/improved`}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
        >
          Try Improved Interface
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Conversational Input
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          Autonomous Agents
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          Token-Based Reality
        </span>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Interactive Queries
        </span>
      </div>
    </div>
  );
}
