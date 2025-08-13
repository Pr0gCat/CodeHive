import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Conversation Model', () => {
  beforeEach(async () => {
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

  describe('Conversation Creation', () => {
    it('should create a new conversation with required fields', async () => {
      const conversation = await prisma.conversation.create({
        data: {
          projectId: 'test-project-1',
          phase: 'REQUIREMENTS',
          status: 'ACTIVE'
        }
      });

      expect(conversation).toMatchObject({
        projectId: 'test-project-1',
        phase: 'REQUIREMENTS',
        status: 'ACTIVE',
        messageCount: 0,
        tokenUsage: 0
      });
      expect(conversation.id).toBeDefined();
      expect(conversation.createdAt).toBeDefined();
      expect(conversation.updatedAt).toBeDefined();
    });

    it('should create conversation with optional fields', async () => {
      const contextData = JSON.stringify({
        projectName: 'Test Project',
        epics: [],
        currentPhase: 'REQUIREMENTS'
      });

      const conversation = await prisma.conversation.create({
        data: {
          projectId: 'test-project-2',
          phase: 'MVP',
          title: 'MVP Development Discussion',
          context: contextData,
          summary: 'Initial MVP planning conversation'
        }
      });

      expect(conversation.title).toBe('MVP Development Discussion');
      expect(conversation.context).toBe(contextData);
      expect(conversation.summary).toBe('Initial MVP planning conversation');
      expect(conversation.phase).toBe('MVP');
    });

    it('should have default values for status, messageCount, and tokenUsage', async () => {
      const conversation = await prisma.conversation.create({
        data: {
          projectId: 'test-project-3',
          phase: 'CONTINUOUS'
        }
      });

      expect(conversation.status).toBe('ACTIVE');
      expect(conversation.messageCount).toBe(0);
      expect(conversation.tokenUsage).toBe(0);
    });
  });

  describe('Conversation Queries', () => {
    beforeEach(async () => {
      // Create test conversations
      await prisma.conversation.createMany({
        data: [
          {
            projectId: 'project-1',
            phase: 'REQUIREMENTS',
            status: 'ACTIVE',
            messageCount: 5
          },
          {
            projectId: 'project-1',
            phase: 'MVP',
            status: 'COMPLETED',
            messageCount: 10
          },
          {
            projectId: 'project-2',
            phase: 'REQUIREMENTS',
            status: 'ACTIVE',
            messageCount: 3
          }
        ]
      });
    });

    it('should find conversations by projectId', async () => {
      const conversations = await prisma.conversation.findMany({
        where: { projectId: 'project-1' }
      });

      expect(conversations).toHaveLength(2);
      expect(conversations.every(c => c.projectId === 'project-1')).toBe(true);
    });

    it('should find conversations by projectId and status', async () => {
      const activeConversations = await prisma.conversation.findMany({
        where: { 
          projectId: 'project-1',
          status: 'ACTIVE'
        }
      });

      expect(activeConversations).toHaveLength(1);
      expect(activeConversations[0].phase).toBe('REQUIREMENTS');
    });

    it('should find conversations by phase', async () => {
      const requirementsConversations = await prisma.conversation.findMany({
        where: { phase: 'REQUIREMENTS' }
      });

      expect(requirementsConversations).toHaveLength(2);
      expect(requirementsConversations.every(c => c.phase === 'REQUIREMENTS')).toBe(true);
    });
  });

  describe('Conversation Updates', () => {
    it('should update conversation fields', async () => {
      const conversation = await prisma.conversation.create({
        data: {
          projectId: 'test-project-update',
          phase: 'REQUIREMENTS'
        }
      });

      const updated = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          title: 'Updated Title',
          messageCount: 5,
          tokenUsage: 1000,
          lastMessageAt: new Date()
        }
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.messageCount).toBe(5);
      expect(updated.tokenUsage).toBe(1000);
      expect(updated.lastMessageAt).toBeDefined();
      expect(updated.updatedAt.getTime()).toBeGreaterThan(conversation.updatedAt.getTime());
    });

    it('should update conversation status', async () => {
      const conversation = await prisma.conversation.create({
        data: {
          projectId: 'test-project-status',
          phase: 'REQUIREMENTS'
        }
      });

      const completed = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: 'COMPLETED' }
      });

      expect(completed.status).toBe('COMPLETED');
    });
  });
});

