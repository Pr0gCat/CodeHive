import { describe, it, expect, beforeEach } from '@jest/globals';
import { AIService, ConversationContext } from '@/lib/agents/ai-service';

describe('AIService', () => {
  let aiService: AIService;
  let mockContext: ConversationContext;

  beforeEach(() => {
    aiService = new AIService({
      model: 'test-model',
      temperature: 0.7,
      maxTokens: 1000
    });

    mockContext = {
      projectId: 'test-project',
      projectPhase: 'REQUIREMENTS',
      conversationId: 'test-conversation',
      recentMessages: [],
      projectMetadata: {
        name: 'Test Project',
        framework: 'Next.js',
        language: 'TypeScript'
      }
    };
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const service = new AIService();
      const config = service.getConfig();
      
      expect(config.model).toBe('claude-3-sonnet-20240229');
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(4096);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        model: 'custom-model',
        temperature: 0.5,
        maxTokens: 2000
      };
      
      const service = new AIService(customConfig);
      const config = service.getConfig();
      
      expect(config.model).toBe('custom-model');
      expect(config.temperature).toBe(0.5);
      expect(config.maxTokens).toBe(2000);
    });

    it('should update configuration', () => {
      aiService.updateConfig({ temperature: 0.9 });
      const config = aiService.getConfig();
      
      expect(config.temperature).toBe(0.9);
      expect(config.model).toBe('test-model'); // Should preserve other settings
    });
  });

  describe('Phase System Prompts', () => {
    it('should generate response for REQUIREMENTS phase', async () => {
      const response = await aiService.generateResponse('我想建立一個網站', mockContext);
      
      expect(response.content).toBeTruthy();
      expect(response.contentType).toBe('MARKDOWN');
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.tokenUsage).toBeGreaterThanOrEqual(0);
      expect(response.responseTime).toBeGreaterThan(0);
    });

    it('should generate response for MVP phase', async () => {
      const mvpContext = { ...mockContext, projectPhase: 'MVP' as const };
      const response = await aiService.generateResponse('開始開發登入功能', mvpContext);
      
      expect(response.content).toBeTruthy();
      expect(response.contentType).toBe('MARKDOWN');
    });

    it('should generate response for CONTINUOUS phase', async () => {
      const continuousContext = { ...mockContext, projectPhase: 'CONTINUOUS' as const };
      const response = await aiService.generateResponse('修復登入錯誤', continuousContext);
      
      expect(response.content).toBeTruthy();
      expect(response.contentType).toBe('MARKDOWN');
    });

    it('should handle unknown phase gracefully', async () => {
      const invalidContext = { ...mockContext, projectPhase: 'INVALID' as any };
      
      await expect(aiService.generateResponse('test message', invalidContext))
        .rejects.toThrow('Unknown project phase: INVALID');
    });
  });

  describe('Response Generation', () => {
    it('should include conversation history in context', async () => {
      const contextWithMessages = {
        ...mockContext,
        recentMessages: [
          {
            id: '1',
            conversationId: 'test-conversation',
            role: 'USER' as const,
            content: 'Previous message',
            createdAt: new Date(),
            tokenUsage: 10
          }
        ]
      };

      const response = await aiService.generateResponse('Follow-up message', contextWithMessages);
      expect(response).toBeDefined();
    });

    it('should handle empty conversation history', async () => {
      const response = await aiService.generateResponse('First message', mockContext);
      expect(response.content).toBeTruthy();
    });

    it('should return fallback response on API failure', async () => {
      // Test with null messages to trigger error handling
      const invalidContext = { ...mockContext, recentMessages: null as any };
      
      const response = await aiService.generateResponse('test', invalidContext);
      expect(response.confidence).toBe(0.1);
      expect(response.content).toContain('AI服務暫時無法使用');
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      const result = await aiService.testConnection();
      // Currently returns true as placeholder
      expect(result).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed context gracefully', async () => {
      const malformedContext = {
        projectId: null as any,
        projectPhase: 'REQUIREMENTS' as const,
        conversationId: null as any,
        recentMessages: null as any
      };

      const response = await aiService.generateResponse('test', malformedContext);
      expect(response.content).toBeTruthy();
      expect(response.confidence).toBeLessThanOrEqual(0.1);
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(10000);
      const response = await aiService.generateResponse(longMessage, mockContext);
      
      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
    });
  });

  describe('Response Parsing', () => {
    it('should parse response content correctly', async () => {
      const response = await aiService.generateResponse('創建一個Epic', mockContext);
      
      expect(response.content).toBeDefined();
      expect(response.suggestedActions).toBeDefined();
      expect(Array.isArray(response.suggestedActions)).toBe(true);
    });

    it('should detect phase transitions if any', async () => {
      const response = await aiService.generateResponse('需求已完成，開始MVP', mockContext);
      
      // Phase transitions are not implemented yet, so should be undefined
      expect(response.phaseTransition).toBeUndefined();
    });
  });
});