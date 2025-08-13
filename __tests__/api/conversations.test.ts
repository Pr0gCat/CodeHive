import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('/api/projects/[id]/conversations', () => {
  let testProjectId: string;

  beforeEach(async () => {
    testProjectId = 'test-project-api';
    
    // Clean up before each test
    await prisma.messageAction.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.messageAction.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
  });

  describe('GET /api/projects/[id]/conversations', () => {
    beforeEach(async () => {
      // Create test conversations
      await prisma.conversation.createMany({
        data: [
          {
            projectId: testProjectId,
            phase: 'REQUIREMENTS',
            status: 'ACTIVE',
            title: 'Initial Requirements Discussion',
            messageCount: 5
          },
          {
            projectId: testProjectId,
            phase: 'MVP',
            status: 'COMPLETED',
            title: 'MVP Planning',
            messageCount: 10
          },
          {
            projectId: 'other-project',
            phase: 'REQUIREMENTS',
            status: 'ACTIVE',
            messageCount: 3
          }
        ]
      });
    });

    it('should return conversations for a specific project', async () => {
      const response = await fetch(`http://localhost:3000/api/projects/${testProjectId}/conversations`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.data.every((c: any) => c.projectId === testProjectId)).toBe(true);
    });

    it('should return conversations ordered by lastMessageAt desc', async () => {
      // Update one conversation with a recent message time
      const conversations = await prisma.conversation.findMany({ 
        where: { projectId: testProjectId } 
      });
      
      await prisma.conversation.update({
        where: { id: conversations[0].id },
        data: { lastMessageAt: new Date() }
      });

      const response = await fetch(`http://localhost:3000/api/projects/${testProjectId}/conversations`);
      const data = await response.json();

      expect(data.data[0].lastMessageAt).toBeTruthy();
      expect(data.data[1].lastMessageAt).toBeFalsy();
    });

    it('should filter conversations by status', async () => {
      const response = await fetch(`http://localhost:3000/api/projects/${testProjectId}/conversations?status=ACTIVE`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].status).toBe('ACTIVE');
    });

    it('should filter conversations by phase', async () => {
      const response = await fetch(`http://localhost:3000/api/projects/${testProjectId}/conversations?phase=MVP`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].phase).toBe('MVP');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await fetch(`http://localhost:3000/api/projects/non-existent/conversations`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/projects/[id]/conversations', () => {
    it('should create a new conversation with required fields', async () => {
      const conversationData = {
        phase: 'REQUIREMENTS',
        title: 'New Project Discussion'
      };

      const response = await fetch(`http://localhost:3000/api/projects/${testProjectId}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversationData)
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        projectId: testProjectId,
        phase: 'REQUIREMENTS',
        title: 'New Project Discussion',
        status: 'ACTIVE',
        messageCount: 0,
        tokenUsage: 0
      });
    });

    it('should create conversation with context', async () => {
      const conversationData = {
        phase: 'MVP',
        title: 'MVP Development',
        context: JSON.stringify({ 
          projectName: 'Test App',
          epics: ['auth', 'dashboard'] 
        })
      };

      const response = await fetch(`http://localhost:3000/api/projects/${testProjectId}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversationData)
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.context).toBe(conversationData.context);
      expect(data.data.phase).toBe('MVP');
    });

    it('should validate required fields', async () => {
      const invalidData = { title: 'Missing phase' };

      const response = await fetch(`http://localhost:3000/api/projects/${testProjectId}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData)
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('phase');
    });

    it('should validate phase values', async () => {
      const invalidData = {
        phase: 'INVALID_PHASE',
        title: 'Test'
      };

      const response = await fetch(`http://localhost:3000/api/projects/${testProjectId}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData)
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/projects/[id]/conversations/[conversationId]', () => {
    let testConversationId: string;

    beforeEach(async () => {
      const conversation = await prisma.conversation.create({
        data: {
          projectId: testProjectId,
          phase: 'REQUIREMENTS',
          title: 'Test Conversation'
        }
      });
      testConversationId = conversation.id;

      // Add some messages
      await prisma.message.createMany({
        data: [
          {
            conversationId: testConversationId,
            role: 'USER',
            content: 'Hello',
            createdAt: new Date('2024-01-01T10:00:00Z')
          },
          {
            conversationId: testConversationId,
            role: 'AGENT',
            content: 'Hi there!',
            createdAt: new Date('2024-01-01T10:01:00Z')
          }
        ]
      });
    });

    it('should return conversation with messages', async () => {
      const response = await fetch(`http://localhost:3000/api/projects/${testProjectId}/conversations/${testConversationId}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testConversationId);
      expect(data.data.messages).toHaveLength(2);
      expect(data.data.messages[0].role).toBe('USER');
      expect(data.data.messages[1].role).toBe('AGENT');
    });

    it('should return messages in chronological order', async () => {
      const response = await fetch(`http://localhost:3000/api/projects/${testProjectId}/conversations/${testConversationId}`);
      const data = await response.json();

      const messages = data.data.messages;
      expect(new Date(messages[0].createdAt).getTime()).toBeLessThan(
        new Date(messages[1].createdAt).getTime()
      );
    });

    it('should return 404 for non-existent conversation', async () => {
      const response = await fetch(`http://localhost:3000/api/projects/${testProjectId}/conversations/non-existent`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('should return 403 for conversation from different project', async () => {
      const otherConversation = await prisma.conversation.create({
        data: {
          projectId: 'other-project',
          phase: 'REQUIREMENTS'
        }
      });

      const response = await fetch(`http://localhost:3000/api/projects/${testProjectId}/conversations/${otherConversation.id}`);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });
});

describe('/api/projects/[id]/conversations/[conversationId]/messages', () => {
  let testProjectId: string;
  let testConversationId: string;

  beforeEach(async () => {
    testProjectId = 'test-project-messages';
    
    // Clean up
    await prisma.messageAction.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();

    // Create test conversation
    const conversation = await prisma.conversation.create({
      data: {
        projectId: testProjectId,
        phase: 'REQUIREMENTS'
      }
    });
    testConversationId = conversation.id;
  });

  afterEach(async () => {
    await prisma.messageAction.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
  });

  describe('POST /api/projects/[id]/conversations/[conversationId]/messages', () => {
    it('should create a user message', async () => {
      const messageData = {
        role: 'USER',
        content: 'I want to create a web application for managing tasks'
      };

      const response = await fetch(
        `http://localhost:3000/api/projects/${testProjectId}/conversations/${testConversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageData)
        }
      );

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        conversationId: testConversationId,
        role: 'USER',
        content: messageData.content,
        contentType: 'TEXT',
        isError: false
      });
    });

    it('should create agent message with metadata', async () => {
      const messageData = {
        role: 'AGENT',
        content: 'I can help you create a task management application.',
        contentType: 'MARKDOWN',
        metadata: JSON.stringify({ 
          confidence: 0.95,
          suggestedActions: ['create_epic']
        }),
        tokenUsage: 42,
        responseTime: 1500
      };

      const response = await fetch(
        `http://localhost:3000/api/projects/${testProjectId}/conversations/${testConversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageData)
        }
      );

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.role).toBe('AGENT');
      expect(data.data.contentType).toBe('MARKDOWN');
      expect(data.data.metadata).toBe(messageData.metadata);
      expect(data.data.tokenUsage).toBe(42);
      expect(data.data.responseTime).toBe(1500);
    });

    it('should update conversation messageCount and lastMessageAt', async () => {
      const messageData = {
        role: 'USER',
        content: 'Test message'
      };

      await fetch(
        `http://localhost:3000/api/projects/${testProjectId}/conversations/${testConversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageData)
        }
      );

      const updatedConversation = await prisma.conversation.findUnique({
        where: { id: testConversationId }
      });

      expect(updatedConversation?.messageCount).toBe(1);
      expect(updatedConversation?.lastMessageAt).toBeDefined();
    });

    it('should validate required fields', async () => {
      const invalidData = { content: 'Missing role' };

      const response = await fetch(
        `http://localhost:3000/api/projects/${testProjectId}/conversations/${testConversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidData)
        }
      );

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('role');
    });

    it('should validate role values', async () => {
      const invalidData = {
        role: 'INVALID_ROLE',
        content: 'Test content'
      };

      const response = await fetch(
        `http://localhost:3000/api/projects/${testProjectId}/conversations/${testConversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidData)
        }
      );

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 404 for non-existent conversation', async () => {
      const messageData = {
        role: 'USER',
        content: 'Test'
      };

      const response = await fetch(
        `http://localhost:3000/api/projects/${testProjectId}/conversations/non-existent/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messageData)
        }
      );

      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/projects/[id]/conversations/[conversationId]/messages', () => {
    beforeEach(async () => {
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
    });

    it('should return messages in chronological order', async () => {
      const response = await fetch(
        `http://localhost:3000/api/projects/${testProjectId}/conversations/${testConversationId}/messages`
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(3);
      expect(data.data[0].content).toBe('First message');
      expect(data.data[1].content).toBe('Agent response');
      expect(data.data[2].content).toBe('Second message');
    });

    it('should support pagination with limit and offset', async () => {
      const response = await fetch(
        `http://localhost:3000/api/projects/${testProjectId}/conversations/${testConversationId}/messages?limit=2&offset=1`
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].content).toBe('Agent response');
      expect(data.data[1].content).toBe('Second message');
    });

    it('should filter messages by role', async () => {
      const response = await fetch(
        `http://localhost:3000/api/projects/${testProjectId}/conversations/${testConversationId}/messages?role=USER`
      );

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.data.every((m: any) => m.role === 'USER')).toBe(true);
    });
  });
});