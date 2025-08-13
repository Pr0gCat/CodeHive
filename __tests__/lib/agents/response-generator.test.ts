import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { ResponseGenerator } from '@/lib/agents/response-generator';

const prisma = new PrismaClient();

// Mock the realtime service
jest.mock('@/lib/agents/realtime-service', () => ({
  realtimeService: {
    startAgentTyping: jest.fn(),
    stopAgentTyping: jest.fn(),
    emitProgress: jest.fn(),
    streamResponse: jest.fn(),
    emitResponseComplete: jest.fn(),
    emitActionUpdate: jest.fn(),
    emitPhaseChange: jest.fn(),
    emitError: jest.fn()
  }
}));

describe('ResponseGenerator', () => {
  let responseGenerator: ResponseGenerator;
  let testProjectId: string;
  let testConversationId: string;

  beforeEach(async () => {
    responseGenerator = new ResponseGenerator();
    testProjectId = 'test-project-generator';
    
    // Clean up before each test
    await prisma.messageAction.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();

    // Create test conversation
    const conversation = await prisma.conversation.create({
      data: {
        projectId: testProjectId,
        phase: 'REQUIREMENTS',
        title: 'Test Conversation for Generator'
      }
    });
    testConversationId = conversation.id;
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.messageAction.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
  });

  describe('Response Generation', () => {
    it('should generate response for user message', async () => {
      const request = {
        projectId: testProjectId,
        conversationId: testConversationId,
        userMessage: '我想建立一個網站',
        phase: 'REQUIREMENTS' as const
      };

      const result = await responseGenerator.generateResponse(request);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.messageId).toBeTruthy();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalTime).toBeGreaterThan(0);
      expect(result.metrics.contextBuildTime).toBeGreaterThanOrEqual(0);
      expect(result.metrics.aiResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should save response message to database', async () => {
      const request = {
        projectId: testProjectId,
        conversationId: testConversationId,
        userMessage: '測試訊息',
        phase: 'MVP' as const
      };

      const result = await responseGenerator.generateResponse(request);

      // Verify message was saved
      const savedMessage = await prisma.message.findUnique({
        where: { id: result.messageId }
      });

      expect(savedMessage).toBeDefined();
      expect(savedMessage?.role).toBe('AGENT');
      expect(savedMessage?.conversationId).toBe(testConversationId);
      expect(savedMessage?.content).toBeTruthy();
      expect(savedMessage?.tokenUsage).toBeGreaterThanOrEqual(0);
    });

    it('should update conversation stats after response', async () => {
      const initialConversation = await prisma.conversation.findUnique({
        where: { id: testConversationId }
      });

      const request = {
        projectId: testProjectId,
        conversationId: testConversationId,
        userMessage: '更新統計測試',
        phase: 'CONTINUOUS' as const
      };

      await responseGenerator.generateResponse(request);

      const updatedConversation = await prisma.conversation.findUnique({
        where: { id: testConversationId }
      });

      expect(updatedConversation?.messageCount).toBeGreaterThan(initialConversation?.messageCount || 0);
      expect(updatedConversation?.lastMessageAt).toBeDefined();
    });

    it('should handle different project phases correctly', async () => {
      const phases: Array<'REQUIREMENTS' | 'MVP' | 'CONTINUOUS'> = ['REQUIREMENTS', 'MVP', 'CONTINUOUS'];

      for (const phase of phases) {
        const request = {
          projectId: testProjectId,
          conversationId: testConversationId,
          userMessage: `測試 ${phase} 階段`,
          phase
        };

        const result = await responseGenerator.generateResponse(request);
        expect(result.response.content).toBeTruthy();
        expect(result.messageId).toBeTruthy();
      }
    });
  });

  describe('Action Execution', () => {
    it('should handle requests with no suggested actions', async () => {
      const request = {
        projectId: testProjectId,
        conversationId: testConversationId,
        userMessage: '簡單問題',
        phase: 'REQUIREMENTS' as const
      };

      const result = await responseGenerator.generateResponse(request);
      expect(result.actionsCreated).toBeDefined();
      expect(Array.isArray(result.actionsCreated)).toBe(true);
    });

    // Note: Action execution tests would be more meaningful once actual actions are implemented
    it('should create action records for suggested actions', async () => {
      // This test would be more comprehensive once AI service suggests actual actions
      const request = {
        projectId: testProjectId,
        conversationId: testConversationId,
        userMessage: '創建一個Epic',
        phase: 'MVP' as const
      };

      const result = await responseGenerator.generateResponse(request);
      expect(result.actionsCreated).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid conversation ID gracefully', async () => {
      const request = {
        projectId: testProjectId,
        conversationId: 'invalid-conversation-id',
        userMessage: '測試錯誤處理',
        phase: 'REQUIREMENTS' as const
      };

      const result = await responseGenerator.generateResponse(request);
      
      // Should still provide a response even with invalid conversation ID
      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });

    it('should handle empty user message', async () => {
      const request = {
        projectId: testProjectId,
        conversationId: testConversationId,
        userMessage: '',
        phase: 'REQUIREMENTS' as const
      };

      const result = await responseGenerator.generateResponse(request);
      expect(result.response.content).toBeTruthy();
    });

    it('should provide fallback response on AI service failure', async () => {
      const request = {
        projectId: 'invalid-project',
        conversationId: testConversationId,
        userMessage: 'This should trigger fallback',
        phase: 'REQUIREMENTS' as const
      };

      const result = await responseGenerator.generateResponse(request);
      
      // Even on failure, should provide some response
      expect(result.response).toBeDefined();
      expect(result.response.content).toBeTruthy();
    });
  });

  describe('Performance Metrics', () => {
    it('should track timing metrics accurately', async () => {
      const request = {
        projectId: testProjectId,
        conversationId: testConversationId,
        userMessage: '性能測試',
        phase: 'REQUIREMENTS' as const
      };

      const result = await responseGenerator.generateResponse(request);

      expect(result.metrics.totalTime).toBeGreaterThan(0);
      expect(result.metrics.contextBuildTime).toBeGreaterThanOrEqual(0);
      expect(result.metrics.aiResponseTime).toBeGreaterThanOrEqual(0);
      expect(result.metrics.totalTime).toBeGreaterThanOrEqual(
        result.metrics.contextBuildTime + result.metrics.aiResponseTime
      );
    });

    it('should track token usage', async () => {
      const request = {
        projectId: testProjectId,
        conversationId: testConversationId,
        userMessage: 'Token usage test',
        phase: 'MVP' as const
      };

      const result = await responseGenerator.generateResponse(request);
      expect(result.metrics.tokensUsed).toBeGreaterThanOrEqual(0);
      expect(result.response.tokenUsage).toBe(result.metrics.tokensUsed);
    });

    it('should track context size', async () => {
      // Add some messages to create context
      await prisma.message.createMany({
        data: [
          {
            conversationId: testConversationId,
            role: 'USER',
            content: 'Context message 1'
          },
          {
            conversationId: testConversationId,
            role: 'AGENT',
            content: 'Context response 1'
          }
        ]
      });

      const request = {
        projectId: testProjectId,
        conversationId: testConversationId,
        userMessage: 'Context size test',
        phase: 'REQUIREMENTS' as const
      };

      const result = await responseGenerator.generateResponse(request);
      expect(result.metrics.contextSize).toBeGreaterThan(0);
    });
  });

  describe('Generation Statistics', () => {
    it('should get generation stats for empty project', async () => {
      const stats = await responseGenerator.getGenerationStats(testProjectId, 'day');
      
      expect(stats).toBeDefined();
      expect(stats.totalConversations).toBeGreaterThanOrEqual(0);
      expect(stats.totalResponses).toBeGreaterThanOrEqual(0);
      expect(stats.errorRate).toBeGreaterThanOrEqual(0);
      expect(stats.errorRate).toBeLessThanOrEqual(1);
    });

    it('should get generation stats after responses', async () => {
      // Generate a response first
      const request = {
        projectId: testProjectId,
        conversationId: testConversationId,
        userMessage: '統計測試',
        phase: 'REQUIREMENTS' as const
      };

      await responseGenerator.generateResponse(request);

      const stats = await responseGenerator.getGenerationStats(testProjectId, 'day');
      expect(stats.totalConversations).toBeGreaterThan(0);
      expect(stats.totalResponses).toBeGreaterThan(0);
    });

    it('should handle different time ranges for stats', async () => {
      const dayStats = await responseGenerator.getGenerationStats(testProjectId, 'day');
      const weekStats = await responseGenerator.getGenerationStats(testProjectId, 'week');
      const monthStats = await responseGenerator.getGenerationStats(testProjectId, 'month');

      expect(dayStats).toBeDefined();
      expect(weekStats).toBeDefined();
      expect(monthStats).toBeDefined();
    });
  });
});