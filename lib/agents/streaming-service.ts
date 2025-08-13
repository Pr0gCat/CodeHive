/**
 * Streaming Service for Real-time AI Responses
 * 
 * Provides streaming capabilities for Claude API responses,
 * allowing real-time display of AI-generated content as it's being produced.
 */

import { aiConfig } from './ai-config';

export interface StreamingResponse {
  content: string;
  isComplete: boolean;
  tokenCount: number;
  error?: string;
  metadata?: {
    model: string;
    stopReason?: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
  };
}

export interface StreamingOptions {
  onChunk: (chunk: StreamingResponse) => void;
  onComplete: (finalResponse: StreamingResponse) => void;
  onError: (error: Error) => void;
  maxTokens?: number;
  temperature?: number;
}

export class StreamingService {
  private config = aiConfig.getConfig();

  /**
   * Stream response from Claude API
   */
  async streamResponse(
    prompt: string,
    options: StreamingOptions
  ): Promise<void> {
    if (!this.config.claudeApiKey) {
      if (this.config.fallbackToMock) {
        await this.streamMockResponse(prompt, options);
        return;
      } else {
        options.onError(new Error('No Claude API key configured and mock fallback is disabled'));
        return;
      }
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: options.maxTokens || this.config.maxTokens,
          temperature: options.temperature || this.config.temperature,
          stream: true, // Enable streaming
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      await this.processStreamingResponse(response, options);

    } catch (error) {
      console.error('Streaming API call failed:', error);
      
      if (this.config.fallbackToMock) {
        console.warn('Falling back to mock streaming response');
        await this.streamMockResponse(prompt, options);
      } else {
        options.onError(error as Error);
      }
    }
  }

  /**
   * Process streaming response from Claude API
   */
  private async processStreamingResponse(
    response: Response,
    options: StreamingOptions
  ): Promise<void> {
    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = '';
    let totalTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            
            if (dataStr === '[DONE]') {
              // Streaming complete
              options.onComplete({
                content: accumulatedContent,
                isComplete: true,
                tokenCount: totalTokens,
                metadata: {
                  model: this.config.model,
                  stopReason: 'end_turn'
                }
              });
              return;
            }

            try {
              const data = JSON.parse(dataStr);
              
              if (data.type === 'content_block_delta') {
                const deltaText = data.delta?.text || '';
                accumulatedContent += deltaText;
                totalTokens += Math.ceil(deltaText.length / 4); // Rough token estimation

                options.onChunk({
                  content: accumulatedContent,
                  isComplete: false,
                  tokenCount: totalTokens
                });
              } else if (data.type === 'message_stop') {
                // Message completed
                options.onComplete({
                  content: accumulatedContent,
                  isComplete: true,
                  tokenCount: totalTokens,
                  metadata: {
                    model: this.config.model,
                    stopReason: data.stop_reason || 'end_turn',
                    usage: data.usage
                  }
                });
                return;
              } else if (data.type === 'error') {
                throw new Error(`Streaming error: ${data.error?.message || 'Unknown error'}`);
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming data:', dataStr, parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Simulate streaming response for development/testing
   */
  private async streamMockResponse(
    prompt: string,
    options: StreamingOptions
  ): Promise<void> {
    const mockContent = this.generateMockContent(prompt);
    const words = mockContent.split(' ');
    let accumulatedContent = '';
    let tokenCount = 0;

    // Simulate streaming by sending words over time
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100)); // Realistic typing speed
      
      accumulatedContent += (i > 0 ? ' ' : '') + words[i];
      tokenCount = Math.ceil(accumulatedContent.length / 4);

      options.onChunk({
        content: accumulatedContent,
        isComplete: false,
        tokenCount
      });
    }

    // Complete the stream
    options.onComplete({
      content: accumulatedContent,
      isComplete: true,
      tokenCount,
      metadata: {
        model: 'mock-claude-streaming',
        stopReason: 'end_turn'
      }
    });
  }

