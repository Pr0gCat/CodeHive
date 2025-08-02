'use client';

import { useState } from 'react';
import { AlertTriangle, BarChart3, Code, FileText, Zap, Layers } from 'lucide-react';
import { ImprovedProjectOverview } from './ImprovedProjectOverview';
import { EpicsTab } from './tabs/EpicsTab';
import { StoriesTab } from './tabs/StoriesTab';
import { DevelopmentTab } from './tabs/DevelopmentTab';
import { ResourcesTab } from './tabs/ResourcesTab';

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
    description: 'High-level progress + urgent queries'
  },
  {
    id: 'epics',
    name: 'Epics',
    icon: FileText,
    description: 'Epic-level breakdown and status'
  },
  {
    id: 'stories',
    name: 'Stories',
    icon: BarChart3,
    description: 'Story-level task progress'
  },
  {
    id: 'development',
    name: 'Development',
    icon: Code,
    description: 'Live TDD cycle execution'
  },
  {
    id: 'resources',
    name: 'Resources',
    icon: Zap,
    description: 'Token usage and constraints'
  },
];

interface ProjectTabsProps {
  projectId: string;
  urgentQueriesCount?: number;
}

export function ProjectTabs({ projectId, urgentQueriesCount = 0 }: ProjectTabsProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <ImprovedProjectOverview projectId={projectId} />;
      case 'epics':
        return <EpicsTab projectId={projectId} />;
      case 'stories':
        return <StoriesTab projectId={projectId} />;
      case 'development':
        return <DevelopmentTab projectId={projectId} />;
      case 'resources':
        return <ResourcesTab projectId={projectId} />;
      default:
        return <ImprovedProjectOverview projectId={projectId} />;
    }
  };

  return (
    <div>
      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
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
                <Icon className={`mr-2 h-5 w-5 ${
                  isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
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

      {/* Tab Description */}
      <div className="mb-6">
        <p className="text-sm text-gray-600">
          {tabs.find(tab => tab.id === activeTab)?.description}
        </p>
      </div>

      {/* Tab Content */}
      <div>
        {renderTabContent()}
      </div>
    </div>
  );
}