describe('Message Model', () => {
  let testConversationId: string;

  beforeEach(async () => {
    // Clean up before each test
    await prisma.messageAction.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();

    // Create a test conversation
    const conversation = await prisma.conversation.create({
      data: {
        projectId: 'test-project-messages',
        phase: 'REQUIREMENTS'
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

  describe('Message Creation', () => {
    it('should create a user message with required fields', async () => {
      const message = await prisma.message.create({
        data: {
          conversationId: testConversationId,
          role: 'USER',
          content: 'Hello, I want to create a new web application'
        }
      });

      expect(message).toMatchObject({
        conversationId: testConversationId,
        role: 'USER',
        content: 'Hello, I want to create a new web application',
        contentType: 'TEXT',
        tokenUsage: 0,
        isError: false
      });
      expect(message.id).toBeDefined();
      expect(message.createdAt).toBeDefined();
    });

    it('should create an agent message with metadata', async () => {
      const metadata = JSON.stringify({
        confidence: 0.95,
        suggestedActions: ['create_epic', 'define_requirements']
      });

      const message = await prisma.message.create({
        data: {
          conversationId: testConversationId,
          role: 'AGENT',
          content: 'I can help you create a web application. What features do you need?',
          contentType: 'MARKDOWN',
          metadata,
          phase: 'REQUIREMENTS',
          tokenUsage: 45,
          responseTime: 1250
        }
      });

      expect(message.role).toBe('AGENT');
      expect(message.contentType).toBe('MARKDOWN');
      expect(message.metadata).toBe(metadata);
      expect(message.phase).toBe('REQUIREMENTS');
      expect(message.tokenUsage).toBe(45);
      expect(message.responseTime).toBe(1250);
    });

    it('should create a system message', async () => {
      const message = await prisma.message.create({
        data: {
          conversationId: testConversationId,
          role: 'SYSTEM',
          content: 'Project phase changed from REQUIREMENTS to MVP',
          contentType: 'JSON'
        }
      });

      expect(message.role).toBe('SYSTEM');
      expect(message.contentType).toBe('JSON');
    });
  });

  describe('Message Threading', () => {
    it('should create threaded messages with parent-child relationship', async () => {
      const parentMessage = await prisma.message.create({
        data: {
          conversationId: testConversationId,
          role: 'USER',
          content: 'Can you explain how authentication works?'
        }
      });

      const replyMessage = await prisma.message.create({
        data: {
          conversationId: testConversationId,
          role: 'AGENT',
          content: 'Authentication involves verifying user credentials...',
          parentMessageId: parentMessage.id
        }
      });

      const messageWithReplies = await prisma.message.findUnique({
        where: { id: parentMessage.id },
        include: { replies: true }
      });

      const messageWithParent = await prisma.message.findUnique({
        where: { id: replyMessage.id },
        include: { parentMessage: true }
      });

      expect(messageWithReplies?.replies).toHaveLength(1);
      expect(messageWithReplies?.replies[0].id).toBe(replyMessage.id);
      expect(messageWithParent?.parentMessage?.id).toBe(parentMessage.id);
    });
  });

  describe('Message Queries', () => {
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
            createdAt: new Date('2024-01-01T10:05:00Z')
          },
          {
            conversationId: testConversationId,
            role: 'USER',
            content: 'Second message',
            createdAt: new Date('2024-01-01T10:10:00Z')
          }
        ]
      });
    });

    it('should retrieve messages in chronological order', async () => {
      const messages = await prisma.message.findMany({
        where: { conversationId: testConversationId },
        orderBy: { createdAt: 'asc' }
      });

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Agent response');
      expect(messages[2].content).toBe('Second message');
    });

    it('should filter messages by role', async () => {
      const userMessages = await prisma.message.findMany({
        where: { 
          conversationId: testConversationId,
          role: 'USER'
        }
      });

      expect(userMessages).toHaveLength(2);
      expect(userMessages.every(m => m.role === 'USER')).toBe(true);
    });

    it('should get conversation with messages', async () => {
      const conversationWithMessages = await prisma.conversation.findUnique({
        where: { id: testConversationId },
        include: { 
          messages: { 
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      expect(conversationWithMessages?.messages).toHaveLength(3);
      expect(conversationWithMessages?.messages[0].role).toBe('USER');
      expect(conversationWithMessages?.messages[1].role).toBe('AGENT');
    });
  });

  describe('Message Error Handling', () => {
    it('should create error message', async () => {
      const errorMessage = await prisma.message.create({
        data: {
          conversationId: testConversationId,
          role: 'SYSTEM',
          content: 'An error occurred while processing your request',
          isError: true,
          errorDetails: 'AI service timeout after 30 seconds'
        }
      });

      expect(errorMessage.isError).toBe(true);
      expect(errorMessage.errorDetails).toBe('AI service timeout after 30 seconds');
    });
  });
});

describe('MessageAction Model', () => {
  let testConversationId: string;
  let testMessageId: string;

  beforeEach(async () => {
    // Clean up and create test data
    await prisma.messageAction.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();

    const conversation = await prisma.conversation.create({
      data: {
        projectId: 'test-project-actions',
        phase: 'REQUIREMENTS'
      }
    });
    testConversationId = conversation.id;

    const message = await prisma.message.create({
      data: {
        conversationId: testConversationId,
        role: 'AGENT',
        content: 'I will create an epic for your user authentication feature'
      }
    });
    testMessageId = message.id;
  });

  afterEach(async () => {
    await prisma.messageAction.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
  });

  describe('MessageAction Creation', () => {
    it('should create a message action with required fields', async () => {
      const actionData = JSON.stringify({
        title: 'User Authentication Epic',
        description: 'Implement user login and registration',
        priority: 'HIGH'
      });

      const action = await prisma.messageAction.create({
        data: {
          messageId: testMessageId,
          actionType: 'CREATE_EPIC',
          actionData,
          status: 'PENDING'
        }
      });

      expect(action).toMatchObject({
        messageId: testMessageId,
        actionType: 'CREATE_EPIC',
        actionData,
        status: 'PENDING'
      });
      expect(action.id).toBeDefined();
      expect(action.createdAt).toBeDefined();
    });

    it('should create completed action with result', async () => {
      const actionData = JSON.stringify({ storyTitle: 'Login Form' });
      const result = JSON.stringify({ storyId: 'story-123', success: true });

      const action = await prisma.messageAction.create({
        data: {
          messageId: testMessageId,
          actionType: 'CREATE_STORY',
          actionData,
          status: 'COMPLETED',
          result,
          executedAt: new Date()
        }
      });

      expect(action.status).toBe('COMPLETED');
      expect(action.result).toBe(result);
      expect(action.executedAt).toBeDefined();
    });

    it('should create failed action with error', async () => {
      const action = await prisma.messageAction.create({
        data: {
          messageId: testMessageId,
          actionType: 'UPDATE_PHASE',
          actionData: '{"phase": "MVP"}',
          status: 'FAILED',
          error: 'Insufficient permissions to change project phase'
        }
      });

      expect(action.status).toBe('FAILED');
      expect(action.error).toBe('Insufficient permissions to change project phase');
    });
  });

  describe('MessageAction Queries', () => {
    beforeEach(async () => {
      // Create test actions
      await prisma.messageAction.createMany({
        data: [
          {
            messageId: testMessageId,
            actionType: 'CREATE_EPIC',
            actionData: '{"title": "Epic 1"}',
            status: 'COMPLETED'
          },
          {
            messageId: testMessageId,
            actionType: 'CREATE_STORY',
            actionData: '{"title": "Story 1"}',
            status: 'PENDING'
          },
          {
            messageId: testMessageId,
            actionType: 'CREATE_TASK',
            actionData: '{"title": "Task 1"}',
            status: 'FAILED'
          }
        ]
      });
    });

    it('should get actions for a message', async () => {
      const messageWithActions = await prisma.message.findUnique({
        where: { id: testMessageId },
        include: { actions: true }
      });

      expect(messageWithActions?.actions).toHaveLength(3);
    });

    it('should filter actions by status', async () => {
      const pendingActions = await prisma.messageAction.findMany({
        where: { status: 'PENDING' }
      });

      expect(pendingActions).toHaveLength(1);
      expect(pendingActions[0].actionType).toBe('CREATE_STORY');
    });

    it('should filter actions by type', async () => {
      const epicActions = await prisma.messageAction.findMany({
        where: { actionType: 'CREATE_EPIC' }
      });

      expect(epicActions).toHaveLength(1);
      expect(epicActions[0].status).toBe('COMPLETED');
    });
  });
});