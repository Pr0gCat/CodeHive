import { prisma } from '@/lib/db';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';

export interface CleanupOptions {
  removeFiles?: boolean;
  removeDatabaseRecord?: boolean;
  reason?: string;
}

/**
 * Task Recovery System - handles cleanup and rollback for cancelled/failed tasks
 */
export class TaskRecovery {
  /**
   * Clean up a cancelled or failed project creation/import task
   */
  static async cleanupCancelledProject(
    projectId: string,
    taskId: string,
    options: CleanupOptions = {}
  ) {
    const {
      removeFiles = true,
      removeDatabaseRecord = true,
      reason = 'Task cancelled',
    } = options;

    console.log(`🧹 Starting cleanup for cancelled project: ${projectId}`);
    console.log(`   Task ID: ${taskId}`);
    console.log(`   Reason: ${reason}`);

    const cleanupResults = {
      databaseCleanup: false,
      filesCleanup: false,
      errors: [] as string[],
    };

    try {
      // Get project details before cleanup
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          localPath: true,
          status: true,
        },
      });

      if (!project) {
        console.log(`⚠️ Project ${projectId} not found in database`);
        return cleanupResults;
      }

      console.log(`📋 Found project: ${project.name} at ${project.localPath}`);

      // 1. Clean up filesystem
      if (removeFiles && project.localPath) {
        try {
          if (existsSync(project.localPath)) {
            console.log(`🗂️ Removing directory: ${project.localPath}`);
            await fs.rm(project.localPath, { recursive: true, force: true });
            console.log(`✅ Directory removed successfully`);
            cleanupResults.filesCleanup = true;
          } else {
            console.log(`ℹ️ Directory does not exist: ${project.localPath}`);
            cleanupResults.filesCleanup = true;
          }
        } catch (error) {
          const errorMsg = `Failed to remove directory ${project.localPath}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          cleanupResults.errors.push(errorMsg);
        }
      }

      // 2. Clean up database records
      if (removeDatabaseRecord) {
        try {
          console.log(`🗄️ Removing database records for project ${projectId}`);

          // Remove task-related records first
          await prisma.taskEvent.deleteMany({
            where: { taskId },
          });

          await prisma.taskPhase.deleteMany({
            where: { taskId },
          });

          await prisma.taskExecution.deleteMany({
            where: { taskId },
          });

          // Remove project-related records in proper order
          await prisma.sprintEpic.deleteMany({
            where: { 
              OR: [
                { sprint: { projectId } },
                { epic: { projectId } }
              ]
            },
          });

          await prisma.kanbanCard.deleteMany({
            where: { projectId },
          });

          await prisma.epic.deleteMany({
            where: { projectId },
          });

          await prisma.sprint.deleteMany({
            where: { projectId },
          });

          await prisma.cycle.deleteMany({
            where: { projectId },
          });

          await prisma.query.deleteMany({
            where: { projectId },
          });

          await prisma.queuedTask.deleteMany({
            where: { projectId },
          });

          await prisma.tokenUsage.deleteMany({
            where: { projectId },
          });

          await prisma.projectBudget.deleteMany({
            where: { projectId },
          });

          // Finally remove the project itself
          await prisma.project.delete({
            where: { id: projectId },
          });

          console.log(`✅ Database records removed successfully`);
          cleanupResults.databaseCleanup = true;
        } catch (error) {
          const errorMsg = `Failed to remove database records: ${error}`;
          console.error(`❌ ${errorMsg}`);
          cleanupResults.errors.push(errorMsg);
        }
      }

      console.log(`🎯 Cleanup completed for project ${project.name}`);
      
      return cleanupResults;
    } catch (error) {
      const errorMsg = `Unexpected error during cleanup: ${error}`;
      console.error(`❌ ${errorMsg}`);
      cleanupResults.errors.push(errorMsg);
      return cleanupResults;
    }
  }

  /**
   * Get list of projects that can be cleaned up (INITIALIZING status for more than 30 minutes)
   */
  static async getStaleProjects() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const staleProjects = await prisma.project.findMany({
      where: {
        status: 'INITIALIZING',
        createdAt: { lt: thirtyMinutesAgo },
      },
      select: {
        id: true,
        name: true,
        localPath: true,
        createdAt: true,
        status: true,
      },
    });

    return staleProjects;
  }
}