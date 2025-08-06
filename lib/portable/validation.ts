/**
 * Project validation and integrity checking tools for portable CodeHive projects
 * Validates .codehive/ metadata structure and data consistency
 */

import { promises as fs } from 'fs';
import path from 'path';
import { ProjectMetadataManager } from './metadata-manager';
import {
  ProjectMetadataSchema,
  ProjectSettingsSchema,
  EpicSchema,
  StorySchema,
  SprintSchema,
  AgentSpecSchema,
  CycleSchema,
  TokenUsageSchema,
  ProjectBudgetSchema,
} from './schemas';

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  category: 'structure' | 'metadata' | 'data' | 'consistency' | 'performance';
  message: string;
  path?: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  metadata?: {
    hasProject: boolean;
    hasSettings: boolean;
    hasBudget: boolean;
    directories: string[];
    entityCounts: {
      epics: number;
      stories: number;
      sprints: number;
      agents: number;
      cycles: number;
      tokenUsage: number;
    };
  };
}

export interface ValidationOptions {
  checkStructure?: boolean;
  checkMetadata?: boolean;
  checkDataConsistency?: boolean;
  checkPerformance?: boolean;
  autoFix?: boolean;
  verbose?: boolean;
}

export class ProjectValidator {
  private metadataManager: ProjectMetadataManager;
  private projectPath: string;
  private codehivePath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.codehivePath = path.join(projectPath, '.codehive');
    this.metadataManager = new ProjectMetadataManager(projectPath);
  }

  /**
   * Comprehensive project validation
   */
  async validateProject(options: ValidationOptions = {}): Promise<ValidationResult> {
    const {
      checkStructure = true,
      checkMetadata = true,
      checkDataConsistency = true,
      checkPerformance = true,
      autoFix = false,
      verbose = false,
    } = options;

    const issues: ValidationIssue[] = [];
    const result: ValidationResult = {
      isValid: true,
      issues,
      summary: { errors: 0, warnings: 0, info: 0 },
      metadata: {
        hasProject: false,
        hasSettings: false,
        hasBudget: false,
        directories: [],
        entityCounts: {
          epics: 0,
          stories: 0,
          sprints: 0,
          agents: 0,
          cycles: 0,
          tokenUsage: 0,
        },
      },
    };

    try {
      // Check if project is portable
      if (!(await this.metadataManager.isPortableProject())) {
        issues.push({
          type: 'error',
          category: 'structure',
          message: 'Project is not a portable CodeHive project (missing .codehive/ directory or project.json)',
          suggestion: 'Run migration to convert to portable format',
        });
        result.isValid = false;
      } else {
        // Structure validation
        if (checkStructure) {
          await this.validateStructure(issues, result.metadata!, autoFix);
        }

        // Metadata validation
        if (checkMetadata) {
          await this.validateMetadata(issues, result.metadata!, autoFix);
        }

        // Data consistency validation
        if (checkDataConsistency) {
          await this.validateDataConsistency(issues, autoFix);
        }

        // Performance validation
        if (checkPerformance) {
          await this.validatePerformance(issues);
        }
      }

      // Calculate summary
      result.summary = this.calculateSummary(issues);
      result.isValid = result.summary.errors === 0;

      return result;

    } catch (error) {
      issues.push({
        type: 'error',
        category: 'structure',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });

      result.summary = this.calculateSummary(issues);
      result.isValid = false;
      return result;
    }
  }

  /**
   * Quick validation for basic checks
   */
  async quickValidate(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check basic structure
      if (!(await this.pathExists(this.codehivePath))) {
        issues.push('.codehive/ directory missing');
      }

      if (!(await this.pathExists(path.join(this.codehivePath, 'project.json')))) {
        issues.push('project.json missing');
      }

      // Try to load metadata
      try {
        await this.metadataManager.getProjectMetadata({ validateData: true });
      } catch (error) {
        issues.push(`Invalid project metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return {
        isValid: issues.length === 0,
        issues,
      };

    } catch (error) {
      return {
        isValid: false,
        issues: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Validate and repair project structure
   */
  async validateAndRepair(): Promise<ValidationResult> {
    const result = await this.validateProject({ autoFix: true });
    
    if (!result.isValid) {
      // Attempt additional repairs
      await this.attemptStructureRepair();
      
      // Re-validate after repair
      return this.validateProject({ autoFix: false });
    }

    return result;
  }

  // Private validation methods

  private async validateStructure(
    issues: ValidationIssue[], 
    metadata: ValidationResult['metadata']!, 
    autoFix: boolean
  ): Promise<void> {
    const requiredDirs = [
      'epics',
      'stories', 
      'sprints',
      'cycles',
      'agents',
      'usage',
      'logs',
      'workspaces',
      'locks',
      'backups',
    ];

    const existingDirs: string[] = [];

    // Check required directories
    for (const dir of requiredDirs) {
      const dirPath = path.join(this.codehivePath, dir);
      
      if (await this.pathExists(dirPath)) {
        existingDirs.push(dir);
      } else {
        issues.push({
          type: 'warning',
          category: 'structure',
          message: `Missing directory: .codehive/${dir}`,
          path: dirPath,
          suggestion: autoFix ? 'Will be created automatically' : 'Create missing directory',
        });

        if (autoFix) {
          try {
            await fs.mkdir(dirPath, { recursive: true });
            existingDirs.push(dir);
          } catch (error) {
            issues.push({
              type: 'error',
              category: 'structure',
              message: `Failed to create directory: .codehive/${dir}`,
              path: dirPath,
            });
          }
        }
      }
    }

    metadata.directories = existingDirs;

    // Check for unexpected files/directories
    try {
      const entries = await fs.readdir(this.codehivePath, { withFileTypes: true });
      const allowedFiles = ['project.json', 'settings.json', 'budget.json'];
      const allowedDirs = requiredDirs;

      for (const entry of entries) {
        if (entry.isDirectory() && !allowedDirs.includes(entry.name)) {
          issues.push({
            type: 'info',
            category: 'structure',
            message: `Unexpected directory: .codehive/${entry.name}`,
            path: path.join(this.codehivePath, entry.name),
          });
        } else if (entry.isFile() && !allowedFiles.includes(entry.name)) {
          issues.push({
            type: 'info', 
            category: 'structure',
            message: `Unexpected file: .codehive/${entry.name}`,
            path: path.join(this.codehivePath, entry.name),
          });
        }
      }
    } catch (error) {
      issues.push({
        type: 'error',
        category: 'structure',
        message: `Failed to read .codehive/ directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private async validateMetadata(
    issues: ValidationIssue[], 
    metadata: ValidationResult['metadata']!, 
    autoFix: boolean
  ): Promise<void> {
    // Validate project.json
    try {
      const projectMetadata = await this.metadataManager.getProjectMetadata({ validateData: true });
      if (projectMetadata) {
        metadata.hasProject = true;
        
        // Additional validations
        if (!projectMetadata.name.trim()) {
          issues.push({
            type: 'error',
            category: 'metadata',
            message: 'Project name is empty',
            path: path.join(this.codehivePath, 'project.json'),
          });
        }

        if (!projectMetadata.localPath || projectMetadata.localPath !== this.projectPath) {
          issues.push({
            type: 'error',
            category: 'metadata',
            message: 'Project localPath does not match current directory',
            path: path.join(this.codehivePath, 'project.json'),
            suggestion: autoFix ? 'Will be corrected automatically' : 'Update localPath in project.json',
          });

          if (autoFix) {
            projectMetadata.localPath = this.projectPath;
            projectMetadata.updatedAt = new Date().toISOString();
            await this.metadataManager.saveProjectMetadata(projectMetadata);
          }
        }
      }
    } catch (error) {
      issues.push({
        type: 'error',
        category: 'metadata',
        message: `Invalid project.json: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: path.join(this.codehivePath, 'project.json'),
      });
    }

    // Validate settings.json
    try {
      const settings = await this.metadataManager.getProjectSettings({ validateData: true });
      if (settings) {
        metadata.hasSettings = true;
      }
    } catch (error) {
      issues.push({
        type: 'warning',
        category: 'metadata',
        message: `Invalid or missing settings.json: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: path.join(this.codehivePath, 'settings.json'),
        suggestion: 'Create default settings file',
      });

      if (autoFix) {
        try {
          const defaultSettings = ProjectSettingsSchema.parse({});
          await this.metadataManager.saveProjectSettings(defaultSettings);
          metadata.hasSettings = true;
        } catch (fixError) {
          issues.push({
            type: 'error',
            category: 'metadata',
            message: `Failed to create default settings: ${fixError instanceof Error ? fixError.message : 'Unknown error'}`,
          });
        }
      }
    }

    // Validate budget.json (optional)
    try {
      const budget = await this.metadataManager.getProjectBudget();
      if (budget) {
        metadata.hasBudget = true;
      }
    } catch (error) {
      issues.push({
        type: 'info',
        category: 'metadata',
        message: `Budget configuration issue: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: path.join(this.codehivePath, 'budget.json'),
      });
    }

    // Count entities
    try {
      const [epics, stories, sprints, agents, cycles, tokenUsage] = await Promise.all([
        this.metadataManager.getEpics(),
        this.metadataManager.getStories(),
        this.metadataManager.getSprints(),
        this.metadataManager.getAgents(),
        this.metadataManager.getCycles(),
        this.metadataManager.getTokenUsage(),
      ]);

      metadata.entityCounts = {
        epics: epics.length,
        stories: stories.length,
        sprints: sprints.length,
        agents: agents.length,
        cycles: cycles.length,
        tokenUsage: tokenUsage.length,
      };
    } catch (error) {
      issues.push({
        type: 'warning',
        category: 'metadata',
        message: `Failed to count entities: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private async validateDataConsistency(issues: ValidationIssue[], autoFix: boolean): Promise<void> {
    try {
      // Get all data
      const [epics, stories, sprints] = await Promise.all([
        this.metadataManager.getEpics(),
        this.metadataManager.getStories(),
        this.metadataManager.getSprints(),
      ]);

      // Check epic-story relationships
      const epicIds = new Set(epics.map(e => e.id));
      for (const story of stories) {
        if (story.epicId && !epicIds.has(story.epicId)) {
          issues.push({
            type: 'error',
            category: 'consistency',
            message: `Story "${story.title}" references non-existent epic: ${story.epicId}`,
            path: path.join(this.codehivePath, 'stories', `${story.id}.json`),
            suggestion: 'Remove invalid epic reference or create missing epic',
          });

          if (autoFix) {
            story.epicId = undefined;
            await this.metadataManager.saveStory(story);
          }
        }
      }

      // Check sprint-story relationships
      const sprintIds = new Set(sprints.map(s => s.id));
      for (const story of stories) {
        if (story.sprintId && !sprintIds.has(story.sprintId)) {
          issues.push({
            type: 'error',
            category: 'consistency',
            message: `Story "${story.title}" references non-existent sprint: ${story.sprintId}`,
            path: path.join(this.codehivePath, 'stories', `${story.id}.json`),
            suggestion: 'Remove invalid sprint reference or create missing sprint',
          });

          if (autoFix) {
            story.sprintId = undefined;
            await this.metadataManager.saveStory(story);
          }
        }
      }

      // Check for duplicate IDs
      const allIds = new Set<string>();
      const entities = [
        ...epics.map(e => ({ type: 'epic', id: e.id, name: e.title })),
        ...stories.map(s => ({ type: 'story', id: s.id, name: s.title })),
        ...sprints.map(s => ({ type: 'sprint', id: s.id, name: s.name })),
      ];

      for (const entity of entities) {
        if (allIds.has(entity.id)) {
          issues.push({
            type: 'error',
            category: 'consistency',
            message: `Duplicate ID found: ${entity.id} (${entity.type}: ${entity.name})`,
            suggestion: 'Generate new unique ID for conflicting entity',
          });
        } else {
          allIds.add(entity.id);
        }
      }

      // Check story dependencies
      const storyIds = new Set(stories.map(s => s.id));
      for (const story of stories) {
        for (const depId of story.dependencies || []) {
          if (!storyIds.has(depId)) {
            issues.push({
              type: 'warning',
              category: 'consistency',
              message: `Story "${story.title}" has invalid dependency: ${depId}`,
              path: path.join(this.codehivePath, 'stories', `${story.id}.json`),
            });
          }
        }
      }

    } catch (error) {
      issues.push({
        type: 'error',
        category: 'consistency',
        message: `Data consistency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private async validatePerformance(issues: ValidationIssue[]): Promise<void> {
    try {
      // Check file sizes
      const files = [
        'project.json',
        'settings.json',
        'budget.json',
      ];

      for (const file of files) {
        const filePath = path.join(this.codehivePath, file);
        
        if (await this.pathExists(filePath)) {
          const stats = await fs.stat(filePath);
          
          if (stats.size > 1024 * 1024) { // 1MB
            issues.push({
              type: 'warning',
              category: 'performance',
              message: `Large metadata file: ${file} (${Math.round(stats.size / 1024)}KB)`,
              path: filePath,
              suggestion: 'Consider optimizing metadata structure',
            });
          }
        }
      }

      // Check entity counts
      const entityCounts = await this.getEntityCounts();
      
      if (entityCounts.tokenUsage > 10000) {
        issues.push({
          type: 'warning',
          category: 'performance',
          message: `Large number of token usage records: ${entityCounts.tokenUsage}`,
          suggestion: 'Consider archiving old token usage data',
        });
      }

      if (entityCounts.cycles > 1000) {
        issues.push({
          type: 'warning',
          category: 'performance',
          message: `Large number of TDD cycles: ${entityCounts.cycles}`,
          suggestion: 'Consider archiving completed cycles',
        });
      }

    } catch (error) {
      issues.push({
        type: 'warning',
        category: 'performance',
        message: `Performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private async attemptStructureRepair(): Promise<void> {
    try {
      // Re-initialize structure
      await this.metadataManager.initialize();
      
      // Create missing metadata files with defaults
      if (!(await this.pathExists(path.join(this.codehivePath, 'project.json')))) {
        await this.metadataManager.getProjectMetadata({ createIfMissing: true });
      }

      if (!(await this.pathExists(path.join(this.codehivePath, 'settings.json')))) {
        await this.metadataManager.getProjectSettings({ createIfMissing: true });
      }

    } catch (error) {
      console.error('Structure repair failed:', error);
    }
  }

  private async getEntityCounts(): Promise<{
    epics: number;
    stories: number;
    sprints: number;
    agents: number;
    cycles: number;
    tokenUsage: number;
  }> {
    try {
      const [epics, stories, sprints, agents, cycles, tokenUsage] = await Promise.all([
        this.metadataManager.getEpics(),
        this.metadataManager.getStories(),
        this.metadataManager.getSprints(),
        this.metadataManager.getAgents(),
        this.metadataManager.getCycles(),
        this.metadataManager.getTokenUsage(),
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
      return {
        epics: 0,
        stories: 0,
        sprints: 0,
        agents: 0,
        cycles: 0,
        tokenUsage: 0,
      };
    }
  }

  private calculateSummary(issues: ValidationIssue[]): { errors: number; warnings: number; info: number } {
    return issues.reduce(
      (acc, issue) => {
        acc[issue.type === 'error' ? 'errors' : issue.type === 'warning' ? 'warnings' : 'info']++;
        return acc;
      },
      { errors: 0, warnings: 0, info: 0 }
    );
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Utility functions

/**
 * Quick validation for a project path
 */
export async function validateProjectPath(projectPath: string): Promise<boolean> {
  const validator = new ProjectValidator(projectPath);
  const result = await validator.quickValidate();
  return result.isValid;
}

/**
 * Get validation summary for multiple projects
 */
export async function validateMultipleProjects(projectPaths: string[]): Promise<{
  validProjects: number;
  invalidProjects: number;
  totalIssues: number;
  results: Array<{ path: string; isValid: boolean; issueCount: number }>;
}> {
  const results = [];
  let validProjects = 0;
  let invalidProjects = 0;
  let totalIssues = 0;

  for (const projectPath of projectPaths) {
    try {
      const validator = new ProjectValidator(projectPath);
      const result = await validator.validateProject();
      
      const issueCount = result.issues.length;
      totalIssues += issueCount;
      
      if (result.isValid) {
        validProjects++;
      } else {
        invalidProjects++;
      }

      results.push({
        path: projectPath,
        isValid: result.isValid,
        issueCount,
      });
    } catch (error) {
      invalidProjects++;
      totalIssues++;
      
      results.push({
        path: projectPath,
        isValid: false,
        issueCount: 1,
      });
    }
  }

  return {
    validProjects,
    invalidProjects,
    totalIssues,
    results,
  };
}