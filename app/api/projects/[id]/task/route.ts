import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  try {
    // Find the active or recent task for this project
    const activeTask = await prisma.taskExecution.findFirst({
      where: {
        projectId,
        status: { in: ['PENDING', 'RUNNING', 'FAILED', 'CANCELLED'] },
      },
      include: {
        phases: { orderBy: { order: 'asc' } },
        events: {
          orderBy: { timestamp: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeTask) {
      return NextResponse.json(
        { success: false, error: 'No task found for this project' },
        { status: 404 }
      );
    }

    // Calculate current progress
    const currentPhase = activeTask.phases.find(p => p.status === 'ACTIVE');
    const completedPhases = activeTask.phases.filter(
      p => p.status === 'COMPLETED'
    );
    const totalProgress =
      activeTask.totalPhases > 0
        ? ((completedPhases.length + (currentPhase?.progress || 0) / 100) /
            activeTask.totalPhases) *
          100
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        taskId: activeTask.taskId,
        taskType: activeTask.type,
        status: activeTask.status,
        currentPhase: currentPhase?.title || currentPhase?.phaseId,
        progress: Math.round(totalProgress),
        message: activeTask.events[0]?.message || 'Processing...',
        createdAt: activeTask.createdAt,
        phases: activeTask.phases.map(phase => ({
          id: phase.phaseId,
          title: phase.title,
          status: phase.status,
          progress: phase.progress,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching project task:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch project task information',
      },
      { status: 500 }
    );
  }
}
