import { NextRequest, NextResponse } from 'next/server';
import { taskRecoveryService } from '@/lib/tasks/task-recovery';
import { prisma } from '@/lib/db';

/**
 * Manual task recovery endpoint for administrative purposes
 */
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json().catch(() => ({ action: 'recover' }));

    switch (action) {
      case 'recover':
        console.log('🔄 Manual task recovery triggered');
        await taskRecoveryService.recoverInterruptedTasks();
        
        const stats = await taskRecoveryService.getRecoveryStats();
        
        return NextResponse.json({
          success: true,
          message: 'Task recovery process completed',
          stats,
        });

      case 'stats':
        const currentStats = await taskRecoveryService.getRecoveryStats();
        
        // Get additional current statistics
        const [
          initializingProjects,
          pendingTasks,
          runningTasks,
          failedTasks,
        ] = await Promise.all([
          prisma.project.findMany({
            where: { status: 'INITIALIZING' },
            select: { id: true, name: true, createdAt: true },
          }),
          prisma.taskExecution.count({
            where: { status: 'PENDING' },
          }),
          prisma.taskExecution.count({
            where: { status: 'RUNNING' },
          }),
          prisma.taskExecution.count({
            where: { status: 'FAILED' },
          }),
        ]);

        return NextResponse.json({
          success: true,
          stats: {
            ...currentStats,
            details: {
              initializingProjects,
              tasks: {
                pending: pendingTasks,
                running: runningTasks,
                failed: failedTasks,
              },
            },
          },
        });

      case 'cleanup':
        // Clean up old failed tasks (older than 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const cleanupResult = await prisma.taskExecution.deleteMany({
          where: {
            status: 'FAILED',
            createdAt: { lt: oneDayAgo },
          },
        });

        return NextResponse.json({
          success: true,
          message: `Cleaned up ${cleanupResult.count} old failed tasks`,
          cleanedCount: cleanupResult.count,
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: recover, stats, or cleanup' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Task recovery API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { success: false, error: `Task recovery failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * Get current recovery status
 */
export async function GET() {
  try {
    const stats = await taskRecoveryService.getRecoveryStats();
    
    // Get current system status
    const [
      totalProjects,
      initializingProjects,
      activeProjects,
      archivedProjects,
      totalTasks,
      pendingTasks,
      runningTasks,
      completedTasks,
      failedTasks,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { status: 'INITIALIZING' } }),
      prisma.project.count({ where: { status: 'ACTIVE' } }),
      prisma.project.count({ where: { status: 'ARCHIVED' } }),
      prisma.taskExecution.count(),
      prisma.taskExecution.count({ where: { status: 'PENDING' } }),
      prisma.taskExecution.count({ where: { status: 'RUNNING' } }),
      prisma.taskExecution.count({ where: { status: 'COMPLETED' } }),
      prisma.taskExecution.count({ where: { status: 'FAILED' } }),
    ]);

    return NextResponse.json({
      success: true,
      systemStatus: {
        projects: {
          total: totalProjects,
          initializing: initializingProjects,
          active: activeProjects,
          archived: archivedProjects,
        },
        tasks: {
          total: totalTasks,
          pending: pendingTasks,
          running: runningTasks,
          completed: completedTasks,
          failed: failedTasks,
        },
      },
      recoveryStats: stats,
      needsRecovery: initializingProjects > 0 || pendingTasks > 0,
    });
  } catch (error) {
    console.error('Task recovery status error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}