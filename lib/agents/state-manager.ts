import { PrismaClient } from '@prisma/client';
import { ProjectPhase, AgentState, ProjectContext, ConversationMessage } from './project-agent';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * 狀態快照
 */
export interface StateSnapshot {
  id: string;
  projectId: string;
  phase: ProjectPhase;
  state: AgentState;
  context: ProjectContext;
  timestamp: Date;
  checkpoint?: string;  // Git commit hash
}

/**
 * 狀態轉換記錄
 */
export interface StateTransition {
  id: string;
  fromState: AgentState;
  toState: AgentState;
  fromPhase?: ProjectPhase;
  toPhase?: ProjectPhase;
  trigger: string;  // 觸發原因
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * 狀態管理器 - 處理專案代理的狀態持久化和恢復
 */
export class StateManager {
  private prisma: PrismaClient;
  private projectId: string;
  private projectPath: string;
  private stateHistory: StateSnapshot[] = [];
  private transitionHistory: StateTransition[] = [];

  constructor(prisma: PrismaClient, projectId: string, projectPath: string) {
    this.prisma = prisma;
    this.projectId = projectId;
    this.projectPath = projectPath;
  }

  /**
   * 建立狀態快照
   */
  async createSnapshot(
    state: AgentState,
    phase: ProjectPhase,
    context: ProjectContext,
    checkpoint?: string
  ): Promise<StateSnapshot> {
    const snapshot: StateSnapshot = {
      id: this.generateId(),
      projectId: this.projectId,
      phase,
      state,
      context: this.cloneContext(context),
      timestamp: new Date(),
      checkpoint
    };

    // 儲存到記憶體
    this.stateHistory.push(snapshot);

    // 持久化到資料庫
    await this.saveSnapshotToDatabase(snapshot);

    // 保持快照數量在合理範圍
    await this.cleanupOldSnapshots();

    return snapshot;
  }

  /**
   * 恢復到指定快照
   */
  async restoreFromSnapshot(snapshotId: string): Promise<StateSnapshot | null> {
    // 首先從記憶體查找
    let snapshot = this.stateHistory.find(s => s.id === snapshotId);

    // 如果記憶體中沒有，從資料庫查找
    if (!snapshot) {
      snapshot = await this.loadSnapshotFromDatabase(snapshotId);
    }

    if (!snapshot) {
      return null;
    }

    // TODO: 恢復Git檢查點
    if (snapshot.checkpoint) {
      await this.restoreGitCheckpoint(snapshot.checkpoint);
    }

    return snapshot;
  }

  /**
   * 記錄狀態轉換
   */
  async recordTransition(
    fromState: AgentState,
    toState: AgentState,
    trigger: string,
    fromPhase?: ProjectPhase,
    toPhase?: ProjectPhase,
    metadata?: Record<string, any>
  ): Promise<StateTransition> {
    const transition: StateTransition = {
      id: this.generateId(),
      fromState,
      toState,
      fromPhase,
      toPhase,
      trigger,
      timestamp: new Date(),
      metadata
    };

    // 儲存到記憶體
    this.transitionHistory.push(transition);

    // 持久化到資料庫
    await this.saveTransitionToDatabase(transition);

    return transition;
  }

  /**
   * 取得最新快照
   */
  getLatestSnapshot(): StateSnapshot | null {
    return this.stateHistory.length > 0 
      ? this.stateHistory[this.stateHistory.length - 1]
      : null;
  }

  /**
   * 取得指定階段的快照
   */
  getSnapshotsByPhase(phase: ProjectPhase): StateSnapshot[] {
    return this.stateHistory.filter(s => s.phase === phase);
  }

  /**
   * 取得狀態轉換歷史
   */
  getTransitionHistory(): StateTransition[] {
    return [...this.transitionHistory];
  }

  /**
   * 載入專案狀態
   */
  async loadProjectState(): Promise<{
    latestSnapshot: StateSnapshot | null;
    recentTransitions: StateTransition[];
  }> {
    // 從資料庫載入最近的快照和轉換
    await this.loadRecentSnapshots();
    await this.loadRecentTransitions();

    return {
      latestSnapshot: this.getLatestSnapshot(),
      recentTransitions: this.getTransitionHistory().slice(-10)
    };
  }

