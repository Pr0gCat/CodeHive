/**
 * Project Index Database Service
 * Manages the system database index of all portable projects
 */

import { ProjectIndex } from '@prisma/client';
import { prisma } from './index';
import { ProjectMetadata } from '../portable/schemas';

export interface ProjectIndexEntry {
  id: string;
  name: string;
  description?: string;
  localPath: string;
  gitUrl?: string;
  status: string;
  framework?: string;
  language?: string;
  packageManager?: string;
  testFramework?: string;
  lintTool?: string;
  buildTool?: string;
  projectType: string;
  importSource?: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  epicCount: number;
  storyCount: number;
  tokenUsage: number;
  isHealthy: boolean;
  lastHealthCheck: Date;
}

export interface ProjectIndexStats {
  epicCount: number;
  storyCount: number;
  tokenUsage: number;
}

export interface ProjectIndexOptions {
  includeInactive?: boolean;
  orderBy?: 'name' | 'createdAt' | 'lastAccessedAt';
  orderDirection?: 'asc' | 'desc';
}

export class ProjectIndexService {
  /**
   * Register a new project in the index
   */
  async registerProject(
    metadata: ProjectMetadata,
    importSource?: 'LOCAL_FOLDER' | 'GIT_URL' | 'MIGRATED'
  ): Promise<ProjectIndex> {
    const projectIndex = await prisma.projectIndex.create({
      data: {
        id: metadata.id,
        name: metadata.name,
        description: metadata.description,
        localPath: metadata.localPath,
        gitUrl: metadata.gitUrl,
        status: metadata.status,
        framework: metadata.framework,
        language: metadata.language,
        packageManager: metadata.packageManager,
        testFramework: metadata.testFramework,
        lintTool: metadata.lintTool,
        buildTool: metadata.buildTool,
        importSource,
        projectType: 'PORTABLE',
      },
    });

    return projectIndex;
  }

