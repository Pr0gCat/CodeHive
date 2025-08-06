/**
 * Project Discovery Service - Scans repos/ directory for portable CodeHive projects
 * Detects projects with .codehive/ directories and loads their metadata
 */

import { promises as fs } from 'fs';
import path from 'path';
import { ProjectMetadataManager } from './metadata-manager';
import { ProjectMetadata } from './schemas';

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
   * Discover all portable CodeHive projects in repos directory
   */
  async discoverProjects(options: ProjectDiscoveryOptions = {}): Promise<DiscoveredProject[]> {
    const { includeInvalid = false, validateMetadata = true, scanDepth = 2 } = options;
    
    try {
      // Ensure repos directory exists
      await fs.mkdir(this.reposPath, { recursive: true });
      
      const projects: DiscoveredProject[] = [];
      const scannedPaths = await this.scanDirectory(this.reposPath, scanDepth);
      
      for (const projectPath of scannedPaths) {
        try {
          const project = await this.analyzeProject(projectPath, validateMetadata);
          
          if (project && (includeInvalid || project.isValid)) {
            projects.push(project);
            this.discoveryCache.set(projectPath, project);
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
      
      // Check if cache is still valid (metadata file not modified)
      try {
        const metadataPath = path.join(projectPath, '.codehive', 'project.json');
        const stats = await fs.stat(metadataPath);
        
        if (stats.mtime <= cached.lastModified) {
          return cached;
        }
      } catch {
        // Metadata file might not exist, proceed with re-analysis
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
      const projectJsonPath = path.join(codehivePath, 'project.json');
      
      await fs.access(codehivePath);
      await fs.access(projectJsonPath);
      
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
        const metadataPath = path.join(projectPath, '.codehive', 'project.json');
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
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const fullPath = path.join(dirPath, entry.name);
          
          // Check if this directory is a portable project
          if (await this.isPortableProject(fullPath)) {
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
      const metadataManager = new ProjectMetadataManager(projectPath);
      
      // Check if it's a portable project
      if (!(await metadataManager.isPortableProject())) {
        return null;
      }

      // Load metadata
      const metadata = await metadataManager.getProjectMetadata({
        validateData: validateMetadata,
        createIfMissing: false,
      });

      if (!metadata) {
        return null;
      }

      // Get directory stats
      const stats = await this.getDirectoryStats(projectPath);
      
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