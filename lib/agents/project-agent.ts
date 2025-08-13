import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ConversationHandler, ConversationAnalysis } from './conversation-handler';
import { ClaudeCodeIntegration, ClaudeCodeConfig, ClaudeCodeResult } from './claude-code-integration';
import { StateManager, StateSnapshot, StateTransition } from './state-manager';
import { ContextManager, ProjectContextData, ClaudeMdSection } from './context-manager';

/**
 * 專案生命週期階段
 */
export enum ProjectPhase {
  REQUIREMENTS = 'requirements',    // 需求獲取階段
  MVP = 'mvp',                      // MVP開發階段
  CONTINUOUS = 'continuous'         // 持續整合階段
}

/**
 * 代理狀態
 */
export enum AgentState {
  IDLE = 'idle',                    // 閒置
  LISTENING = 'listening',          // 聆聽對話
  PROCESSING = 'processing',        // 處理中
  WAITING_USER = 'waiting_user',    // 等待使用者
  EXECUTING = 'executing',          // 執行指令
  ERROR = 'error'                   // 錯誤狀態
}

/**
 * 對話訊息
 */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * 專案代理配置
 */
export interface ProjectAgentConfig {
  projectId: string;
  projectPath: string;
  claudeMdPath?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * 執行指令（現在使用統一的階層模型）
 */
export interface ExecutionInstruction {
  id: string;
  taskId: string;
  directive: string;
  expectedOutcome: string;
  validationCriteria?: string;
  sequence: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  output?: string;
  error?: string;
  tokenUsage?: number;
  executionTime?: number;
}

/**
 * 專案脈絡
 */
export interface ProjectContext {
  phase: ProjectPhase;
  currentEpicId?: string;
  currentStoryId?: string;
  currentTaskId?: string;
  conversationHistory: ConversationMessage[];
  requirements?: Record<string, any>;
  proposal?: Record<string, any>;
  decisions: Record<string, any>;
}

/**
 * 單一專案代理 - 管理整個專案生命週期
 */
export class ProjectAgent extends EventEmitter {
  private prisma: PrismaClient;
  private config: ProjectAgentConfig;
  private state: AgentState = AgentState.IDLE;
  private context: ProjectContext;
  private claudeMdPath: string;
  private conversationHandler: ConversationHandler;
  private claudeCodeIntegration: ClaudeCodeIntegration;
  private stateManager: StateManager;
  private contextManager: ContextManager;

  constructor(config: ProjectAgentConfig, prisma: PrismaClient) {
    super();
    this.config = config;
    this.prisma = prisma;
    this.claudeMdPath = config.claudeMdPath || 
      path.join(config.projectPath, '.codehive', 'CLAUDE.md');
    
    // 初始化專案脈絡
    this.context = {
      phase: ProjectPhase.REQUIREMENTS,
      conversationHistory: [],
      decisions: {}
    };
    
    // 初始化脈絡管理器
    this.contextManager = new ContextManager(
      this.config.projectPath,
      this.claudeMdPath
    );
    
    // 初始化對話處理器
    this.conversationHandler = new ConversationHandler();
    
    // 初始化Claude Code整合
    const claudeConfig: ClaudeCodeConfig = {
      workingDirectory: config.projectPath,
      maxTokens: config.maxTokens,
      apiKey: process.env.ANTHROPIC_API_KEY
    };
    this.claudeCodeIntegration = new ClaudeCodeIntegration(claudeConfig);
    
    // 初始化狀態管理器
    this.stateManager = new StateManager(
      this.prisma,
      this.config.projectId,
      this.config.projectPath
    );
    
    // 監聽Claude Code事件
    this.claudeCodeIntegration.on('output', (data) => {
      this.emit('claude:output', data);
    });
    
    this.claudeCodeIntegration.on('execution:completed', (result) => {
      this.emit('claude:completed', result);
    });
  }

