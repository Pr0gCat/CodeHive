import { ProjectPhase } from './project-agent';

/**
 * 對話意圖
 */
export enum ConversationIntent {
  PROVIDE_INFO = 'provide_info',           // 提供資訊
  ASK_QUESTION = 'ask_question',           // 詢問問題
  REQUEST_ACTION = 'request_action',       // 請求行動
  CONFIRM = 'confirm',                      // 確認
  DENY = 'deny',                           // 否定
  PHASE_TRANSITION = 'phase_transition',   // 階段轉換
  UNKNOWN = 'unknown'                      // 未知
}

/**
 * 需求類型
 */
export interface RequirementType {
  functional: string[];      // 功能需求
  nonFunctional: string[];  // 非功能需求
  constraints: string[];    // 限制條件
  preferences: string[];    // 偏好設定
}

/**
 * 對話分析結果
 */
export interface ConversationAnalysis {
  intent: ConversationIntent;
  entities: Record<string, any>;
  confidence: number;
  keywords: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

/**
 * 問題範本
 */
interface QuestionTemplate {
  id: string;
  category: string;
  question: string;
  priority: number;
  dependencies?: string[];
}

/**
 * 對話處理器 - 處理不同階段的對話邏輯
 */
export class ConversationHandler {
  private requirementQuestions: QuestionTemplate[] = [
    {
      id: 'purpose',
      category: 'general',
      question: '請描述您的專案想要解決什麼問題？',
      priority: 1
    },
    {
      id: 'users',
      category: 'general',
      question: '誰是您的目標使用者？他們有什麼特點？',
      priority: 2
    },
    {
      id: 'features',
      category: 'functional',
      question: '您希望專案具備哪些核心功能？',
      priority: 3
    },
    {
      id: 'tech_stack',
      category: 'technical',
      question: '您有偏好的技術堆疊嗎？例如：程式語言、框架等',
      priority: 4
    },
    {
      id: 'scale',
      category: 'scope',
      question: '預期的專案規模如何？大約需要多少功能？',
      priority: 5
    },
    {
      id: 'timeline',
      category: 'scope',
      question: '您期望的完成時程是多久？',
      priority: 6
    },
    {
      id: 'integrations',
      category: 'technical',
      question: '需要與其他系統或服務整合嗎？',
      priority: 7,
      dependencies: ['features']
    },
    {
      id: 'performance',
      category: 'non-functional',
      question: '有特殊的效能需求嗎？例如：回應時間、並發數等',
      priority: 8
    },
    {
      id: 'security',
      category: 'non-functional',
      question: '有特殊的安全需求嗎？',
      priority: 9
    },
    {
      id: 'ui_ux',
      category: 'design',
      question: 'UI/UX有特殊要求嗎？有參考的設計風格嗎？',
      priority: 10
    }
  ];

  private askedQuestions: Set<string> = new Set();
  private collectedRequirements: RequirementType = {
    functional: [],
    nonFunctional: [],
    constraints: [],
    preferences: []
  };

  /**
   * 分析對話意圖
   */
  analyzeConversation(message: string): ConversationAnalysis {
    const lowerMessage = message.toLowerCase();
    
    // 檢測階段轉換意圖
    if (this.detectPhaseTransition(lowerMessage)) {
      return {
        intent: ConversationIntent.PHASE_TRANSITION,
        entities: { targetPhase: this.extractTargetPhase(lowerMessage) },
        confidence: 0.9,
        keywords: this.extractKeywords(message),
        sentiment: 'neutral'
      };
    }
    
    // 檢測確認/否定
    if (this.detectConfirmation(lowerMessage)) {
      return {
        intent: ConversationIntent.CONFIRM,
        entities: {},
        confidence: 0.95,
        keywords: ['是', '好', '確認', '同意'],
        sentiment: 'positive'
      };
    }
    
    if (this.detectDenial(lowerMessage)) {
      return {
        intent: ConversationIntent.DENY,
        entities: {},
        confidence: 0.95,
        keywords: ['否', '不', '取消', '不同意'],
        sentiment: 'negative'
      };
    }
    
    // 檢測問題
    if (this.detectQuestion(lowerMessage)) {
      return {
        intent: ConversationIntent.ASK_QUESTION,
        entities: { question: message },
        confidence: 0.8,
        keywords: this.extractKeywords(message),
        sentiment: 'neutral'
      };
    }
    
    // 檢測行動請求
    if (this.detectActionRequest(lowerMessage)) {
      return {
        intent: ConversationIntent.REQUEST_ACTION,
        entities: { action: this.extractAction(lowerMessage) },
        confidence: 0.7,
        keywords: this.extractKeywords(message),
        sentiment: 'neutral'
      };
    }
    
    // 預設為提供資訊
    return {
      intent: ConversationIntent.PROVIDE_INFO,
      entities: { info: message },
      confidence: 0.6,
      keywords: this.extractKeywords(message),
      sentiment: this.analyzeSentiment(message)
    };
  }

