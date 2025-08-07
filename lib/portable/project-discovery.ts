/**
 * Project Discovery Service - Scans repos/ directory for portable CodeHive projects
 * Detects projects with .codehive/ directories and loads their metadata
 */

import { promises as fs } from 'fs';
import path from 'path';
import { SQLiteMetadataManager } from './sqlite-metadata-manager';
import { ProjectMetadata } from './schemas';
import { getProjectIndexService } from '../db/project-index';
import { getCleanupScheduler } from '../registry/cleanup-scheduler';

export interface DiscoveredProject {
  path: string;
  metadata: ProjectMetadata;
  isValid: boolean;
  lastModified: Date;
  size: number;
}

export interface ProjectDiscoveryOptions {
  includeInvalid?: boolean;
  validateMetadata?: boolean;
  scanDepth?: number;
}

export class ProjectDiscoveryService {
  private reposPath: string;
  private discoveryCache: Map<string, DiscoveredProject> = new Map();
  private lastScanTime: Date | null = null;

  constructor(reposPath?: string) {
    this.reposPath = reposPath || path.join(process.cwd(), 'repos');
  }

  /**
   * Discover all portable CodeHive projects from system database and repos directory
   */
  async discoverProjects(options: ProjectDiscoveryOptions = {}): Promise<DiscoveredProject[]> {
    const { includeInvalid = false, validateMetadata = true, scanDepth = 2 } = options;
    
    try {
      console.log(`Starting project discovery in: ${this.reposPath}`);
      
      // Ensure repos directory exists
      await fs.mkdir(this.reposPath, { recursive: true });
      
      const projects: DiscoveredProject[] = [];
      const indexService = getProjectIndexService();
      const processedPaths = new Set<string>();

      // First, get all projects from system database
      try {
        const indexedProjects = await indexService.getAllProjects({ includeInactive: false });
        
        for (const indexedProject of indexedProjects) {
          try {
            const project = await this.analyzeProject(indexedProject.localPath, validateMetadata);
            if (project && (includeInvalid || project.isValid)) {
              projects.push(project);
              this.discoveryCache.set(indexedProject.localPath, project);
              processedPaths.add(indexedProject.localPath);
              
              // Sync with system database (in case metadata changed)
              await indexService.syncWithProject(project.metadata);
            }
          } catch (error) {
            console.warn(`Failed to analyze indexed project at ${indexedProject.localPath}:`, error);
            // Mark as unhealthy in database
            await indexService.updateProjectHealth(indexedProject.id, false);
            
            if (includeInvalid) {
              projects.push({
                path: indexedProject.localPath,
                metadata: {} as ProjectMetadata,
                isValid: false,
                lastModified: new Date(),
                size: 0,
              });
            }
          }
        }
      } catch (dbError) {
        console.warn('Failed to query system database, falling back to filesystem scan only:', dbError);
      }

      // Then, scan repos directory for any projects not in database
      const scannedPaths = await this.scanDirectory(this.reposPath, scanDepth);
      console.log(`Found ${scannedPaths.length} potential project paths from filesystem scan`);
      
      for (const projectPath of scannedPaths) {
        console.log(`Analyzing discovered path: ${projectPath}`);
        // Skip if already processed from database
        if (processedPaths.has(projectPath)) {
          continue;
        }
        
        try {
          const project = await this.analyzeProject(projectPath, validateMetadata);
          
          if (project && (includeInvalid || project.isValid)) {
            projects.push(project);
            this.discoveryCache.set(projectPath, project);
            
            // Sync with system database (new project found in filesystem)
            if (project.isValid) {
              try {
                await indexService.syncWithProject(project.metadata);
              } catch (syncError) {
                console.warn(`Failed to sync project ${project.metadata.id} with system database:`, syncError);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to analyze project at ${projectPath}:`, error);
          
          if (includeInvalid) {
            projects.push({
              path: projectPath,
              metadata: {} as ProjectMetadata,
              isValid: false,
              lastModified: new Date(),
              size: 0,
            });
          }
        }
      }
      
      // Cleanup orphaned entries in the system database
      try {
        const cleanup = await indexService.cleanupOrphanedEntries();
        if (cleanup.archived > 0 || cleanup.removed > 0) {
          console.log(`Database cleanup completed: ${cleanup.archived} archived, ${cleanup.removed} removed`);
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup orphaned project entries:', cleanupError);
      }
      
      // Trigger additional cleanup through scheduler if significant changes detected
      const totalChanges = projects.length;
      if (totalChanges === 0 || this.lastScanTime === null) {
        try {
          const scheduler = getCleanupScheduler();
          const status = scheduler.getStatus();
          
          // Only run if not already running and haven't run recently (within 10 minutes)
          if (!status.isRunning && (!status.lastRun || 
              Date.now() - status.lastRun.getTime() > 10 * 60 * 1000)) {
            console.log('Triggering comprehensive cleanup due to no projects found or first scan');
            await scheduler.runCleanup();
          }
        } catch (schedulerError) {
          console.warn('Failed to trigger scheduler cleanup:', schedulerError);
        }
      }
      
      this.lastScanTime = new Date();
      return projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    } catch (error) {
      console.error('Failed to discover projects:', error);
      return [];
    }
  }

  /**
   * Get a single project by path
   */
  async getProject(projectPath: string, validateMetadata = true): Promise<DiscoveredProject | null> {
    // Check cache first
    if (this.discoveryCache.has(projectPath)) {
      const cached = this.discoveryCache.get(projectPath)!;
      
      // Check if cache is still valid (database not modified)
      try {
        const metadataPath = path.join(projectPath, '.codehive', 'project.db');
        const stats = await fs.stat(metadataPath);
        
        if (stats.mtime <= cached.lastModified) {
          return cached;
        }
      } catch {
        // Database file might not exist, proceed with re-analysis
      }
    }

    // Analyze project fresh
    const project = await this.analyzeProject(projectPath, validateMetadata);
    
    if (project) {
      this.discoveryCache.set(projectPath, project);
    }
    
    return project;
  }

  /**
   * Check if a directory contains a portable CodeHive project
   */
  async isPortableProject(projectPath: string): Promise<boolean> {
    try {
      const codehivePath = path.join(projectPath, '.codehive');
      const projectDbPath = path.join(codehivePath, 'project.db');
      
      await fs.access(codehivePath);
      await fs.access(projectDbPath);
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get projects that have been updated since last scan
   */
  async getUpdatedProjects(): Promise<DiscoveredProject[]> {
    if (!this.lastScanTime) {
      return this.discoverProjects();
    }

    const updatedProjects: DiscoveredProject[] = [];
    
    for (const [projectPath, cachedProject] of this.discoveryCache) {
      try {
        const metadataPath = path.join(projectPath, '.codehive', 'project.db');
        const stats = await fs.stat(metadataPath);
        
        if (stats.mtime > this.lastScanTime) {
          const project = await this.analyzeProject(projectPath, true);
          if (project) {
            updatedProjects.push(project);
            this.discoveryCache.set(projectPath, project);
          }
        }
      } catch {
        // Project might have been deleted, remove from cache
        this.discoveryCache.delete(projectPath);
      }
    }

    return updatedProjects;
  }

  /**
   * Get project statistics
   */
  async getProjectStats(): Promise<{
    totalProjects: number;
    validProjects: number;
    invalidProjects: number;
    totalSize: number;
    lastScanTime: Date | null;
  }> {
    const projects = await this.discoverProjects({ includeInvalid: true });
    
    const validProjects = projects.filter(p => p.isValid);
    const invalidProjects = projects.filter(p => !p.isValid);
    const totalSize = projects.reduce((sum, p) => sum + p.size, 0);

    return {
      totalProjects: projects.length,
      validProjects: validProjects.length,
      invalidProjects: invalidProjects.length,
      totalSize,
      lastScanTime: this.lastScanTime,
    };
  }

  /**
   * Clear discovery cache
   */
  clearCache(): void {
    this.discoveryCache.clear();
    this.lastScanTime = null;
  }

  /**
   * Watch for changes in repos directory
   */
  async watchForChanges(callback: (projects: DiscoveredProject[]) => void): Promise<() => void> {
    // Simple polling implementation - could be enhanced with fs.watch
    const interval = setInterval(async () => {
      try {
        const updatedProjects = await this.getUpdatedProjects();
        if (updatedProjects.length > 0) {
          callback(updatedProjects);
        }
      } catch (error) {
        console.error('Error watching for project changes:', error);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }

  // Private methods

  private async scanDirectory(dirPath: string, maxDepth: number, currentDepth = 0): Promise<string[]> {
    const projectPaths: string[] = [];
    
    if (currentDepth >= maxDepth) {
      return projectPaths;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      console.log(`Scanning ${dirPath} (depth ${currentDepth}): found ${entries.length} entries`);
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const fullPath = path.join(dirPath, entry.name);
          
          // Check if this directory is a portable project
          const isPortable = await this.isPortableProject(fullPath);
          console.log(`  Checking ${entry.name}: portable=${isPortable}`);
          
          if (isPortable) {
            projectPaths.push(fullPath);
          } else if (currentDepth < maxDepth - 1) {
            // Recursively scan subdirectories
            const subProjects = await this.scanDirectory(fullPath, maxDepth, currentDepth + 1);
            projectPaths.push(...subProjects);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error);
    }

    return projectPaths;
  }

  private async analyzeProject(projectPath: string, validateMetadata: boolean): Promise<DiscoveredProject | null> {
    try {
      const metadataManager = new SQLiteMetadataManager(projectPath);
      
      // Check if it's a portable project
      if (!(await metadataManager.isPortableProject())) {
        console.log(`Not a portable project: ${projectPath}`);
        return null;
      }

      // Initialize the database connection
      await metadataManager.initialize();

      // Load metadata
      const metadata = await metadataManager.getProjectMetadata({
        validateData: validateMetadata,
        createIfMissing: false,
      });

      if (!metadata) {
        console.warn(`No metadata found in portable project: ${projectPath}`);
        metadataManager.close();
        return null;
      }

      // Get directory stats
      const stats = await this.getDirectoryStats(projectPath);
      
      // Close database connection
      metadataManager.close();
      
      return {
        path: projectPath,
        metadata,
        isValid: true,
        lastModified: stats.lastModified,
        size: stats.size,
      };
    } catch (error) {
      console.error(`Failed to analyze project at ${projectPath}:`, error);
      return null;
    }
  }

  private async getDirectoryStats(dirPath: string): Promise<{ lastModified: Date; size: number }> {
    let totalSize = 0;
    let lastModified = new Date(0);

    const scanDir = async (currentPath: string) => {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await scanDir(fullPath);
            }
          } else {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
            
            if (stats.mtime > lastModified) {
              lastModified = stats.mtime;
            }
          }
        }
      } catch (error) {
        // Ignore errors for individual files/directories
      }
    };

    await scanDir(dirPath);
    
    return { lastModified, size: totalSize };
  }
}

// Singleton instance for global use
let globalDiscoveryService: ProjectDiscoveryService | null = null;

export function getProjectDiscoveryService(reposPath?: string): ProjectDiscoveryService {
  if (!globalDiscoveryService) {
    globalDiscoveryService = new ProjectDiscoveryService(reposPath);
  }
  return globalDiscoveryService;
}