import { prisma } from '@/lib/db';
import { TaskManager } from './task-manager';

/**
 * Task Recovery Service
 * 
 * Handles recovery of interrupted tasks during application startup.
 * This ensures that projects stuck in INITIALIZING state are properly resumed.
 */
export class TaskRecoveryService {
  private static instance: TaskRecoveryService;
  private taskManager: TaskManager;

  constructor() {
    this.taskManager = TaskManager.getInstance();
  }

  static getInstance(): TaskRecoveryService {
    if (!TaskRecoveryService.instance) {
      TaskRecoveryService.instance = new TaskRecoveryService();
    }
    return TaskRecoveryService.instance;
  }

  /**
   * Scan and recover all interrupted tasks on application startup
   */
  async recoverInterruptedTasks(): Promise<void> {
    console.log('🔄 Starting task recovery process...');

    try {
      // 1. First, clean up old orphaned projects (older than 24 hours)
      const cleanedCount = await this.cleanupOrphanedProjects(24);
      
      // 2. Find all remaining projects in INITIALIZING state
      const initializingProjects = await prisma.project.findMany({
        where: { status: 'INITIALIZING' },
        select: {
          id: true,
          name: true,
          localPath: true,
          gitUrl: true,
          createdAt: true,
        },
      });

      if (initializingProjects.length === 0) {
        console.log('✅ No interrupted initialization tasks to recover');
        if (cleanedCount > 0) {
          console.log(`🧹 Cleaned up ${cleanedCount} old orphaned projects`);
        }
        return;
      }

      console.log(
        `🔍 Found ${initializingProjects.length} projects in INITIALIZING state (after cleanup)`
      );

      // 3. Process each interrupted project
      for (const project of initializingProjects) {
        await this.recoverProjectTask(project);
      }

      console.log('✅ Task recovery process completed');
    } catch (error) {
      console.error('❌ Error during task recovery:', error);
    }
  }

