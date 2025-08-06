/**
 * ProjectMetadataManager - Handles all operations with .codehive/ directory metadata
 * Provides CRUD operations for project data stored locally in JSON files
 */

import { promises as fs } from 'fs';
import path from 'path';
import { validatePath } from '@/lib/utils/security';
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
  PortableProjectSchema,
} from './schemas';

export interface ProjectMetadataOptions {
  createIfMissing?: boolean;
  validateData?: boolean;
  backupOnWrite?: boolean;
}

export class ProjectMetadataManager {
  private projectPath: string;
  private codehivePath: string;
  private metadataCache: Map<string, any> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.codehivePath = path.join(projectPath, '.codehive');
  }

  /**
   * Initialize the .codehive/ directory structure
   */
  async initialize(): Promise<void> {
    const dirs = [
      this.codehivePath,
      path.join(this.codehivePath, 'epics'),
      path.join(this.codehivePath, 'stories'), 
      path.join(this.codehivePath, 'sprints'),
      path.join(this.codehivePath, 'cycles'),
      path.join(this.codehivePath, 'agents'),
      path.join(this.codehivePath, 'usage'),
      path.join(this.codehivePath, 'logs'),
      path.join(this.codehivePath, 'workspaces'),
      path.join(this.codehivePath, 'locks'),
      path.join(this.codehivePath, 'backups'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Ensure .gitignore includes .codehive
    await this.updateGitignore();
  }

  /**
   * Check if project has .codehive/ structure
   */
  async isPortableProject(): Promise<boolean> {
    try {
      await fs.access(this.codehivePath);
      const projectJsonPath = path.join(this.codehivePath, 'project.json');
      await fs.access(projectJsonPath);
      return true;
    } catch {
      return false;
    }
  }

  // === Project Metadata Operations ===

  async getProjectMetadata(options: ProjectMetadataOptions = {}): Promise<ProjectMetadata | null> {
    const cacheKey = 'project-metadata';
    
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey);
    }

    try {
      const filePath = path.join(this.codehivePath, 'project.json');
      const data = await this.readJsonFile(filePath);
      
      if (options.validateData) {
        const validated = ProjectMetadataSchema.parse(data);
        this.metadataCache.set(cacheKey, validated);
        return validated;
      }
      
      this.metadataCache.set(cacheKey, data);
      return data;
    } catch (error) {
      if (options.createIfMissing) {
        return this.createDefaultProjectMetadata();
      }
      console.error('Failed to read project metadata:', error);
      return null;
    }
  }

  async saveProjectMetadata(metadata: ProjectMetadata, options: ProjectMetadataOptions = {}): Promise<void> {
    if (options.validateData) {
      ProjectMetadataSchema.parse(metadata);
    }

    const filePath = path.join(this.codehivePath, 'project.json');
    
    if (options.backupOnWrite) {
      await this.createBackup('project.json');
    }

    await this.writeJsonFile(filePath, metadata);
    this.metadataCache.set('project-metadata', metadata);
  }

  // === Settings Operations ===

  async getProjectSettings(options: ProjectMetadataOptions = {}): Promise<ProjectSettings | null> {
    const cacheKey = 'project-settings';
    
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey);
    }

    try {
      const filePath = path.join(this.codehivePath, 'settings.json');
      const data = await this.readJsonFile(filePath);
      
      if (options.validateData) {
        const validated = ProjectSettingsSchema.parse(data);
        this.metadataCache.set(cacheKey, validated);
        return validated;
      }
      
      this.metadataCache.set(cacheKey, data);
      return data;
    } catch (error) {
      if (options.createIfMissing) {
        return this.createDefaultProjectSettings();
      }
      console.error('Failed to read project settings:', error);
      return null;
    }
  }

  async saveProjectSettings(settings: ProjectSettings, options: ProjectMetadataOptions = {}): Promise<void> {
    if (options.validateData) {
      ProjectSettingsSchema.parse(settings);
    }

    const filePath = path.join(this.codehivePath, 'settings.json');
    
    if (options.backupOnWrite) {
      await this.createBackup('settings.json');
    }

    await this.writeJsonFile(filePath, settings);
    this.metadataCache.set('project-settings', settings);
  }

  async updateProjectSettings(updates: Partial<ProjectSettings>, options: ProjectMetadataOptions = {}): Promise<void> {
    const currentSettings = await this.getProjectSettings({ createIfMissing: true }) || {};
    const updatedSettings = { ...currentSettings, ...updates };
    await this.saveProjectSettings(updatedSettings as ProjectSettings, options);
  }

  // === Epic Operations ===

  async getEpics(): Promise<Epic[]> {
    try {
      const epicsDir = path.join(this.codehivePath, 'epics');
      const files = await fs.readdir(epicsDir);
      const epics: Epic[] = [];

      for (const file of files.filter(f => f.endsWith('.json'))) {
        const epicData = await this.readJsonFile(path.join(epicsDir, file));
        epics.push(EpicSchema.parse(epicData));
      }

      return epics.sort((a, b) => a.sequence - b.sequence);
    } catch (error) {
      console.error('Failed to read epics:', error);
      return [];
    }
  }

  async getEpic(epicId: string): Promise<Epic | null> {
    try {
      const filePath = path.join(this.codehivePath, 'epics', `${epicId}.json`);
      const data = await this.readJsonFile(filePath);
      return EpicSchema.parse(data);
    } catch (error) {
      console.error(`Failed to read epic ${epicId}:`, error);
      return null;
    }
  }

  async saveEpic(epic: Epic): Promise<void> {
    EpicSchema.parse(epic);
    const filePath = path.join(this.codehivePath, 'epics', `${epic.id}.json`);
    await this.writeJsonFile(filePath, epic);
  }

  async deleteEpic(epicId: string): Promise<void> {
    const filePath = path.join(this.codehivePath, 'epics', `${epicId}.json`);
    await fs.unlink(filePath);
  }

  // === Story Operations ===

  async getStories(): Promise<Story[]> {
    try {
      const storiesDir = path.join(this.codehivePath, 'stories');
      const files = await fs.readdir(storiesDir);
      const stories: Story[] = [];

      for (const file of files.filter(f => f.endsWith('.json'))) {
        const storyData = await this.readJsonFile(path.join(storiesDir, file));
        stories.push(StorySchema.parse(storyData));
      }

      return stories.sort((a, b) => a.sequence - b.sequence);
    } catch (error) {
      console.error('Failed to read stories:', error);
      return [];
    }
  }

  async getStory(storyId: string): Promise<Story | null> {
    try {
      const filePath = path.join(this.codehivePath, 'stories', `${storyId}.json`);
      const data = await this.readJsonFile(filePath);
      return StorySchema.parse(data);
    } catch (error) {
      console.error(`Failed to read story ${storyId}:`, error);
      return null;
    }
  }

  async saveStory(story: Story): Promise<void> {
    StorySchema.parse(story);
    const filePath = path.join(this.codehivePath, 'stories', `${story.id}.json`);
    await this.writeJsonFile(filePath, story);
  }

  async deleteStory(storyId: string): Promise<void> {
    const filePath = path.join(this.codehivePath, 'stories', `${storyId}.json`);
    await fs.unlink(filePath);
  }

  // === Sprint Operations ===

  async getSprints(): Promise<Sprint[]> {
    try {
      const sprintsDir = path.join(this.codehivePath, 'sprints');
      const files = await fs.readdir(sprintsDir);
      const sprints: Sprint[] = [];

      for (const file of files.filter(f => f.endsWith('.json'))) {
        const sprintData = await this.readJsonFile(path.join(sprintsDir, file));
        sprints.push(SprintSchema.parse(sprintData));
      }

      return sprints.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    } catch (error) {
      console.error('Failed to read sprints:', error);
      return [];
    }
  }

  async getSprint(sprintId: string): Promise<Sprint | null> {
    try {
      const filePath = path.join(this.codehivePath, 'sprints', `${sprintId}.json`);
      const data = await this.readJsonFile(filePath);
      return SprintSchema.parse(data);
    } catch (error) {
      console.error(`Failed to read sprint ${sprintId}:`, error);
      return null;
    }
  }

  async saveSprint(sprint: Sprint): Promise<void> {
    SprintSchema.parse(sprint);
    const filePath = path.join(this.codehivePath, 'sprints', `${sprint.id}.json`);
    await this.writeJsonFile(filePath, sprint);
  }

  async deleteSprint(sprintId: string): Promise<void> {
    const filePath = path.join(this.codehivePath, 'sprints', `${sprintId}.json`);
    await fs.unlink(filePath);
  }

  // === Agent Operations ===

  async getAgents(): Promise<AgentSpec[]> {
    try {
      const agentsDir = path.join(this.codehivePath, 'agents');
      const files = await fs.readdir(agentsDir);
      const agents: AgentSpec[] = [];

      for (const file of files.filter(f => f.endsWith('.json'))) {
        const agentData = await this.readJsonFile(path.join(agentsDir, file));
        agents.push(AgentSpecSchema.parse(agentData));
      }

      return agents.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Failed to read agents:', error);
      return [];
    }
  }

  async getAgent(agentId: string): Promise<AgentSpec | null> {
    try {
      const filePath = path.join(this.codehivePath, 'agents', `${agentId}.json`);
      const data = await this.readJsonFile(filePath);
      return AgentSpecSchema.parse(data);
    } catch (error) {
      console.error(`Failed to read agent ${agentId}:`, error);
      return null;
    }
  }

  async saveAgent(agent: AgentSpec): Promise<void> {
    AgentSpecSchema.parse(agent);
    const filePath = path.join(this.codehivePath, 'agents', `${agent.id}.json`);
    await this.writeJsonFile(filePath, agent);
  }

  async deleteAgent(agentId: string): Promise<void> {
    const filePath = path.join(this.codehivePath, 'agents', `${agentId}.json`);
    await fs.unlink(filePath);
  }

  // === Cycle Operations ===

  async getCycles(): Promise<Cycle[]> {
    try {
      const cyclesDir = path.join(this.codehivePath, 'cycles');
      const files = await fs.readdir(cyclesDir);
      const cycles: Cycle[] = [];

      for (const file of files.filter(f => f.endsWith('.json'))) {
        const cycleData = await this.readJsonFile(path.join(cyclesDir, file));
        cycles.push(CycleSchema.parse(cycleData));
      }

      return cycles.sort((a, b) => a.sequence - b.sequence);
    } catch (error) {
      console.error('Failed to read cycles:', error);
      return [];
    }
  }

  async getCycle(cycleId: string): Promise<Cycle | null> {
    try {
      const filePath = path.join(this.codehivePath, 'cycles', `${cycleId}.json`);
      const data = await this.readJsonFile(filePath);
      return CycleSchema.parse(data);
    } catch (error) {
      console.error(`Failed to read cycle ${cycleId}:`, error);
      return null;
    }
  }

  async saveCycle(cycle: Cycle): Promise<void> {
    CycleSchema.parse(cycle);
    const filePath = path.join(this.codehivePath, 'cycles', `${cycle.id}.json`);
    await this.writeJsonFile(filePath, cycle);
  }

  async deleteCycle(cycleId: string): Promise<void> {
    const filePath = path.join(this.codehivePath, 'cycles', `${cycleId}.json`);
    await fs.unlink(filePath);
  }

  // === Token Usage Operations ===

  async getTokenUsage(): Promise<TokenUsage[]> {
    try {
      const usageFile = path.join(this.codehivePath, 'usage', 'token-usage.json');
      const data = await this.readJsonFile(usageFile);
      return Array.isArray(data) ? data.map(item => TokenUsageSchema.parse(item)) : [];
    } catch (error: any) {
      // Don't log error for missing files (ENOENT) - this is normal for new projects
      if (error?.code !== 'ENOENT') {
        console.error('Failed to read token usage:', error);
      }
      return [];
    }
  }

  async addTokenUsage(usage: TokenUsage): Promise<void> {
    TokenUsageSchema.parse(usage);
    const usageFile = path.join(this.codehivePath, 'usage', 'token-usage.json');
    
    try {
      const existingUsage = await this.getTokenUsage();
      existingUsage.push(usage);
      await this.writeJsonFile(usageFile, existingUsage);
    } catch (error) {
      // If file doesn't exist, create it with the single usage entry
      await this.writeJsonFile(usageFile, [usage]);
    }
  }

  // === Budget Operations ===

  async getProjectBudget(): Promise<ProjectBudget | null> {
    try {
      const filePath = path.join(this.codehivePath, 'budget.json');
      const data = await this.readJsonFile(filePath);
      return ProjectBudgetSchema.parse(data);
    } catch (error) {
      console.error('Failed to read project budget:', error);
      return null;
    }
  }

  async saveProjectBudget(budget: ProjectBudget): Promise<void> {
    ProjectBudgetSchema.parse(budget);
    const filePath = path.join(this.codehivePath, 'budget.json');
    await this.writeJsonFile(filePath, budget);
  }

  // === Export/Import Operations ===

  async exportPortableProject(): Promise<PortableProject> {
    const metadata = await this.getProjectMetadata({ createIfMissing: true });
    const settings = await this.getProjectSettings({ createIfMissing: true });
    const budget = await this.getProjectBudget();
    const epics = await this.getEpics();
    const stories = await this.getStories();
    const sprints = await this.getSprints();
    const agents = await this.getAgents();
    const cycles = await this.getCycles();
    const tokenUsage = await this.getTokenUsage();

    const portableProject: PortableProject = {
      metadata: metadata!,
      settings: settings!,
      budget,
      epics,
      stories,
      sprints,
      agents,
      cycles,
      tokenUsage,
      createdAt: metadata!.createdAt,
      updatedAt: new Date().toISOString(),
    };

    return PortableProjectSchema.parse(portableProject);
  }

  async importPortableProject(portableProject: PortableProject): Promise<void> {
    // Validate the entire project structure
    PortableProjectSchema.parse(portableProject);

    // Initialize directory structure
    await this.initialize();

    // Import all data
    await this.saveProjectMetadata(portableProject.metadata);
    await this.saveProjectSettings(portableProject.settings);
    
    if (portableProject.budget) {
      await this.saveProjectBudget(portableProject.budget);
    }

    // Save individual entities
    for (const epic of portableProject.epics) {
      await this.saveEpic(epic);
    }

    for (const story of portableProject.stories) {
      await this.saveStory(story);
    }

    for (const sprint of portableProject.sprints) {
      await this.saveSprint(sprint);
    }

    for (const agent of portableProject.agents) {
      await this.saveAgent(agent);
    }

    for (const cycle of portableProject.cycles) {
      await this.saveCycle(cycle);
    }

    // Import token usage
    if (portableProject.tokenUsage.length > 0) {
      const usageFile = path.join(this.codehivePath, 'usage', 'token-usage.json');
      await this.writeJsonFile(usageFile, portableProject.tokenUsage);
    }

    // Clear cache after import
    this.metadataCache.clear();
  }

  // === Utility Methods ===

  private async readJsonFile(filePath: string): Promise<any> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  private async writeJsonFile(filePath: string, data: any): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  private async createBackup(filename: string): Promise<void> {
    try {
      const sourcePath = path.join(this.codehivePath, filename);
      const backupDir = path.join(this.codehivePath, 'backups');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${filename}.${timestamp}.backup`);
      
      await fs.mkdir(backupDir, { recursive: true });
      await fs.copyFile(sourcePath, backupPath);
    } catch (error) {
      console.warn(`Failed to create backup for ${filename}:`, error);
    }
  }

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

  private async createDefaultProjectSettings(): Promise<ProjectSettings> {
    const settings: ProjectSettings = ProjectSettingsSchema.parse({});
    await this.saveProjectSettings(settings);
    return settings;
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
      // If .gitignore doesn't exist, create it
      await fs.writeFile(gitignorePath, '# CodeHive\n.codehive/\n');
    }
  }

  /**
   * Clear all cached metadata
   */
  clearCache(): void {
    this.metadataCache.clear();
  }
}