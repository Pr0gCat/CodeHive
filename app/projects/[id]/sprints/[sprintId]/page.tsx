import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { prisma as db } from '@/lib/db';
import { SprintBoard } from '@/app/components/sprints/SprintBoard';
import { SprintBurndown } from '@/app/components/sprints/SprintBurndown';
import { SprintActions } from '@/app/components/sprints/SprintActions';
import { SprintPlanningWrapper } from '@/app/components/sprints/SprintPlanningWrapper';

interface SprintDetailPageProps {
  params: Promise<{ id: string; sprintId: string }>;
}

export default async function SprintDetailPage({ params }: SprintDetailPageProps) {
  const { id: projectId, sprintId } = await params;

  const sprint = await db.sprint.findUnique({
    where: { id: sprintId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      stories: {
        include: {
          epic: {
            select: {
              id: true,
              title: true,
              type: true,
            },
          },
        },
        orderBy: { position: 'asc' },
      },
      sprintEpics: {
        include: {
          epic: true,
        },
      },
      _count: {
        select: {
          stories: true,
        },
      },
    },
  });

  if (!sprint || sprint.project.id !== projectId) {
    notFound();
  }

  const getStatusBadge = () => {
    const statusColors = {
      PLANNING: 'bg-gray-100 text-gray-800',
      ACTIVE: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          statusColors[sprint.status as keyof typeof statusColors]
        }`}
      >
        {sprint.status}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              {sprint.name}
              {getStatusBadge()}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {sprint.project.name} • {format(new Date(sprint.startDate), 'MMM d')} -{' '}
              {format(new Date(sprint.endDate), 'MMM d, yyyy')}
            </p>
            {sprint.goal && (
              <p className="mt-2 text-gray-700">{sprint.goal}</p>
            )}
          </div>
          <SprintActions sprint={sprint} />
        </div>

        {/* Sprint Metrics */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">計劃點數</p>
            <p className="text-2xl font-semibold text-gray-900">
              {sprint.plannedStoryPoints}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">承諾點數</p>
            <p className="text-2xl font-semibold text-gray-900">
              {sprint.commitedStoryPoints}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">完成點數</p>
            <p className="text-2xl font-semibold text-gray-900">
              {sprint.completedStoryPoints}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">速度</p>
            <p className="text-2xl font-semibold text-gray-900">
              {sprint.velocity ? `${sprint.velocity.toFixed(1)}` : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Burndown Chart */}
      {sprint.status === 'ACTIVE' && (
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">燃盡圖</h2>
          <SprintBurndown sprintId={sprintId} />
        </div>
      )}

      {/* Sprint Planning for PLANNING status */}
      {sprint.status === 'PLANNING' && (
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Sprint 規劃</h2>
          <SprintPlanningWrapper sprint={sprint} projectId={projectId} />
        </div>
      )}

      {/* Sprint Board */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Sprint 看板</h2>
        <SprintBoard
          sprintId={sprintId}
          stories={sprint.stories}
          onStoryUpdate={async (storyId, status) => {
            // This will be handled by client-side component
            console.log('Story update:', storyId, status);
          }}
        />
      </div>

      {/* Sprint Epics */}
      {sprint.sprintEpics.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">相關史詩</h2>
          <div className="space-y-3">
            {sprint.sprintEpics.map((se: any) => (
              <div
                key={se.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <h3 className="font-medium text-gray-900">{se.epic.title}</h3>
                  <p className="text-sm text-gray-600">
                    類型: {se.epic.type} • 優先級: {se.epic.mvpPriority}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    {se.completedStoryPoints} / {se.plannedStoryPoints} 點
                  </p>
                  {se.plannedStoryPoints > 0 && (
                    <div className="mt-1 w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{
                          width: `${
                            (se.completedStoryPoints / se.plannedStoryPoints) * 100
                          }%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}