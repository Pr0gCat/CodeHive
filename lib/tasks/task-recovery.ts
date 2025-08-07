import { prisma } from '@/lib/db';
import { TaskManager } from './task-manager';

interface TaskExecution {
  taskId: string;
  phases: Array<{
    phaseId: string;
    status: string;
    order: number;
  }>;
}

interface Project {
  id: string;
  name: string;
  localPath: string | null;
  gitUrl: string | null;
}

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
      // Since we're using portable projects, we only recover active task executions
      // without depending on the database projects table
      
      // Find task executions that are still pending or running
      let activeTasks;
      try {
        activeTasks = await prisma.taskExecution.findMany({
          where: {
            status: { in: ['PENDING', 'RUNNING'] },
          },
          select: {
            taskId: true,
            projectId: true,
            type: true,
            status: true,
            createdAt: true,
          },
        });
      } catch (dbError) {
        // If tables don't exist yet, skip recovery
        if (dbError.code === 'P2021') {
          console.log('Database tables not initialized yet, skipping task recovery');
          return;
        }
        throw dbError; // Re-throw if it's a different error
      }

      if (activeTasks.length === 0) {
        console.log('No interrupted initialization tasks to recover');
        return;
      }

      console.log(
        `🔍 Found ${activeTasks.length} active task executions to clean up`
      );

      // Mark stale tasks as failed (older than 1 hour)
      const staleThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      let recoveredCount = 0;

      for (const task of activeTasks) {
        if (task.createdAt < staleThreshold) {
          await this.failStaleTask(task.taskId, task.projectId);
          recoveredCount++;
          console.log(`🔧 Marked stale task as failed: ${task.taskId}`);
        }
      }

      if (recoveredCount > 0) {
        console.log(`🔧 Recovered ${recoveredCount} stale tasks`);
      }

      console.log('Task recovery process completed');
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
    taskExecution: TaskExecution,
    project: Project
  ): Promise<void> {
    try {
      // Check what phase was last active
      const lastActivePhase = taskExecution.phases.find(
        (p) => p.status === 'ACTIVE'
      );
      const lastCompletedPhase = taskExecution.phases
        .filter((p) => p.status === 'COMPLETED')
        .sort((a, b) => b.order - a.order)[0];

      console.log(
        `Last active phase: ${lastActivePhase?.phaseId || 'none'}, Last completed: ${lastCompletedPhase?.phaseId || 'none'}`
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
    taskExecution: TaskExecution,
    project: Project
  ): Promise<void> {
    try {
      // Check what phase was last active
      const lastActivePhase = taskExecution.phases.find(
        (p) => p.status === 'ACTIVE'
      );

      console.log(`Resuming import from phase: ${lastActivePhase?.phaseId || 'beginning'}`);

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
   * Clean up old orphaned tasks automatically
   * Note: Updated for portable project system - cleans tasks not projects
   */
  async cleanupOrphanedProjects(maxAgeHours: number = 24): Promise<number> {
    console.log(`🧹 Cleaning up orphaned projects older than ${maxAgeHours} hours`);
    
    // For portable projects, we just clean up old task executions
    // The projects themselves are managed through the portable system
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    let oldTasks;
    try {
      oldTasks = await prisma.taskExecution.findMany({
        where: {
          status: { in: ['PENDING', 'RUNNING'] },
          createdAt: { lt: cutoffTime },
        },
        select: {
          taskId: true,
          projectId: true,
          type: true,
        },
      });
    } catch (dbError) {
      // If tables don't exist yet, skip cleanup
      if (dbError.code === 'P2021') {
        console.log('Database tables not initialized yet, skipping cleanup');
        return 0;
      }
      throw dbError; // Re-throw if it's a different error
    }

    let cleanedCount = 0;
    
    for (const task of oldTasks) {
      await this.failStaleTask(task.taskId, task.projectId);
      cleanedCount++;
      console.log(`🗑️ Cleaned up orphaned task: ${task.taskId} (${task.type})`);
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} orphaned tasks`);
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
            console.log(`Orphaned project ${project.name} appears complete, marking as ACTIVE`);
            await prisma.projectIndex.update({
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
    await prisma.projectIndex.update({
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
    const initializingCount = await prisma.projectIndex.count({
      where: { status: 'INITIALIZING' },
    });

    stats.totalInitializing = initializingCount;
    return stats;
  }

  /**
   * Get stale projects that need recovery (for backward compatibility)
   */
  async getStaleProjects(): Promise<Array<{
    id: string;
    name: string;
    localPath: string | null;
    gitUrl: string | null;
    createdAt: Date;
  }>> {
    return await prisma.projectIndex.findMany({
      where: { status: 'INITIALIZING' },
      select: {
        id: true,
        name: true,
        localPath: true,
        gitUrl: true,
        createdAt: true,
      },
    });
  }

  /**
   * Cleanup a cancelled project (for backward compatibility)
   */
  async cleanupCancelledProject(
    projectId: string,
    taskId: string,
    options: { reason: string }
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🧹 Cleaning up cancelled project: ${projectId}`);

      // Find the project
      const project = await prisma.projectIndex.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        return {
          success: false,
          message: `Project ${projectId} not found`,
        };
      }

      // Mark any active tasks as failed
      await prisma.taskExecution.updateMany({
        where: {
          projectId: projectId,
          status: { in: ['PENDING', 'RUNNING'] },
        },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          result: JSON.stringify({
            success: false,
            error: options.reason,
            cancelledAt: new Date().toISOString(),
          }),
        },
      });

      // Mark project as archived  
      await this.markProjectAsFailed(projectId, options.reason);

      return {
        success: true,
        message: `Project ${projectId} cleaned up successfully`,
      };
    } catch (error) {
      console.error(`Error cleaning up project ${projectId}:`, error);
      return {
        success: false,
        message: `Failed to clean up project: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Export singleton instance
export const taskRecoveryService = TaskRecoveryService.getInstance();