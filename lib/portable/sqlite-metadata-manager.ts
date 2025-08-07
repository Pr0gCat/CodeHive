/**
 * SQLiteMetadataManager - Drop-in replacement for ProjectMetadataManager using SQLite
 * Provides the same API but stores data in SQLite instead of JSON files
 */

import { SQLiteManager, SQLiteManagerOptions } from './sqlite-manager';
import {
  ProjectMetadata,
  ProjectSettings,
  Epic,
  Story,
  Sprint,
  AgentSpec,
  Cycle,
  TokenUsage,
  ProjectBudget,
  PortableProject,
  ProjectMetadataSchema,
  ProjectSettingsSchema,
} from './schemas';

export interface ProjectMetadataOptions {
  createIfMissing?: boolean;
  validateData?: boolean;
  backupOnWrite?: boolean;
}

export class SQLiteMetadataManager {
  private sqlite: SQLiteManager;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.sqlite = new SQLiteManager(projectPath);
  }

  /**
   * Initialize the SQLite database and create tables
   */
  async initialize(): Promise<void> {
    await this.sqlite.initialize();
  }

  /**
   * Close database connection
   */
  close(): void {
    this.sqlite.close();
  }

  /**
   * Check if project has SQLite database
   */
  async isPortableProject(): Promise<boolean> {
    return this.sqlite.isPortableProject();
  }

  // === Project Metadata Operations ===

  async getProjectMetadata(options: ProjectMetadataOptions = {}): Promise<ProjectMetadata | null> {
    try {
      const metadata = await this.sqlite.getProjectMetadata();
      
      if (!metadata && options.createIfMissing) {
        return this.createDefaultProjectMetadata();
      }
      
      return metadata;
    } catch (error) {
      console.error('Failed to read project metadata:', error);
      if (options.createIfMissing) {
        return this.createDefaultProjectMetadata();
      }
      return null;
    }
  }

  async saveProjectMetadata(metadata: ProjectMetadata, options: ProjectMetadataOptions = {}): Promise<void> {
    if (options.validateData) {
      ProjectMetadataSchema.parse(metadata);
    }

    if (options.backupOnWrite) {
      await this.sqlite.createBackup();
    }

    await this.sqlite.saveProjectMetadata(metadata);
  }

  // === Settings Operations ===

  async getProjectSettings(options: ProjectMetadataOptions = {}): Promise<ProjectSettings | null> {
    try {
      const settings = await this.sqlite.getProjectSettings();
      
      if (!settings && options.createIfMissing) {
        return this.createDefaultProjectSettings();
      }
      
      return settings;
    } catch (error) {
      console.error('Failed to read project settings:', error);
      if (options.createIfMissing) {
        return this.createDefaultProjectSettings();
      }
      return null;
    }
  }

  async saveProjectSettings(settings: ProjectSettings, options: ProjectMetadataOptions = {}): Promise<void> {
    if (options.validateData) {
      ProjectSettingsSchema.parse(settings);
    }

    if (options.backupOnWrite) {
      await this.sqlite.createBackup();
    }

    await this.sqlite.saveProjectSettings(settings);
  }

  async updateProjectSettings(updates: Partial<ProjectSettings>, options: ProjectMetadataOptions = {}): Promise<void> {
    if (options.backupOnWrite) {
      await this.sqlite.createBackup();
    }

    await this.sqlite.updateProjectSettings(updates);
  }

  // === Epic Operations ===

  async getEpics(): Promise<Epic[]> {
    return this.sqlite.getEpics();
  }

  async getEpic(epicId: string): Promise<Epic | null> {
    return this.sqlite.getEpic(epicId);
  }

  async saveEpic(epic: Epic): Promise<void> {
    await this.sqlite.saveEpic(epic);
  }

  async deleteEpic(epicId: string): Promise<void> {
    await this.sqlite.deleteEpic(epicId);
  }

  // === Story Operations ===

  async getStories(): Promise<Story[]> {
    return this.sqlite.getStories();
  }

  async getStory(storyId: string): Promise<Story | null> {
    return this.sqlite.getStory(storyId);
  }

  async saveStory(story: Story): Promise<void> {
    await this.sqlite.saveStory(story);
  }

  async deleteStory(storyId: string): Promise<void> {
    await this.sqlite.deleteStory(storyId);
  }

  // === Sprint Operations ===

  async getSprints(): Promise<Sprint[]> {
    return this.sqlite.getSprints();
  }

  async getSprint(sprintId: string): Promise<Sprint | null> {
    return this.sqlite.getSprint(sprintId);
  }

  async saveSprint(sprint: Sprint): Promise<void> {
    await this.sqlite.saveSprint(sprint);
  }

  async deleteSprint(sprintId: string): Promise<void> {
    return this.sqlite.deleteSprint(sprintId);
  }

  // === Agent Operations ===

  async getAgents(): Promise<AgentSpec[]> {
    return this.sqlite.getAgents();
  }

  async getAgent(agentId: string): Promise<AgentSpec | null> {
    return this.sqlite.getAgent(agentId);
  }

  async saveAgent(agent: AgentSpec): Promise<void> {
    await this.sqlite.saveAgent(agent);
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.sqlite.deleteAgent(agentId);
  }

  // === Cycle Operations ===

  async getCycles(): Promise<Cycle[]> {
    return this.sqlite.getCycles();
  }

  async getCycle(cycleId: string): Promise<Cycle | null> {
    return this.sqlite.getCycle(cycleId);
  }

  async saveCycle(cycle: Cycle): Promise<void> {
    await this.sqlite.saveCycle(cycle);
  }

  async deleteCycle(cycleId: string): Promise<void> {
    await this.sqlite.deleteCycle(cycleId);
  }

  // === Token Usage Operations ===

  async getTokenUsage(): Promise<TokenUsage[]> {
    return this.sqlite.getTokenUsage();
  }

  async addTokenUsage(usage: TokenUsage): Promise<void> {
    await this.sqlite.addTokenUsage(usage);
  }

  // === Budget Operations ===

  async getProjectBudget(): Promise<ProjectBudget | null> {
    return this.sqlite.getProjectBudget();
  }

  async saveProjectBudget(budget: ProjectBudget): Promise<void> {
    await this.sqlite.saveProjectBudget(budget);
  }

  // === Export/Import Operations ===

  async exportPortableProject(): Promise<PortableProject> {
    return this.sqlite.exportPortableProject();
  }

  async importPortableProject(portableProject: PortableProject): Promise<void> {
    await this.sqlite.importPortableProject(portableProject);
  }

  // === Utility Methods ===

  /**
   * Get database statistics
   */
  async getStats(): Promise<Record<string, number>> {
    return this.sqlite.getStats();
  }

  /**
   * Create a backup of the database
   */
  async createBackup(): Promise<string> {
    return this.sqlite.createBackup();
  }

  /**
   * Clear all cached metadata (no-op for SQLite, kept for API compatibility)
   */
  clearCache(): void {
    // SQLite doesn't use caching like JSON manager
  }

  /**
   * Check if this project has legacy JSON-based structure
   */
  async hasLegacyStructure(): Promise<boolean> {
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    const codehivePath = path.join(this.projectPath, '.codehive');
    const legacyFiles = ['project.json', 'settings.json', 'budget.json'];
    
    for (const file of legacyFiles) {
      try {
        await fs.access(path.join(codehivePath, file));
        return true; // Found at least one legacy file
      } catch {
        // File doesn't exist, continue checking
      }
    }
    
    return false;
  }

  /**
   * Clean up legacy JSON files and directories from old implementation
   */
  async cleanupLegacyFiles(): Promise<{ cleaned: string[], errors: string[] }> {
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    const codehivePath = path.join(this.projectPath, '.codehive');
    const cleaned: string[] = [];
    const errors: string[] = [];
    
    // Legacy items to remove (files and directories)
    const legacyItems = [
      'project.json',
      'settings.json', 
      'budget.json',
      'epics/',
      'stories/',
      'sprints/', 
      'agents/',
      'cycles/',
      'usage/',
      'backups/'
    ];

    for (const item of legacyItems) {
      const itemPath = path.join(codehivePath, item);
      
      try {
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          await fs.rm(itemPath, { recursive: true, force: true });
          cleaned.push(`directory: ${item}`);
        } else if (stat.isFile()) {
          await fs.unlink(itemPath);
          cleaned.push(`file: ${item}`);
        }
      } catch (error) {
        if ((error as any).code !== 'ENOENT') {
          // Item exists but couldn't be removed
          errors.push(`${item}: ${(error as Error).message}`);
        }
        // If ENOENT, item doesn't exist - that's fine
      }
    }
    
    return { cleaned, errors };
  }

  /**
   * Migrate legacy JSON-based project to SQLite format
   */
  async migrateLegacyProject(): Promise<void> {
    const hasLegacy = await this.hasLegacyStructure();
    if (!hasLegacy) {
      return; // No legacy structure to migrate
    }

    // Import the old metadata manager to read legacy data
    const { ProjectMetadataManager } = await import('./metadata-manager');
    const legacyManager = new ProjectMetadataManager(this.projectPath);
    
    try {
      // Load legacy data
      const legacyProject = await legacyManager.loadProject();
      
      if (legacyProject) {
        // Import the data into SQLite
        await this.importPortableProject(legacyProject);
        console.log(`✅ Migrated legacy project data to SQLite: ${this.projectPath}`);
        
        // Clean up legacy files after successful migration
        const cleanup = await this.cleanupLegacyFiles();
        if (cleanup.cleaned.length > 0) {
          console.log(`🧹 Cleaned up legacy files: ${cleanup.cleaned.join(', ')}`);
        }
        if (cleanup.errors.length > 0) {
          console.warn(`⚠️ Cleanup errors: ${cleanup.errors.join(', ')}`);
        }
      }
    } catch (error) {
      console.error('Failed to migrate legacy project:', error);
      throw error;
    }
  }

  // === Private Helper Methods ===

  private async createDefaultProjectMetadata(): Promise<ProjectMetadata> {
    const now = new Date().toISOString();
    const projectName = require('path').basename(this.projectPath);
    
    const metadata: ProjectMetadata = {
      version: '1.0.0',
      id: `project-${Date.now()}`,
      name: projectName,
      description: `Portable CodeHive project: ${projectName}`,
      localPath: this.projectPath,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    await this.saveProjectMetadata(metadata);
    return metadata;
  }

  private async createDefaultProjectSettings(): Promise<ProjectSettings> {
    const settings: ProjectSettings = ProjectSettingsSchema.parse({});
    await this.saveProjectSettings(settings);
    return settings;
  }
}