/**
 * Project export/import utilities for full portability between CodeHive installations
 * Handles backup, archiving, and transferring portable projects
 */

import { promises as fs } from 'fs';
import path from 'path';
import { ProjectMetadataManager } from './metadata-manager';
import { ProjectValidator } from './validation';
import { PortableProject, PortableProjectSchema } from './schemas';
import { createHash } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

export interface ExportOptions {
  includeWorkspaceSnapshots?: boolean;
  includeLogs?: boolean;
  includeUsageData?: boolean;
  compress?: boolean;
  validateBeforeExport?: boolean;
  outputPath?: string;
}

export interface ImportOptions {
  targetPath?: string;
  overwriteExisting?: boolean;
  validateAfterImport?: boolean;
  skipBackup?: boolean;
  mergeMode?: 'replace' | 'merge' | 'skip';
}

export interface ExportResult {
  success: boolean;
  exportPath?: string;
  size?: number;
  checksum?: string;
  projectName: string;
  projectId: string;
  error?: string;
  validationIssues?: number;
  includedItems: {
    metadata: boolean;
    epics: number;
    stories: number;
    sprints: number;
    agents: number;
    cycles: number;
    tokenUsage: number;
    workspaceSnapshots: number;
    logs: number;
  };
}

export interface ImportResult {
  success: boolean;
  importPath?: string;
  projectName: string;
  projectId: string;
  error?: string;
  validationIssues?: number;
  conflicts?: string[];
  mergedItems: {
    metadata: boolean;
    epics: number;
    stories: number;
    sprints: number;
    agents: number;
    cycles: number;
    tokenUsage: number;
  };
}

export class ProjectExportImportService {
  
