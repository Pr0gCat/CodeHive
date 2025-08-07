/**
 * Portable CodeHive Projects - Main exports
 * 
 * This module provides a complete portable project system for CodeHive,
 * allowing projects to be fully self-contained with all metadata stored
 * locally in .codehive/ directories.
 */

// Core schemas and types
export * from './schemas';

// Project metadata management
export { ProjectMetadataManager } from './metadata-manager';
export { SQLiteMetadataManager } from './sqlite-metadata-manager';
export { SQLiteManager } from './sqlite-manager';

// Project discovery and scanning
export { 
  ProjectDiscoveryService, 
  getProjectDiscoveryService,
  type DiscoveredProject,
  type ProjectDiscoveryOptions 
} from './project-discovery';

// Migration from database to portable format
export { 
  ProjectMigrationService,
  type MigrationResult,
  type MigrationOptions 
} from './migration';

// Project validation and integrity checking
export { 
  ProjectValidator,
  validateProjectPath,
  validateMultipleProjects,
  type ValidationResult,
  type ValidationIssue,
  type ValidationOptions 
} from './validation';

// Export/import for project portability
export { 
  ProjectExportImportService,
  type ExportResult,
  type ImportResult,
  type ExportOptions,
  type ImportOptions 
} from './export-import';

// Utility functions
export const PortableProjectUtils = {
  /**
   * Check if a directory contains a portable CodeHive project
   */
  async isPortableProject(projectPath: string): Promise<boolean> {
    const { ProjectMetadataManager } = await import('./metadata-manager');
    const manager = new ProjectMetadataManager(projectPath);
    return manager.isPortableProject();
  },

  /**
   * Quick project information retrieval
   */
  async getProjectInfo(projectPath: string): Promise<{
    name: string;
    id: string;
    description?: string;
    framework?: string;
    language?: string;
    createdAt: string;
    updatedAt: string;
  } | null> {
    try {
      const { ProjectMetadataManager } = await import('./metadata-manager');
      const manager = new ProjectMetadataManager(projectPath);
      
      if (!(await manager.isPortableProject())) {
        return null;
      }

      const metadata = await manager.getProjectMetadata();
      if (!metadata) {
        return null;
      }

      return {
        name: metadata.name,
        id: metadata.id,
        description: metadata.description,
        framework: metadata.framework,
        language: metadata.language,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
      };
    } catch {
      return null;
    }
  },

  /**
   * Initialize a directory as a portable CodeHive project
   */
  async initializePortableProject(
    projectPath: string, 
    projectName: string,
    options: {
      description?: string;
      gitUrl?: string;
      framework?: string;
      language?: string;
    } = {}
  ): Promise<boolean> {
    try {
      const { ProjectMetadataManager } = await import('./metadata-manager');
      const { WorkspaceManager } = await import('../workspace/workspace-manager');
      
      const metadataManager = new ProjectMetadataManager(projectPath);
      const workspaceManager = new WorkspaceManager(projectPath);

      // Initialize directory structures
      await metadataManager.initialize();
      await workspaceManager.initialize();

      // Create project metadata
      const now = new Date().toISOString();
      const projectId = `portable-${Date.now()}`;
      
      const metadata = {
        version: '1.0.0' as const,
        id: projectId,
        name: projectName,
        description: options.description,
        gitUrl: options.gitUrl,
        localPath: projectPath,
        status: 'ACTIVE' as const,
        framework: options.framework,
        language: options.language,
        createdAt: now,
        updatedAt: now,
      };

      await metadataManager.saveProjectMetadata(metadata, { validateData: true });

      // Create default settings
      const settings = await metadataManager.getProjectSettings({ createIfMissing: true });
      if (settings) {
        await metadataManager.saveProjectSettings(settings, { validateData: true });
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize portable project:', error);
      return false;
    }
  },

  /**
   * Get project statistics
   */
  async getProjectStats(projectPath: string): Promise<{
    epics: number;
    stories: number;
    sprints: number;
    agents: number;
    cycles: number;
    tokenUsage: number;
  } | null> {
    try {
      const { ProjectMetadataManager } = await import('./metadata-manager');
      const manager = new ProjectMetadataManager(projectPath);
      
      if (!(await manager.isPortableProject())) {
        return null;
      }

      const [epics, stories, sprints, agents, cycles, tokenUsage] = await Promise.all([
        manager.getEpics(),
        manager.getStories(),
        manager.getSprints(),
        manager.getAgents(),
        manager.getCycles(),
        manager.getTokenUsage(),
      ]);

      return {
        epics: epics.length,
        stories: stories.length,
        sprints: sprints.length,
        agents: agents.length,
        cycles: cycles.length,
        tokenUsage: tokenUsage.length,
      };
    } catch {
      return null;
    }
  },

  /**
   * Convert legacy project to portable format
   */
  async convertToPortable(projectId: string): Promise<boolean> {
    try {
      const { ProjectMigrationService } = await import('./migration');
      const migrationService = new ProjectMigrationService();
      
      const result = await migrationService.migrateProject(projectId, {
        validateOutput: true,
        backupOriginal: true,
      });

      return result.success;
    } catch (error) {
      console.error('Failed to convert project to portable format:', error);
      return false;
    }
  },
};

// Version information
export const PORTABLE_PROJECT_VERSION = '1.0.0';

// Feature flags
export const PORTABLE_PROJECT_FEATURES = {
  METADATA_MANAGEMENT: true,
  PROJECT_DISCOVERY: true,
  DATABASE_MIGRATION: true,
  PROJECT_VALIDATION: true,
  EXPORT_IMPORT: true,
  BACKUP_RESTORE: true,
  BATCH_OPERATIONS: true,
  COMPRESSION: true,
  INTEGRITY_CHECKING: true,
} as const;