/**
 * SQLiteManager - Handles SQLite database operations for portable CodeHive projects
 * Each project has its own SQLite database stored in .codehive/project.db
 */

import Database, { Database as DatabaseType } from 'better-sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
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
  EpicSchema,
  StorySchema,
  SprintSchema,
  AgentSpecSchema,
  CycleSchema,
  TokenUsageSchema,
  ProjectBudgetSchema,
} from './schemas';

export interface SQLiteManagerOptions {
  createIfMissing?: boolean;
  validateData?: boolean;
  backupOnWrite?: boolean;
  readonly?: boolean;
}

export class SQLiteManager {
  private projectPath: string;
  private codehivePath: string;
  private databasePath: string;
  private db: DatabaseType | null = null;
  private readonly: boolean = false;

  constructor(projectPath: string, options: SQLiteManagerOptions = {}) {
    this.projectPath = projectPath;
    this.codehivePath = path.join(projectPath, '.codehive');
    this.databasePath = path.join(this.codehivePath, 'project.db');
    this.readonly = options.readonly || false;
  }

  /**
   * Initialize the database connection and create tables if needed
   */
  async initialize(): Promise<void> {
    // Ensure .codehive directory exists
    await fs.mkdir(this.codehivePath, { recursive: true });

    // Create database connection
    this.db = new Database(this.databasePath, {
      readonly: this.readonly,
      fileMustExist: false,
    });

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    // Set WAL mode for better concurrency
    if (!this.readonly) {
      this.db.pragma('journal_mode = WAL');
    }

    // Create tables from schema
    await this.createTables();

    // Ensure .gitignore includes .codehive
    if (!this.readonly) {
      await this.updateGitignore();
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Check if project has SQLite database
   */
  async isPortableProject(): Promise<boolean> {
    try {
      await fs.access(this.databasePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create database tables from schema
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Use process.cwd() to get the project root and build the path from there
    const projectRoot = process.cwd();
    const schemaPath = path.join(projectRoot, 'lib', 'portable', 'sqlite-schema.sql');
    
    try {
      const schema = await fs.readFile(schemaPath, 'utf-8');
      
      // Execute schema statements
      this.db.exec(schema);
    } catch (error) {
      throw new Error(`Failed to load database schema from ${schemaPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // === Project Metadata Operations ===

  async getProjectMetadata(): Promise<ProjectMetadata | null> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM project_metadata LIMIT 1
    `);
    
    const row = stmt.get() as any;
    if (!row) return null;

    return ProjectMetadataSchema.parse({
      id: row.id,
      version: row.version,
      name: row.name,
      description: row.description || undefined,
      summary: row.summary || undefined,
      gitUrl: row.git_url || undefined,
      localPath: row.local_path,
      status: row.status,
      framework: row.framework || undefined,
      language: row.language || undefined,
      packageManager: row.package_manager || undefined,
      testFramework: row.test_framework || undefined,
      lintTool: row.lint_tool || undefined,
      buildTool: row.build_tool || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async saveProjectMetadata(metadata: ProjectMetadata): Promise<void> {
    if (!this.db) await this.initialize();
    
    ProjectMetadataSchema.parse(metadata);

    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO project_metadata (
        id, version, name, description, summary, git_url, local_path,
        status, framework, language, package_manager, test_framework,
        lint_tool, build_tool, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metadata.id,
      metadata.version,
      metadata.name,
      metadata.description,
      metadata.summary,
      metadata.gitUrl,
      metadata.localPath,
      metadata.status,
      metadata.framework,
      metadata.language,
      metadata.packageManager,
      metadata.testFramework,
      metadata.lintTool,
      metadata.buildTool,
      metadata.createdAt,
      metadata.updatedAt
    );
  }

  // === Settings Operations ===

  async getProjectSettings(): Promise<ProjectSettings | null> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM project_settings WHERE id = 1
    `);
    
    const row = stmt.get() as any;
    if (!row) return null;

    return ProjectSettingsSchema.parse({
      claudeModel: row.claude_model,
      maxTokensPerRequest: row.max_tokens_per_request,
      maxRequestsPerMinute: row.max_requests_per_minute,
      agentTimeout: row.agent_timeout,
      maxRetries: row.max_retries,
      autoExecuteTasks: Boolean(row.auto_execute_tasks),
      testCoverageThreshold: row.test_coverage_threshold,
      enforceTypeChecking: Boolean(row.enforce_type_checking),
      customInstructions: row.custom_instructions,
      excludePatterns: row.exclude_patterns,
    });
  }

  async saveProjectSettings(settings: ProjectSettings): Promise<void> {
    if (!this.db) await this.initialize();
    
    ProjectSettingsSchema.parse(settings);

    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO project_settings (
        id, claude_model, max_tokens_per_request, max_requests_per_minute,
        agent_timeout, max_retries, auto_execute_tasks, test_coverage_threshold,
        enforce_type_checking, custom_instructions, exclude_patterns, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(
      settings.claudeModel,
      settings.maxTokensPerRequest,
      settings.maxRequestsPerMinute,
      settings.agentTimeout,
      settings.maxRetries,
      settings.autoExecuteTasks ? 1 : 0,
      settings.testCoverageThreshold,
      settings.enforceTypeChecking ? 1 : 0,
      settings.customInstructions,
      settings.excludePatterns
    );
  }

  async updateProjectSettings(updates: Partial<ProjectSettings>): Promise<void> {
    const current = await this.getProjectSettings();
    if (!current) {
      await this.saveProjectSettings(ProjectSettingsSchema.parse(updates));
      return;
    }

    const updated = { ...current, ...updates };
    await this.saveProjectSettings(updated);
  }

  // === Budget Operations ===

  async getProjectBudget(): Promise<ProjectBudget | null> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM project_budget WHERE id = 1
    `);
    
    const row = stmt.get() as any;
    if (!row) return null;

    return ProjectBudgetSchema.parse({
      allocatedPercentage: row.allocated_percentage,
      dailyTokenBudget: row.daily_token_budget,
      usedTokens: row.used_tokens,
      lastResetAt: row.last_reset_at,
      warningNotified: Boolean(row.warning_notified),
      criticalNotified: Boolean(row.critical_notified),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async saveProjectBudget(budget: ProjectBudget): Promise<void> {
    if (!this.db) await this.initialize();
    
    ProjectBudgetSchema.parse(budget);

    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO project_budget (
        id, allocated_percentage, daily_token_budget, used_tokens,
        last_reset_at, warning_notified, critical_notified, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(
      budget.allocatedPercentage,
      budget.dailyTokenBudget,
      budget.usedTokens,
      budget.lastResetAt,
      budget.warningNotified ? 1 : 0,
      budget.criticalNotified ? 1 : 0
    );
  }

  // === Epic Operations ===

  async getEpics(): Promise<Epic[]> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM epics ORDER BY sequence ASC
    `);
    
    const rows = stmt.all() as any[];
    const epics: Epic[] = [];

    for (const row of rows) {
      // Get dependencies
      const depsStmt = this.db!.prepare(`
        SELECT depends_on FROM epic_dependencies WHERE epic_id = ?
      `);
      const dependencies = depsStmt.all(row.id).map((dep: any) => dep.depends_on);

      // Get dependents
      const dependentsStmt = this.db!.prepare(`
        SELECT epic_id FROM epic_dependencies WHERE depends_on = ?
      `);
      const dependents = dependentsStmt.all(row.id).map((dep: any) => dep.epic_id);

      epics.push(EpicSchema.parse({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        description: row.description,
        type: row.type,
        phase: row.phase,
        status: row.status,
        mvpPriority: row.mvp_priority,
        coreValue: row.core_value,
        sequence: row.sequence,
        estimatedStoryPoints: row.estimated_story_points,
        actualStoryPoints: row.actual_story_points,
        startDate: row.start_date,
        dueDate: row.due_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
        dependencies,
        dependents,
      }));
    }

    return epics;
  }

  async getEpic(epicId: string): Promise<Epic | null> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM epics WHERE id = ?
    `);
    
    const row = stmt.get(epicId) as any;
    if (!row) return null;

    // Get dependencies and dependents
    const depsStmt = this.db!.prepare(`
      SELECT depends_on FROM epic_dependencies WHERE epic_id = ?
    `);
    const dependencies = depsStmt.all(epicId).map((dep: any) => dep.depends_on);

    const dependentsStmt = this.db!.prepare(`
      SELECT epic_id FROM epic_dependencies WHERE depends_on = ?
    `);
    const dependents = dependentsStmt.all(epicId).map((dep: any) => dep.epic_id);

    return EpicSchema.parse({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      type: row.type,
      phase: row.phase,
      status: row.status,
      mvpPriority: row.mvp_priority,
      coreValue: row.core_value,
      sequence: row.sequence,
      estimatedStoryPoints: row.estimated_story_points,
      actualStoryPoints: row.actual_story_points,
      startDate: row.start_date,
      dueDate: row.due_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      dependencies,
      dependents,
    });
  }

  async saveEpic(epic: Epic): Promise<void> {
    if (!this.db) await this.initialize();
    
    EpicSchema.parse(epic);

    // Use transaction for epic and dependencies
    const transaction = this.db!.transaction(() => {
      // Insert/update epic
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO epics (
          id, project_id, title, description, type, phase, status, mvp_priority,
          core_value, sequence, estimated_story_points, actual_story_points,
          start_date, due_date, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        epic.id,
        epic.projectId,
        epic.title,
        epic.description,
        epic.type,
        epic.phase,
        epic.status,
        epic.mvpPriority,
        epic.coreValue,
        epic.sequence,
        epic.estimatedStoryPoints,
        epic.actualStoryPoints,
        epic.startDate,
        epic.dueDate,
        epic.createdAt,
        epic.updatedAt,
        epic.completedAt
      );

      // Clear existing dependencies
      const clearDeps = this.db!.prepare(`
        DELETE FROM epic_dependencies WHERE epic_id = ?
      `);
      clearDeps.run(epic.id);

      // Insert new dependencies
      if (epic.dependencies && epic.dependencies.length > 0) {
        const insertDep = this.db!.prepare(`
          INSERT INTO epic_dependencies (epic_id, depends_on) VALUES (?, ?)
        `);

        for (const depId of epic.dependencies) {
          insertDep.run(epic.id, depId);
        }
      }
    });

    transaction();
  }

  async deleteEpic(epicId: string): Promise<void> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      DELETE FROM epics WHERE id = ?
    `);
    
    stmt.run(epicId);
  }

  // === Story Operations ===

  async getStories(): Promise<Story[]> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM stories ORDER BY sequence ASC
    `);
    
    const rows = stmt.all() as any[];
    const stories: Story[] = [];

    for (const row of rows) {
      // Get dependencies
      const depsStmt = this.db!.prepare(`
        SELECT depends_on FROM story_dependencies WHERE story_id = ?
      `);
      const dependencies = depsStmt.all(row.id).map((dep: any) => dep.depends_on);

      // Get dependents
      const dependentsStmt = this.db!.prepare(`
        SELECT story_id FROM story_dependencies WHERE depends_on = ?
      `);
      const dependents = dependentsStmt.all(row.id).map((dep: any) => dep.story_id);

      stories.push(StorySchema.parse({
        id: row.id,
        epicId: row.epic_id,
        sprintId: row.sprint_id,
        title: row.title,
        description: row.description,
        status: row.status,
        position: row.position,
        assignedAgent: row.assigned_agent,
        targetBranch: row.target_branch,
        storyPoints: row.story_points,
        priority: row.priority,
        sequence: row.sequence,
        tddEnabled: Boolean(row.tdd_enabled),
        acceptanceCriteria: row.acceptance_criteria,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        dependencies,
        dependents,
      }));
    }

    return stories;
  }

  async getStory(storyId: string): Promise<Story | null> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM stories WHERE id = ?
    `);
    
    const row = stmt.get(storyId) as any;
    if (!row) return null;

    // Get dependencies and dependents
    const depsStmt = this.db!.prepare(`
      SELECT depends_on FROM story_dependencies WHERE story_id = ?
    `);
    const dependencies = depsStmt.all(storyId).map((dep: any) => dep.depends_on);

    const dependentsStmt = this.db!.prepare(`
      SELECT story_id FROM story_dependencies WHERE depends_on = ?
    `);
    const dependents = dependentsStmt.all(storyId).map((dep: any) => dep.story_id);

    return StorySchema.parse({
      id: row.id,
      epicId: row.epic_id,
      sprintId: row.sprint_id,
      title: row.title,
      description: row.description,
      status: row.status,
      position: row.position,
      assignedAgent: row.assigned_agent,
      targetBranch: row.target_branch,
      storyPoints: row.story_points,
      priority: row.priority,
      sequence: row.sequence,
      tddEnabled: Boolean(row.tdd_enabled),
      acceptanceCriteria: row.acceptance_criteria,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      dependencies,
      dependents,
    });
  }

  async saveStory(story: Story): Promise<void> {
    if (!this.db) await this.initialize();
    
    StorySchema.parse(story);

    // Use transaction for story and dependencies
    const transaction = this.db!.transaction(() => {
      // Insert/update story
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO stories (
          id, epic_id, sprint_id, title, description, status, position,
          assigned_agent, target_branch, story_points, priority, sequence,
          tdd_enabled, acceptance_criteria, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        story.id,
        story.epicId,
        story.sprintId,
        story.title,
        story.description,
        story.status,
        story.position,
        story.assignedAgent,
        story.targetBranch,
        story.storyPoints,
        story.priority,
        story.sequence,
        story.tddEnabled ? 1 : 0,
        story.acceptanceCriteria,
        story.createdAt,
        story.updatedAt
      );

      // Clear existing dependencies
      const clearDeps = this.db!.prepare(`
        DELETE FROM story_dependencies WHERE story_id = ?
      `);
      clearDeps.run(story.id);

      // Insert new dependencies
      if (story.dependencies && story.dependencies.length > 0) {
        const insertDep = this.db!.prepare(`
          INSERT INTO story_dependencies (story_id, depends_on) VALUES (?, ?)
        `);

        for (const depId of story.dependencies) {
          insertDep.run(story.id, depId);
        }
      }
    });

    transaction();
  }

  async deleteStory(storyId: string): Promise<void> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      DELETE FROM stories WHERE id = ?
    `);
    
    stmt.run(storyId);
  }

  // === Sprint Operations ===

  async getSprints(): Promise<Sprint[]> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM sprints ORDER BY start_date ASC
    `);
    
    const rows = stmt.all() as any[];
    const sprints: Sprint[] = [];

    for (const row of rows) {
      // Get story IDs
      const storyStmt = this.db!.prepare(`
        SELECT story_id FROM sprint_stories WHERE sprint_id = ?
      `);
      const storyIds = storyStmt.all(row.id).map((story: any) => story.story_id);

      // Get epic IDs
      const epicStmt = this.db!.prepare(`
        SELECT epic_id FROM sprint_epics WHERE sprint_id = ?
      `);
      const epicIds = epicStmt.all(row.id).map((epic: any) => epic.epic_id);

      sprints.push(SprintSchema.parse({
        id: row.id,
        name: row.name,
        goal: row.goal,
        startDate: row.start_date,
        endDate: row.end_date,
        duration: row.duration,
        status: row.status,
        plannedStoryPoints: row.planned_story_points,
        commitedStoryPoints: row.commited_story_points,
        completedStoryPoints: row.completed_story_points,
        velocity: row.velocity,
        planningNotes: row.planning_notes,
        reviewNotes: row.review_notes,
        retrospectiveNotes: row.retrospective_notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
        storyIds,
        epicIds,
      }));
    }

    return sprints;
  }

  async getSprint(sprintId: string): Promise<Sprint | null> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM sprints WHERE id = ?
    `);
    
    const row = stmt.get(sprintId) as any;
    if (!row) return null;

    // Get story and epic IDs
    const storyStmt = this.db!.prepare(`
      SELECT story_id FROM sprint_stories WHERE sprint_id = ?
    `);
    const storyIds = storyStmt.all(sprintId).map((story: any) => story.story_id);

    const epicStmt = this.db!.prepare(`
      SELECT epic_id FROM sprint_epics WHERE sprint_id = ?
    `);
    const epicIds = epicStmt.all(sprintId).map((epic: any) => epic.epic_id);

    return SprintSchema.parse({
      id: row.id,
      name: row.name,
      goal: row.goal,
      startDate: row.start_date,
      endDate: row.end_date,
      duration: row.duration,
      status: row.status,
      plannedStoryPoints: row.planned_story_points,
      commitedStoryPoints: row.commited_story_points,
      completedStoryPoints: row.completed_story_points,
      velocity: row.velocity,
      planningNotes: row.planning_notes,
      reviewNotes: row.review_notes,
      retrospectiveNotes: row.retrospective_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      storyIds,
      epicIds,
    });
  }

  async saveSprint(sprint: Sprint): Promise<void> {
    if (!this.db) await this.initialize();
    
    SprintSchema.parse(sprint);

    // Use transaction for sprint and related data
    const transaction = this.db!.transaction(() => {
      // Insert/update sprint
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO sprints (
          id, name, goal, start_date, end_date, duration, status,
          planned_story_points, commited_story_points, completed_story_points,
          velocity, planning_notes, review_notes, retrospective_notes,
          created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        sprint.id,
        sprint.name,
        sprint.goal,
        sprint.startDate,
        sprint.endDate,
        sprint.duration,
        sprint.status,
        sprint.plannedStoryPoints,
        sprint.commitedStoryPoints,
        sprint.completedStoryPoints,
        sprint.velocity,
        sprint.planningNotes,
        sprint.reviewNotes,
        sprint.retrospectiveNotes,
        sprint.createdAt,
        sprint.updatedAt,
        sprint.completedAt
      );

      // Clear existing relationships
      const clearStories = this.db!.prepare(`DELETE FROM sprint_stories WHERE sprint_id = ?`);
      clearStories.run(sprint.id);
      
      const clearEpics = this.db!.prepare(`DELETE FROM sprint_epics WHERE sprint_id = ?`);
      clearEpics.run(sprint.id);

      // Insert new relationships
      if (sprint.storyIds && sprint.storyIds.length > 0) {
        const insertStory = this.db!.prepare(`
          INSERT INTO sprint_stories (sprint_id, story_id) VALUES (?, ?)
        `);
        for (const storyId of sprint.storyIds) {
          insertStory.run(sprint.id, storyId);
        }
      }

      if (sprint.epicIds && sprint.epicIds.length > 0) {
        const insertEpic = this.db!.prepare(`
          INSERT INTO sprint_epics (sprint_id, epic_id) VALUES (?, ?)
        `);
        for (const epicId of sprint.epicIds) {
          insertEpic.run(sprint.id, epicId);
        }
      }
    });

    transaction();
  }

  async deleteSprint(sprintId: string): Promise<void> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      DELETE FROM sprints WHERE id = ?
    `);
    
    stmt.run(sprintId);
  }

  // === Agent Operations ===

  async getAgents(): Promise<AgentSpec[]> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM agent_specs ORDER BY name ASC
    `);
    
    const rows = stmt.all() as any[];
    const agents: AgentSpec[] = [];

    for (const row of rows) {
      // Get performance data
      const perfStmt = this.db!.prepare(`
        SELECT * FROM agent_performance WHERE agent_id = ? ORDER BY timestamp DESC
      `);
      const performance = perfStmt.all(row.id).map((perf: any) => ({
        id: perf.id,
        executionTime: perf.execution_time,
        tokensUsed: perf.tokens_used,
        success: Boolean(perf.success),
        errorMessage: perf.error_message,
        taskComplexity: perf.task_complexity,
        timestamp: perf.timestamp,
      }));

      // Get evolution data
      const evolStmt = this.db!.prepare(`
        SELECT * FROM agent_evolution WHERE agent_id = ? ORDER BY timestamp DESC
      `);
      const evolution = evolStmt.all(row.id).map((evol: any) => ({
        id: evol.id,
        version: evol.version,
        changes: evol.changes,
        performanceBefore: evol.performance_before,
        performanceAfter: evol.performance_after,
        reason: evol.reason,
        timestamp: evol.timestamp,
      }));

      agents.push(AgentSpecSchema.parse({
        id: row.id,
        name: row.name,
        type: row.type,
        purpose: row.purpose,
        capabilities: row.capabilities,
        dependencies: row.dependencies,
        prompt: row.prompt,
        constraints: row.constraints,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        performance,
        evolution,
      }));
    }

    return agents;
  }

