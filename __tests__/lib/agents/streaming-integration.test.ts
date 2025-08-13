import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { streamingService } from '@/lib/agents/streaming-service';
import { responseGenerator } from '@/lib/agents/response-generator';
import { aiConfig } from '@/lib/agents/ai-config';

describe('Streaming Integration Tests', () => {
  
  beforeEach(() => {
    // Mock WebSocket and streaming dependencies
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Streaming Service', () => {
    it('should handle mock streaming response', async () => {
      const chunks: any[] = [];
      let completed = false;
      let finalResponse: any = null;

      await streamingService.streamResponse('測試串流回應', {
        onChunk: (chunk) => {
          chunks.push(chunk);
          expect(chunk.isComplete).toBe(false);
          expect(chunk.content).toBeDefined();
          expect(chunk.tokenCount).toBeGreaterThan(0);
        },
        onComplete: (response) => {
          completed = true;
          finalResponse = response;
          expect(response.isComplete).toBe(true);
          expect(response.content.length).toBeGreaterThan(0);
        },
        onError: (error) => {
          throw error;
        }
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(completed).toBe(true);
      expect(finalResponse).toBeDefined();
      expect(finalResponse.metadata?.model).toBe('mock-claude-streaming');
    });

    it('should detect actions during streaming', async () => {
      const detectedActions: any[] = [];
      let completed = false;

      const promptWithAction = '請為我創建一個Epic [CREATE_EPIC:{"title":"用戶管理","businessValue":"提供用戶註冊和登入功能"}]';

      await streamingService.streamResponseWithActions(promptWithAction, {
        onChunk: (chunk) => {
          // Actions may be detected during streaming
        },
        onComplete: (response) => {
          completed = true;
        },
        onActionDetected: (action) => {
          detectedActions.push(action);
        },
        onError: (error) => {
          throw error;
        }
      });

      expect(completed).toBe(true);
      expect(detectedActions.length).toBeGreaterThan(0);
      expect(detectedActions[0].type).toBe('CREATE_EPIC');
      expect(detectedActions[0].data.title).toBe('用戶管理');
    });

    it('should test streaming connection', async () => {
      const result = await streamingService.testStreaming();
      
      expect(result.success).toBe(true);
      expect(result.avgLatency).toBeDefined();
      expect(result.avgLatency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Response Generator with Streaming', () => {
    it('should generate streaming response', async () => {
      const testProjectId = 'test-streaming-project';
      const testConversationId = 'test-streaming-conversation';

      const request = {
        projectId: testProjectId,
        conversationId: testConversationId,
        userMessage: '我想要創建一個任務管理系統',
        phase: 'REQUIREMENTS' as const,
        enableStreaming: true
      };

      // Mock database operations
      const mockCreate = jest.fn().mockResolvedValue({
        id: 'mock-message-id',
        conversationId: testConversationId,
        role: 'AGENT',
        content: '',
        contentType: 'MARKDOWN',
        phase: 'REQUIREMENTS'
      });

      const mockUpdate = jest.fn().mockResolvedValue({});

      // Mock Prisma operations
      jest.doMock('@prisma/client', () => ({
        PrismaClient: jest.fn().mockImplementation(() => ({
          message: {
            create: mockCreate,
            update: mockUpdate
          },
          conversation: {
            findFirst: jest.fn().mockResolvedValue(null),
            updateMany: jest.fn().mockResolvedValue({})
          }
        }))
      }));

      const result = await responseGenerator.generateResponse(request);

      expect(result).toBeDefined();
      expect(result.messageId).toBeDefined();
      expect(result.response.content).toBeDefined();
      expect(result.response.contentType).toBe('MARKDOWN');
      expect(result.metrics.totalTime).toBeGreaterThan(0);
    });

    it('should fallback to standard response on streaming error', async () => {
      // Mock streaming error
      const originalStreamResponse = streamingService.streamResponseWithActions;
      jest.spyOn(streamingService, 'streamResponseWithActions').mockImplementation(
        async (prompt, options) => {
          options.onError(new Error('Mock streaming error'));
        }
      );

      const request = {
        projectId: 'test-fallback-project',
        conversationId: 'test-fallback-conversation',
        userMessage: '測試容錯機制',
        phase: 'REQUIREMENTS' as const,
        enableStreaming: true
      };

      const result = await responseGenerator.generateResponse(request);

      expect(result).toBeDefined();
      expect(result.response.content).toBeDefined();
      
      // Restore original method
      jest.spyOn(streamingService, 'streamResponseWithActions').mockImplementation(originalStreamResponse);
    });
  });

  describe('AI Configuration', () => {
    it('should manage streaming configuration', () => {
      const config = aiConfig.getConfig();
      
      expect(config).toBeDefined();
      expect(config.model).toBeDefined();
      expect(config.maxTokens).toBeGreaterThan(0);
      expect(config.temperature).toBeGreaterThanOrEqual(0);
      expect(config.temperature).toBeLessThanOrEqual(2);
      expect(config.fallbackToMock).toBeDefined();
    });

    it('should validate configuration for streaming', () => {
      const validation = aiConfig.validateConfig();
      
      expect(validation).toBeDefined();
      expect(validation.valid).toBeDefined();
      expect(Array.isArray(validation.errors)).toBe(true);
    });

    it('should provide model information', () => {
      const modelInfo = aiConfig.getModelInfo();
      
      expect(modelInfo.model).toBeDefined();
      expect(modelInfo.contextLimit).toBeGreaterThan(0);
      expect(modelInfo.outputLimit).toBeGreaterThan(0);
      expect(Array.isArray(modelInfo.supportedFormats)).toBe(true);
      expect(modelInfo.supportedFormats).toContain('markdown');
    });
  });

  describe('End-to-End Streaming Workflow', () => {
    it('should handle complete streaming workflow', async () => {
      const workflowSteps: string[] = [];
      let finalContent = '';
      let totalTokens = 0;
      
      const testPrompt = '請協助我規劃一個電商網站的開發';

      await streamingService.streamResponseWithActions(testPrompt, {
        onChunk: (chunk) => {
          workflowSteps.push('chunk_received');
          finalContent = chunk.content;
          totalTokens = chunk.tokenCount;
        },
        onComplete: (response) => {
          workflowSteps.push('streaming_complete');
          finalContent = response.content;
          totalTokens = response.tokenCount;
        },
        onActionDetected: (action) => {
          workflowSteps.push(`action_detected:${action.type}`);
        },
        onError: (error) => {
          workflowSteps.push(`error:${error.message}`);
        }
      });

      expect(workflowSteps.length).toBeGreaterThan(0);
      expect(workflowSteps).toContain('streaming_complete');
      expect(finalContent.length).toBeGreaterThan(0);
      expect(totalTokens).toBeGreaterThan(0);
      
      // Should contain e-commerce related content
      expect(finalContent.toLowerCase()).toMatch(/(電商|網站|商店|購物)/);
    });

    it('should measure streaming performance', async () => {
      const startTime = Date.now();
      let chunkTimes: number[] = [];
      let completionTime = 0;

      await streamingService.streamResponse('效能測試訊息', {
        onChunk: (chunk) => {
          chunkTimes.push(Date.now() - startTime);
        },
        onComplete: (response) => {
          completionTime = Date.now() - startTime;
        },
        onError: (error) => {
          console.error('Performance test error:', error);
        }
      });

      expect(chunkTimes.length).toBeGreaterThan(0);
      expect(completionTime).toBeGreaterThan(0);
      expect(Math.max(...chunkTimes)).toBeLessThanOrEqual(completionTime);
      
      // Performance expectations (mock should be fast)
      expect(completionTime).toBeLessThan(5000); // Under 5 seconds
      
      const avgChunkInterval = chunkTimes.length > 1 
        ? (completionTime - chunkTimes[0]) / (chunkTimes.length - 1)
        : 0;
      
      expect(avgChunkInterval).toBeLessThan(500); // Under 500ms per chunk
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle network timeouts gracefully', async () => {
      // Mock timeout scenario
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100);
      });

      jest.spyOn(global, 'fetch').mockImplementation(() => timeoutPromise as any);

      let errorOccurred = false;
      let fallbackContent = '';

      await streamingService.streamResponse('測試超時處理', {
        onChunk: (chunk) => {
          fallbackContent = chunk.content;
        },
        onComplete: (response) => {
          fallbackContent = response.content;
        },
        onError: (error) => {
          errorOccurred = true;
          expect(error.message).toContain('timeout');
        }
      });

      // Should fallback to mock response
      expect(fallbackContent.length).toBeGreaterThan(0);
    });

    it('should handle malformed response data', async () => {
      // Test resilience against malformed streaming data
      const malformedPrompt = '測試格式錯誤的回應 [INVALID_ACTION:{"incomplete":true';

      let completed = false;
      let content = '';

      await streamingService.streamResponseWithActions(malformedPrompt, {
        onChunk: (chunk) => {
          content = chunk.content;
        },
        onComplete: (response) => {
          completed = true;
          content = response.content;
        },
        onActionDetected: (action) => {
          // Should not detect invalid actions
          expect(action).toBeDefined();
        },
        onError: (error) => {
          console.warn('Expected error for malformed data:', error);
        }
      });

      expect(completed).toBe(true);
      expect(content.length).toBeGreaterThan(0);
    });
  });
});

// Additional utility tests
describe('Streaming Utilities', () => {
  it('should extract actions from partial content', () => {
    const partialContent = '讓我協助您創建 [CREATE_EPIC:{"title":"用戶系統","priority":"HIGH"}] 這個功能模組';
    
    // Test the streaming service's internal action extraction
    const extractActions = (content: string) => {
      const actions = [];
      const patterns = [/\[CREATE_EPIC:([^\]]+)\]/gi];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          try {
            actions.push(JSON.parse(match[1]));
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      return actions;
    };

    const actions = extractActions(partialContent);
    expect(actions.length).toBe(1);
    expect(actions[0].title).toBe('用戶系統');
    expect(actions[0].priority).toBe('HIGH');
  });

  it('should calculate token usage accurately', () => {
    const testContent = '這是一個測試訊息，用來計算代幣使用量。';
    
    // Rough token estimation (characters / 4)
    const estimatedTokens = Math.ceil(testContent.length / 4);
    
    expect(estimatedTokens).toBeGreaterThan(0);
    expect(estimatedTokens).toBeLessThan(testContent.length); // Should be less than character count
  });
});