  /**
   * Recover a specific project's initialization task
   */
  private async recoverProjectTask(project: {
    id: string;
    name: string;
    localPath: string | null;
    gitUrl: string | null;
    createdAt: Date;
  }): Promise<void> {
    try {
      console.log(`🔄 Recovering project: ${project.name} (${project.id})`);

      // Find the associated task execution
      const taskExecution = await prisma.taskExecution.findFirst({
        where: {
          projectId: project.id,
          status: { in: ['PENDING', 'RUNNING'] },
        },
        include: {
          phases: { orderBy: { order: 'asc' } },
        },
      });

      if (!taskExecution) {
        // No active task found - this project might be orphaned
        await this.handleOrphanedProject(project);
        return;
      }

      // Check task age - if too old, consider it failed
      const taskAge = Date.now() - taskExecution.createdAt.getTime();
      const maxTaskAge = 30 * 60 * 1000; // 30 minutes

      if (taskAge > maxTaskAge) {
        console.log(
          `⏰ Task ${taskExecution.taskId} is too old (${Math.round(taskAge / 60000)} minutes), marking as failed`
        );
        await this.failStaleTask(taskExecution.taskId, project.id);
        return;
      }

      // Determine task type and resume appropriately
      const taskType = taskExecution.type;
      console.log(`📋 Resuming ${taskType} task: ${taskExecution.taskId}`);

      if (taskType === 'PROJECT_CREATE') {
        await this.resumeProjectCreation(taskExecution, project);
      } else if (taskType === 'PROJECT_IMPORT') {
        await this.resumeProjectImport(taskExecution, project);
      } else {
        console.log(`⚠️ Unknown task type: ${taskType}, marking as failed`);
        await this.failStaleTask(taskExecution.taskId, project.id);
      }
    } catch (error) {
      console.error(`❌ Error recovering project ${project.name}:`, error);
      // Mark project as failed
      await this.markProjectAsFailed(
        project.id,
        `Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Resume project creation task
   */
  private async resumeProjectCreation(
    taskExecution: any,
    project: any
  ): Promise<void> {
    try {
      // Check what phase was last active
      const lastActivePhase = taskExecution.phases.find(
        (p: any) => p.status === 'ACTIVE'
      );
      const lastCompletedPhase = taskExecution.phases
        .filter((p: any) => p.status === 'COMPLETED')
        .sort((a: any, b: any) => b.order - a.order)[0];

      console.log(
        `📊 Last active phase: ${lastActivePhase?.phaseId || 'none'}, Last completed: ${lastCompletedPhase?.phaseId || 'none'}`
      );

      // Restart the creation process from the appropriate phase
      // For safety, we'll restart the entire creation process
      const { createProjectAsync } = await import('@/lib/tasks/project-creation');
      
      await createProjectAsync(taskExecution.taskId, project.id, {
        name: project.name,
        localPath: project.localPath,
        gitUrl: project.gitUrl || undefined,
      });
    } catch (error) {
      console.error('Error resuming project creation:', error);
      await this.failStaleTask(taskExecution.taskId, project.id);
    }
  }

  /**
   * Resume project import task
   */
  private async resumeProjectImport(
    taskExecution: any,
    project: any
  ): Promise<void> {
    try {
      // Check what phase was last active
      const lastActivePhase = taskExecution.phases.find(
        (p: any) => p.status === 'ACTIVE'
      );

      console.log(`📊 Resuming import from phase: ${lastActivePhase?.phaseId || 'beginning'}`);

      // Restart the import process
      // For safety, we'll restart the entire import process
      const { runImportAsync } = await import('@/lib/tasks/project-import');
      
      await runImportAsync(taskExecution.taskId, project.id, {
        projectName: project.name,
        localPath: project.localPath,
        gitUrl: project.gitUrl || undefined,
      });
    } catch (error) {
      console.error('Error resuming project import:', error);
      await this.failStaleTask(taskExecution.taskId, project.id);
    }
  }

  /**
   * Clean up old orphaned projects automatically
   */
  async cleanupOrphanedProjects(maxAgeHours: number = 24): Promise<number> {
    console.log(`🧹 Cleaning up orphaned projects older than ${maxAgeHours} hours`);
    
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    const orphanedProjects = await prisma.project.findMany({
      where: {
        status: 'INITIALIZING',
        createdAt: { lt: cutoffTime },
      },
    });

    let cleanedCount = 0;
    
    for (const project of orphanedProjects) {
      const hasActiveTask = await prisma.taskExecution.findFirst({
        where: {
          projectId: project.id,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      });

      if (!hasActiveTask) {
        await this.markProjectAsFailed(
          project.id,
          `Automatically cleaned up - orphaned for more than ${maxAgeHours} hours`
        );
        cleanedCount++;
        console.log(`🗑️ Cleaned up orphaned project: ${project.name}`);
      }
    }

    if (cleanedCount > 0) {
      console.log(`✅ Cleaned up ${cleanedCount} orphaned projects`);
    }
    
    return cleanedCount;
  }

  /**
   * Handle orphaned projects (INITIALIZING status but no active task)
   */
  private async handleOrphanedProject(project: {
    id: string;
    name: string;
    localPath: string | null;
    gitUrl: string | null;
    createdAt: Date;
  }): Promise<void> {
    console.log(`🚨 Found orphaned project: ${project.name}`);

    // Check if the project was actually created successfully
    if (project.localPath) {
      const { promises: fs } = await import('fs');
      const { gitClient } = await import('@/lib/git');

      try {
        // Check if directory exists and has content
        const stats = await fs.stat(project.localPath);
        if (stats.isDirectory()) {
          const files = await fs.readdir(project.localPath);
          const isGitRepo = await gitClient.isValidRepository(project.localPath);

          if (files.length > 0 && isGitRepo) {
            // Project appears to be successfully created
            console.log(`✅ Orphaned project ${project.name} appears complete, marking as ACTIVE`);
            await prisma.project.update({
              where: { id: project.id },
              data: { status: 'ACTIVE' },
            });
            return;
          }
        }
      } catch (error) {
        console.log(`📁 Project directory doesn't exist or is invalid: ${project.localPath}`);
      }
    }

    // Project is truly orphaned - mark as failed
    await this.markProjectAsFailed(
      project.id,
      'Initialization was interrupted and could not be recovered'
    );
  }

  /**
   * Mark a stale task as failed
   */
  private async failStaleTask(taskId: string, projectId: string): Promise<void> {
    try {
      // Update task execution
      await prisma.taskExecution.update({
        where: { taskId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          result: JSON.stringify({
            success: false,
            error: 'Task was interrupted and could not be recovered',
            recoveredAt: new Date().toISOString(),
          }),
        },
      });

      // Mark project as failed
      await this.markProjectAsFailed(
        projectId,
        'Initialization task failed during recovery'
      );

      console.log(`❌ Marked stale task ${taskId} as failed`);
    } catch (error) {
      console.error(`Error failing stale task ${taskId}:`, error);
    }
  }

  /**
   * Mark a project as failed
   */
  private async markProjectAsFailed(projectId: string, reason: string): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'ARCHIVED',
        description: `初始化失敗: ${reason}`,
      },
    });
    console.log(`🗃️ Marked project ${projectId} as ARCHIVED: ${reason}`);
  }

  /**
   * Get recovery statistics
   */
  async getRecoveryStats(): Promise<{
    totalInitializing: number;
    recovered: number;
    failed: number;
    orphaned: number;
  }> {
    const stats = {
      totalInitializing: 0,
      recovered: 0,
      failed: 0,
      orphaned: 0,
    };

    // This would be populated during the actual recovery process
    // For now, return current state
    const initializingCount = await prisma.project.count({
      where: { status: 'INITIALIZING' },
    });

    stats.totalInitializing = initializingCount;
    return stats;
  }
}

// Export singleton instance
export const taskRecoveryService = TaskRecoveryService.getInstance();