  /**
   * 生成需求階段回應
   */
  generateRequirementsResponse(
    analysis: ConversationAnalysis,
    context: any
  ): string {
    switch (analysis.intent) {
      case ConversationIntent.PROVIDE_INFO:
        // 處理使用者提供的資訊
        this.extractRequirements(analysis.entities.info);
        const nextQuestion = this.getNextQuestion();
        if (nextQuestion) {
          return `了解了。${nextQuestion.question}`;
        }
        return '感謝您提供的資訊。我已經收集了足夠的需求，現在可以準備專案提案了。';
        
      case ConversationIntent.ASK_QUESTION:
        return this.answerUserQuestion(analysis.entities.question);
        
      case ConversationIntent.PHASE_TRANSITION:
        if (this.hasEnoughRequirements()) {
          return '好的，讓我基於收集到的需求準備專案提案和MVP計劃。請點擊「進入MVP階段」按鈕繼續。';
        }
        return '我還需要更多資訊才能準備完整的提案。' + this.getNextQuestion()?.question;
        
      default:
        return '請告訴我更多關於您專案的資訊。';
    }
  }

  /**
   * 生成MVP階段回應
   */
  generateMVPResponse(
    analysis: ConversationAnalysis,
    context: any
  ): string {
    switch (analysis.intent) {
      case ConversationIntent.REQUEST_ACTION:
        return `正在處理您的請求：${analysis.entities.action}`;
        
      case ConversationIntent.ASK_QUESTION:
        return `關於您的問題：正在開發中的功能...`;
        
      default:
        return '正在執行MVP開發計劃...';
    }
  }

  /**
   * 生成持續整合階段回應
   */
  generateContinuousResponse(
    analysis: ConversationAnalysis,
    context: any
  ): string {
    switch (analysis.intent) {
      case ConversationIntent.REQUEST_ACTION:
        const action = analysis.entities.action;
        if (action.includes('功能') || action.includes('feature')) {
          return `正在新增功能：${action}`;
        }
        if (action.includes('修復') || action.includes('fix')) {
          return `正在修復問題：${action}`;
        }
        if (action.includes('優化') || action.includes('optimize')) {
          return `正在進行優化：${action}`;
        }
        return `正在處理：${action}`;
        
      default:
        return '請告訴我您想要進行什麼變更。';
    }
  }

  /**
   * 取得下一個問題
   */
  getNextQuestion(): QuestionTemplate | null {
    // 找出未問過的問題
    const unansweredQuestions = this.requirementQuestions
      .filter(q => !this.askedQuestions.has(q.id))
      .filter(q => this.checkDependencies(q))
      .sort((a, b) => a.priority - b.priority);
    
    if (unansweredQuestions.length > 0) {
      const question = unansweredQuestions[0];
      this.askedQuestions.add(question.id);
      return question;
    }
    
    return null;
  }

  /**
   * 檢查問題相依性
   */
  private checkDependencies(question: QuestionTemplate): boolean {
    if (!question.dependencies) return true;
    return question.dependencies.every(dep => this.askedQuestions.has(dep));
  }

  /**
   * 從訊息中提取需求
   */
  private extractRequirements(message: string): void {
    // 功能需求關鍵字
    const functionalKeywords = ['功能', '可以', '需要', '希望', '想要'];
    // 非功能需求關鍵字
    const nonFunctionalKeywords = ['效能', '安全', '穩定', '快速', '可靠'];
    // 限制條件關鍵字
    const constraintKeywords = ['必須', '不能', '限制', '最多', '最少'];
    // 偏好關鍵字
    const preferenceKeywords = ['偏好', '喜歡', '最好', '建議'];
    
    const sentences = message.split(/[。！？]/);
    
    sentences.forEach(sentence => {
      if (functionalKeywords.some(kw => sentence.includes(kw))) {
        this.collectedRequirements.functional.push(sentence.trim());
      }
      if (nonFunctionalKeywords.some(kw => sentence.includes(kw))) {
        this.collectedRequirements.nonFunctional.push(sentence.trim());
      }
      if (constraintKeywords.some(kw => sentence.includes(kw))) {
        this.collectedRequirements.constraints.push(sentence.trim());
      }
      if (preferenceKeywords.some(kw => sentence.includes(kw))) {
        this.collectedRequirements.preferences.push(sentence.trim());
      }
    });
  }

