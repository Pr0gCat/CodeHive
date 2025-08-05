'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Code,
  FileText,
  Zap,
  Layers,
} from 'lucide-react';

interface Tab {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const tabs: Tab[] = [
  {
    id: 'overview',
    name: 'Overview',
    icon: Layers,
    description: 'High-level progress + urgent queries',
  },
  {
    id: 'epics',
    name: 'Epics',
    icon: FileText,
    description: 'Epic-level breakdown and status',
  },
  {
    id: 'stories',
    name: 'Stories',
    icon: BarChart3,
    description: 'Story-level task progress',
  },
  {
    id: 'development',
    name: 'Development',
    icon: Code,
    description: 'Live TDD cycle execution',
  },
  {
    id: 'resources',
    name: 'Resources',
    icon: Zap,
    description: 'Token usage and constraints',
  },
];

interface ImprovedProjectLayoutProps {
  projectId: string;
  projectName?: string;
  children: React.ReactNode;
  urgentQueriesCount?: number;
}

export function ImprovedProjectLayout({
  projectId,
  projectName = 'CodeHive Project',
  children,
  urgentQueriesCount = 0,
}: ImprovedProjectLayoutProps) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Clean Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {projectName}
                </h1>
                <p className="text-sm text-gray-500">
                  AI-Native Development Platform
                </p>
              </div>
              {urgentQueriesCount > 0 && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-red-100 text-red-800 rounded-full">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {urgentQueriesCount} urgent{' '}
                    {urgentQueriesCount === 1 ? 'query' : 'queries'}
                  </span>
                </div>
              )}
            </div>
            <div className="text-sm text-gray-500">Project ID: {projectId}</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon
                    className={`mr-2 h-5 w-5 ${
                      isActive
                        ? 'text-indigo-500'
                        : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                  {tab.name}
                  {tab.id === 'overview' && urgentQueriesCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                      {urgentQueriesCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Description */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <p className="text-sm text-gray-600">
            {tabs.find(tab => tab.id === activeTab)?.description}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
}