  /**
   * 初始化代理
   */
  async initialize(): Promise<void> {
    try {
      // 載入專案狀態
      const { latestSnapshot } = await this.stateManager.loadProjectState();
      
      // 載入脈絡管理器的脈絡
      const contextData = await this.contextManager.loadContext();
      
      // 如果有歷史狀態，恢復之
      if (latestSnapshot) {
        this.context = latestSnapshot.context;
        this.context.phase = latestSnapshot.phase;
      } else if (contextData) {
        // 從脈絡管理器恢復
        this.context.phase = contextData.phase;
        this.context.conversationHistory = contextData.recentMessages;
        this.context.decisions = contextData.decisions;
        this.context.requirements = contextData.requirements;
      }
      
      // 同步脈絡管理器狀態
      await this.syncContextManager();
      
      // 驗證狀態一致性
      const isValid = await this.stateManager.validateStateConsistency(
        this.state,
        this.context.phase,
        this.context
      );
      
      if (!isValid) {
        console.warn('State inconsistency detected, creating recovery snapshot');
      }
      
      // 設定狀態為聆聽
      await this.setState(AgentState.LISTENING, 'initialization');
      
      // 建立初始快照
      await this.stateManager.createSnapshot(
        this.state,
        this.context.phase,
        this.context
      );
      
      this.emit('initialized', {
        projectId: this.config.projectId,
        phase: this.context.phase,
        restored: !!latestSnapshot
      });
    } catch (error) {
      await this.setState(AgentState.ERROR, 'initialization_error');
      throw error;
    }
  }

  /**
   * 處理使用者對話
   */
  async handleConversation(message: string): Promise<string> {
    await this.setState(AgentState.PROCESSING, 'user_message');
    
    try {
      // 記錄使用者訊息
      const userMessage: ConversationMessage = {
        id: this.generateId(),
        role: 'user',
        content: message,
        timestamp: new Date()
      };
      this.context.conversationHistory.push(userMessage);
      
      // 同步到脈絡管理器
      await this.contextManager.addConversationMessage(userMessage);
      
      // 根據當前階段處理對話
      let response: string;
      switch (this.context.phase) {
        case ProjectPhase.REQUIREMENTS:
          response = await this.handleRequirementsConversation(message);
          break;
        case ProjectPhase.MVP:
          response = await this.handleMVPConversation(message);
          break;
        case ProjectPhase.CONTINUOUS:
          response = await this.handleContinuousConversation(message);
          break;
        default:
          response = "我不確定如何處理這個請求。";
      }
      
      // 記錄助理回應
      const assistantMessage: ConversationMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
      this.context.conversationHistory.push(assistantMessage);
      
      // 同步到脈絡管理器
      await this.contextManager.addConversationMessage(assistantMessage);
      
      // 儲存脈絡
      await this.saveContext();
      
      // 建立對話快照
      await this.stateManager.createSnapshot(
        AgentState.LISTENING,
        this.context.phase,
        this.context
      );
      
      await this.setState(AgentState.LISTENING, 'conversation_complete');
      return response;
    } catch (error) {
      await this.setState(AgentState.ERROR, 'conversation_error');
      throw error;
    }
  }

  /**
   * 處理需求獲取階段對話
   */
  private async handleRequirementsConversation(message: string): Promise<string> {
    this.emit('requirements:processing', { message });
    
    // 分析對話意圖
    const analysis = this.conversationHandler.analyzeConversation(message);
    
    // 生成回應
    const response = this.conversationHandler.generateRequirementsResponse(
      analysis,
      this.context
    );
    
    // 更新需求到脈絡
    this.context.requirements = this.conversationHandler.getCollectedRequirements();
    
    return response;
  }

  /**
   * 處理MVP開發階段對話
   */
  private async handleMVPConversation(message: string): Promise<string> {
    this.emit('mvp:processing', { message });
    
    // 分析對話意圖
    const analysis = this.conversationHandler.analyzeConversation(message);
    
    // 生成回應
    const response = this.conversationHandler.generateMVPResponse(
      analysis,
      this.context
    );
    
    return response;
  }

  /**
   * 處理持續整合階段對話
   */
  private async handleContinuousConversation(message: string): Promise<string> {
    this.emit('continuous:processing', { message });
    
    // 分析對話意圖
    const analysis = this.conversationHandler.analyzeConversation(message);
    
    // 生成回應
    const response = this.conversationHandler.generateContinuousResponse(
      analysis,
      this.context
    );
    
    return response;
  }

