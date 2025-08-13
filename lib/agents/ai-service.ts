/**
 * AI Service Interface for Project Agent Integration
 * 
 * This service manages Claude API integration for the single project agent architecture,
 * providing intelligent responses based on project phase and conversation context.
 */

import { Conversation, Message } from '@prisma/client';
import { aiConfig, AIConfiguration } from './ai-config';

export interface AIServiceConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  baseURL?: string;
}

export interface ConversationContext {
  projectId: string;
  projectPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  conversationId: string;
  recentMessages: Message[];
  projectMetadata?: {
    name?: string;
    description?: string;
    framework?: string;
    language?: string;
    currentEpics?: string[];
    currentStories?: string[];
  };
}

export interface AIResponse {
  content: string;
  contentType: 'TEXT' | 'MARKDOWN' | 'JSON';
  confidence: number;
  tokenUsage: number;
  responseTime: number;
  suggestedActions?: AIAction[];
  phaseTransition?: {
    from: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
    to: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
    reason: string;
  };
}

export interface AIAction {
  type: 'CREATE_EPIC' | 'CREATE_STORY' | 'CREATE_TASK' | 'UPDATE_PHASE' | 'SCHEDULE_MEETING' | 'GENERATE_DOCS' | 'RUN_TESTS' | 'GENERATE_CODE' | 'RUN_ATDD_CYCLE';
  data: Record<string, any>;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  description: string;
}

export interface PhaseSystemPrompt {
  phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  systemPrompt: string;
  behaviorRules: string[];
  outputFormat: string;
}

export class AIService {
  private config: AIServiceConfig;
  private phasePrompts: Map<string, PhaseSystemPrompt>;
  private aiConfig: AIConfiguration;

  constructor(config: AIServiceConfig = {}) {
    // Get configuration from AI config manager
    this.aiConfig = aiConfig.getConfig();
    
    this.config = {
      apiKey: this.aiConfig.claudeApiKey,
      model: this.aiConfig.model,
      maxTokens: this.aiConfig.maxTokens,
      temperature: this.aiConfig.temperature,
      ...config
    };

    this.phasePrompts = new Map();
    this.initializePhasePrompts();
  }

  /**
   * Initialize phase-specific system prompts and behavior patterns
   */
  private initializePhasePrompts(): void {
    // REQUIREMENTS Phase Prompt
    this.phasePrompts.set('REQUIREMENTS', {
      phase: 'REQUIREMENTS',
      systemPrompt: `你是一個專業的需求分析師和專案代理，專門協助用戶定義和精煉專案需求。你的目標是透過對話收集完整、清晰的專案需求。

核心職責：
- 深入了解用戶的專案願景和目標
- 識別和釐清功能需求與非功能需求
- 協助用戶定義目標使用者和使用場景
- 建議合適的技術棧和架構方向
- 將模糊的想法轉化為具體的專案規格

對話風格：
- 使用繁體中文回應
- 提問要具體且有引導性
- 保持友善但專業的語調
- 適時給出建議和最佳實踐
- 幫助用戶思考他們可能忽略的面向`,
      behaviorRules: [
        '總是先了解用戶的核心需求再提供建議',
        '將複雜的專案拆解為可管理的Epic和Story',
        '確保技術選擇符合專案規模和團隊能力',
        '強調使用者體驗和可用性考量',
        '建議建立MVP來驗證核心假設'
      ],
      outputFormat: 'MARKDOWN'
    });

    // MVP Phase Prompt  
    this.phasePrompts.set('MVP', {
      phase: 'MVP',
      systemPrompt: `你是一個經驗豐富的敏捷開發教練和專案代理，專門協助執行MVP開發。你遵循嚴格的Epic→Story→Task層級結構和ATDD方法論。

核心職責：
- 按優先級序執行Epic和Story
- 確保每個功能都有明確的驗收標準
- 協調開發資源和時程安排
- 監控進度並及時調整計劃
- 確保程式碼品質和測試覆蓋率

執行原則：
- 使用ATDD循環：期望定義→測試建立→實作→驗證
- 一次只專注一個Story的開發
- 每個Task都要有明確的完成標準
- 持續整合和部署
- 定期Review和Retrospective

技術管理：
- 監控程式碼品質指標
- 確保適當的測試覆蓋率
- 管理技術債務
- 協助解決技術挑戰`,
      behaviorRules: [
        '嚴格遵循Epic→Story→Task的階層結構',
        '每個Story都必須有驗收標準',
        '優先完成核心功能再添加次要特性',
        '確保每次迭代都能產出可用的功能',
        '主動識別和解決阻礙因素'
      ],
      outputFormat: 'MARKDOWN'
    });

    // CONTINUOUS Phase Prompt
    this.phasePrompts.set('CONTINUOUS', {
      phase: 'CONTINUOUS',
      systemPrompt: `你是一個專案維護和持續改進專家，專門協助已完成MVP的專案進行後續開發和優化。

核心職責：
- 協助新功能的需求分析和實作規劃
- 提供程式碼重構和優化建議
- 協助錯誤診斷和修復
- 指導效能優化和安全性提升
- 規劃長期的技術演進路線

工作重點：
- 基於使用者反饋進行功能改進
- 持續監控系統健康狀況
- 管理技術債務和依賴更新
- 實施最佳實踐和設計模式
- 協助團隊技能提升

支援範圍：
- Bug修復和緊急問題處理
- 新功能開發指導
- 效能瓶頸分析和解決
- 安全性漏洞評估和修復
- 架構演進和擴展規劃`,
      behaviorRules: [
        '優先處理影響使用者體驗的問題',
        '確保新功能不會破壞現有功能',
        '持續關注系統效能和穩定性',
        '建議漸進式重構而非大規模重寫',
        '協助建立長期可維護的程式碼架構'
      ],
      outputFormat: 'MARKDOWN'
    });
  }