  /**
   * 檢查是否收集足夠需求
   */
  private hasEnoughRequirements(): boolean {
    // 至少回答了一半的高優先級問題
    const highPriorityQuestions = this.requirementQuestions
      .filter(q => q.priority <= 5);
    const answeredHighPriority = highPriorityQuestions
      .filter(q => this.askedQuestions.has(q.id));
    
    return answeredHighPriority.length >= highPriorityQuestions.length * 0.5;
  }

  /**
   * 回答使用者問題
   */
  private answerUserQuestion(question: string): string {
    // TODO: 實作更智能的問答邏輯
    if (question.includes('什麼') || question.includes('什麼')) {
      return '這是一個幫助您開發專案的AI系統。我會透過對話了解您的需求，然後自動生成和實作程式碼。';
    }
    if (question.includes('如何') || question.includes('怎麼')) {
      return '您只需要告訴我您的需求，我會處理所有技術細節。';
    }
    if (question.includes('多久') || question.includes('時間')) {
      return '開發時間取決於專案複雜度，通常MVP可以在幾天內完成。';
    }
    return '關於您的問題，讓我們先完成需求收集，之後我會詳細解答。';
  }

  /**
   * 檢測階段轉換意圖
   */
  private detectPhaseTransition(message: string): boolean {
    const transitionKeywords = ['開始', '進入', '轉換', 'mvp', '開發', '下一步'];
    return transitionKeywords.some(kw => message.includes(kw));
  }

  /**
   * 提取目標階段
   */
  private extractTargetPhase(message: string): ProjectPhase | null {
    if (message.includes('mvp') || message.includes('開發')) {
      return ProjectPhase.MVP;
    }
    if (message.includes('持續') || message.includes('整合')) {
      return ProjectPhase.CONTINUOUS;
    }
    return null;
  }

  /**
   * 檢測確認
   */
  private detectConfirmation(message: string): boolean {
    const confirmKeywords = ['是', '對', '好', '可以', '確認', '同意', 'yes', 'ok'];
    return confirmKeywords.some(kw => message === kw || message.startsWith(kw));
  }

  /**
   * 檢測否定
   */
  private detectDenial(message: string): boolean {
    const denyKeywords = ['否', '不', '取消', '不要', '不同意', 'no', 'cancel'];
    return denyKeywords.some(kw => message === kw || message.startsWith(kw));
  }

  /**
   * 檢測問題
   */
  private detectQuestion(message: string): boolean {
    const questionMarkers = ['？', '?', '嗎', '呢', '什麼', '如何', '怎麼', '為什麼'];
    return questionMarkers.some(marker => message.includes(marker));
  }

  /**
   * 檢測行動請求
   */
  private detectActionRequest(message: string): boolean {
    const actionKeywords = ['請', '幫我', '建立', '新增', '修改', '刪除', '執行', '實作'];
    return actionKeywords.some(kw => message.includes(kw));
  }

  /**
   * 提取行動
   */
  private extractAction(message: string): string {
    // 移除常見的請求前綴
    const prefixes = ['請', '幫我', '可以', '能否'];
    let action = message;
    prefixes.forEach(prefix => {
      if (action.startsWith(prefix)) {
        action = action.substring(prefix.length).trim();
      }
    });
    return action;
  }

  /**
   * 提取關鍵字
   */
  private extractKeywords(message: string): string[] {
    // 簡單的關鍵字提取
    const stopWords = ['的', '了', '是', '在', '和', '與', '或', '但', '嗎', '呢', '啊'];
    const words = message.split(/[\s,，。！？、]/);
    return words
      .filter(word => word.length > 1)
      .filter(word => !stopWords.includes(word))
      .slice(0, 5);
  }

  /**
   * 分析情感
   */
  private analyzeSentiment(message: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['好', '棒', '優秀', '喜歡', '滿意', '期待'];
    const negativeWords = ['差', '糟', '問題', '錯誤', '失敗', '不滿'];
    
    const positiveCount = positiveWords.filter(w => message.includes(w)).length;
    const negativeCount = negativeWords.filter(w => message.includes(w)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * 取得收集到的需求
   */
  getCollectedRequirements(): RequirementType {
    return this.collectedRequirements;
  }

  /**
   * 重設對話處理器
   */
  reset(): void {
    this.askedQuestions.clear();
    this.collectedRequirements = {
      functional: [],
      nonFunctional: [],
      constraints: [],
      preferences: []
    };
  }
}