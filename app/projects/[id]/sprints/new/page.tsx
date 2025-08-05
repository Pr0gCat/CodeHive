import { notFound } from 'next/navigation';
import { prisma as db } from '@/lib/db';
import { SprintForm } from '@/components/sprints/SprintForm';

interface NewSprintPageProps {
  params: Promise<{ id: string }>;
}

export default async function NewSprintPage({ params }: NewSprintPageProps) {
  const { id } = await params;

  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">創建新 Sprint</h1>
        <p className="mt-1 text-sm text-gray-600">{project.name}</p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <SprintForm projectId={id} />
      </div>
    </div>
  );
}
