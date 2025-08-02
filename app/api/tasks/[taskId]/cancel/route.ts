import { NextRequest, NextResponse } from 'next/server';
import { taskManager } from '@/lib/tasks/task-manager';
import { TaskRecovery } from '@/lib/tasks/task-recovery';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;

  try {
    console.log(`🚫 Received cancellation request for task: ${taskId}`);

    // Get task details first
    const task = await prisma.taskExecution.findUnique({
      where: { taskId },
      select: {
        taskId: true,
        type: true,
        status: true,
        projectId: true,
        projectName: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }

    if (task.status === 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'Task is already completed' },
        { status: 400 }
      );
    }

    if (task.status === 'CANCELLED') {
      return NextResponse.json(
        { success: false, error: 'Task is already cancelled' },
        { status: 400 }
      );
    }

    // Cancel the task
    const cancelResult = await taskManager.cancelTask(taskId, 'User requested cancellation');
    
    if (!cancelResult.success) {
      return NextResponse.json(
        { success: false, error: cancelResult.error },
        { status: 500 }
      );
    }

    // If this is a project creation/import task, clean up the project
    if (task.projectId && (task.type === 'PROJECT_CREATE' || task.type === 'PROJECT_IMPORT')) {
      console.log(`🧹 Starting project cleanup for cancelled task: ${taskId}`);
      
      try {
        const cleanupResult = await TaskRecovery.cleanupCancelledProject(
          task.projectId,
          taskId,
          {
            removeFiles: true,
            removeDatabaseRecord: true,
            reason: 'User cancelled task',
          }
        );

        return NextResponse.json({
          success: true,
          message: 'Task cancelled and project cleaned up successfully',
          details: {
            taskCancelled: true,
            projectCleaned: cleanupResult.databaseCleanup,
            filesRemoved: cleanupResult.filesCleanup,
            errors: cleanupResult.errors,
            projectName: task.projectName,
          },
        });
      } catch (cleanupError) {
        console.error('Error during project cleanup:', cleanupError);
        
        return NextResponse.json({
          success: true,
          message: 'Task cancelled but cleanup failed',
          details: {
            taskCancelled: true,
            projectCleaned: false,
            cleanupError: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
            projectName: task.projectName,
          },
        });
      }
    }

    // For non-project tasks, just return success
    return NextResponse.json({
      success: true,
      message: 'Task cancelled successfully',
      details: {
        taskCancelled: true,
        taskType: task.type,
      },
    });

  } catch (error) {
    console.error('Error cancelling task:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel task',
      },
      { status: 500 }
    );
  }
}