  /**
   * 轉換專案階段
   */
  async transitionPhase(newPhase: ProjectPhase, reason?: string): Promise<void> {
    const oldPhase = this.context.phase;
    
    // 記錄階段轉換
    await this.stateManager.recordTransition(
      this.state,
      this.state,
      'phase_transition',
      oldPhase,
      newPhase,
      { reason: reason || 'user_requested' }
    );
    
    this.context.phase = newPhase;
    
    // 同步到脈絡管理器
    await this.contextManager.updatePhase(newPhase, reason);
    
    // 建立快照
    await this.stateManager.createSnapshot(
      this.state,
      this.context.phase,
      this.context
    );
    
    this.emit('phase:transition', {
      from: oldPhase,
      to: newPhase,
      reason
    });
    
    await this.saveContext();
  }

  /**
   * 生成指令供執行器執行（現在委派給階層管理器）
   */
  async generateInstruction(taskId: string, directive: string, expectedOutcome: string): Promise<ExecutionInstruction> {
    const instruction: ExecutionInstruction = {
      id: this.generateId(),
      taskId,
      directive,
      expectedOutcome,
      sequence: 1,
      status: 'pending'
    };
    
    this.emit('instruction:generated', instruction);
    return instruction;
  }

  /**
   * 執行指令 - 整合階層化模型
   */
  async executeInstruction(instruction: ExecutionInstruction | { directive: string; expectedOutcome: string }): Promise<ClaudeCodeResult> {
    await this.setState(AgentState.EXECUTING, 'instruction_execution');
    
    try {
      const result = await this.claudeCodeIntegration.executeInstruction(instruction);
      
      // 建立執行快照
      await this.stateManager.createSnapshot(
        this.state,
        this.context.phase,
        this.context
      );
      
      await this.setState(AgentState.LISTENING, 'instruction_completed');
      return result;
    } catch (error) {
      await this.setState(AgentState.ERROR, 'instruction_error');
      throw error;
    }
  }

  /**
   * 驗證非開發任務的標準
   */
  async validateCriteria(taskId: string, output: any): Promise<boolean> {
    this.emit('validation:checking', { taskId, output });
    
    // 取得任務的驗證標準
    // TODO: 從資料庫取得實際的任務標準
    const criteria = "任務已完成且滿足預期結果";
    
    try {
      const isValid = await this.claudeCodeIntegration.validateOutput(
        String(output),
        criteria
      );
      
      this.emit('validation:completed', { taskId, isValid });
      return isValid;
    } catch (error) {
      this.emit('validation:error', { taskId, error });
      return false;
    }
  }

  /**
   * 載入專案脈絡
   */
  private async loadContext(): Promise<void> {
    try {
      // 從CLAUDE.md載入脈絡
      const claudeMdContent = await fs.readFile(this.claudeMdPath, 'utf-8');
      // TODO: 解析CLAUDE.md內容
      
      // 從資料庫載入對話歷史
      // TODO: 實作資料庫查詢
      
      this.emit('context:loaded', this.context);
    } catch (error) {
      // 如果檔案不存在，使用預設脈絡
      console.log('Creating new context');
    }
  }

  /**
   * 儲存專案脈絡
   */
  private async saveContext(): Promise<void> {
    try {
      // 更新CLAUDE.md
      const contextSummary = this.generateContextSummary();
      await fs.writeFile(this.claudeMdPath, contextSummary, 'utf-8');
      
      // 儲存到資料庫
      // TODO: 實作資料庫儲存
      
      this.emit('context:saved', this.context);
    } catch (error) {
      console.error('Failed to save context:', error);
      throw error;
    }
  }

  /**
   * 生成脈絡摘要
   */
  private generateContextSummary(): string {
    return `# Project Context

## Current Phase
${this.context.phase}

## Conversation History
${this.context.conversationHistory.slice(-10).map(m => 
  `[${m.role}]: ${m.content}`
).join('\n')}

## Decisions
${JSON.stringify(this.context.decisions, null, 2)}

## Requirements
${JSON.stringify(this.context.requirements || {}, null, 2)}

## Proposal
${JSON.stringify(this.context.proposal || {}, null, 2)}
`;
  }

