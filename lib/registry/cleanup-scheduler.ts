/**
 * Project Registry Cleanup Scheduler
 * Automatically removes orphaned project entries from the system database
 * when their corresponding directories no longer exist in repos/
 */

import { getProjectIndexService } from '../db/project-index';
import { getProjectDiscoveryService } from '../portable/project-discovery';

export interface CleanupSchedulerOptions {
  intervalMinutes?: number;
  runOnStartup?: boolean;
  logVerbose?: boolean;
}

export interface CleanupResult {
  timestamp: Date;
  removed: number;
  archived: number;
  healthChecked: number;
  errors: string[];
}

export class ProjectRegistryCleanupScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastRun: Date | null = null;
  private options: Required<CleanupSchedulerOptions>;

  constructor(options: CleanupSchedulerOptions = {}) {
    this.options = {
      intervalMinutes: options.intervalMinutes ?? 60, // Default: run every hour
      runOnStartup: options.runOnStartup ?? true,
      logVerbose: options.logVerbose ?? true,
    };
  }

  /**
   * Start the cleanup scheduler
   */
  async start(): Promise<void> {
    if (this.intervalId) {
      console.warn('Cleanup scheduler is already running');
      return;
    }

    if (this.options.logVerbose) {
      console.log(`Starting project registry cleanup scheduler (interval: ${this.options.intervalMinutes} minutes)`);
    }

    // Run cleanup on startup if enabled
    if (this.options.runOnStartup) {
      try {
        await this.runCleanup();
      } catch (error) {
        console.error('Failed to run startup cleanup:', error);
      }
    }

    // Schedule periodic cleanup
    this.intervalId = setInterval(async () => {
      try {
        await this.runCleanup();
      } catch (error) {
        console.error('Scheduled cleanup failed:', error);
      }
    }, this.options.intervalMinutes * 60 * 1000);

    if (this.options.logVerbose) {
      console.log('Project registry cleanup scheduler started');
    }
  }

  /**
   * Stop the cleanup scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      
      if (this.options.logVerbose) {
        console.log('Project registry cleanup scheduler stopped');
      }
    }
  }

  /**
   * Run cleanup immediately
   */
  async runCleanup(): Promise<CleanupResult> {
    if (this.isRunning) {
      throw new Error('Cleanup is already in progress');
    }

    this.isRunning = true;
    const startTime = new Date();
    const errors: string[] = [];
    let removed = 0;
    let archived = 0;
    let healthChecked = 0;

    try {
      if (this.options.logVerbose) {
        console.log('Starting project registry cleanup...');
      }

      const indexService = getProjectIndexService();

      // Step 1: Run orphaned entries cleanup
      try {
        const orphanedResult = await indexService.cleanupOrphanedEntries();
        removed = orphanedResult.removed;
        archived = orphanedResult.archived;

        if (this.options.logVerbose && (removed > 0 || archived > 0)) {
          console.log(`Orphaned entries cleanup: ${archived} archived, ${removed} removed`);
        }
      } catch (error) {
        const errorMsg = `Failed to cleanup orphaned entries: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }

      // Step 2: Run health check on remaining projects
      try {
        const unhealthyProjects = await indexService.getProjectsNeedingHealthCheck(1); // Check projects not checked in last hour
        
        for (const project of unhealthyProjects) {
          try {
            const { promises: fs } = await import('fs');
            const path = await import('path');
            
            // Check if project directory and .codehive directory exist
            await fs.access(project.localPath);
            const codehivePath = path.join(project.localPath, '.codehive');
            await fs.access(codehivePath);
            
            // Mark as healthy
            await indexService.updateProjectHealth(project.id, true);
            healthChecked++;
          } catch (healthError) {
            // Mark as unhealthy
            await indexService.updateProjectHealth(project.id, false);
            healthChecked++;
            
            if (this.options.logVerbose) {
              console.log(`Project ${project.name} marked as unhealthy: ${healthError instanceof Error ? healthError.message : 'Unknown error'}`);
            }
          }
        }

        if (this.options.logVerbose && healthChecked > 0) {
          console.log(`Health check completed for ${healthChecked} projects`);
        }
      } catch (error) {
        const errorMsg = `Failed to run health checks: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }

      // Step 3: Clean up related data (budgets, token usage) for removed projects
      try {
        const { prisma } = await import('../db');
        
        // Get all project IDs from index
        const existingProjects = await indexService.getAllProjects({ includeInactive: true });
        const existingProjectIds = new Set(existingProjects.map(p => p.id));
        
        // Remove budgets for projects no longer in index
        const orphanedBudgets = await prisma.projectBudget.findMany({
          where: {
            NOT: {
              projectId: {
                in: Array.from(existingProjectIds)
              }
            }
          }
        });
        
        if (orphanedBudgets.length > 0) {
          await prisma.projectBudget.deleteMany({
            where: {
              projectId: {
                in: orphanedBudgets.map(b => b.projectId)
              }
            }
          });
          
          if (this.options.logVerbose) {
            console.log(`Removed ${orphanedBudgets.length} orphaned project budgets`);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to cleanup related data: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }

      this.lastRun = startTime;
      
      if (this.options.logVerbose) {
        const duration = Date.now() - startTime.getTime();
        console.log(`Project registry cleanup completed in ${duration}ms`);
      }

      return {
        timestamp: startTime,
        removed,
        archived,
        healthChecked,
        errors,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    isScheduled: boolean;
    lastRun: Date | null;
    intervalMinutes: number;
  } {
    return {
      isRunning: this.isRunning,
      isScheduled: this.intervalId !== null,
      lastRun: this.lastRun,
      intervalMinutes: this.options.intervalMinutes,
    };
  }

  /**
   * Update scheduler interval
   */
  updateInterval(intervalMinutes: number): void {
    this.options.intervalMinutes = intervalMinutes;
    
    if (this.intervalId) {
      // Restart with new interval
      this.stop();
      this.start();
    }
  }
}

// Global scheduler instance
let globalCleanupScheduler: ProjectRegistryCleanupScheduler | null = null;

/**
 * Get the global cleanup scheduler instance
 */
export function getCleanupScheduler(): ProjectRegistryCleanupScheduler {
  if (!globalCleanupScheduler) {
    globalCleanupScheduler = new ProjectRegistryCleanupScheduler({
      intervalMinutes: 30, // Run every 30 minutes
      runOnStartup: true,
      logVerbose: true,
    });
  }
  return globalCleanupScheduler;
}

/**
 * Initialize and start the cleanup scheduler
 * Call this from your main server startup code
 */
export async function initCleanupScheduler(): Promise<void> {
  const scheduler = getCleanupScheduler();
  await scheduler.start();
}

/**
 * Stop the cleanup scheduler
 * Call this when shutting down the server
 */
export function stopCleanupScheduler(): void {
  if (globalCleanupScheduler) {
    globalCleanupScheduler.stop();
    globalCleanupScheduler = null;
  }
}