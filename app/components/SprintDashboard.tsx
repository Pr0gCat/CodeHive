'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { SprintList } from './sprints/SprintList';

interface SprintDashboardProps {
  projectId: string;
}

export default function SprintDashboard({ projectId }: SprintDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-accent-50">Sprint 管理</h2>
          <p className="mt-1 text-sm text-primary-300">
            管理專案的 Sprint 週期，追蹤開發進度
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/sprints/new`}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-accent-600 hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          新增 Sprint
        </Link>
      </div>

      {/* Sprint List */}
      <SprintList projectId={projectId} />
    </div>
  );
}