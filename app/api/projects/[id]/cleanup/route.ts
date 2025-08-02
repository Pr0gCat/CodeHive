import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { TaskRecovery } from '@/lib/tasks/task-recovery';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  try {
    const body = await request.json();
    const { reason = 'manual_cleanup' } = body;

    console.log(`🧹 Starting cleanup for project ${projectId}, reason: ${reason}`);

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if project is in a state that can be cleaned up
    if (project.status === 'ACTIVE') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot clean up an active project. Please use the normal project deletion process.' 
        },
        { status: 400 }
      );
    }

    // Find the most recent task for this project to get the task ID
    const recentTask = await prisma.taskExecution.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    const taskId = recentTask?.taskId || `cleanup-${Date.now()}`;

    // Perform comprehensive cleanup
    const cleanupResult = await TaskRecovery.cleanupCancelledProject(projectId, taskId, {
      removeFiles: true,
      removeDatabaseRecord: true,
      reason,
    });

    // Check if cleanup was successful (no errors and at least one operation succeeded)
    const isSuccessful = cleanupResult.errors.length === 0 && 
                        (cleanupResult.databaseCleanup || cleanupResult.filesCleanup);

    if (isSuccessful) {
      console.log('✅ Project cleanup completed successfully:', cleanupResult);
      
      return NextResponse.json({
        success: true,
        message: 'Project cleaned up successfully',
        data: {
          projectId,
          cleanupSummary: cleanupResult,
        },
      });
    } else {
      console.error('❌ Project cleanup failed:', cleanupResult);
      
      return NextResponse.json(
        {
          success: false,
          error: cleanupResult.errors.length > 0 ? cleanupResult.errors.join('; ') : 'Cleanup failed',
          details: cleanupResult,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Error during project cleanup:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clean up project',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}