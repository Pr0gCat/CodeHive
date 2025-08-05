import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma as db } from '@/lib/db';
import { SprintList } from '@/components/sprints/SprintList';

interface SprintsPageProps {
  params: Promise<{ id: string }>;
}

export default async function SprintsPage({ params }: SprintsPageProps) {
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          sprints: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sprint 管理</h1>
            <p className="mt-1 text-sm text-gray-600">
              {project.name} - 共 {project._count.sprints} 個 Sprint
            </p>
          </div>
          <Link
            href={`/projects/${id}/sprints/new`}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            新增 Sprint
          </Link>
        </div>
      </div>

      <SprintList projectId={id} />
    </div>
  );
}