  async getAgent(agentId: string): Promise<AgentSpec | null> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM agent_specs WHERE id = ?
    `);
    
    const row = stmt.get(agentId) as any;
    if (!row) return null;

    // Get performance and evolution data (same as above)
    const perfStmt = this.db!.prepare(`
      SELECT * FROM agent_performance WHERE agent_id = ? ORDER BY timestamp DESC
    `);
    const performance = perfStmt.all(agentId).map((perf: any) => ({
      id: perf.id,
      executionTime: perf.execution_time,
      tokensUsed: perf.tokens_used,
      success: Boolean(perf.success),
      errorMessage: perf.error_message,
      taskComplexity: perf.task_complexity,
      timestamp: perf.timestamp,
    }));

    const evolStmt = this.db!.prepare(`
      SELECT * FROM agent_evolution WHERE agent_id = ? ORDER BY timestamp DESC
    `);
    const evolution = evolStmt.all(agentId).map((evol: any) => ({
      id: evol.id,
      version: evol.version,
      changes: evol.changes,
      performanceBefore: evol.performance_before,
      performanceAfter: evol.performance_after,
      reason: evol.reason,
      timestamp: evol.timestamp,
    }));

    return AgentSpecSchema.parse({
      id: row.id,
      name: row.name,
      type: row.type,
      purpose: row.purpose,
      capabilities: row.capabilities,
      dependencies: row.dependencies,
      prompt: row.prompt,
      constraints: row.constraints,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      performance,
      evolution,
    });
  }

  async saveAgent(agent: AgentSpec): Promise<void> {
    if (!this.db) await this.initialize();
    
    AgentSpecSchema.parse(agent);

    // Use transaction for agent and related data
    const transaction = this.db!.transaction(() => {
      // Insert/update agent
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO agent_specs (
          id, name, type, purpose, capabilities, dependencies, prompt,
          constraints, created_at, updated_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        agent.id,
        agent.name,
        agent.type,
        agent.purpose,
        agent.capabilities,
        agent.dependencies,
        agent.prompt,
        agent.constraints,
        agent.createdAt,
        agent.updatedAt,
        agent.createdBy
      );

      // Clear existing performance and evolution data
      const clearPerf = this.db!.prepare(`DELETE FROM agent_performance WHERE agent_id = ?`);
      clearPerf.run(agent.id);
      
      const clearEvol = this.db!.prepare(`DELETE FROM agent_evolution WHERE agent_id = ?`);
      clearEvol.run(agent.id);

      // Insert performance data
      if (agent.performance && agent.performance.length > 0) {
        const insertPerf = this.db!.prepare(`
          INSERT INTO agent_performance (
            id, agent_id, execution_time, tokens_used, success,
            error_message, task_complexity, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const perf of agent.performance) {
          insertPerf.run(
            perf.id,
            agent.id,
            perf.executionTime,
            perf.tokensUsed,
            perf.success ? 1 : 0,
            perf.errorMessage,
            perf.taskComplexity,
            perf.timestamp
          );
        }
      }

      // Insert evolution data
      if (agent.evolution && agent.evolution.length > 0) {
        const insertEvol = this.db!.prepare(`
          INSERT INTO agent_evolution (
            id, agent_id, version, changes, performance_before,
            performance_after, reason, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const evol of agent.evolution) {
          insertEvol.run(
            evol.id,
            agent.id,
            evol.version,
            evol.changes,
            evol.performanceBefore,
            evol.performanceAfter,
            evol.reason,
            evol.timestamp
          );
        }
      }
    });

    transaction();
  }

  async deleteAgent(agentId: string): Promise<void> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      DELETE FROM agent_specs WHERE id = ?
    `);
    
    stmt.run(agentId);
  }

  // === Cycle Operations ===

  async getCycles(): Promise<Cycle[]> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM cycles ORDER BY sequence ASC
    `);
    
    const rows = stmt.all() as any[];
    const cycles: Cycle[] = [];

    for (const row of rows) {
      // Get tests
      const testsStmt = this.db!.prepare(`
        SELECT * FROM tests WHERE cycle_id = ? ORDER BY created_at ASC
      `);
      const tests = testsStmt.all(row.id).map((test: any) => ({
        id: test.id,
        name: test.name,
        description: test.description,
        code: test.code,
        filePath: test.file_path,
        status: test.status,
        lastRun: test.last_run,
        duration: test.duration,
        errorOutput: test.error_output,
        createdAt: test.created_at,
        updatedAt: test.updated_at,
      }));

      // Get artifacts
      const artifactsStmt = this.db!.prepare(`
        SELECT * FROM artifacts WHERE cycle_id = ? ORDER BY created_at ASC
      `);
      const artifacts = artifactsStmt.all(row.id).map((artifact: any) => ({
        id: artifact.id,
        type: artifact.type,
        name: artifact.name,
        path: artifact.path,
        content: artifact.content,
        purpose: artifact.purpose,
        phase: artifact.phase,
        createdAt: artifact.created_at,
        updatedAt: artifact.updated_at,
      }));

      // Get queries with comments
      const queriesStmt = this.db!.prepare(`
        SELECT * FROM queries WHERE cycle_id = ? ORDER BY created_at ASC
      `);
      const queryRows = queriesStmt.all(row.id);
      
      const queries = [];
      for (const queryRow of queryRows) {
        const commentsStmt = this.db!.prepare(`
          SELECT * FROM query_comments WHERE query_id = ? ORDER BY created_at ASC
        `);
        const comments = commentsStmt.all(queryRow.id).map((comment: any) => ({
          id: comment.id,
          content: comment.content,
          author: comment.author,
          createdAt: comment.created_at,
        }));

        queries.push({
          id: queryRow.id,
          type: queryRow.type,
          title: queryRow.title,
          question: queryRow.question,
          context: queryRow.context,
          urgency: queryRow.urgency,
          priority: queryRow.priority,
          status: queryRow.status,
          answer: queryRow.answer,
          answeredAt: queryRow.answered_at,
          createdAt: queryRow.created_at,
          updatedAt: queryRow.updated_at,
          comments,
        });
      }

      cycles.push(CycleSchema.parse({
        id: row.id,
        storyId: row.story_id,
        title: row.title,
        description: row.description,
        phase: row.phase,
        status: row.status,
        sequence: row.sequence,
        acceptanceCriteria: row.acceptance_criteria,
        constraints: row.constraints,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
        tests,
        artifacts,
        queries,
      }));
    }

    return cycles;
  }

  async getCycle(cycleId: string): Promise<Cycle | null> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM cycles WHERE id = ?
    `);
    
    const row = stmt.get(cycleId) as any;
    if (!row) return null;

    // Get related data (same logic as getCycles but for single cycle)
    const testsStmt = this.db!.prepare(`
      SELECT * FROM tests WHERE cycle_id = ? ORDER BY created_at ASC
    `);
    const tests = testsStmt.all(cycleId).map((test: any) => ({
      id: test.id,
      name: test.name,
      description: test.description,
      code: test.code,
      filePath: test.file_path,
      status: test.status,
      lastRun: test.last_run,
      duration: test.duration,
      errorOutput: test.error_output,
      createdAt: test.created_at,
      updatedAt: test.updated_at,
    }));

    const artifactsStmt = this.db!.prepare(`
      SELECT * FROM artifacts WHERE cycle_id = ? ORDER BY created_at ASC
    `);
    const artifacts = artifactsStmt.all(cycleId).map((artifact: any) => ({
      id: artifact.id,
      type: artifact.type,
      name: artifact.name,
      path: artifact.path,
      content: artifact.content,
      purpose: artifact.purpose,
      phase: artifact.phase,
      createdAt: artifact.created_at,
      updatedAt: artifact.updated_at,
    }));

    const queriesStmt = this.db!.prepare(`
      SELECT * FROM queries WHERE cycle_id = ? ORDER BY created_at ASC
    `);
    const queryRows = queriesStmt.all(cycleId);
    
    const queries = [];
    for (const queryRow of queryRows) {
      const commentsStmt = this.db!.prepare(`
        SELECT * FROM query_comments WHERE query_id = ? ORDER BY created_at ASC
      `);
      const comments = commentsStmt.all(queryRow.id).map((comment: any) => ({
        id: comment.id,
        content: comment.content,
        author: comment.author,
        createdAt: comment.created_at,
      }));

      queries.push({
        id: queryRow.id,
        type: queryRow.type,
        title: queryRow.title,
        question: queryRow.question,
        context: queryRow.context,
        urgency: queryRow.urgency,
        priority: queryRow.priority,
        status: queryRow.status,
        answer: queryRow.answer,
        answeredAt: queryRow.answered_at,
        createdAt: queryRow.created_at,
        updatedAt: queryRow.updated_at,
        comments,
      });
    }

    return CycleSchema.parse({
      id: row.id,
      storyId: row.story_id,
      title: row.title,
      description: row.description,
      phase: row.phase,
      status: row.status,
      sequence: row.sequence,
      acceptanceCriteria: row.acceptance_criteria,
      constraints: row.constraints,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      tests,
      artifacts,
      queries,
    });
  }

  async saveCycle(cycle: Cycle): Promise<void> {
    if (!this.db) await this.initialize();
    
    CycleSchema.parse(cycle);

    // Use transaction for cycle and all related data
    const transaction = this.db!.transaction(() => {
      // Insert/update cycle
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO cycles (
          id, story_id, title, description, phase, status, sequence,
          acceptance_criteria, constraints, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        cycle.id,
        cycle.storyId,
        cycle.title,
        cycle.description,
        cycle.phase,
        cycle.status,
        cycle.sequence,
        cycle.acceptanceCriteria,
        cycle.constraints,
        cycle.createdAt,
        cycle.updatedAt,
        cycle.completedAt
      );

      // Clear existing related data
      this.db!.prepare(`DELETE FROM tests WHERE cycle_id = ?`).run(cycle.id);
      this.db!.prepare(`DELETE FROM artifacts WHERE cycle_id = ?`).run(cycle.id);
      this.db!.prepare(`DELETE FROM queries WHERE cycle_id = ?`).run(cycle.id);

      // Insert tests
      if (cycle.tests && cycle.tests.length > 0) {
        const insertTest = this.db!.prepare(`
          INSERT INTO tests (
            id, cycle_id, name, description, code, file_path, status,
            last_run, duration, error_output, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const test of cycle.tests) {
          insertTest.run(
            test.id, cycle.id, test.name, test.description, test.code,
            test.filePath, test.status, test.lastRun, test.duration,
            test.errorOutput, test.createdAt, test.updatedAt
          );
        }
      }

      // Insert artifacts
      if (cycle.artifacts && cycle.artifacts.length > 0) {
        const insertArtifact = this.db!.prepare(`
          INSERT INTO artifacts (
            id, cycle_id, type, name, path, content, purpose,
            phase, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const artifact of cycle.artifacts) {
          insertArtifact.run(
            artifact.id, cycle.id, artifact.type, artifact.name,
            artifact.path, artifact.content, artifact.purpose,
            artifact.phase, artifact.createdAt, artifact.updatedAt
          );
        }
      }

      // Insert queries and their comments
      if (cycle.queries && cycle.queries.length > 0) {
        const insertQuery = this.db!.prepare(`
          INSERT INTO queries (
            id, cycle_id, type, title, question, context, urgency,
            priority, status, answer, answered_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertComment = this.db!.prepare(`
          INSERT INTO query_comments (id, query_id, content, author, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);

        for (const query of cycle.queries) {
          insertQuery.run(
            query.id, cycle.id, query.type, query.title, query.question,
            query.context, query.urgency, query.priority, query.status,
            query.answer, query.answeredAt, query.createdAt, query.updatedAt
          );

          // Insert comments
          if (query.comments && query.comments.length > 0) {
            for (const comment of query.comments) {
              insertComment.run(
                comment.id, query.id, comment.content,
                comment.author, comment.createdAt
              );
            }
          }
        }
      }
    });

    transaction();
  }

  async deleteCycle(cycleId: string): Promise<void> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      DELETE FROM cycles WHERE id = ?
    `);
    
    stmt.run(cycleId);
  }

  // === Token Usage Operations ===

  async getTokenUsage(): Promise<TokenUsage[]> {
    if (!this.db) await this.initialize();
    
    const stmt = this.db!.prepare(`
      SELECT * FROM token_usage ORDER BY timestamp DESC
    `);
    
    const rows = stmt.all() as any[];
    
    return rows.map(row => TokenUsageSchema.parse({
      id: row.id,
      agentType: row.agent_type,
      taskId: row.task_id,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      timestamp: row.timestamp,
    }));
  }

  async addTokenUsage(usage: TokenUsage): Promise<void> {
    if (!this.db) await this.initialize();
    
    TokenUsageSchema.parse(usage);

    const stmt = this.db!.prepare(`
      INSERT INTO token_usage (
        id, agent_type, task_id, input_tokens, output_tokens, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      usage.id,
      usage.agentType,
      usage.taskId,
      usage.inputTokens,
      usage.outputTokens,
      usage.timestamp
    );
  }

  // === Utility Methods ===

  private async updateGitignore(): Promise<void> {
    const gitignorePath = path.join(this.projectPath, '.gitignore');

    try {
      let content = await fs.readFile(gitignorePath, 'utf-8');
      
      if (!content.includes('.codehive')) {
        content += '\n# CodeHive\n.codehive/\n';
        await fs.writeFile(gitignorePath, content);
      }
    } catch {
      // If .gitignore doesn't exist, create it
      await fs.writeFile(gitignorePath, '# CodeHive\n.codehive/\n');
    }
  }

  /**
   * Create a backup of the database
   */
  async createBackup(): Promise<string> {
    if (!this.db) await this.initialize();
    
    const backupDir = path.join(this.codehivePath, 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `project-${timestamp}.db`);
    
    const backup = this.db!.backup(backupPath);
    await new Promise<void>((resolve, reject) => {
      backup.on('progress', ({ totalPages, remainingPages }) => {
        console.log(`Backup progress: ${totalPages - remainingPages}/${totalPages}`);
      });
      
      backup.on('done', () => {
        console.log('Database backup completed:', backupPath);
        resolve();
      });
      
      backup.on('error', reject);
    });
    
    return backupPath;
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<Record<string, number>> {
    if (!this.db) await this.initialize();
    
    const tables = [
      'epics', 'stories', 'sprints', 'cycles', 'agent_specs',
      'tests', 'artifacts', 'queries', 'token_usage'
    ];
    
    const stats: Record<string, number> = {};
    
    for (const table of tables) {
      const stmt = this.db!.prepare(`SELECT COUNT(*) as count FROM ${table}`);
      const result = stmt.get() as any;
      stats[table] = result.count;
    }
    
    return stats;
  }

  // === Export/Import Operations ===

  async exportPortableProject(): Promise<PortableProject> {
    const metadata = await this.getProjectMetadata();
    const settings = await this.getProjectSettings();
    const budget = await this.getProjectBudget();
    const epics = await this.getEpics();
    const stories = await this.getStories();
    const sprints = await this.getSprints();
    const agents = await this.getAgents();
    const cycles = await this.getCycles();
    const tokenUsage = await this.getTokenUsage();

    if (!metadata) {
      throw new Error('No project metadata found');
    }

    if (!settings) {
      throw new Error('No project settings found');
    }

    const portableProject: PortableProject = {
      metadata,
      settings,
      budget,
      epics,
      stories,
      sprints,
      agents,
      cycles,
      tokenUsage,
      createdAt: metadata.createdAt,
      updatedAt: new Date().toISOString(),
    };

    return portableProject;
  }

  async importPortableProject(portableProject: PortableProject): Promise<void> {
    if (!this.db) await this.initialize();

    // Use transaction for entire import
    const transaction = this.db!.transaction(() => {
      // Clear all existing data
      const tables = [
        'project_metadata', 'project_settings', 'project_budget',
        'epics', 'epic_dependencies', 'stories', 'story_dependencies',
        'sprints', 'sprint_stories', 'sprint_epics', 'agent_specs',
        'agent_performance', 'agent_evolution', 'cycles', 'tests',
        'artifacts', 'queries', 'query_comments', 'token_usage'
      ];

      for (const table of tables) {
        this.db!.prepare(`DELETE FROM ${table}`).run();
      }

      // Import all data
      this.saveProjectMetadata(portableProject.metadata);
      this.saveProjectSettings(portableProject.settings);
      
      if (portableProject.budget) {
        this.saveProjectBudget(portableProject.budget);
      }

      // Save individual entities
      for (const epic of portableProject.epics) {
        this.saveEpic(epic);
      }

      for (const story of portableProject.stories) {
        this.saveStory(story);
      }

      for (const sprint of portableProject.sprints) {
        this.saveSprint(sprint);
      }

      for (const agent of portableProject.agents) {
        this.saveAgent(agent);
      }

      for (const cycle of portableProject.cycles) {
        this.saveCycle(cycle);
      }

      // Import token usage
      for (const usage of portableProject.tokenUsage) {
        this.addTokenUsage(usage);
      }
    });

    transaction();
  }

  /**
   * Create default project metadata
   */
  private async createDefaultProjectMetadata(): Promise<ProjectMetadata> {
    const now = new Date().toISOString();
    const projectName = path.basename(this.projectPath);
    
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

  /**
   * Create default project settings
   */
  private async createDefaultProjectSettings(): Promise<ProjectSettings> {
    const settings: ProjectSettings = ProjectSettingsSchema.parse({});
    await this.saveProjectSettings(settings);
    return settings;
  }
}