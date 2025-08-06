/**
 * Hybrid Metadata Manager - Combines JSON files with local SQLite database
 * for optimal performance and portability
 */

import { promises as fs } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { 
  ProjectMetadata, 
  ProjectSettings, 
  ProjectBudget,
  Epic,
  Story,
  Sprint,
  Cycle,
  TokenUsage,
  ProjectMetadataSchema,
  ProjectSettingsSchema,
  ProjectBudgetSchema,
} from './schemas';
import { PORTABLE_DB_SCHEMA } from './schemas/database';

export class HybridMetadataManager {
  private projectPath: string;
  private codehivePath: string;
  private db: Database.Database | null = null;
  private metadataCache: Map<string, any> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.codehivePath = path.join(projectPath, '.codehive');
  }

  /**
   * Initialize the hybrid structure (JSON + SQLite)
   */
  async initialize(): Promise<void> {
    // Create directory structure
    const dirs = [
      this.codehivePath,
      path.join(this.codehivePath, 'agents'),
      path.join(this.codehivePath, 'workspaces'),
      path.join(this.codehivePath, 'locks'),
      path.join(this.codehivePath, 'backups'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Initialize SQLite database
    await this.initializeDatabase();
    
    // Update .gitignore
    await this.updateGitignore();
  }

  /**
   * Initialize SQLite database with schema
   */
  private async initializeDatabase(): Promise<void> {
    const dbPath = path.join(this.codehivePath, 'codehive.db');
    
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Better concurrency
    this.db.pragma('foreign_keys = ON');  // Enable foreign key constraints
    
    // Create schema
    this.db.exec(PORTABLE_DB_SCHEMA);
  }

  /**
   * Get database connection (lazy initialization)
   */
  private getDb(): Database.Database {
    if (!this.db) {
      const dbPath = path.join(this.codehivePath, 'codehive.db');
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
    }
    return this.db;
  }

  // === JSON-based operations (unchanged) ===

  async getProjectMetadata(): Promise<ProjectMetadata | null> {
    try {
      const filePath = path.join(this.codehivePath, 'project.json');
      const data = await this.readJsonFile(filePath);
      return ProjectMetadataSchema.parse(data);
    } catch {
      return null;
    }
  }

  async saveProjectMetadata(metadata: ProjectMetadata): Promise<void> {
    const filePath = path.join(this.codehivePath, 'project.json');
    await this.writeJsonFile(filePath, metadata);
  }

  async getProjectSettings(): Promise<ProjectSettings | null> {
    try {
      const filePath = path.join(this.codehivePath, 'settings.json');
      const data = await this.readJsonFile(filePath);
      return ProjectSettingsSchema.parse(data);
    } catch {
      return null;
    }
  }

  async saveProjectSettings(settings: ProjectSettings): Promise<void> {
    const filePath = path.join(this.codehivePath, 'settings.json');
    await this.writeJsonFile(filePath, settings);
  }

  async getProjectBudget(): Promise<ProjectBudget | null> {
    try {
      const filePath = path.join(this.codehivePath, 'budget.json');
      const data = await this.readJsonFile(filePath);
      return ProjectBudgetSchema.parse(data);
    } catch {
      return null;
    }
  }

  async saveProjectBudget(budget: ProjectBudget): Promise<void> {
    const filePath = path.join(this.codehivePath, 'budget.json');
    await this.writeJsonFile(filePath, budget);
  }

  // === Database-based operations ===

  // Epic operations
  async getEpics(): Promise<Epic[]> {
    const db = this.getDb();
    const rows = db.prepare(`
      SELECT e.*, 
        GROUP_CONCAT(DISTINCT ed1.depends_on_id) as dependencies,
        GROUP_CONCAT(DISTINCT ed2.epic_id) as dependents
      FROM epics e
      LEFT JOIN epic_dependencies ed1 ON e.id = ed1.epic_id
      LEFT JOIN epic_dependencies ed2 ON e.id = ed2.depends_on_id
      GROUP BY e.id
      ORDER BY e.sequence
    `).all();

    return rows.map(row => ({
      ...row,
      dependencies: row.dependencies ? row.dependencies.split(',') : [],
      dependents: row.dependents ? row.dependents.split(',') : [],
    }));
  }

  async getEpic(epicId: string): Promise<Epic | null> {
    const db = this.getDb();
    const row = db.prepare('SELECT * FROM epics WHERE id = ?').get(epicId);
    
    if (!row) return null;

    // Get dependencies
    const deps = db.prepare('SELECT depends_on_id FROM epic_dependencies WHERE epic_id = ?').all(epicId);
    const dependents = db.prepare('SELECT epic_id FROM epic_dependencies WHERE depends_on_id = ?').all(epicId);

    return {
      ...row,
      dependencies: deps.map(d => d.depends_on_id),
      dependents: dependents.map(d => d.epic_id),
    };
  }

  async saveEpic(epic: Epic): Promise<void> {
    const db = this.getDb();
    const { dependencies, dependents, ...epicData } = epic;

    db.transaction(() => {
      // Upsert epic
      db.prepare(`
        INSERT INTO epics (id, title, description, type, phase, status, mvp_priority, 
          core_value, sequence, estimated_story_points, actual_story_points, 
          start_date, due_date, created_at, updated_at, completed_at)
        VALUES (@id, @title, @description, @type, @phase, @status, @mvp_priority,
          @core_value, @sequence, @estimated_story_points, @actual_story_points,
          @start_date, @due_date, @created_at, @updated_at, @completed_at)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          type = excluded.type,
          phase = excluded.phase,
          status = excluded.status,
          mvp_priority = excluded.mvp_priority,
          core_value = excluded.core_value,
          sequence = excluded.sequence,
          estimated_story_points = excluded.estimated_story_points,
          actual_story_points = excluded.actual_story_points,
          start_date = excluded.start_date,
          due_date = excluded.due_date,
          updated_at = excluded.updated_at,
          completed_at = excluded.completed_at
      `).run(epicData);

      // Update dependencies
      db.prepare('DELETE FROM epic_dependencies WHERE epic_id = ?').run(epic.id);
      
      const insertDep = db.prepare(`
        INSERT INTO epic_dependencies (id, epic_id, depends_on_id, type, created_at)
        VALUES (?, ?, ?, 'BLOCKS', datetime('now'))
      `);

      for (const depId of dependencies || []) {
        insertDep.run(`${epic.id}-${depId}`, epic.id, depId);
      }
    })();
  }

  async deleteEpic(epicId: string): Promise<void> {
    const db = this.getDb();
    db.prepare('DELETE FROM epics WHERE id = ?').run(epicId);
  }

  // Story operations
  async getStories(): Promise<Story[]> {
    const db = this.getDb();
    const rows = db.prepare(`
      SELECT s.*,
        GROUP_CONCAT(DISTINCT sd1.depends_on_id) as dependencies,
        GROUP_CONCAT(DISTINCT sd2.story_id) as dependents
      FROM stories s
      LEFT JOIN story_dependencies sd1 ON s.id = sd1.story_id
      LEFT JOIN story_dependencies sd2 ON s.id = sd2.depends_on_id
      GROUP BY s.id
      ORDER BY s.sequence
    `).all();

    return rows.map(row => ({
      ...row,
      tdd_enabled: !!row.tdd_enabled,
      dependencies: row.dependencies ? row.dependencies.split(',') : [],
      dependents: row.dependents ? row.dependents.split(',') : [],
    }));
  }

  async getStoriesByEpic(epicId: string): Promise<Story[]> {
    const db = this.getDb();
    const rows = db.prepare('SELECT * FROM stories WHERE epic_id = ? ORDER BY sequence').all(epicId);
    return rows.map(row => ({ ...row, tdd_enabled: !!row.tdd_enabled }));
  }

  async getStoriesBySprint(sprintId: string): Promise<Story[]> {
    const db = this.getDb();
    const rows = db.prepare('SELECT * FROM stories WHERE sprint_id = ? ORDER BY position').all(sprintId);
    return rows.map(row => ({ ...row, tdd_enabled: !!row.tdd_enabled }));
  }

  async saveStory(story: Story): Promise<void> {
    const db = this.getDb();
    const { dependencies, dependents, ...storyData } = story;

    db.transaction(() => {
      db.prepare(`
        INSERT INTO stories (id, epic_id, sprint_id, title, description, status, 
          position, assigned_agent, target_branch, story_points, priority, sequence,
          tdd_enabled, acceptance_criteria, created_at, updated_at)
        VALUES (@id, @epic_id, @sprint_id, @title, @description, @status,
          @position, @assigned_agent, @target_branch, @story_points, @priority, @sequence,
          @tdd_enabled, @acceptance_criteria, @created_at, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          epic_id = excluded.epic_id,
          sprint_id = excluded.sprint_id,
          title = excluded.title,
          description = excluded.description,
          status = excluded.status,
          position = excluded.position,
          assigned_agent = excluded.assigned_agent,
          target_branch = excluded.target_branch,
          story_points = excluded.story_points,
          priority = excluded.priority,
          sequence = excluded.sequence,
          tdd_enabled = excluded.tdd_enabled,
          acceptance_criteria = excluded.acceptance_criteria,
          updated_at = excluded.updated_at
      `).run({
        ...storyData,
        tdd_enabled: storyData.tddEnabled ? 1 : 0,
      });

      // Update dependencies
      db.prepare('DELETE FROM story_dependencies WHERE story_id = ?').run(story.id);
      
      const insertDep = db.prepare(`
        INSERT INTO story_dependencies (id, story_id, depends_on_id, type, created_at)
        VALUES (?, ?, ?, 'BLOCKS', datetime('now'))
      `);

      for (const depId of dependencies || []) {
        insertDep.run(`${story.id}-${depId}`, story.id, depId);
      }
    })();
  }

  // Token usage operations
  async addTokenUsage(usage: TokenUsage): Promise<void> {
    const db = this.getDb();
    db.prepare(`
      INSERT INTO token_usage (id, agent_type, task_id, input_tokens, output_tokens, timestamp)
      VALUES (@id, @agent_type, @task_id, @input_tokens, @output_tokens, @timestamp)
    `).run(usage);
  }

  async getTokenUsage(options?: { 
    startDate?: string; 
    endDate?: string; 
    agentType?: string;
    limit?: number;
  }): Promise<TokenUsage[]> {
    const db = this.getDb();
    let query = 'SELECT * FROM token_usage WHERE 1=1';
    const params: any = {};

    if (options?.startDate) {
      query += ' AND timestamp >= @startDate';
      params.startDate = options.startDate;
    }

    if (options?.endDate) {
      query += ' AND timestamp <= @endDate';
      params.endDate = options.endDate;
    }

    if (options?.agentType) {
      query += ' AND agent_type = @agentType';
      params.agentType = options.agentType;
    }

    query += ' ORDER BY timestamp DESC';

    if (options?.limit) {
      query += ' LIMIT @limit';
      params.limit = options.limit;
    }

    return db.prepare(query).all(params);
  }

  async getTokenUsageStats(): Promise<{
    total: number;
    byAgent: Record<string, number>;
    last24Hours: number;
    last7Days: number;
  }> {
    const db = this.getDb();
    
    const total = db.prepare(`
      SELECT SUM(input_tokens + output_tokens) as total FROM token_usage
    `).get();

    const byAgent = db.prepare(`
      SELECT agent_type, SUM(input_tokens + output_tokens) as total
      FROM token_usage
      GROUP BY agent_type
    `).all();

    const last24Hours = db.prepare(`
      SELECT SUM(input_tokens + output_tokens) as total
      FROM token_usage
      WHERE timestamp >= datetime('now', '-1 day')
    `).get();

    const last7Days = db.prepare(`
      SELECT SUM(input_tokens + output_tokens) as total
      FROM token_usage
      WHERE timestamp >= datetime('now', '-7 days')
    `).get();

    return {
      total: total?.total || 0,
      byAgent: Object.fromEntries(byAgent.map(row => [row.agent_type, row.total])),
      last24Hours: last24Hours?.total || 0,
      last7Days: last7Days?.total || 0,
    };
  }

  // Log operations
  async addLog(log: {
    level: string;
    source: string;
    message: string;
    metadata?: any;
  }): Promise<void> {
    const db = this.getDb();
    db.prepare(`
      INSERT INTO logs (id, level, source, message, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(
      `log-${Date.now()}`,
      log.level,
      log.source,
      log.message,
      log.metadata ? JSON.stringify(log.metadata) : null
    );
  }

  async getLogs(options?: {
    level?: string;
    source?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<any[]> {
    const db = this.getDb();
    let query = 'SELECT * FROM logs WHERE 1=1';
    const params: any = {};

    if (options?.level) {
      query += ' AND level = @level';
      params.level = options.level;
    }

    if (options?.source) {
      query += ' AND source = @source';
      params.source = options.source;
    }

    if (options?.startDate) {
      query += ' AND timestamp >= @startDate';
      params.startDate = options.startDate;
    }

    if (options?.endDate) {
      query += ' AND timestamp <= @endDate';
      params.endDate = options.endDate;
    }

    query += ' ORDER BY timestamp DESC';

    if (options?.limit) {
      query += ' LIMIT @limit';
      params.limit = options.limit;
    }

    return db.prepare(query).all(params).map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));
  }

  // Utility methods
  private async readJsonFile(filePath: string): Promise<any> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  private async writeJsonFile(filePath: string, data: any): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  private async updateGitignore(): Promise<void> {
    const gitignorePath = path.join(this.projectPath, '.gitignore');

    try {
      let content = await fs.readFile(gitignorePath, 'utf-8');
      
      if (!content.includes('.codehive')) {
        content += '\n# CodeHive\n.codehive/\n';
        await fs.writeFile(gitignorePath, content);
      }
    } catch {
      await fs.writeFile(gitignorePath, '# CodeHive\n.codehive/\n');
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
   * Vacuum database (optimize storage)
   */
  async vacuum(): Promise<void> {
    const db = this.getDb();
    db.prepare('VACUUM').run();
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    fileSize: number;
    tableStats: Record<string, number>;
  }> {
    const dbPath = path.join(this.codehivePath, 'codehive.db');
    const stats = await fs.stat(dbPath);
    
    const db = this.getDb();
    const tables = ['epics', 'stories', 'sprints', 'cycles', 'token_usage', 'logs'];
    const tableStats: Record<string, number> = {};

    for (const table of tables) {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      tableStats[table] = count?.count || 0;
    }

    return {
      fileSize: stats.size,
      tableStats,
    };
  }
}