  /**
   * Generate mock content based on prompt
   */
  private generateMockContent(prompt: string): string {
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('需求') || promptLower.includes('requirement')) {
      return '我了解您想要討論專案需求。讓我們一步步來分析您的想法：\n\n**首先，請告訴我**：\n1. 您的專案主要解決什麼問題？\n2. 目標使用者是誰？\n3. 您期望的核心功能有哪些？\n\n我會根據您的回答協助您整理完整的需求規格。';
    } else if (promptLower.includes('epic') || promptLower.includes('story')) {
      return '很好！讓我協助您規劃 Epic 和 Story 結構：\n\n**建議的 Epic 分解**：\n\n🎯 **用戶管理 Epic**\n- Story 1: 用戶註冊流程\n- Story 2: 用戶登入驗證\n- Story 3: 個人資料管理\n\n📊 **核心功能 Epic**\n- Story 1: 主要功能實作\n- Story 2: 資料處理邏輯\n- Story 3: 整合測試\n\n您想要優先開發哪個 Epic？';
    } else if (promptLower.includes('task') || promptLower.includes('開發')) {
      return '我會使用 ATDD 方法協助您執行開發任務：\n\n**ATDD 四階段流程**：\n\n1. 🎯 **定義階段**：明確驗收標準\n2. 🧪 **測試階段**：建立驗證機制\n3. 🛠️ **開發階段**：實作功能\n4. ✅ **驗證階段**：確認符合期望\n\n讓我們開始第一個任務。您想要實作什麼功能？';
    } else {
      return '歡迎使用 CodeHive 專案代理！我是您的 AI 助手，專門協助軟體開發專案管理。\n\n**我可以幫助您**：\n\n📋 **需求分析**：整理和精煉專案需求\n🎯 **Epic 規劃**：拆解大功能為可管理的史詩\n📖 **Story 撰寫**：建立詳細的使用者故事\n⚙️ **任務執行**：協助開發任務實施\n🔄 **ATDD 循環**：測試驅動開發流程\n📊 **進度追蹤**：監控專案開發進展\n\n請告訴我您目前的專案階段，我會提供最適合的協助！';
    }
  }

  /**
   * Stream response with action parsing
   */
  async streamResponseWithActions(
    prompt: string,
    options: StreamingOptions & {
      onActionDetected?: (action: any) => void;
    }
  ): Promise<void> {
    let currentContent = '';
    
    const enhancedOptions: StreamingOptions = {
      ...options,
      onChunk: (chunk) => {
        currentContent = chunk.content;
        
        // Look for action markers in the current content
        const actions = this.extractActionsFromContent(currentContent);
        if (actions.length > 0 && options.onActionDetected) {
          actions.forEach(action => options.onActionDetected!(action));
        }
        
        options.onChunk(chunk);
      },
      onComplete: (finalResponse) => {
        // Final action extraction
        const actions = this.extractActionsFromContent(finalResponse.content);
        if (actions.length > 0 && options.onActionDetected) {
          actions.forEach(action => options.onActionDetected!(action));
        }
        
        options.onComplete(finalResponse);
      }
    };

    await this.streamResponse(prompt, enhancedOptions);
  }

  /**
   * Extract actions from streaming content
   */
  private extractActionsFromContent(content: string): any[] {
    const actions = [];
    const actionPatterns = [
      /\[CREATE_EPIC:([^\]]+)\]/gi,
      /\[CREATE_STORY:([^\]]+)\]/gi,
      /\[CREATE_TASK:([^\]]+)\]/gi,
      /\[UPDATE_PHASE:([^\]]+)\]/gi
    ];

    for (const pattern of actionPatterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex
      while ((match = pattern.exec(content)) !== null) {
        try {
          const actionData = JSON.parse(match[1]);
          actions.push({
            type: match[0].split(':')[0].slice(1), // Extract action type
            data: actionData,
            rawMatch: match[0]
          });
        } catch (error) {
          console.warn('Failed to parse action from stream:', match[1]);
        }
      }
    }

    return actions;
  }

  /**
   * Test streaming connection
   */
  async testStreaming(): Promise<{
    success: boolean;
    error?: string;
    avgLatency?: number;
  }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let chunkCount = 0;
      let totalLatency = 0;

      this.streamResponse('Hello, this is a streaming test.', {
        onChunk: (chunk) => {
          chunkCount++;
          totalLatency += Date.now() - startTime;
        },
        onComplete: (response) => {
          resolve({
            success: true,
            avgLatency: chunkCount > 0 ? totalLatency / chunkCount : 0
          });
        },
        onError: (error) => {
          resolve({
            success: false,
            error: error.message
          });
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        resolve({
          success: false,
          error: 'Streaming test timed out'
        });
      }, 10000);
    });
  }
}

// Export singleton instance
export const streamingService = new StreamingService();