import { promises as fs } from 'fs';
import * as path from 'path';
import { ProjectPhase, AgentState, ConversationMessage } from './project-agent';

/**
 * CLAUDE.md 章節類型
 */
export enum ClaudeMdSection {
  PROJECT_OVERVIEW = 'project_overview',
  CURRENT_STATUS = 'current_status',
  CONVERSATION_HISTORY = 'conversation_history',
  REQUIREMENTS = 'requirements',
  DECISIONS = 'decisions',
  EPIC_STATUS = 'epic_status',
  TASKS_COMPLETED = 'tasks_completed',
  NEXT_ACTIONS = 'next_actions',
  CONTEXT_DATA = 'context_data'
}

/**
 * 專案脈絡資料
 */
export interface ProjectContextData {
  // 基本資訊
  projectId: string;
  projectName: string;
  phase: ProjectPhase;
  agentState: AgentState;
  
  // 時間資訊
  createdAt: Date;
  lastUpdated: Date;
  phaseStartedAt?: Date;
  
  // 需求和決策
  requirements?: Record<string, any>;
  decisions: Record<string, any>;
  proposal?: Record<string, any>;
  
  // 史詩和任務
  currentEpicId?: string;
  currentStoryId?: string;
  currentTaskId?: string;
  completedTasks: string[];
  
  // 對話記錄
  conversationSummary: string;
  recentMessages: ConversationMessage[];
  
  // 統計資訊
  totalMessages: number;
  totalTasks: number;
  completedTaskCount: number;
  
  // 元資料
  metadata: Record<string, any>;
}

/**
 * CLAUDE.md 檔案結構
 */
export interface ClaudeMdStructure {
  header: string;
  sections: Map<ClaudeMdSection, string>;
  footer: string;
}

/**
 * 脈絡管理器 - 負責CLAUDE.md檔案的讀寫和管理
 */
export class ContextManager {
  private claudeMdPath: string;
  private projectPath: string;
  private currentContext: ProjectContextData | null = null;
  private lastModified: Date | null = null;

  constructor(projectPath: string, claudeMdPath?: string) {
    this.projectPath = projectPath;
    this.claudeMdPath = claudeMdPath || path.join(projectPath, '.codehive', 'CLAUDE.md');
  }

  /**
   * 載入專案脈絡
   */
  async loadContext(): Promise<ProjectContextData> {
    try {
      // 檢查檔案是否存在
      const exists = await this.fileExists(this.claudeMdPath);
      if (!exists) {
        // 建立預設脈絡
        this.currentContext = this.createDefaultContext();
        await this.saveContext(this.currentContext);
        return this.currentContext;
      }

      // 讀取檔案
      const content = await fs.readFile(this.claudeMdPath, 'utf-8');
      const stats = await fs.stat(this.claudeMdPath);
      this.lastModified = stats.mtime;

      // 解析內容
      this.currentContext = await this.parseClaudeMd(content);
      return this.currentContext;
    } catch (error) {
      console.error('Failed to load context:', error);
      // 建立預設脈絡作為後備
      this.currentContext = this.createDefaultContext();
      return this.currentContext;
    }
  }

  /**
   * 儲存專案脈絡
   */
  async saveContext(context: ProjectContextData): Promise<void> {
    try {
      // 更新時間戳記
      context.lastUpdated = new Date();

      // 生成CLAUDE.md內容
      const content = await this.generateClaudeMd(context);

      // 確保目錄存在
      const dir = path.dirname(this.claudeMdPath);
      await fs.mkdir(dir, { recursive: true });

      // 寫入檔案
      await fs.writeFile(this.claudeMdPath, content, 'utf-8');
      
      // 更新快取
      this.currentContext = context;
      this.lastModified = new Date();

      console.log(`Context saved to ${this.claudeMdPath}`);
    } catch (error) {
      console.error('Failed to save context:', error);
      throw error;
    }
  }

  /**
   * 更新特定章節
   */
  async updateSection(section: ClaudeMdSection, content: string): Promise<void> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    // 更新特定資料
    switch (section) {
      case ClaudeMdSection.CURRENT_STATUS:
        this.currentContext!.metadata.currentStatus = content;
        break;
      case ClaudeMdSection.REQUIREMENTS:
        this.currentContext!.requirements = this.parseYamlLikeContent(content);
        break;
      case ClaudeMdSection.DECISIONS:
        this.currentContext!.decisions = this.parseYamlLikeContent(content);
        break;
      case ClaudeMdSection.EPIC_STATUS:
        this.currentContext!.metadata.epicStatus = content;
        break;
      case ClaudeMdSection.TASKS_COMPLETED:
        this.currentContext!.metadata.tasksCompleted = content;
        break;
      case ClaudeMdSection.NEXT_ACTIONS:
        this.currentContext!.metadata.nextActions = content;
        break;
      default:
        // 對於其他章節，存在metadata中
        this.currentContext!.metadata[section] = content;
    }