  /**
   * 生成需求問題
   */
  private async generateRequirementQuestions(): Promise<string[]> {
    // TODO: 實作智能問題生成
    return [
      "您的專案主要解決什麼問題？",
      "目標使用者是誰？",
      "有哪些核心功能需求？",
      "是否有技術限制或偏好？",
      "預期的專案規模和時程？"
    ];
  }

  /**
   * 檢查是否要求開始MVP
   */
  private isAskingToStartMVP(message: string): boolean {
    const keywords = ['開始', 'mvp', '開發', '實作', '建立'];
    return keywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  /**
   * 設定代理狀態
   */
  private async setState(newState: AgentState, trigger?: string): Promise<void> {
    const oldState = this.state;
    
    // 記錄狀態轉換
    if (oldState !== newState && trigger) {
      await this.stateManager.recordTransition(
        oldState,
        newState,
        trigger,
        undefined,
        undefined,
        { timestamp: new Date() }
      );
    }
    
    this.state = newState;
    this.emit('state:changed', {
      from: oldState,
      to: newState,
      trigger
    });
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 取得當前狀態
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * 取得當前階段
   */
  getPhase(): ProjectPhase {
    return this.context.phase;
  }

  /**
   * 取得對話歷史
   */
  getConversationHistory(): ConversationMessage[] {
    return this.context.conversationHistory;
  }

  /**
   * 恢復到指定狀態快照
   */
  async restoreFromSnapshot(snapshotId: string): Promise<boolean> {
    try {
      const snapshot = await this.stateManager.restoreFromSnapshot(snapshotId);
      
      if (!snapshot) {
        return false;
      }
      
      // 恢復狀態和脈絡
      this.context = snapshot.context;
      await this.setState(snapshot.state, 'snapshot_restore');
      
      // 儲存恢復的脈絡
      await this.saveContext();
      
      this.emit('restored', {
        snapshotId,
        phase: snapshot.phase,
        timestamp: snapshot.timestamp
      });
      
      return true;
    } catch (error) {
      console.error('Failed to restore from snapshot:', error);
      return false;
    }
  }

  /**
   * 取得狀態歷史
   */
  getStateHistory(): {
    snapshots: StateSnapshot[];
    transitions: StateTransition[];
  } {
    const latestSnapshot = this.stateManager.getLatestSnapshot();
    const transitions = this.stateManager.getTransitionHistory();
    
    return {
      snapshots: latestSnapshot ? [latestSnapshot] : [],
      transitions
    };
  }

  /**
   * 同步脈絡管理器
   */
  private async syncContextManager(): Promise<void> {
    const currentContext = this.contextManager.getCurrentContext();
    if (!currentContext) return;

    // 更新當前任務資訊
    await this.contextManager.updateCurrentTask(
      this.context.currentEpicId,
      this.context.currentStoryId,
      this.context.currentTaskId
    );
  }

  /**
   * 更新當前任務
   */
  async updateCurrentTask(epicId?: string, storyId?: string, taskId?: string): Promise<void> {
    this.context.currentEpicId = epicId;
    this.context.currentStoryId = storyId;
    this.context.currentTaskId = taskId;

    // 同步到脈絡管理器
    await this.contextManager.updateCurrentTask(epicId, storyId, taskId);
  }

  /**
   * 標記任務完成
   */
  async markTaskCompleted(taskId: string, summary?: string): Promise<void> {
    // 同步到脈絡管理器
    await this.contextManager.completeTask(taskId, summary);
    
    this.emit('task:completed', { taskId, summary });
  }

  /**
   * 更新脈絡章節
   */
  async updateContextSection(section: ClaudeMdSection, content: string): Promise<void> {
    await this.contextManager.updateSection(section, content);
    this.emit('context:section_updated', { section, content });
  }

  /**
   * 取得專案脈絡資料
   */
  getProjectContextData(): ProjectContextData | null {
    return this.contextManager.getCurrentContext();
  }

  /**
   * 檢查脈絡是否需要重新載入
   */
  async shouldReloadContext(): Promise<boolean> {
    return await this.contextManager.needsReload();
  }

  /**
   * 重新載入脈絡
   */
  async reloadContext(): Promise<void> {
    const contextData = await this.contextManager.loadContext();
    
    // 同步內部狀態
    if (contextData) {
      this.context.phase = contextData.phase;
      this.context.decisions = contextData.decisions;
      this.context.requirements = contextData.requirements;
    }
    
    this.emit('context:reloaded', { contextData });
  }

  /**
   * 建立會話恢復點
   */
  async createSessionRecoveryPoint(): Promise<string> {
    const sessionData = {
      agentState: this.state,
      currentTask: {
        epicId: this.context.currentEpicId,
        storyId: this.context.currentStoryId,
        taskId: this.context.currentTaskId
      },
      phase: this.context.phase
    };

    const recoveryId = await this.contextManager.createSessionRecoveryPoint(sessionData);
    this.emit('recovery:point_created', { recoveryId, sessionData });
    return recoveryId;
  }

  /**
   * 恢復會話狀態
   */
  async recoverSession(recoveryId?: string): Promise<boolean> {
    try {
      const recovery = await this.contextManager.recoverSession(recoveryId);
      
      if (!recovery.success) {
        return false;
      }

      // 恢復代理狀態
      if (recovery.recoveredSessionData) {
        const sessionData = recovery.recoveredSessionData;
        
        if (sessionData.agentState) {
          await this.setState(sessionData.agentState, 'session_recovery');
        }

        if (sessionData.currentTask) {
          this.context.currentEpicId = sessionData.currentTask.epicId;
          this.context.currentStoryId = sessionData.currentTask.storyId;
          this.context.currentTaskId = sessionData.currentTask.taskId;
        }

        if (sessionData.phase) {
          this.context.phase = sessionData.phase;
        }
      }

      this.emit('recovery:session_recovered', { recovery });
      return true;
    } catch (error) {
      console.error('Failed to recover session:', error);
      return false;
    }
  }

  /**
   * 自動會話恢復
   */
  async autoRecoverSession(): Promise<boolean> {
    try {
      const recovery = await this.contextManager.autoRecoverSession();
      
      if (recovery.success && recovery.recoveryAttempted) {
        // 如果有恢復會話資料，同步狀態
        if (recovery.recoveredData && recovery.recoveredData.agentState) {
          await this.setState(recovery.recoveredData.agentState, 'auto_recovery');
        }

        this.emit('recovery:auto_recovered', { recovery });
      }

      return recovery.success;
    } catch (error) {
      console.error('Auto recovery failed:', error);
      return false;
    }
  }

  /**
   * 執行健康檢查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    contextHealth: any;
    agentHealth: {
      state: AgentState;
      initialized: boolean;
      hasValidContext: boolean;
      stateConsistent: boolean;
    };
  }> {
    // 檢查脈絡管理器健康狀況
    const contextHealth = await this.contextManager.healthCheck();
    
    // 檢查代理本身的健康狀況
    const agentHealth = {
      state: this.state,
      initialized: this.state !== AgentState.IDLE,
      hasValidContext: !!this.context && !!this.context.phase,
      stateConsistent: this.context?.phase !== undefined
    };

    const overallHealthy = contextHealth.healthy && 
                          agentHealth.initialized && 
                          agentHealth.hasValidContext && 
                          agentHealth.stateConsistent;

    return {
      healthy: overallHealthy,
      contextHealth,
      agentHealth
    };
  }

  /**
   * 取得恢復點資訊
   */
  getRecoveryPoints(): Array<{
    id: string;
    timestamp: string;
    sessionSummary: string;
    contextPhase: string;
  }> {
    return this.contextManager.getAvailableRecoveryPoints();
  }

  /**
   * 清理資源
   */
  async cleanup(): Promise<void> {
    await this.saveContext();
    
    // 建立最終快照
    await this.stateManager.createSnapshot(
      AgentState.IDLE,
      this.context.phase,
      this.context
    );
    
    this.claudeCodeIntegration.cleanup();
    await this.stateManager.cleanup();
    this.removeAllListeners();
    await this.setState(AgentState.IDLE, 'cleanup');
  }
}