  /**
   * 驗證狀態一致性
   */
  async validateStateConsistency(
    currentState: AgentState,
    currentPhase: ProjectPhase,
    currentContext: ProjectContext
  ): Promise<boolean> {
    const latestSnapshot = this.getLatestSnapshot();
    
    if (!latestSnapshot) {
      return true; // 沒有歷史快照，認為一致
    }

    // 檢查狀態是否合理
    const validTransitions = this.getValidTransitions(latestSnapshot.state);
    if (!validTransitions.includes(currentState)) {
      console.warn(`Invalid state transition: ${latestSnapshot.state} -> ${currentState}`);
      return false;
    }

    // 檢查階段轉換是否合理
    if (latestSnapshot.phase !== currentPhase) {
      const validPhaseTransitions = this.getValidPhaseTransitions(latestSnapshot.phase);
      if (!validPhaseTransitions.includes(currentPhase)) {
        console.warn(`Invalid phase transition: ${latestSnapshot.phase} -> ${currentPhase}`);
        return false;
      }
    }

    return true;
  }

  /**
   * 取得有效的狀態轉換
   */
  private getValidTransitions(fromState: AgentState): AgentState[] {
    const transitions: Record<AgentState, AgentState[]> = {
      [AgentState.IDLE]: [AgentState.LISTENING, AgentState.ERROR],
      [AgentState.LISTENING]: [
        AgentState.PROCESSING,
        AgentState.WAITING_USER,
        AgentState.EXECUTING,
        AgentState.ERROR,
        AgentState.IDLE
      ],
      [AgentState.PROCESSING]: [
        AgentState.LISTENING,
        AgentState.WAITING_USER,
        AgentState.EXECUTING,
        AgentState.ERROR
      ],
      [AgentState.WAITING_USER]: [
        AgentState.PROCESSING,
        AgentState.LISTENING,
        AgentState.ERROR
      ],
      [AgentState.EXECUTING]: [
        AgentState.LISTENING,
        AgentState.PROCESSING,
        AgentState.ERROR
      ],
      [AgentState.ERROR]: [
        AgentState.IDLE,
        AgentState.LISTENING
      ]
    };

    return transitions[fromState] || [];
  }

  /**
   * 取得有效的階段轉換
   */
  private getValidPhaseTransitions(fromPhase: ProjectPhase): ProjectPhase[] {
    const transitions: Record<ProjectPhase, ProjectPhase[]> = {
      [ProjectPhase.REQUIREMENTS]: [ProjectPhase.MVP],
      [ProjectPhase.MVP]: [ProjectPhase.CONTINUOUS],
      [ProjectPhase.CONTINUOUS]: [] // 持續整合階段不轉換
    };

    return transitions[fromPhase] || [];
  }

  /**
   * 儲存快照到資料庫
   */
  private async saveSnapshotToDatabase(snapshot: StateSnapshot): Promise<void> {
    try {
      // TODO: 實作實際的資料庫儲存邏輯
      // 這裡需要定義對應的Prisma模型
      console.log('Saving snapshot to database:', snapshot.id);
      
      // 暫時儲存到檔案系統
      const snapshotPath = path.join(
        this.projectPath,
        '.codehive',
        'snapshots',
        `${snapshot.id}.json`
      );
      
      await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
      await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
    } catch (error) {
      console.error('Failed to save snapshot:', error);
    }
  }

  /**
   * 從資料庫載入快照
   */
  private async loadSnapshotFromDatabase(snapshotId: string): Promise<StateSnapshot | null> {
    try {
      // TODO: 實作實際的資料庫查詢邏輯
      
      // 暫時從檔案系統載入
      const snapshotPath = path.join(
        this.projectPath,
        '.codehive',
        'snapshots',
        `${snapshotId}.json`
      );
      
      const content = await fs.readFile(snapshotPath, 'utf-8');
      return JSON.parse(content) as StateSnapshot;
    } catch (error) {
      console.error('Failed to load snapshot:', error);
      return null;
    }
  }

