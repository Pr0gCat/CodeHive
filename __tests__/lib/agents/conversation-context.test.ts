import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { ConversationContextManager } from '@/lib/agents/conversation-context';

const prisma = new PrismaClient();
const contextManager = new ConversationContextManager();

describe('ConversationContextManager', () => {
  let testProjectId: string;
  let testConversationId: string;

  beforeEach(async () => {
    testProjectId = 'test-project-context';
    
    // Clean up before each test
    await prisma.messageAction.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();

    // Create test conversation
    const conversation = await prisma.conversation.create({
      data: {
        projectId: testProjectId,
        phase: 'REQUIREMENTS',
        title: 'Test Conversation'
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

  describe('Context Building', () => {
    it('should build basic context with no messages', async () => {
      const context = await contextManager.buildContext(
        testProjectId,
        testConversationId,
        'REQUIREMENTS'
      );

      expect(context.projectId).toBe(testProjectId);
      expect(context.conversationId).toBe(testConversationId);
      expect(context.projectPhase).toBe('REQUIREMENTS');
      expect(context.recentMessages).toHaveLength(0);
      expect(context.projectMetadata).toBeDefined();
    });

    it('should build context with recent messages', async () => {
      // Create test messages
      await prisma.message.createMany({
        data: [
          {
            conversationId: testConversationId,
            role: 'USER',
            content: 'First message',
            createdAt: new Date('2024-01-01T10:00:00Z')
          },
          {
            conversationId: testConversationId,
            role: 'AGENT',
            content: 'Agent response',
            createdAt: new Date('2024-01-01T10:01:00Z')
          },
          {
            conversationId: testConversationId,
            role: 'USER',
            content: 'Second message',
            createdAt: new Date('2024-01-01T10:02:00Z')
          }
        ]
      });

      const context = await contextManager.buildContext(
        testProjectId,
        testConversationId,
        'REQUIREMENTS',
        10
      );

      expect(context.recentMessages).toHaveLength(3);
      expect(context.recentMessages[0].content).toBe('First message');
      expect(context.recentMessages[1].content).toBe('Agent response');
      expect(context.recentMessages[2].content).toBe('Second message');
    });

    it('should limit messages to specified count', async () => {
      // Create 5 test messages
      const messages = Array.from({ length: 5 }, (_, i) => ({
        conversationId: testConversationId,
        role: 'USER',
        content: `Message ${i + 1}`,
        createdAt: new Date(Date.now() + i * 1000)
      }));

      await prisma.message.createMany({ data: messages });

      const context = await contextManager.buildContext(
        testProjectId,
        testConversationId,
        'REQUIREMENTS',
        3
      );

      expect(context.recentMessages).toHaveLength(3);
      // Should get the most recent 3 messages
      expect(context.recentMessages[2].content).toBe('Message 5');
    });

    it('should include project metadata for each phase', async () => {
      const requirementsContext = await contextManager.buildContext(
        testProjectId,
        testConversationId,
        'REQUIREMENTS'
      );

      const mvpContext = await contextManager.buildContext(
        testProjectId,
        testConversationId,
        'MVP'
      );

      const continuousContext = await contextManager.buildContext(
        testProjectId,
        testConversationId,
        'CONTINUOUS'
      );

      expect(requirementsContext.projectMetadata).toBeDefined();
      expect(mvpContext.projectMetadata).toBeDefined();
      expect(continuousContext.projectMetadata).toBeDefined();
      
      // Different phases should have different metadata structure
      // (though exact content depends on implementation)
    });
  });

  describe('Project Information', () => {
    it('should handle non-existent project gracefully', async () => {
      const context = await contextManager.buildContext(
        'non-existent-project',
        testConversationId,
        'REQUIREMENTS'
      );

      expect(context.projectId).toBe('non-existent-project');
      expect(context.projectMetadata).toBeDefined();
      // Should still provide basic structure even if project doesn't exist
    });

    it('should infer project info when not in database', async () => {
      const context = await contextManager.buildContext(
        testProjectId,
        testConversationId,
        'REQUIREMENTS'
      );

      // Since project isn't in database, should get inferred info
      expect(context.projectMetadata?.name).toContain('專案');
    });
  });

  describe('Conversation Metrics', () => {
    beforeEach(async () => {
      // Create test messages with different roles and metrics
      await prisma.message.createMany({
        data: [
          {
            conversationId: testConversationId,
            role: 'USER',
            content: 'User message 1',
            tokenUsage: 10
          },
          {
            conversationId: testConversationId,
            role: 'AGENT',
            content: 'Agent response 1',
            tokenUsage: 25,
            responseTime: 1500
          },
          {
            conversationId: testConversationId,
            role: 'USER',
            content: 'User message 2',
            tokenUsage: 8
          },
          {
            conversationId: testConversationId,
            role: 'AGENT',
            content: 'Agent response 2',
            tokenUsage: 30,
            responseTime: 2000
          }
        ]
      });
    });

    it('should calculate conversation metrics correctly', async () => {
      const metrics = await contextManager.getConversationMetrics(testConversationId);

      expect(metrics.totalMessages).toBe(4);
      expect(metrics.userMessages).toBe(2);
      expect(metrics.agentMessages).toBe(2);
      expect(metrics.totalTokenUsage).toBe(73); // 10 + 25 + 8 + 30
      expect(metrics.averageResponseTime).toBe(1750); // (1500 + 2000) / 2
    });

    it('should handle empty conversation metrics', async () => {
      // Create empty conversation
      const emptyConversation = await prisma.conversation.create({
        data: {
          projectId: testProjectId,
          phase: 'REQUIREMENTS'
        }
      });

      const metrics = await contextManager.getConversationMetrics(emptyConversation.id);

      expect(metrics.totalMessages).toBe(0);
      expect(metrics.userMessages).toBe(0);
      expect(metrics.agentMessages).toBe(0);
      expect(metrics.totalTokenUsage).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
    });
  });

  describe('Context Caching', () => {
    it('should update context cache without error', async () => {
      const context = await contextManager.buildContext(
        testProjectId,
        testConversationId,
        'REQUIREMENTS'
      );

      // Should not throw error (implementation is placeholder)
      await expect(contextManager.updateContextCache(
        testProjectId,
        testConversationId,
        context
      )).resolves.toBeUndefined();
    });

    it('should clear context cache without error', async () => {
      // Should not throw error (implementation is placeholder)
      await expect(contextManager.clearContextCache(testProjectId))
        .resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Test with invalid conversation ID
      const context = await contextManager.buildContext(
        testProjectId,
        'invalid-conversation-id',
        'REQUIREMENTS'
      );

      // Should still return valid context structure
      expect(context.projectId).toBe(testProjectId);
      expect(context.conversationId).toBe('invalid-conversation-id');
      expect(context.recentMessages).toHaveLength(0);
    });

    it('should handle missing conversation gracefully', async () => {
      const context = await contextManager.buildContext(
        testProjectId,
        'missing-conversation',
        'MVP'
      );

      expect(context.recentMessages).toHaveLength(0);
      expect(context.projectPhase).toBe('MVP');
    });
  });
});