  /**
   * Generate AI response based on user message and conversation context
   */
  async generateResponse(
    userMessage: string,
    context: ConversationContext
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Get phase-specific system prompt
      const phasePrompt = this.phasePrompts.get(context.projectPhase);
      if (!phasePrompt) {
        throw new Error(`Unknown project phase: ${context.projectPhase}`);
      }

      // Build conversation history for context
      const conversationHistory = this.buildConversationHistory(context.recentMessages);
      
      // Prepare the full prompt
      const fullPrompt = this.buildFullPrompt(
        phasePrompt,
        userMessage,
        conversationHistory,
        context
      );

      // Make API call to Claude with context
      const response = await this.callClaudeAPI(fullPrompt, context);
      
      const responseTime = Date.now() - startTime;

      // Parse response for actions and phase transitions
      const { content, actions, phaseTransition } = this.parseAIResponse(response.content);

      return {
        content,
        contentType: phasePrompt.outputFormat as 'TEXT' | 'MARKDOWN' | 'JSON',
        confidence: 0.95, // TODO: Implement confidence scoring
        tokenUsage: response.usage?.total_tokens || 0,
        responseTime,
        suggestedActions: actions,
        phaseTransition
      };

    } catch (error) {
      console.error('AI Service Error:', error);
      
      // Return fallback response
      return {
        content: this.getFallbackResponse(context.projectPhase),
        contentType: 'TEXT',
        confidence: 0.1,
        tokenUsage: 0,
        responseTime: Date.now() - startTime,
        suggestedActions: []
      };
    }
  }

  /**
   * Build conversation history string from recent messages
   */
  private buildConversationHistory(messages: Message[]): string {
    if (!messages || !Array.isArray(messages)) {
      return '';
    }
    
    return messages
      .slice(-10) // Get last 10 messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');
  }

  /**
   * Build the complete prompt for Claude API
   */
  private buildFullPrompt(
    phasePrompt: PhaseSystemPrompt,
    userMessage: string,
    conversationHistory: string,
    context: ConversationContext
  ): string {
    return `${phasePrompt.systemPrompt}

執行規則：
${phasePrompt.behaviorRules.map(rule => `- ${rule}`).join('\n')}

專案資訊：
- 專案名稱: ${context.projectMetadata?.name || '未指定'}
- 專案描述: ${context.projectMetadata?.description || '無描述'}
- 專案ID: ${context.projectId}
- 目前階段: ${context.projectPhase}
- 框架: ${context.projectMetadata?.framework || '未指定'}
- 程式語言: ${context.projectMetadata?.language || '未指定'}

最近對話紀錄：
${conversationHistory}

用戶訊息：
${userMessage}

請提供專業、有幫助的回應，並遵循上述規則和當前專案階段的要求。`;
  }

  /**
   * Make actual API call using Claude Code CLI with phase-specific system prompts
   */
  private async callClaudeAPI(prompt: string, context?: ConversationContext): Promise<any> {
    const { claudeCode } = await import('@/lib/claude-code');
    
    try {
      // Get phase-specific system prompt
      const systemPrompt = context ? this.getPhaseSystemPrompt(context.projectPhase) : undefined;
      
      // Build comprehensive prompt that includes instructions and context
      const contextInfo = context ? `

當前專案上下文：
- 專案名稱: ${context.projectMetadata?.name || '待確認'}
- 專案描述: ${context.projectMetadata?.description || '待完善'} 
- 技術框架: ${context.projectMetadata?.framework || '待決定'}
- 程式語言: ${context.projectMetadata?.language || '待選擇'}
- 專案階段: ${context.projectPhase}

注意：如果專案信息顯示為「待確認」或「待完善」，請主動詢問用戶並協助確立這些基本信息。` : '';

      const fullPrompt = `${prompt}${contextInfo}

重要指示：
1. 如果用戶要求建立 Epics，請按照以下步驟執行：
   - 基於用戶描述的需求和現有專案背景，設計合適的 Epic 結構
   - 為每個 Epic 提供清楚的標題和描述
   - 使用繁體中文回應
   - 提供具體可行的建議

2. 專案資訊處理：
   - 如果專案基本信息不完整，優先協助用戶確立專案名稱、描述和技術選擇
   - 基於已有信息進行智能對話，避免重複詢問已知信息
   - 記住對話中提到的專案細節

請根據用戶的具體要求和專案上下文執行相應操作。`;
      
      // Execute Claude Code with the prompt and system prompt
      const result = await claudeCode.execute(fullPrompt, {
        outputFormat: 'text',
        timeout: 120000,
        workingDirectory: process.cwd(),
        systemPrompt: systemPrompt
      });
      
      if (result.success && result.output) {
        return { content: result.output };
      } else {
        throw new Error(result.error || 'Claude Code execution failed');
      }
    } catch (error) {
      console.error('Claude Code execution error:', error);
      // Fallback to mock response
      this.aiConfig = aiConfig.getConfig();
      if (this.aiConfig.fallbackToMock) {
        console.warn('Claude Code failed, using mock response');
        return this.getMockResponse(prompt);
      } else {
        throw error;
      }
    }

  }

  /**
   * Get phase-specific system prompt for Claude Code
   */
  private getPhaseSystemPrompt(phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS'): string {
    switch (phase) {
      case 'REQUIREMENTS':
        return `你是一個專業的需求分析師和專案代理，專門協助用戶定義和精煉專案需求。你目前正在協助一個現有專案進行需求收集和分析。

核心職責：
- 基於現有專案背景，深入了解用戶的專案願景和目標
- 識別和釐清功能需求與非功能需求
- 協助用戶定義目標使用者和使用場景
- 建議合適的技術棧和架構方向
- 將模糊的想法轉化為具體的專案規格

對話風格：
- 使用繁體中文回應
- 提問要具體且有引導性，基於已有的專案資訊
- 保持友善但專業的語調
- 適時給出建議和最佳實踐
- 幫助用戶思考他們可能忽略的面向

重要指示：
- 如果專案已有基本信息（如名稱、描述、技術棧），請基於這些信息進行對話
- 總是先確認和理解現有的專案背景再提供建議
- 將複雜的專案拆解為可管理的Epic和Story
- 確保技術選擇符合專案規模和團隊能力
- 強調使用者體驗和可用性考量
- 建議建立MVP來驗證核心假設
- 如果用戶提到專案名稱或詳情，請確認並記住這些信息`;

      case 'MVP':
        return `你是一個經驗豐富的敏捷開發教練和專案代理，專門協助執行MVP開發。你遵循嚴格的Epic→Story→Task層級結構和ATDD方法論。

核心職責：
- 按優先級序執行Epic和Story
- 確保每個功能都有明確的驗收標準
- 協調開發資源和時程安排
- 監控進度並及時調整計劃
- 確保程式碼品質和測試覆蓋率

執行原則：
- 使用ATDD循環：期望定義→測試建立→實作→驗證
- 一次只專注一個Story的開發
- 每個Task都要有明確的完成標準
- 持續整合和部署
- 定期Review和Retrospective

技術管理：
- 監控程式碼品質指標
- 確保適當的測試覆蓋率
- 管理技術債務
- 協助解決技術挑戰

重要指示：
- 嚴格遵循Epic→Story→Task的階層結構
- 每個Story都必須有驗收標準
- 優先完成核心功能再添加次要特性
- 確保每次迭代都能產出可用的功能
- 主動識別和解決阻礙因素
- 使用繁體中文進行所有溝通`;

      case 'CONTINUOUS':
        return `你是一個專案維護和持續改進專家，專門協助已完成MVP的專案進行後續開發和優化。

核心職責：
- 協助新功能的需求分析和實作規劃
- 提供程式碼重構和優化建議
- 協助錯誤診斷和修復
- 指導效能優化和安全性提升
- 規劃長期的技術演進路線

工作重點：
- 基於使用者反饋進行功能改進
- 持續監控系統健康狀況
- 管理技術債務和依賴更新
- 實施最佳實踐和設計模式
- 協助團隊技能提升

支援範圍：
- Bug修復和緊急問題處理
- 新功能開發指導
- 效能瓶頸分析和解決
- 安全性漏洞評估和修復
- 架構演進和擴展規劃

重要指示：
- 優先處理影響使用者體驗的問題
- 確保新功能不會破壞現有功能
- 持續關注系統效能和穩定性
- 建議漸進式重構而非大規模重寫
- 協助建立長期可維護的程式碼架構
- 使用繁體中文進行所有溝通`;

      default:
        return `你是一個有用的專案助理。請使用繁體中文溝通並提供清楚、可行的軟體開發指導。`;
    }
  }

  /**
   * Generate mock response for testing and fallback
   */
  private getMockResponse(prompt: string): any {
    const promptLower = prompt.toLowerCase();
    
    let mockContent = '';
    
    if (promptLower.includes('需求') || promptLower.includes('requirement')) {
      mockContent = '我了解您想要討論專案需求。請告訴我更多關於您的專案目標和功能需求，我會協助您整理和規劃。\n\n您希望開發什麼類型的應用程式？主要功能有哪些？目標使用者是誰？';
    } else if (promptLower.includes('epic') || promptLower.includes('story')) {
      mockContent = '讓我協助您規劃 Epic 和 Story。根據您的需求，我建議將功能分解為以下結構：\n\n**Epic**: 核心功能模組\n- **Story 1**: 使用者註冊功能\n- **Story 2**: 使用者登入功能\n\n您希望優先開發哪個功能？';
    } else if (promptLower.includes('task') || promptLower.includes('開發')) {
      mockContent = '我會協助您執行開發任務。讓我們使用 ATDD 方法：\n\n1. **定義期望**: 明確驗收標準\n2. **建立測試**: 建立驗證機制\n3. **執行開發**: 實作功能\n4. **驗證結果**: 確認符合期望\n\n您想要開始哪個任務？';
    } else {
      mockContent = '我是您的專案代理，很高興為您提供協助！我可以幫助您：\n\n- 📋 分析和整理專案需求\n- 🎯 規劃 Epic 和 Story\n- ⚡ 執行開發任務\n- 🧪 實施 ATDD 測試循環\n- 📊 管理專案階段轉換\n\n請告訴我您需要什麼幫助？';
    }

    return {
      content: mockContent,
      usage: {
        total_tokens: Math.floor(Math.random() * 200) + 100,
        input_tokens: Math.floor(prompt.length / 4),
        output_tokens: Math.floor(mockContent.length / 4)
      },
      model: 'mock-claude-3-sonnet',
      stop_reason: 'end_turn'
    };
  }

  /**
   * Parse AI response for actions and special instructions
   */
  private parseAIResponse(content: string): {
    content: string;
    actions: AIAction[];
    phaseTransition?: AIResponse['phaseTransition'];
  } {
    const actions: AIAction[] = [];
    let cleanContent = content;
    let phaseTransition: AIResponse['phaseTransition'] | undefined;

    // Parse action markers
    const actionPatterns = {
      CREATE_EPIC: /\[CREATE_EPIC:([^\]]+)\]/gi,
      CREATE_STORY: /\[CREATE_STORY:([^\]]+)\]/gi,
      CREATE_TASK: /\[CREATE_TASK:([^\]]+)\]/gi,
      UPDATE_PHASE: /\[UPDATE_PHASE:([^\]]+)\]/gi,
      RUN_TESTS: /\[RUN_TESTS:([^\]]+)\]/gi,
      RUN_ATDD_CYCLE: /\[RUN_ATDD_CYCLE:([^\]]+)\]/gi
    };

    // Extract actions from content
    for (const [actionType, pattern] of Object.entries(actionPatterns)) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        try {
          const actionData = JSON.parse(match[1]);
          actions.push({
            type: actionType as AIAction['type'],
            data: actionData,
            priority: actionData.priority || 'MEDIUM',
            description: actionData.description || `Execute ${actionType.toLowerCase()}`
          });
          
          // Remove action marker from content
          cleanContent = cleanContent.replace(match[0], '');
        } catch (error) {
          console.warn(`Failed to parse action ${actionType}:`, error);
        }
      }
    }

    // Parse phase transition markers
    const phaseTransitionPattern = /\[PHASE_TRANSITION:([^\]]+)\]/gi;
    const phaseMatch = phaseTransitionPattern.exec(content);
    if (phaseMatch) {
      try {
        const transitionData = JSON.parse(phaseMatch[1]);
        phaseTransition = {
          from: transitionData.from,
          to: transitionData.to,
          reason: transitionData.reason || 'AI recommended phase transition'
        };
        
        // Remove phase transition marker from content
        cleanContent = cleanContent.replace(phaseMatch[0], '');
      } catch (error) {
        console.warn('Failed to parse phase transition:', error);
      }
    }

    // Clean up any extra whitespace
    cleanContent = cleanContent.trim();

    return {
      content: cleanContent,
      actions,
      phaseTransition
    };
  }

  /**
   * Get fallback response when AI service fails
   */
  private getFallbackResponse(phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS'): string {
    const fallbacks = {
      REQUIREMENTS: '抱歉，AI服務暫時無法使用。請描述您的專案需求，我會儘快回應。',
      MVP: '抱歉，AI服務暫時無法使用。請告訴我您目前遇到的開發問題。',
      CONTINUOUS: '抱歉，AI服務暫時無法使用。請描述需要協助的功能或問題。'
    };

    return fallbacks[phase];
  }

  /**
   * Update AI service configuration
   */
  updateConfig(config: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Also update the AI config manager if API key is provided
    if (config.apiKey) {
      aiConfig.setClaudeApiKey(config.apiKey);
    }
  }

  /**
   * Get current configuration (sanitized)
   */
  getConfig(): Omit<AIServiceConfig, 'apiKey'> {
    const { apiKey, ...safeConfig } = this.config;
    return safeConfig;
  }
  
  /**
   * Get full configuration including sensitive data
   */
  getFullConfig(): AIServiceConfig {
    return { ...this.config };
  }

  /**
   * Refresh configuration from AI config manager
   */
  refreshConfig(): void {
    this.aiConfig = aiConfig.getConfig();
    this.config = {
      ...this.config,
      apiKey: this.aiConfig.claudeApiKey,
      model: this.aiConfig.model,
      maxTokens: this.aiConfig.maxTokens,
      temperature: this.aiConfig.temperature
    };
  }

  /**
   * Test AI service connection
   */
  async testConnection(): Promise<{
    success: boolean;
    error?: string;
    responseTime?: number;
    usingMock?: boolean;
  }> {
    try {
      this.refreshConfig();
      
      const result = await aiConfig.testConfiguration();
      
      if (result.success) {
        return {
          success: true,
          responseTime: result.responseTime,
          usingMock: !this.hasApiKey()
        };
      } else {
        return {
          success: false,
          error: result.error,
          responseTime: result.responseTime
        };
      }
    } catch (error) {
      console.error('AI Service connection test failed:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Configure API key for Claude API
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    aiConfig.setClaudeApiKey(apiKey);
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    this.refreshConfig();
    return !!this.config.apiKey;
  }

  /**
   * Get model information and capabilities
   */
  getModelInfo(): {
    model: string;
    contextLimit: number;
    outputLimit: number;
    supportedFormats: string[];
  } {
    return aiConfig.getModelInfo();
  }

  /**
   * Get API usage statistics (placeholder for future implementation)
   */
  async getUsageStats(): Promise<{
    totalTokens: number;
    requestCount: number;
    averageResponseTime: number;
  }> {
    // TODO: Implement actual usage tracking
    return {
      totalTokens: 0,
      requestCount: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Validate current service configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const configValidation = aiConfig.validateConfig();
    const errors = [...configValidation.errors];
    
    // Add service-specific validations
    if (!this.phasePrompts || this.phasePrompts.size === 0) {
      errors.push('Phase prompts not initialized');
    }
    
    return {
      valid: configValidation.valid && errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const aiService = new AIService();