  /**
   * Update project information in the index
   */
  async updateProject(
    projectId: string,
    updates: Partial<Pick<ProjectIndexEntry, 
      'name' | 'description' | 'status' | 'framework' | 'language' | 
      'packageManager' | 'testFramework' | 'lintTool' | 'buildTool' | 'gitUrl'
    >>
  ): Promise<ProjectIndex> {
    return prisma.projectIndex.update({
      where: { id: projectId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update project statistics (cached values)
   */
  async updateProjectStats(
    projectId: string,
    stats: ProjectIndexStats
  ): Promise<ProjectIndex> {
    return prisma.projectIndex.update({
      where: { id: projectId },
      data: {
        epicCount: stats.epicCount,
        storyCount: stats.storyCount,
        tokenUsage: stats.tokenUsage,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Mark project as accessed (updates lastAccessedAt)
   */
  async markProjectAccessed(projectId: string): Promise<void> {
    await prisma.projectIndex.update({
      where: { id: projectId },
      data: {
        lastAccessedAt: new Date(),
      },
    });
  }

  /**
   * Get all projects from the index
   */
  async getAllProjects(options: ProjectIndexOptions = {}): Promise<ProjectIndex[]> {
    const {
      includeInactive = false,
      orderBy = 'lastAccessedAt',
      orderDirection = 'desc'
    } = options;

    return prisma.projectIndex.findMany({
      where: includeInactive ? undefined : {
        status: {
          not: 'ARCHIVED'
        }
      },
      orderBy: {
        [orderBy]: orderDirection
      }
    });
  }

  /**
   * Get project by ID
   */
  async getProjectById(projectId: string): Promise<ProjectIndex | null> {
    const project = await prisma.projectIndex.findUnique({
      where: { id: projectId }
    });

    if (project) {
      // Mark as accessed
      await this.markProjectAccessed(projectId);
    }

    return project;
  }

  /**
   * Get project by path
   */
  async getProjectByPath(localPath: string): Promise<ProjectIndex | null> {
    return prisma.projectIndex.findUnique({
      where: { localPath }
    });
  }

  /**
   * Check if project exists in index
   */
  async projectExists(projectId: string): Promise<boolean> {
    const count = await prisma.projectIndex.count({
      where: { id: projectId }
    });
    return count > 0;
  }

  /**
   * Check if project path exists in index
   */
  async projectPathExists(localPath: string): Promise<boolean> {
    const count = await prisma.projectIndex.count({
      where: { localPath }
    });
    return count > 0;
  }

  /**
   * Remove project from index (DISABLED - projects can only be archived)
   */
  async removeProject(projectId: string): Promise<void> {
    // Projects cannot be removed, only archived
    console.warn(`Project removal attempted for ${projectId} - archiving instead`);
    await this.archiveProject(projectId);
  }

  /**
   * Archive project (soft delete)
   */
  async archiveProject(projectId: string): Promise<ProjectIndex> {
    return prisma.projectIndex.update({
      where: { id: projectId },
      data: {
        status: 'ARCHIVED',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update project health status
   */
  async updateProjectHealth(
    projectId: string,
    isHealthy: boolean,
    lastHealthCheck?: Date
  ): Promise<ProjectIndex> {
    return prisma.projectIndex.update({
      where: { id: projectId },
      data: {
        isHealthy,
        lastHealthCheck: lastHealthCheck || new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get projects that need health checks
   */
  async getProjectsNeedingHealthCheck(olderThanHours = 24): Promise<ProjectIndex[]> {
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - olderThanHours);

    return prisma.projectIndex.findMany({
      where: {
        OR: [
          { lastHealthCheck: { lt: threshold } },
          { isHealthy: false }
        ],
        status: {
          not: 'ARCHIVED'
        }
      },
      orderBy: {
        lastHealthCheck: 'asc'
      }
    });
  }

  /**
   * Get project statistics summary
   */
  async getProjectSummary(): Promise<{
    totalProjects: number;
    activeProjects: number;
    pausedProjects: number;
    archivedProjects: number;
    unhealthyProjects: number;
    totalEpics: number;
    totalStories: number;
    totalTokenUsage: number;
  }> {
    const [
      totalProjects,
      activeProjects,
      pausedProjects,
      archivedProjects,
      unhealthyProjects,
      aggregates
    ] = await Promise.all([
      prisma.projectIndex.count(),
      prisma.projectIndex.count({ where: { status: 'ACTIVE' } }),
      prisma.projectIndex.count({ where: { status: 'PAUSED' } }),
      prisma.projectIndex.count({ where: { status: 'ARCHIVED' } }),
      prisma.projectIndex.count({ where: { isHealthy: false } }),
      prisma.projectIndex.aggregate({
        _sum: {
          epicCount: true,
          storyCount: true,
          tokenUsage: true,
        }
      })
    ]);

    return {
      totalProjects,
      activeProjects,
      pausedProjects,
      archivedProjects,
      unhealthyProjects,
      totalEpics: aggregates._sum.epicCount || 0,
      totalStories: aggregates._sum.storyCount || 0,
      totalTokenUsage: aggregates._sum.tokenUsage || 0,
    };
  }

  /**
   * Search projects by name or description
   */
  async searchProjects(query: string, options: ProjectIndexOptions = {}): Promise<ProjectIndex[]> {
    const {
      includeInactive = false,
      orderBy = 'lastAccessedAt',
      orderDirection = 'desc'
    } = options;

    return prisma.projectIndex.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } }
            ]
          },
          includeInactive ? {} : {
            status: {
              not: 'ARCHIVED'
            }
          }
        ]
      },
      orderBy: {
        [orderBy]: orderDirection
      }
    });
  }

  /**
   * Sync project index with actual project metadata
   * This should be called periodically or when projects are discovered
   */
  async syncWithProject(metadata: ProjectMetadata): Promise<ProjectIndex> {
    const existingIndex = await this.getProjectById(metadata.id);

    if (existingIndex) {
      // Update existing entry
      return this.updateProject(metadata.id, {
        name: metadata.name,
        description: metadata.description,
        status: metadata.status,
        framework: metadata.framework,
        language: metadata.language,
        packageManager: metadata.packageManager,
        testFramework: metadata.testFramework,
        lintTool: metadata.lintTool,
        buildTool: metadata.buildTool,
        gitUrl: metadata.gitUrl,
      });
    } else {
      // Create new entry
      return this.registerProject(metadata);
    }
  }

  /**
   * Cleanup orphaned index entries (projects that no longer exist on disk)
   * Modified to only archive projects, never remove them
   */
  async cleanupOrphanedEntries(): Promise<{ removed: number; archived: number }> {
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    const allProjects = await this.getAllProjects({ includeInactive: true });
    let removed = 0; // Always 0 now - we don't remove projects
    let archived = 0;

    for (const project of allProjects) {
      try {
        // Check if project directory exists
        await fs.access(project.localPath);
        
        // Check if .codehive directory exists
        const codehivePath = path.join(project.localPath, '.codehive');
        await fs.access(codehivePath);
        
        // Project exists, update health if needed
        if (!project.isHealthy) {
          await this.updateProjectHealth(project.id, true);
        }
      } catch (error) {
        // Project doesn't exist on disk - archive it if not already archived
        if (project.status !== 'ARCHIVED') {
          await this.archiveProject(project.id);
          archived++;
        }
        // Note: We no longer remove archived projects - they stay archived
      }
    }

    return { removed, archived };
  }
}

// Singleton instance
let projectIndexService: ProjectIndexService | null = null;

export function getProjectIndexService(): ProjectIndexService {
  if (!projectIndexService) {
    projectIndexService = new ProjectIndexService();
  }
  return projectIndexService;
}