  /**
   * 儲存轉換到資料庫
   */
  private async saveTransitionToDatabase(transition: StateTransition): Promise<void> {
    try {
      // TODO: 實作實際的資料庫儲存邏輯
      console.log('Saving transition to database:', transition.id);
      
      // 暫時儲存到檔案系統
      const transitionPath = path.join(
        this.projectPath,
        '.codehive',
        'transitions',
        `${transition.id}.json`
      );
      
      await fs.mkdir(path.dirname(transitionPath), { recursive: true });
      await fs.writeFile(transitionPath, JSON.stringify(transition, null, 2));
    } catch (error) {
      console.error('Failed to save transition:', error);
    }
  }

  /**
   * 載入最近的快照
   */
  private async loadRecentSnapshots(): Promise<void> {
    try {
      const snapshotsDir = path.join(this.projectPath, '.codehive', 'snapshots');
      
      try {
        const files = await fs.readdir(snapshotsDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        for (const file of jsonFiles.slice(-10)) { // 載入最近10個快照
          const content = await fs.readFile(path.join(snapshotsDir, file), 'utf-8');
          const snapshot = JSON.parse(content) as StateSnapshot;
          
          // 轉換timestamp為Date對象
          snapshot.timestamp = new Date(snapshot.timestamp);
          
          this.stateHistory.push(snapshot);
        }
        
        // 按時間排序
        this.stateHistory.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      } catch {
        // 目錄不存在或為空，忽略錯誤
      }
    } catch (error) {
      console.error('Failed to load recent snapshots:', error);
    }
  }

  /**
   * 載入最近的轉換
   */
  private async loadRecentTransitions(): Promise<void> {
    try {
      const transitionsDir = path.join(this.projectPath, '.codehive', 'transitions');
      
      try {
        const files = await fs.readdir(transitionsDir);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        for (const file of jsonFiles.slice(-20)) { // 載入最近20個轉換
          const content = await fs.readFile(path.join(transitionsDir, file), 'utf-8');
          const transition = JSON.parse(content) as StateTransition;
          
          // 轉換timestamp為Date對象
          transition.timestamp = new Date(transition.timestamp);
          
          this.transitionHistory.push(transition);
        }
        
        // 按時間排序
        this.transitionHistory.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      } catch {
        // 目錄不存在或為空，忽略錯誤
      }
    } catch (error) {
      console.error('Failed to load recent transitions:', error);
    }
  }

  /**
   * 清理舊快照
   */
  private async cleanupOldSnapshots(): Promise<void> {
    const maxSnapshots = 50;
    
    if (this.stateHistory.length > maxSnapshots) {
      // 移除舊的快照
      const toRemove = this.stateHistory.splice(0, this.stateHistory.length - maxSnapshots);
      
      // 刪除對應的檔案
      for (const snapshot of toRemove) {
        try {
          const snapshotPath = path.join(
            this.projectPath,
            '.codehive',
            'snapshots',
            `${snapshot.id}.json`
          );
          await fs.unlink(snapshotPath);
        } catch {
          // 忽略刪除錯誤
        }
      }
    }
  }

  /**
   * 恢復Git檢查點
   */
  private async restoreGitCheckpoint(checkpoint: string): Promise<void> {
    // TODO: 實作Git恢復邏輯
    console.log('Restoring Git checkpoint:', checkpoint);
  }

  /**
   * 複製脈絡對象
   */
  private cloneContext(context: ProjectContext): ProjectContext {
    return {
      phase: context.phase,
      currentEpicId: context.currentEpicId,
      currentStoryId: context.currentStoryId,
      currentTaskId: context.currentTaskId,
      conversationHistory: context.conversationHistory.map(msg => ({ ...msg })),
      requirements: context.requirements ? { ...context.requirements } : undefined,
      proposal: context.proposal ? { ...context.proposal } : undefined,
      decisions: { ...context.decisions }
    };
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清理資源
   */
  async cleanup(): Promise<void> {
    // 清理記憶體
    this.stateHistory = [];
    this.transitionHistory = [];
  }
}