    await this.saveContext(this.currentContext!);
  }

  /**
   * 更新當前史詩、故事和任務
   */
  async updateCurrentTask(epicId?: string, storyId?: string, taskId?: string): Promise<void> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    this.currentContext!.currentEpicId = epicId;
    this.currentContext!.currentStoryId = storyId;
    this.currentContext!.currentTaskId = taskId;

    // 更新元資料以便在CLAUDE.md中顯示
    this.currentContext!.metadata.currentHierarchy = {
      epicId,
      storyId, 
      taskId,
      updatedAt: new Date().toISOString()
    };

    await this.saveContext(this.currentContext!);
  }

  /**
   * 標記任務為完成
   */
  async completeTask(taskId: string, summary?: string): Promise<void> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    // 添加到完成的任務列表
    if (!this.currentContext!.completedTasks.includes(taskId)) {
      this.currentContext!.completedTasks.push(taskId);
      this.currentContext!.completedTaskCount++;
    }

    // 如果有摘要，存在metadata中
    if (summary) {
      if (!this.currentContext!.metadata.taskSummaries) {
        this.currentContext!.metadata.taskSummaries = {};
      }
      this.currentContext!.metadata.taskSummaries[taskId] = {
        summary,
        completedAt: new Date().toISOString()
      };
    }

    await this.saveContext(this.currentContext!);
  }

  /**
   * 更新階段資訊
   */
  async updatePhase(newPhase: ProjectPhase, reason?: string): Promise<void> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    const oldPhase = this.currentContext!.phase;
    this.currentContext!.phase = newPhase;
    this.currentContext!.phaseStartedAt = new Date();

    // 記錄階段轉換歷史
    if (!this.currentContext!.metadata.phaseHistory) {
      this.currentContext!.metadata.phaseHistory = [];
    }
    
    this.currentContext!.metadata.phaseHistory.push({
      from: oldPhase,
      to: newPhase,
      reason: reason || 'user_requested',
      timestamp: new Date().toISOString()
    });

    await this.saveContext(this.currentContext!);
  }

  /**
   * 新增對話記錄
   */
  async addConversationMessage(message: ConversationMessage): Promise<void> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    this.currentContext!.recentMessages.push(message);
    this.currentContext!.totalMessages++;

    // 保持最近的對話記錄不超過20條
    if (this.currentContext!.recentMessages.length > 20) {
      this.currentContext!.recentMessages = this.currentContext!.recentMessages.slice(-20);
    }

    // 更新對話摘要
    await this.updateConversationSummary();
    await this.saveContext(this.currentContext!);
  }

  /**
   * 批量新增對話記錄
   */
  async addConversationMessages(messages: ConversationMessage[]): Promise<void> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    this.currentContext!.recentMessages.push(...messages);
    this.currentContext!.totalMessages += messages.length;

    // 保持最近的對話記錄不超過20條
    if (this.currentContext!.recentMessages.length > 20) {
      this.currentContext!.recentMessages = this.currentContext!.recentMessages.slice(-20);
    }

    // 更新對話摘要
    await this.updateConversationSummary();
    await this.saveContext(this.currentContext!);
  }

  /**
   * 取得對話歷史
   */
  getConversationHistory(limit?: number): ConversationMessage[] {
    if (!this.currentContext) {
      return [];
    }

    const messages = this.currentContext.recentMessages;
    return limit ? messages.slice(-limit) : messages;
  }

  /**
   * 搜尋對話歷史
   */
  searchConversationHistory(query: string, limit: number = 10): ConversationMessage[] {
    if (!this.currentContext) {
      return [];
    }

    const queryLower = query.toLowerCase();
    return this.currentContext.recentMessages
      .filter(message => 
        message.content.toLowerCase().includes(queryLower) ||
        (message.metadata && JSON.stringify(message.metadata).toLowerCase().includes(queryLower))
      )
      .slice(-limit);
  }

  /**
   * 取得對話統計資訊
   */
  getConversationStats(): {
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    systemMessages: number;
    recentMessageCount: number;
    averageMessageLength: number;
    conversationStartTime?: Date;
    lastMessageTime?: Date;
  } {
    if (!this.currentContext) {
      return {
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0,
        systemMessages: 0,
        recentMessageCount: 0,
        averageMessageLength: 0
      };
    }

    const messages = this.currentContext.recentMessages;
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    const systemMessages = messages.filter(m => m.role === 'system').length;

    const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0);
    const averageLength = messages.length > 0 ? totalLength / messages.length : 0;

    const sortedMessages = [...messages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      totalMessages: this.currentContext.totalMessages,
      userMessages,
      assistantMessages,
      systemMessages,
      recentMessageCount: messages.length,
      averageMessageLength: Math.round(averageLength),
      conversationStartTime: sortedMessages.length > 0 ? new Date(sortedMessages[0].timestamp) : undefined,
      lastMessageTime: sortedMessages.length > 0 ? new Date(sortedMessages[sortedMessages.length - 1].timestamp) : undefined
    };
  }

  /**
   * 清除舊的對話記錄
   */
  async clearOldConversationHistory(keepRecentCount: number = 20): Promise<number> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    const originalCount = this.currentContext!.recentMessages.length;
    
    if (originalCount <= keepRecentCount) {
      return 0;
    }

    this.currentContext!.recentMessages = this.currentContext!.recentMessages.slice(-keepRecentCount);
    await this.updateConversationSummary();
    await this.saveContext(this.currentContext!);

    return originalCount - keepRecentCount;
  }

  /**
   * 更新專案階段
   */
  async updatePhase(newPhase: ProjectPhase, reason?: string): Promise<void> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    const oldPhase = this.currentContext!.phase;
    this.currentContext!.phase = newPhase;
    this.currentContext!.phaseStartedAt = new Date();

    // 記錄決策
    if (reason) {
      this.currentContext!.decisions[`phase_transition_${Date.now()}`] = {
        from: oldPhase,
        to: newPhase,
        reason,
        timestamp: new Date().toISOString()
      };
    }

    await this.saveContext(this.currentContext!);
  }

  /**
   * 更新當前任務
   */
  async updateCurrentTask(epicId?: string, storyId?: string, taskId?: string): Promise<void> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    this.currentContext!.currentEpicId = epicId;
    this.currentContext!.currentStoryId = storyId;
    this.currentContext!.currentTaskId = taskId;

    await this.saveContext(this.currentContext!);
  }

  /**
   * 標記任務完成
   */
  async completeTask(taskId: string, summary?: string): Promise<void> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    if (!this.currentContext!.completedTasks.includes(taskId)) {
      this.currentContext!.completedTasks.push(taskId);
      this.currentContext!.completedTaskCount++;
    }

    // 記錄完成資訊
    if (summary) {
      this.currentContext!.metadata.completedTaskSummaries = 
        this.currentContext!.metadata.completedTaskSummaries || {};
      this.currentContext!.metadata.completedTaskSummaries[taskId] = {
        summary,
        completedAt: new Date().toISOString()
      };
    }

    await this.saveContext(this.currentContext!);
  }

  /**
   * 取得當前脈絡
   */
  getCurrentContext(): ProjectContextData | null {
    return this.currentContext;
  }

  /**
   * 建立狀態快照
   */
  async createStateSnapshot(reason?: string): Promise<string> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    const snapshotId = `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const snapshot = {
      id: snapshotId,
      timestamp: new Date().toISOString(),
      reason: reason || 'manual_snapshot',
      context: JSON.parse(JSON.stringify(this.currentContext)) // 深拷貝
    };

    // 儲存快照到metadata
    this.currentContext!.metadata.snapshots = this.currentContext!.metadata.snapshots || [];
    this.currentContext!.metadata.snapshots.push(snapshot);

    // 保持快照數量不超過10個
    if (this.currentContext!.metadata.snapshots.length > 10) {
      this.currentContext!.metadata.snapshots = this.currentContext!.metadata.snapshots.slice(-10);
    }

    await this.saveContext(this.currentContext!);
    return snapshotId;
  }

  /**
   * 恢復到指定快照
   */
  async restoreFromStateSnapshot(snapshotId: string): Promise<boolean> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    const snapshots = this.currentContext!.metadata.snapshots || [];
    const snapshot = snapshots.find((s: any) => s.id === snapshotId);

    if (!snapshot) {
      return false;
    }

    // 建立當前狀態備份
    await this.createStateSnapshot('before_restore');

    // 恢復狀態（保留快照歷史）
    const currentSnapshots = this.currentContext!.metadata.snapshots;
    this.currentContext = this.ensureDatesInContext({ ...snapshot.context });
    this.currentContext!.metadata.snapshots = currentSnapshots;
    this.currentContext!.lastUpdated = new Date();

    await this.saveContext(this.currentContext!);
    return true;
  }

  /**
   * 取得可用的狀態快照
   */
  getAvailableSnapshots(): Array<{
    id: string;
    timestamp: string;
    reason: string;
    contextSummary: string;
  }> {
    if (!this.currentContext || !this.currentContext.metadata.snapshots) {
      return [];
    }

    return this.currentContext.metadata.snapshots.map((snapshot: any) => ({
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      reason: snapshot.reason,
      contextSummary: `${snapshot.context.phase} - ${snapshot.context.conversationSummary.substring(0, 50)}...`
    }));
  }

  /**
   * 匯出專案狀態
   */
  async exportProjectState(): Promise<{
    context: ProjectContextData;
    claudeMdContent: string;
    exportTimestamp: string;
    version: string;
  }> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    // 讀取當前CLAUDE.md內容
    let claudeMdContent = '';
    try {
      claudeMdContent = await fs.readFile(this.claudeMdPath, 'utf-8');
    } catch {
      claudeMdContent = await this.generateClaudeMd(this.currentContext!);
    }

    return {
      context: JSON.parse(JSON.stringify(this.currentContext!)),
      claudeMdContent,
      exportTimestamp: new Date().toISOString(),
      version: '1.0'
    };
  }

  /**
   * 匯入專案狀態
   */
  async importProjectState(exportedState: {
    context: ProjectContextData;
    claudeMdContent?: string;
    exportTimestamp: string;
    version: string;
  }): Promise<boolean> {
    try {
      // 建立當前狀態備份
      if (this.currentContext) {
        await this.createStateSnapshot('before_import');
      }

      // 匯入狀態
      this.currentContext = {
        ...exportedState.context,
        lastUpdated: new Date(),
        metadata: {
          ...exportedState.context.metadata,
          importedAt: new Date().toISOString(),
          importedFrom: exportedState.exportTimestamp
        }
      };

      // 如果有CLAUDE.md內容，也一起匯入
      if (exportedState.claudeMdContent) {
        await fs.writeFile(this.claudeMdPath, exportedState.claudeMdContent, 'utf-8');
        this.lastModified = new Date();
      } else {
        await this.saveContext(this.currentContext!);
      }

      return true;
    } catch (error) {
      console.error('Failed to import project state:', error);
      return false;
    }
  }

  /**
   * 驗證狀態一致性
   */
  async validateStateConsistency(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!this.currentContext) {
      issues.push('Context not loaded');
      recommendations.push('Load context first');
      return { isValid: false, issues, recommendations };
    }

    // 檢查必要欄位
    if (!this.currentContext.projectId) {
      issues.push('Missing project ID');
    }

    if (!this.currentContext.projectName) {
      issues.push('Missing project name');
    }

    // 檢查時間戳記
    if (this.currentContext.lastUpdated > new Date()) {
      issues.push('Last updated time is in the future');
    }

    if (this.currentContext.createdAt > this.currentContext.lastUpdated) {
      issues.push('Created time is after last updated time');
    }

    // 檢查對話記錄
    if (this.currentContext.totalMessages < this.currentContext.recentMessages.length) {
      issues.push('Total message count is inconsistent with recent messages');
      recommendations.push('Recalculate message statistics');
    }

    // 如果totalMessages為0但有recentMessages，也認為是不一致
    if (this.currentContext.totalMessages === 0 && this.currentContext.recentMessages.length > 0) {
      issues.push('Total message count is zero but recent messages exist');
      recommendations.push('Fix message count statistics');
    }

    // 檢查任務資料
    if (this.currentContext.completedTaskCount !== this.currentContext.completedTasks.length) {
      issues.push('Completed task count is inconsistent with task list');
      recommendations.push('Sync task completion statistics');
    }

    // 檢查檔案同步
    try {
      const fileExists = await this.fileExists(this.claudeMdPath);
      if (!fileExists) {
        issues.push('CLAUDE.md file does not exist');
        recommendations.push('Create CLAUDE.md file from context');
      } else {
        const needsReload = await this.needsReload();
        if (needsReload) {
          issues.push('Context may be out of sync with CLAUDE.md file');
          recommendations.push('Reload context from file');
        }
      }
    } catch {
      issues.push('Unable to check file system consistency');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * 自動修復狀態一致性問題
   */
  async autoRepairStateConsistency(): Promise<{
    success: boolean;
    repairedIssues: string[];
    remainingIssues: string[];
  }> {
    const validation = await this.validateStateConsistency();
    const repairedIssues: string[] = [];
    const remainingIssues: string[] = [];

    if (!this.currentContext) {
      remainingIssues.push('Cannot repair without loaded context');
      return { success: false, repairedIssues, remainingIssues };
    }

    // 修復訊息統計
    if (validation.issues.includes('Total message count is inconsistent with recent messages') ||
        validation.issues.includes('Total message count is zero but recent messages exist')) {
      const actualRecentCount = this.currentContext.recentMessages.length;
      if (this.currentContext.totalMessages < actualRecentCount || 
          (this.currentContext.totalMessages === 0 && actualRecentCount > 0)) {
        this.currentContext.totalMessages = Math.max(actualRecentCount, this.currentContext.totalMessages);
        repairedIssues.push('Fixed total message count');
      }
    }

    // 修復任務統計
    if (validation.issues.includes('Completed task count is inconsistent with task list')) {
      this.currentContext.completedTaskCount = this.currentContext.completedTasks.length;
      repairedIssues.push('Fixed completed task count');
    }

    // 修復時間戳記
    if (validation.issues.includes('Last updated time is in the future')) {
      this.currentContext.lastUpdated = new Date();
      repairedIssues.push('Fixed last updated timestamp');
    }

    // 建立缺失的檔案
    if (validation.issues.includes('CLAUDE.md file does not exist')) {
      await this.saveContext(this.currentContext);
      repairedIssues.push('Created CLAUDE.md file');
    }

    // 其餘問題加入remainingIssues
    validation.issues.forEach(issue => {
      // Check if this issue was addressed by any repair
      const wasRepaired = repairedIssues.some(repaired => 
        issue.includes('message count') && repaired.includes('message count') ||
        issue.includes('task count') && repaired.includes('task count') ||
        issue.includes('timestamp') && repaired.includes('timestamp') ||
        issue.includes('CLAUDE.md') && repaired.includes('CLAUDE.md')
      );
      
      if (!wasRepaired) {
        remainingIssues.push(issue);
      }
    });

    // 如果有修復，儲存狀態
    if (repairedIssues.length > 0) {
      await this.saveContext(this.currentContext);
    }

    return {
      success: remainingIssues.length === 0,
      repairedIssues,
      remainingIssues
    };
  }

  /**
   * 檢查檔案是否需要重新載入
   */
  async needsReload(): Promise<boolean> {
    try {
      if (!this.lastModified) return true;
      
      const stats = await fs.stat(this.claudeMdPath);
      return stats.mtime > this.lastModified;
    } catch {
      return true;
    }
  }

  /**
   * 建立預設脈絡
   */
  private createDefaultContext(): ProjectContextData {
    return {
      projectId: path.basename(this.projectPath),
      projectName: path.basename(this.projectPath),
      phase: ProjectPhase.REQUIREMENTS,
      agentState: AgentState.IDLE,
      createdAt: new Date(),
      lastUpdated: new Date(),
      decisions: {},
      completedTasks: [],
      conversationSummary: '專案剛剛開始，準備收集需求。',
      recentMessages: [],
      totalMessages: 0,
      totalTasks: 0,
      completedTaskCount: 0,
      metadata: {}
    };
  }

  /**
   * 解析CLAUDE.md檔案
   */
  private async parseClaudeMd(content: string): Promise<ProjectContextData> {
    const context = this.createDefaultContext();
    
    try {
      // 解析檔案結構
      const structure = this.parseClaudeMdStructure(content);
      
      // 提取專案基本資訊
      const projectInfo = this.extractProjectInfo(content);
      if (projectInfo.projectName) context.projectName = projectInfo.projectName;
      if (projectInfo.phase) context.phase = projectInfo.phase;
      if (projectInfo.agentState) context.agentState = projectInfo.agentState;

      // 提取需求和決策
      if (structure.sections.has(ClaudeMdSection.REQUIREMENTS)) {
        const reqContent = structure.sections.get(ClaudeMdSection.REQUIREMENTS)!;
        context.requirements = this.parseYamlLikeContent(reqContent);
      }

      if (structure.sections.has(ClaudeMdSection.DECISIONS)) {
        const decContent = structure.sections.get(ClaudeMdSection.DECISIONS)!;
        context.decisions = this.parseYamlLikeContent(decContent);
      }

      // 提取對話摘要
      if (structure.sections.has(ClaudeMdSection.CONVERSATION_HISTORY)) {
        const convContent = structure.sections.get(ClaudeMdSection.CONVERSATION_HISTORY)!;
        context.conversationSummary = this.extractConversationSummary(convContent);
      }

      // 提取任務資訊
      if (structure.sections.has(ClaudeMdSection.TASKS_COMPLETED)) {
        const tasksContent = structure.sections.get(ClaudeMdSection.TASKS_COMPLETED)!;
        context.completedTasks = this.extractCompletedTasks(tasksContent);
        context.completedTaskCount = context.completedTasks.length;
      }

      // 提取元資料
      context.metadata = this.extractMetadata(content);

      return context;
    } catch (error) {
      console.error('Error parsing CLAUDE.md:', error);
      return context; // 回傳預設脈絡
    }
  }

  /**
   * 生成CLAUDE.md內容
   */
  private async generateClaudeMd(context: ProjectContextData): Promise<string> {
    const sections: string[] = [];

    // 標題
    sections.push(`# ${context.projectName} - 專案脈絡`);
    sections.push('');

    // 專案概覽
    sections.push('## 專案概覽');
    sections.push(`- **專案ID**: ${context.projectId}`);
    sections.push(`- **當前階段**: ${this.getPhaseDisplayName(context.phase)}`);
    sections.push(`- **代理狀態**: ${this.getStateDisplayName(context.agentState)}`);
    sections.push(`- **建立時間**: ${this.ensureDate(context.createdAt).toISOString()}`);
    sections.push(`- **最後更新**: ${this.ensureDate(context.lastUpdated).toISOString()}`);
    if (context.phaseStartedAt) {
      sections.push(`- **階段開始時間**: ${this.ensureDate(context.phaseStartedAt).toISOString()}`);
    }
    sections.push('');

    // 當前狀態
    sections.push('## 當前狀態');
    if (context.currentEpicId) {
      sections.push(`- **當前史詩**: ${context.currentEpicId}`);
    }
    if (context.currentStoryId) {
      sections.push(`- **當前故事**: ${context.currentStoryId}`);
    }
    if (context.currentTaskId) {
      sections.push(`- **當前任務**: ${context.currentTaskId}`);
    }
    sections.push(`- **總訊息數**: ${context.totalMessages}`);
    sections.push(`- **總任務數**: ${context.totalTasks}`);
    sections.push(`- **已完成任務**: ${context.completedTaskCount}`);
    sections.push('');

    // 對話歷史摘要
    sections.push('## 對話歷史摘要');
    sections.push(context.conversationSummary);
    sections.push('');

    // 最近對話
    if (context.recentMessages.length > 0) {
      sections.push('### 最近對話');
      context.recentMessages.slice(-5).forEach(msg => {
        const time = new Date(msg.timestamp).toLocaleString();
        sections.push(`**[${msg.role}]** (${time}): ${msg.content.substring(0, 100)}...`);
      });
      sections.push('');
    }

    // 需求
    if (context.requirements && Object.keys(context.requirements).length > 0) {
      sections.push('## 需求');
      sections.push('```yaml');
      sections.push(this.stringifyYamlLike(context.requirements));
      sections.push('```');
      sections.push('');
    }

    // 重要決策
    if (Object.keys(context.decisions).length > 0) {
      sections.push('## 重要決策');
      Object.entries(context.decisions).forEach(([key, value]) => {
        sections.push(`### ${key}`);
        if (typeof value === 'object') {
          sections.push('```yaml');
          sections.push(this.stringifyYamlLike(value));
          sections.push('```');
        } else {
          sections.push(String(value));
        }
        sections.push('');
      });
    }

    // 已完成任務
    if (context.completedTasks.length > 0) {
      sections.push('## 已完成任務');
      context.completedTasks.forEach(taskId => {
        const summary = context.metadata.completedTaskSummaries?.[taskId];
        if (summary) {
          sections.push(`- **${taskId}**: ${summary.summary} (${summary.completedAt})`);
        } else {
          sections.push(`- **${taskId}**: 已完成`);
        }
      });
      sections.push('');
    }

    // 下一步行動
    sections.push('## 下一步行動');
    const nextActions = this.generateNextActions(context);
    sections.push(nextActions);
    sections.push('');

    // 元資料
    if (Object.keys(context.metadata).length > 0) {
      sections.push('## 元資料');
      sections.push('```json');
      try {
        const safeMetadata = this.serializeMetadataSafely(context.metadata);
        sections.push(JSON.stringify(safeMetadata, null, 2));
      } catch (error) {
        sections.push('Error serializing metadata');
      }
      sections.push('```');
      sections.push('');
    }

    // 頁尾
    sections.push('---');
    sections.push(`*由 CodeHive 專案代理自動生成於 ${new Date().toISOString()}*`);

    return sections.join('\n');
  }

  /**
   * 檔案相關輔助方法
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private parseClaudeMdStructure(content: string): ClaudeMdStructure {
    const sections = new Map<ClaudeMdSection, string>();
    const lines = content.split('\n');
    
    // 簡單的章節解析邏輯
    // TODO: 實作更精確的解析
    
    return {
      header: lines[0] || '',
      sections,
      footer: lines[lines.length - 1] || ''
    };
  }

  private extractProjectInfo(content: string): Partial<ProjectContextData> {
    const info: Partial<ProjectContextData> = {};
    
    // 提取階段資訊
    const phaseMatch = content.match(/當前階段.*?:\s*(.+)/);
    if (phaseMatch) {
      const phaseStr = phaseMatch[1].trim();
      if (phaseStr.includes('需求')) info.phase = ProjectPhase.REQUIREMENTS;
      else if (phaseStr.includes('MVP')) info.phase = ProjectPhase.MVP;
      else if (phaseStr.includes('持續')) info.phase = ProjectPhase.CONTINUOUS;
    }

    return info;
  }

  private parseYamlLikeContent(content: string): Record<string, any> {
    // 簡化的YAML解析
    const result: Record<string, any> = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^(.+?):\s*(.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        result[key] = value;
      }
    }
    
    return result;
  }

  private stringifyYamlLike(obj: any): string {
    if (typeof obj !== 'object' || obj === null) {
      return String(obj);
    }
    
    const lines: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object') {
        lines.push(`${key}:`);
        const subLines = this.stringifyYamlLike(value).split('\n');
        subLines.forEach(line => lines.push(`  ${line}`));
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    
    return lines.join('\n');
  }

  private extractConversationSummary(content: string): string {
    // 提取對話摘要的第一行
    const lines = content.split('\n').filter(line => line.trim());
    return lines[0] || '尚無對話記錄';
  }

  private extractCompletedTasks(content: string): string[] {
    const tasks: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^\s*-\s*\*\*(.+?)\*\*/);
      if (match) {
        tasks.push(match[1]);
      }
    }
    
    return tasks;
  }

  private extractMetadata(content: string): Record<string, any> {
    const metadataMatch = content.match(/## 元資料\s*```json\s*([\s\S]*?)\s*```/);
    if (metadataMatch) {
      try {
        return JSON.parse(metadataMatch[1]);
      } catch {
        return {};
      }
    }
    return {};
  }

  private async updateConversationSummary(): Promise<void> {
    if (!this.currentContext || this.currentContext.recentMessages.length === 0) {
      return;
    }

    // 生成簡單的對話摘要
    const messageCount = this.currentContext.totalMessages;
    const phase = this.getPhaseDisplayName(this.currentContext.phase);
    const lastMessage = this.currentContext.recentMessages[this.currentContext.recentMessages.length - 1];
    
    this.currentContext.conversationSummary = 
      `目前在${phase}階段，已進行${messageCount}次對話。` +
      `最近討論：${lastMessage.content.substring(0, 50)}...`;
  }

  private generateNextActions(context: ProjectContextData): string {
    const actions: string[] = [];
    
    switch (context.phase) {
      case ProjectPhase.REQUIREMENTS:
        actions.push('- 繼續收集和分析使用者需求');
        actions.push('- 建立完整的專案提案');
        actions.push('- 準備進入MVP開發階段');
        break;
      case ProjectPhase.MVP:
        actions.push('- 實作核心MVP功能');
        actions.push('- 執行測試和驗證');
        actions.push('- 準備產品展示');
        break;
      case ProjectPhase.CONTINUOUS:
        actions.push('- 根據回饋優化產品');
        actions.push('- 新增額外功能');
        actions.push('- 維護和監控系統');
        break;
    }
    
    if (context.currentTaskId) {
      actions.push(`- 完成當前任務：${context.currentTaskId}`);
    }
    
    return actions.join('\n');
  }

  private getPhaseDisplayName(phase: ProjectPhase): string {
    const names = {
      [ProjectPhase.REQUIREMENTS]: '需求獲取',
      [ProjectPhase.MVP]: 'MVP開發',
      [ProjectPhase.CONTINUOUS]: '持續整合'
    };
    return names[phase] || phase;
  }

  private getStateDisplayName(state: AgentState): string {
    const names = {
      [AgentState.IDLE]: '閒置',
      [AgentState.LISTENING]: '聆聽',
      [AgentState.PROCESSING]: '處理中',
      [AgentState.WAITING_USER]: '等待使用者',
      [AgentState.EXECUTING]: '執行中',
      [AgentState.ERROR]: '錯誤'
    };
    return names[state] || state;
  }

  /**
   * 建立會話恢復點
   */
  async createSessionRecoveryPoint(sessionData: {
    executorStatus?: string;
    currentInstruction?: any;
    queueState?: any;
    agentState?: AgentState;
  }): Promise<string> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    const recoveryId = `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const recoveryPoint = {
      id: recoveryId,
      timestamp: new Date().toISOString(),
      sessionData,
      contextSnapshot: JSON.parse(JSON.stringify(this.currentContext))
    };

    // 儲存恢復點到metadata
    this.currentContext!.metadata.recoveryPoints = this.currentContext!.metadata.recoveryPoints || [];
    this.currentContext!.metadata.recoveryPoints.push(recoveryPoint);

    // 保持恢復點數量不超過5個
    if (this.currentContext!.metadata.recoveryPoints.length > 5) {
      this.currentContext!.metadata.recoveryPoints = this.currentContext!.metadata.recoveryPoints.slice(-5);
    }

    await this.saveContext(this.currentContext!);
    return recoveryId;
  }

  /**
   * 恢復會話
   */
  async recoverSession(recoveryId?: string): Promise<{
    success: boolean;
    recoveredSessionData?: any;
    contextRestored?: boolean;
    recoveryPoint?: any;
  }> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    const recoveryPoints = this.currentContext!.metadata.recoveryPoints || [];

    let recoveryPoint;
    if (recoveryId) {
      recoveryPoint = recoveryPoints.find((rp: any) => rp.id === recoveryId);
    } else {
      // 使用最近的恢復點
      recoveryPoint = recoveryPoints[recoveryPoints.length - 1];
    }

    if (!recoveryPoint) {
      return { success: false };
    }

    try {
      // 建立目前狀態備份
      await this.createStateSnapshot('before_session_recovery');

      // 恢復脈絡（如果需要）
      const contextRestored = recoveryPoint.contextSnapshot && 
        JSON.stringify(this.currentContext) !== JSON.stringify(recoveryPoint.contextSnapshot);
      
      if (contextRestored) {
        const currentRecoveryPoints = this.currentContext!.metadata.recoveryPoints;
        this.currentContext = this.ensureDatesInContext({ ...recoveryPoint.contextSnapshot });
        this.currentContext!.metadata.recoveryPoints = currentRecoveryPoints;
        this.currentContext!.lastUpdated = new Date();
        await this.saveContext(this.currentContext!);
      }

      return {
        success: true,
        recoveredSessionData: recoveryPoint.sessionData,
        contextRestored,
        recoveryPoint: {
          id: recoveryPoint.id,
          timestamp: recoveryPoint.timestamp,
          sessionData: recoveryPoint.sessionData
        }
      };
    } catch (error) {
      console.error('Failed to recover session:', error);
      return { success: false };
    }
  }

  /**
   * 取得可用的恢復點
   */
  getAvailableRecoveryPoints(): Array<{
    id: string;
    timestamp: string;
    sessionSummary: string;
    contextPhase: string;
  }> {
    if (!this.currentContext || !this.currentContext.metadata.recoveryPoints) {
      return [];
    }

    return this.currentContext.metadata.recoveryPoints.map((rp: any) => ({
      id: rp.id,
      timestamp: rp.timestamp,
      sessionSummary: this.generateSessionSummary(rp.sessionData),
      contextPhase: rp.contextSnapshot?.phase || 'unknown'
    }));
  }

  /**
   * 清理舊的恢復點
   */
  async cleanupOldRecoveryPoints(keepRecentCount: number = 5): Promise<number> {
    if (!this.currentContext) {
      await this.loadContext();
    }

    const recoveryPoints = this.currentContext!.metadata.recoveryPoints || [];
    const originalCount = recoveryPoints.length;

    if (originalCount <= keepRecentCount) {
      return 0;
    }

    this.currentContext!.metadata.recoveryPoints = recoveryPoints.slice(-keepRecentCount);
    await this.saveContext(this.currentContext!);

    return originalCount - keepRecentCount;
  }

  /**
   * 自動會話恢復
   */
  async autoRecoverSession(): Promise<{
    success: boolean;
    recoveryAttempted: boolean;
    recoveredData?: any;
    fallbackUsed?: boolean;
  }> {
    // 檢查狀態一致性
    const validation = await this.validateStateConsistency();
    
    if (validation.isValid) {
      return { 
        success: true, 
        recoveryAttempted: false 
      };
    }

    // 嘗試自動修復
    const repair = await this.autoRepairStateConsistency();
    
    if (repair.success) {
      return {
        success: true,
        recoveryAttempted: true,
        recoveredData: { repairedIssues: repair.repairedIssues }
      };
    }

    // 嘗試從恢復點恢復
    const recoveryPoints = this.getAvailableRecoveryPoints();
    if (recoveryPoints.length > 0) {
      const latestRecovery = recoveryPoints[recoveryPoints.length - 1];
      const recovery = await this.recoverSession(latestRecovery.id);
      
      if (recovery.success) {
        return {
          success: true,
          recoveryAttempted: true,
          recoveredData: recovery.recoveredSessionData
        };
      }
    }

    // 最後手段：重新建立預設脈絡
    try {
      await this.createStateSnapshot('before_fallback_recovery');
      this.currentContext = this.createDefaultContext();
      await this.saveContext(this.currentContext);
      
      return {
        success: true,
        recoveryAttempted: true,
        fallbackUsed: true,
        recoveredData: { message: 'Used default context fallback' }
      };
    } catch (error) {
      console.error('Auto recovery failed completely:', error);
      return { 
        success: false, 
        recoveryAttempted: true,
        recoveredData: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * 健康檢查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    performance: {
      contextLoadTime?: number;
      fileAccessible: boolean;
      memoryUsage?: number;
    };
    recommendations: string[];
  }> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    let contextLoadTime: number | undefined;
    let fileAccessible = false;

    try {
      // 測試脈絡載入
      if (!this.currentContext) {
        await this.loadContext();
      }
      contextLoadTime = Date.now() - startTime;

      // 測試檔案存取
      fileAccessible = await this.fileExists(this.claudeMdPath);
      
      // 驗證狀態
      const validation = await this.validateStateConsistency();
      issues.push(...validation.issues);
      recommendations.push(...validation.recommendations);

      // 效能檢查
      if (contextLoadTime > 1000) {
        issues.push('Context loading is slow');
        recommendations.push('Consider optimizing context structure');
      }

      if (!fileAccessible) {
        issues.push('CLAUDE.md file not accessible');
        recommendations.push('Ensure file system permissions are correct');
      }

      // 記憶體使用檢查（估算）
      const memoryUsage = this.currentContext ? 
        JSON.stringify(this.currentContext).length : 0;

      if (memoryUsage > 1048576) { // > 1MB
        issues.push('Context memory usage is high');
        recommendations.push('Consider archiving old conversation history');
      }

      return {
        healthy: issues.length === 0,
        issues,
        performance: {
          contextLoadTime,
          fileAccessible,
          memoryUsage
        },
        recommendations
      };
    } catch (error) {
      issues.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        healthy: false,
        issues,
        performance: {
          contextLoadTime,
          fileAccessible
        },
        recommendations: ['Investigate health check failure']
      };
    }
  }

  /**
   * 生成會話摘要
   */
  private generateSessionSummary(sessionData: any): string {
    const parts: string[] = [];
    
    if (sessionData.executorStatus) {
      parts.push(`執行器: ${sessionData.executorStatus}`);
    }
    
    if (sessionData.currentInstruction) {
      parts.push(`指令: ${sessionData.currentInstruction.directive?.substring(0, 30) || 'N/A'}...`);
    }
    
    if (sessionData.queueState) {
      parts.push(`佇列: ${sessionData.queueState.size || 0} 項`);
    }
    
    if (sessionData.agentState) {
      parts.push(`代理: ${sessionData.agentState}`);
    }

    return parts.length > 0 ? parts.join(', ') : '會話恢復點';
  }

  /**
   * 確保值是Date物件
   */
  private ensureDate(value: Date | string): Date {
    if (value instanceof Date) {
      return value;
    }
    return new Date(value);
  }

  /**
   * 確保脈絡資料中的日期都是Date物件
   */
  private ensureDatesInContext(context: ProjectContextData): ProjectContextData {
    return {
      ...context,
      createdAt: this.ensureDate(context.createdAt),
      lastUpdated: this.ensureDate(context.lastUpdated),
      phaseStartedAt: context.phaseStartedAt ? this.ensureDate(context.phaseStartedAt) : undefined,
      recentMessages: context.recentMessages.map(msg => ({
        ...msg,
        timestamp: this.ensureDate(msg.timestamp)
      }))
    };
  }

  /**
   * 安全地序列化元資料，避免循環引用
   */
  private serializeMetadataSafely(metadata: Record<string, any>): Record<string, any> {
    const seen = new WeakSet();
    
    const replacer = (key: string, value: any): any => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    };

    return JSON.parse(JSON.stringify(metadata, replacer));
  }
}