  /**
   * Export a portable project to a transferable format
   */
  async exportProject(projectPath: string, options: ExportOptions = {}): Promise<ExportResult> {
    const {
      includeWorkspaceSnapshots = false,
      includeLogs = false,
      includeUsageData = true,
      compress = true,
      validateBeforeExport = true,
      outputPath,
    } = options;

    const metadataManager = new ProjectMetadataManager(projectPath);
    
    const result: ExportResult = {
      success: false,
      projectName: '',
      projectId: '',
      includedItems: {
        metadata: false,
        epics: 0,
        stories: 0,
        sprints: 0,
        agents: 0,
        cycles: 0,
        tokenUsage: 0,
        workspaceSnapshots: 0,
        logs: 0,
      },
    };

    try {
      // Check if project is portable
      if (!(await metadataManager.isPortableProject())) {
        result.error = 'Project is not a portable CodeHive project';
        return result;
      }

      const metadata = await metadataManager.getProjectMetadata();
      if (!metadata) {
        result.error = 'Failed to load project metadata';
        return result;
      }

      result.projectName = metadata.name;
      result.projectId = metadata.id;

      // Validate project before export
      if (validateBeforeExport) {
        const validator = new ProjectValidator(projectPath);
        const validation = await validator.validateProject();
        
        if (!validation.isValid) {
          result.error = `Project validation failed with ${validation.summary.errors} errors`;
          result.validationIssues = validation.summary.errors + validation.summary.warnings;
          return result;
        }
      }

      // Export complete project data
      const portableProject = await metadataManager.exportPortableProject();
      result.includedItems.metadata = true;
      result.includedItems.epics = portableProject.epics.length;
      result.includedItems.stories = portableProject.stories.length;
      result.includedItems.sprints = portableProject.sprints.length;
      result.includedItems.agents = portableProject.agents.length;
      result.includedItems.cycles = portableProject.cycles.length;
      
      if (includeUsageData) {
        result.includedItems.tokenUsage = portableProject.tokenUsage.length;
      } else {
        portableProject.tokenUsage = [];
      }

      // Create export package
      const exportData: any = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportOptions: {
          includeWorkspaceSnapshots,
          includeLogs,
          includeUsageData,
        },
        project: portableProject,
      };

      // Include additional data if requested
      if (includeWorkspaceSnapshots) {
        exportData.workspaceSnapshots = await this.exportWorkspaceSnapshots(projectPath);
        result.includedItems.workspaceSnapshots = exportData.workspaceSnapshots.length;
      }

      if (includeLogs) {
        exportData.logs = await this.exportLogs(projectPath);
        result.includedItems.logs = exportData.logs.length;
      }

      // Generate output path
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeName = metadata.name.replace(/[^a-zA-Z0-9-_]/g, '-');
      const filename = `${safeName}-${timestamp}.codehive${compress ? '.gz' : '.json'}`;
      const finalOutputPath = outputPath || path.join(projectPath, '..', filename);

      // Write export file
      const jsonData = JSON.stringify(exportData, null, 2);
      
      if (compress) {
        await this.writeCompressedFile(finalOutputPath, jsonData);
      } else {
        await fs.writeFile(finalOutputPath, jsonData);
      }

      // Calculate checksum and size
      const stats = await fs.stat(finalOutputPath);
      const checksum = await this.calculateChecksum(finalOutputPath);

      result.success = true;
      result.exportPath = finalOutputPath;
      result.size = stats.size;
      result.checksum = checksum;

      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown export error';
      return result;
    }
  }

  /**
   * Import a portable project from an export file
   */
  async importProject(exportFilePath: string, options: ImportOptions = {}): Promise<ImportResult> {
    const {
      targetPath,
      overwriteExisting = false,
      validateAfterImport = true,
      skipBackup = false,
      mergeMode = 'replace',
    } = options;

    const result: ImportResult = {
      success: false,
      projectName: '',
      projectId: '',
      conflicts: [],
      mergedItems: {
        metadata: false,
        epics: 0,
        stories: 0,
        sprints: 0,
        agents: 0,
        cycles: 0,
        tokenUsage: 0,
      },
    };

    try {
      // Check if export file exists
      if (!(await this.fileExists(exportFilePath))) {
        result.error = `Export file not found: ${exportFilePath}`;
        return result;
      }

      // Read and parse export file
      const exportData = await this.readExportFile(exportFilePath);
      
      if (!exportData.project) {
        result.error = 'Invalid export file: missing project data';
        return result;
      }

      // Validate export data
      const portableProject = PortableProjectSchema.parse(exportData.project);
      result.projectName = portableProject.metadata.name;
      result.projectId = portableProject.metadata.id;

      // Determine target path
      const finalTargetPath = targetPath || path.join(process.cwd(), 'repos', portableProject.metadata.name);
      result.importPath = finalTargetPath;

      // Check if target exists
      const targetExists = await this.fileExists(finalTargetPath);
      
      if (targetExists && !overwriteExisting) {
        if (mergeMode === 'skip') {
          result.error = 'Target project already exists and merge mode is skip';
          return result;
        }
        
        // Check for conflicts
        const conflicts = await this.detectImportConflicts(finalTargetPath, portableProject);
        result.conflicts = conflicts;
        
        if (conflicts.length > 0 && mergeMode === 'replace') {
          if (!skipBackup) {
            await this.createImportBackup(finalTargetPath);
          }
        }
      }

      // Create target directory
      await fs.mkdir(finalTargetPath, { recursive: true });

      // Import project
      const metadataManager = new ProjectMetadataManager(finalTargetPath);
      await metadataManager.importPortableProject(portableProject);

      result.mergedItems.metadata = true;
      result.mergedItems.epics = portableProject.epics.length;
      result.mergedItems.stories = portableProject.stories.length;
      result.mergedItems.sprints = portableProject.sprints.length;
      result.mergedItems.agents = portableProject.agents.length;
      result.mergedItems.cycles = portableProject.cycles.length;
      result.mergedItems.tokenUsage = portableProject.tokenUsage.length;

      // Import additional data if available
      if (exportData.workspaceSnapshots) {
        await this.importWorkspaceSnapshots(finalTargetPath, exportData.workspaceSnapshots);
      }

      if (exportData.logs) {
        await this.importLogs(finalTargetPath, exportData.logs);
      }

      // Validate after import
      if (validateAfterImport) {
        const validator = new ProjectValidator(finalTargetPath);
        const validation = await validator.validateProject();
        
        if (!validation.isValid) {
          result.validationIssues = validation.summary.errors + validation.summary.warnings;
        }
      }

      result.success = true;
      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown import error';
      return result;
    }
  }

  /**
   * Create a backup of an existing project before import
   */
  async createProjectBackup(projectPath: string, backupPath?: string): Promise<string> {
    const metadataManager = new ProjectMetadataManager(projectPath);
    const metadata = await metadataManager.getProjectMetadata();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = metadata?.name.replace(/[^a-zA-Z0-9-_]/g, '-') || 'unknown-project';
    const backupFilename = `backup-${safeName}-${timestamp}.codehive.gz`;
    const finalBackupPath = backupPath || path.join(projectPath, '..', backupFilename);

    const exportResult = await this.exportProject(projectPath, {
      includeWorkspaceSnapshots: true,
      includeLogs: true,
      includeUsageData: true,
      compress: true,
      outputPath: finalBackupPath,
    });

    if (!exportResult.success) {
      throw new Error(`Backup failed: ${exportResult.error}`);
    }

    return finalBackupPath;
  }

  /**
   * Batch export multiple projects
   */
  async batchExport(projectPaths: string[], outputDir: string, options: ExportOptions = {}): Promise<ExportResult[]> {
    const results: ExportResult[] = [];
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    for (const projectPath of projectPaths) {
      try {
        const exportOptions = {
          ...options,
          outputPath: undefined, // Let each export generate its own filename
        };

        const result = await this.exportProject(projectPath, exportOptions);
        
        // Move to output directory if export was successful
        if (result.success && result.exportPath) {
          const filename = path.basename(result.exportPath);
          const newPath = path.join(outputDir, filename);
          await fs.rename(result.exportPath, newPath);
          result.exportPath = newPath;
        }

        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          projectName: path.basename(projectPath),
          projectId: 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
          includedItems: {
            metadata: false,
            epics: 0,
            stories: 0,
            sprints: 0,
            agents: 0,
            cycles: 0,
            tokenUsage: 0,
            workspaceSnapshots: 0,
            logs: 0,
          },
        });
      }
    }

    return results;
  }

  // Private helper methods

  private async exportWorkspaceSnapshots(projectPath: string): Promise<any[]> {
    try {
      const snapshotsDir = path.join(projectPath, '.codehive', 'workspaces');
      const snapshots = [];
      
      if (await this.fileExists(snapshotsDir)) {
        const entries = await fs.readdir(snapshotsDir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const snapshotPath = path.join(snapshotsDir, entry.name);
            const metadataPath = path.join(snapshotPath, 'metadata.json');
            
            if (await this.fileExists(metadataPath)) {
              const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
              snapshots.push({
                id: entry.name,
                metadata,
              });
            }
          }
        }
      }
      
      return snapshots;
    } catch {
      return [];
    }
  }

  private async exportLogs(projectPath: string): Promise<any[]> {
    try {
      const logsDir = path.join(projectPath, '.codehive', 'logs');
      const logs = [];
      
      if (await this.fileExists(logsDir)) {
        const files = await fs.readdir(logsDir);
        
        for (const file of files.filter(f => f.endsWith('.json'))) {
          const logPath = path.join(logsDir, file);
          const logData = JSON.parse(await fs.readFile(logPath, 'utf-8'));
          logs.push({
            filename: file,
            data: logData,
          });
        }
      }
      
      return logs;
    } catch {
      return [];
    }
  }

  private async importWorkspaceSnapshots(targetPath: string, snapshots: any[]): Promise<void> {
    const snapshotsDir = path.join(targetPath, '.codehive', 'workspaces');
    await fs.mkdir(snapshotsDir, { recursive: true });
    
    for (const snapshot of snapshots) {
      const snapshotPath = path.join(snapshotsDir, snapshot.id);
      await fs.mkdir(snapshotPath, { recursive: true });
      
      const metadataPath = path.join(snapshotPath, 'metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(snapshot.metadata, null, 2));
    }
  }

  private async importLogs(targetPath: string, logs: any[]): Promise<void> {
    const logsDir = path.join(targetPath, '.codehive', 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    
    for (const log of logs) {
      const logPath = path.join(logsDir, log.filename);
      await fs.writeFile(logPath, JSON.stringify(log.data, null, 2));
    }
  }

  private async detectImportConflicts(targetPath: string, importProject: PortableProject): Promise<string[]> {
    const conflicts: string[] = [];
    
    try {
      const existingManager = new ProjectMetadataManager(targetPath);
      
      if (await existingManager.isPortableProject()) {
        const existingMetadata = await existingManager.getProjectMetadata();
        
        if (existingMetadata) {
          if (existingMetadata.id !== importProject.metadata.id) {
            conflicts.push('Different project ID');
          }
          
          if (existingMetadata.name !== importProject.metadata.name) {
            conflicts.push('Different project name');
          }
        }

        // Check for entity conflicts
        const [existingEpics, existingStories] = await Promise.all([
          existingManager.getEpics(),
          existingManager.getStories(),
        ]);

        const existingEpicIds = new Set(existingEpics.map(e => e.id));
        const existingStoryIds = new Set(existingStories.map(s => s.id));

        const conflictingEpics = importProject.epics.filter(e => existingEpicIds.has(e.id));
        const conflictingStories = importProject.stories.filter(s => existingStoryIds.has(s.id));

        if (conflictingEpics.length > 0) {
          conflicts.push(`${conflictingEpics.length} conflicting epics`);
        }
        
        if (conflictingStories.length > 0) {
          conflicts.push(`${conflictingStories.length} conflicting stories`);
        }
      }
    } catch {
      // Ignore conflicts detection errors
    }
    
    return conflicts;
  }

  private async createImportBackup(targetPath: string): Promise<void> {
    const backupPath = path.join(targetPath, '.codehive', 'backups', `pre-import-${Date.now()}.backup.gz`);
    await this.createProjectBackup(targetPath, backupPath);
  }

  private async readExportFile(filePath: string): Promise<any> {
    const isCompressed = filePath.endsWith('.gz');
    
    if (isCompressed) {
      return this.readCompressedFile(filePath);
    } else {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    }
  }

  private async writeCompressedFile(filePath: string, data: string): Promise<void> {
    const writeStream = createWriteStream(filePath);
    const gzipStream = createGzip();
    
    await pipeline(
      async function* () {
        yield data;
      },
      gzipStream,
      writeStream
    );
  }

  private async readCompressedFile(filePath: string): Promise<any> {
    const readStream = createReadStream(filePath);
    const gunzipStream = createGunzip();
    
    const chunks: Buffer[] = [];
    
    await pipeline(
      readStream,
      gunzipStream,
      async function* (source) {
        for await (const chunk of source) {
          chunks.push(chunk);
        }
      }
    );
    
    const content = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(content);
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}