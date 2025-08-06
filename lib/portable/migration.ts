/**
 * Migration utilities for converting existing centralized projects to portable format
 * Exports data from SQLite database to .codehive/ directories
 */

import { prisma } from '@/lib/db';
import { ProjectMetadataManager } from './metadata-manager';
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
  PortableProject 
} from './schemas';
import { promises as fs } from 'fs';
import path from 'path';

export interface MigrationResult {
  projectId: string;
  projectName: string;
  success: boolean;
  error?: string;
  migratedEntities: {
    metadata: boolean;
    settings: boolean;
    budget: boolean;
    epics: number;
    stories: number;
    sprints: number;
    agents: number;
    cycles: number;
    tokenUsage: number;
  };
}

export interface MigrationOptions {
  dryRun?: boolean;
  backupOriginal?: boolean;
  skipExisting?: boolean;
  validateOutput?: boolean;
}

export class ProjectMigrationService {
  
  /**
   * Migrate a single project from database to portable format
   */
  async migrateProject(projectId: string, options: MigrationOptions = {}): Promise<MigrationResult> {
    const { dryRun = false, backupOriginal = true, skipExisting = true, validateOutput = true } = options;

    const result: MigrationResult = {
      projectId,
      projectName: '',
      success: false,
      migratedEntities: {
        metadata: false,
        settings: false,
        budget: false,
        epics: 0,
        stories: 0,
        sprints: 0,
        agents: 0,
        cycles: 0,
        tokenUsage: 0,
      },
    };

    try {
      // Fetch project from database
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          settings: true,
          budget: true,
          epics: {
            include: {
              dependencies: true,
              dependents: true,
            },
          },
          kanbanCards: {
            include: {
              dependencies: true,
              dependents: true,
            },
          },
          sprints: {
            include: {
              sprintEpics: true,
            },
          },
          agentSpecs: {
            include: {
              performance: true,
              evolution: true,
            },
          },
          cycles: {
            include: {
              tests: true,
              artifacts: true,
              queries: {
                include: {
                  comments: true,
                },
              },
            },
          },
          tokenUsage: true,
        },
      });

      if (!project) {
        result.error = `Project ${projectId} not found`;
        return result;
      }

      result.projectName = project.name;

      // Check if project path exists
      if (!project.localPath || !(await this.pathExists(project.localPath))) {
        result.error = `Project path ${project.localPath} does not exist`;
        return result;
      }

      const metadataManager = new ProjectMetadataManager(project.localPath);

      // Check if already migrated
      if (skipExisting && await metadataManager.isPortableProject()) {
        result.error = 'Project already migrated (use skipExisting: false to force re-migration)';
        return result;
      }

      if (dryRun) {
        // Just validate the data without writing
        await this.validateProjectData(project);
        result.success = true;
        return result;
      }

      // Initialize .codehive directory structure
      await metadataManager.initialize();

      // Backup original database data if requested
      if (backupOriginal) {
        await this.backupProjectData(project);
      }

      // Migrate project metadata
      const metadata = this.convertProjectMetadata(project);
      await metadataManager.saveProjectMetadata(metadata, { validateData: validateOutput });
      result.migratedEntities.metadata = true;

      // Migrate project settings
      if (project.settings) {
        const settings = this.convertProjectSettings(project.settings);
        await metadataManager.saveProjectSettings(settings, { validateData: validateOutput });
        result.migratedEntities.settings = true;
      }

      // Migrate project budget
      if (project.budget) {
        const budget = this.convertProjectBudget(project.budget);
        await metadataManager.saveProjectBudget(budget);
        result.migratedEntities.budget = true;
      }

      // Migrate epics
      for (const epic of project.epics) {
        const convertedEpic = this.convertEpic(epic);
        await metadataManager.saveEpic(convertedEpic);
        result.migratedEntities.epics++;
      }

      // Migrate stories (kanban cards)
      for (const card of project.kanbanCards) {
        const story = this.convertKanbanCardToStory(card);
        await metadataManager.saveStory(story);
        result.migratedEntities.stories++;
      }

      // Migrate sprints
      for (const sprint of project.sprints) {
        const convertedSprint = this.convertSprint(sprint);
        await metadataManager.saveSprint(convertedSprint);
        result.migratedEntities.sprints++;
      }

      // Migrate agent specifications
      for (const agent of project.agentSpecs) {
        const convertedAgent = this.convertAgentSpec(agent);
        await metadataManager.saveAgent(convertedAgent);
        result.migratedEntities.agents++;
      }

      // Migrate TDD cycles
      for (const cycle of project.cycles) {
        const convertedCycle = this.convertCycle(cycle);
        await metadataManager.saveCycle(convertedCycle);
        result.migratedEntities.cycles++;
      }

      // Migrate token usage
      for (const usage of project.tokenUsage) {
        const convertedUsage = this.convertTokenUsage(usage);
        await metadataManager.addTokenUsage(convertedUsage);
        result.migratedEntities.tokenUsage++;
      }

      result.success = true;
      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      return result;
    }
  }

  /**
   * Migrate all projects from database to portable format
   */
  async migrateAllProjects(options: MigrationOptions = {}): Promise<MigrationResult[]> {
    const projects = await prisma.project.findMany({
      select: { id: true, name: true, localPath: true },
    });

    const results: MigrationResult[] = [];

    for (const project of projects) {
      console.log(`Migrating project: ${project.name} (${project.id})`);
      const result = await this.migrateProject(project.id, options);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ Successfully migrated ${project.name}`);
      } else {
        console.log(`❌ Failed to migrate ${project.name}: ${result.error}`);
      }
    }

    return results;
  }

  /**
   * Generate migration report
   */
  generateMigrationReport(results: MigrationResult[]): string {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    const totalEntities = successful.reduce((acc, r) => ({
      epics: acc.epics + r.migratedEntities.epics,
      stories: acc.stories + r.migratedEntities.stories,
      sprints: acc.sprints + r.migratedEntities.sprints,
      agents: acc.agents + r.migratedEntities.agents,
      cycles: acc.cycles + r.migratedEntities.cycles,
      tokenUsage: acc.tokenUsage + r.migratedEntities.tokenUsage,
    }), { epics: 0, stories: 0, sprints: 0, agents: 0, cycles: 0, tokenUsage: 0 });

    let report = '# CodeHive Project Migration Report\n\n';
    report += `## Summary\n`;
    report += `- Total projects: ${results.length}\n`;
    report += `- Successfully migrated: ${successful.length}\n`;
    report += `- Failed: ${failed.length}\n\n`;

    report += `## Migrated Entities\n`;
    report += `- Epics: ${totalEntities.epics}\n`;
    report += `- Stories: ${totalEntities.stories}\n`;
    report += `- Sprints: ${totalEntities.sprints}\n`;
    report += `- Agents: ${totalEntities.agents}\n`;
    report += `- Cycles: ${totalEntities.cycles}\n`;
    report += `- Token Usage Records: ${totalEntities.tokenUsage}\n\n`;

    if (successful.length > 0) {
      report += `## Successful Migrations\n`;
      for (const result of successful) {
        report += `- ✅ ${result.projectName} (${result.projectId})\n`;
      }
      report += '\n';
    }

    if (failed.length > 0) {
      report += `## Failed Migrations\n`;
      for (const result of failed) {
        report += `- ❌ ${result.projectName} (${result.projectId}): ${result.error}\n`;
      }
      report += '\n';
    }

    return report;
  }

  // Private conversion methods

  private convertProjectMetadata(project: any): ProjectMetadata {
    return {
      version: '1.0.0',
      id: project.id,
      name: project.name,
      description: project.description || undefined,
      summary: project.summary || undefined,
      gitUrl: project.gitUrl || undefined,
      localPath: project.localPath,
      status: project.status,
      framework: project.framework || undefined,
      language: project.language || undefined,
      packageManager: project.packageManager || undefined,
      testFramework: project.testFramework || undefined,
      lintTool: project.lintTool || undefined,
      buildTool: project.buildTool || undefined,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  private convertProjectSettings(settings: any): ProjectSettings {
    return {
      maxTokensPerDay: settings.maxTokensPerDay,
      maxTokensPerRequest: settings.maxTokensPerRequest,
      maxRequestsPerMinute: settings.maxRequestsPerMinute,
      maxRequestsPerHour: settings.maxRequestsPerHour,
      agentTimeout: settings.agentTimeout,
      maxRetries: settings.maxRetries,
      parallelAgentLimit: settings.parallelAgentLimit,
      autoReviewOnImport: settings.autoReviewOnImport,
      maxQueueSize: settings.maxQueueSize,
      taskPriority: settings.taskPriority,
      autoExecuteTasks: settings.autoExecuteTasks,
      emailNotifications: settings.emailNotifications,
      slackWebhookUrl: settings.slackWebhookUrl || undefined,
      discordWebhookUrl: settings.discordWebhookUrl || undefined,
      notifyOnTaskComplete: settings.notifyOnTaskComplete,
      notifyOnTaskFail: settings.notifyOnTaskFail,
      codeAnalysisDepth: settings.codeAnalysisDepth,
      testCoverageThreshold: settings.testCoverageThreshold,
      enforceTypeChecking: settings.enforceTypeChecking,
      autoFixLintErrors: settings.autoFixLintErrors,
      claudeModel: settings.claudeModel,
      customInstructions: settings.customInstructions || undefined,
      excludePatterns: settings.excludePatterns || undefined,
      includeDependencies: settings.includeDependencies,
    };
  }

  private convertProjectBudget(budget: any): ProjectBudget {
    return {
      allocatedPercentage: budget.allocatedPercentage,
      dailyTokenBudget: budget.dailyTokenBudget,
      usedTokens: budget.usedTokens,
      lastResetAt: budget.lastResetAt.toISOString(),
      warningNotified: budget.warningNotified,
      criticalNotified: budget.criticalNotified,
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
    };
  }

  private convertEpic(epic: any): Epic {
    return {
      id: epic.id,
      title: epic.title,
      description: epic.description || undefined,
      type: epic.type,
      phase: epic.phase,
      status: epic.status,
      mvpPriority: epic.mvpPriority,
      coreValue: epic.coreValue || undefined,
      sequence: epic.sequence,
      estimatedStoryPoints: epic.estimatedStoryPoints,
      actualStoryPoints: epic.actualStoryPoints,
      startDate: epic.startDate?.toISOString(),
      dueDate: epic.dueDate?.toISOString(),
      createdAt: epic.createdAt.toISOString(),
      updatedAt: epic.updatedAt.toISOString(),
      completedAt: epic.completedAt?.toISOString(),
      dependencies: epic.dependencies?.map((d: any) => d.dependsOnId) || [],
      dependents: epic.dependents?.map((d: any) => d.epicId) || [],
    };
  }

  private convertKanbanCardToStory(card: any): Story {
    return {
      id: card.id,
      epicId: card.epicId || undefined,
      sprintId: card.sprintId || undefined,
      title: card.title,
      description: card.description || undefined,
      status: card.status,
      position: card.position,
      assignedAgent: card.assignedAgent || undefined,
      targetBranch: card.targetBranch || undefined,
      storyPoints: card.storyPoints || undefined,
      priority: card.priority,
      sequence: card.sequence,
      tddEnabled: card.tddEnabled,
      acceptanceCriteria: card.acceptanceCriteria || undefined,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
      dependencies: card.dependencies?.map((d: any) => d.dependsOnId) || [],
      dependents: card.dependents?.map((d: any) => d.storyId) || [],
    };
  }

  private convertSprint(sprint: any): Sprint {
    return {
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal || undefined,
      startDate: sprint.startDate.toISOString(),
      endDate: sprint.endDate.toISOString(),
      duration: sprint.duration,
      status: sprint.status,
      plannedStoryPoints: sprint.plannedStoryPoints,
      commitedStoryPoints: sprint.commitedStoryPoints,
      completedStoryPoints: sprint.completedStoryPoints,
      velocity: sprint.velocity || undefined,
      planningNotes: sprint.planningNotes || undefined,
      reviewNotes: sprint.reviewNotes || undefined,
      retrospectiveNotes: sprint.retrospectiveNotes || undefined,
      createdAt: sprint.createdAt.toISOString(),
      updatedAt: sprint.updatedAt.toISOString(),
      completedAt: sprint.completedAt?.toISOString(),
      storyIds: sprint.stories?.map((s: any) => s.id) || [],
      epicIds: sprint.sprintEpics?.map((se: any) => se.epicId) || [],
    };
  }

  private convertAgentSpec(agent: any): AgentSpec {
    return {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      purpose: agent.purpose,
      capabilities: agent.capabilities,
      dependencies: agent.dependencies,
      prompt: agent.prompt,
      constraints: agent.constraints,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
      createdBy: agent.createdBy,
      performance: agent.performance?.map((p: any) => ({
        id: p.id,
        executionTime: p.executionTime,
        tokensUsed: p.tokensUsed,
        success: p.success,
        errorMessage: p.errorMessage || undefined,
        taskComplexity: p.taskComplexity || undefined,
        timestamp: p.timestamp.toISOString(),
      })) || [],
      evolution: agent.evolution?.map((e: any) => ({
        id: e.id,
        version: e.version,
        changes: e.changes,
        performanceBefore: e.performanceBefore,
        performanceAfter: e.performanceAfter || undefined,
        reason: e.reason,
        timestamp: e.timestamp.toISOString(),
      })) || [],
    };
  }

  private convertCycle(cycle: any): Cycle {
    return {
      id: cycle.id,
      storyId: cycle.storyId || undefined,
      title: cycle.title,
      description: cycle.description || undefined,
      phase: cycle.phase,
      status: cycle.status,
      sequence: cycle.sequence,
      acceptanceCriteria: cycle.acceptanceCriteria,
      constraints: cycle.constraints || undefined,
      createdAt: cycle.createdAt.toISOString(),
      updatedAt: cycle.updatedAt.toISOString(),
      completedAt: cycle.completedAt?.toISOString(),
      tests: cycle.tests?.map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description || undefined,
        code: t.code,
        filePath: t.filePath || undefined,
        status: t.status,
        lastRun: t.lastRun?.toISOString(),
        duration: t.duration || undefined,
        errorOutput: t.errorOutput || undefined,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })) || [],
      artifacts: cycle.artifacts?.map((a: any) => ({
        id: a.id,
        type: a.type,
        name: a.name,
        path: a.path,
        content: a.content,
        purpose: a.purpose || undefined,
        phase: a.phase,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })) || [],
      queries: cycle.queries?.map((q: any) => ({
        id: q.id,
        type: q.type,
        title: q.title,
        question: q.question,
        context: q.context,
        urgency: q.urgency,
        priority: q.priority,
        status: q.status,
        answer: q.answer || undefined,
        answeredAt: q.answeredAt?.toISOString(),
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
        comments: q.comments?.map((c: any) => ({
          id: c.id,
          content: c.content,
          author: c.author,
          createdAt: c.createdAt.toISOString(),
        })) || [],
      })) || [],
    };
  }

  private convertTokenUsage(usage: any): TokenUsage {
    return {
      id: usage.id,
      agentType: usage.agentType,
      taskId: usage.taskId || undefined,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      timestamp: usage.timestamp.toISOString(),
    };
  }

  private async validateProjectData(project: any): Promise<void> {
    // Basic validation - could be expanded
    if (!project.localPath) {
      throw new Error('Project localPath is required');
    }

    if (!(await this.pathExists(project.localPath))) {
      throw new Error(`Project path ${project.localPath} does not exist`);
    }
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async backupProjectData(project: any): Promise<void> {
    const backupDir = path.join(project.localPath, '.codehive', 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `migration-backup-${timestamp}.json`);

    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(backupFile, JSON.stringify(project, null, 2));
  }
}