import { ContextManager, ClaudeMdSection } from '../../../lib/agents/context-manager';
import { ProjectPhase, AgentState, ConversationMessage } from '../../../lib/agents/project-agent';

describe('ContextManager - Core Functionality', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    // Use unique paths for each test to avoid interference
    const testId = Math.random().toString(36).substring(7);
    const mockProjectPath = `/tmp/test-project-${testId}`;
    contextManager = new ContextManager(mockProjectPath);
  });

  describe('Context Creation and Management', () => {
    it('should create and manage basic context', async () => {
      const context = await contextManager.loadContext();
      
      expect(context).toBeDefined();
      expect(context.projectName).toBeTruthy();
      expect(context.phase).toBe(ProjectPhase.REQUIREMENTS);
      expect(context.agentState).toBe(AgentState.IDLE);
      expect(context.totalMessages).toBe(0);
      expect(context.recentMessages).toHaveLength(0);
    });

    it('should return null for current context before loading', () => {
      const context = contextManager.getCurrentContext();
      expect(context).toBeNull();
    });
  });

  describe('Conversation Management', () => {
    beforeEach(async () => {
      await contextManager.loadContext();
    });

    it('should add single conversation message', async () => {
      const message: ConversationMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Test message',
        timestamp: new Date()
      };

      await contextManager.addConversationMessage(message);

      const context = contextManager.getCurrentContext();
      expect(context?.recentMessages).toHaveLength(1);
      expect(context?.totalMessages).toBe(1);
      expect(context?.recentMessages[0].content).toBe('Test message');
    });

    it('should provide conversation statistics', async () => {
      const messages: ConversationMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'User message',
          timestamp: new Date()
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Assistant response',
          timestamp: new Date()
        }
      ];

      await contextManager.addConversationMessages(messages);

      const stats = contextManager.getConversationStats();
      expect(stats.totalMessages).toBe(2);
      expect(stats.userMessages).toBe(1);
      expect(stats.assistantMessages).toBe(1);
      expect(stats.systemMessages).toBe(0);
    });

    it('should search conversation history', async () => {
      const messages: ConversationMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Create login feature',
          timestamp: new Date()
        },
        {
          id: 'msg-2',
          role: 'user',
          content: 'Add registration form',
          timestamp: new Date()
        }
      ];

      await contextManager.addConversationMessages(messages);

      const results = contextManager.searchConversationHistory('login');
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('login');
    });
  });

  describe('Task and Phase Management', () => {
    beforeEach(async () => {
      await contextManager.loadContext();
    });

    it('should update project phase', async () => {
      await contextManager.updatePhase(ProjectPhase.MVP, 'Requirements complete');

      const context = contextManager.getCurrentContext();
      expect(context?.phase).toBe(ProjectPhase.MVP);
      expect(context?.phaseStartedAt).toBeDefined();
      
      // Check decision is recorded
      const decisions = Object.keys(context?.decisions || {});
      expect(decisions.some(key => key.includes('phase_transition'))).toBe(true);
    });

    it('should update current task', async () => {
      await contextManager.updateCurrentTask('epic-1', 'story-1', 'task-1');

      const context = contextManager.getCurrentContext();
      expect(context?.currentEpicId).toBe('epic-1');
      expect(context?.currentStoryId).toBe('story-1');
      expect(context?.currentTaskId).toBe('task-1');
    });

    it('should complete tasks', async () => {
      await contextManager.completeTask('task-1', 'Task completed successfully');

      const context = contextManager.getCurrentContext();
      expect(context?.completedTasks).toContain('task-1');
      expect(context?.completedTaskCount).toBe(1);
      
      const taskSummary = context?.metadata?.completedTaskSummaries?.['task-1'];
      expect(taskSummary?.summary).toBe('Task completed successfully');
    });
  });

  describe('Section Updates', () => {
    beforeEach(async () => {
      await contextManager.loadContext();
    });

    it('should update requirements section', async () => {
      await contextManager.updateSection(
        ClaudeMdSection.REQUIREMENTS, 
        'feature: User authentication\npriority: high'
      );

      const context = contextManager.getCurrentContext();
      expect(context?.requirements).toHaveProperty('feature', 'User authentication');
      expect(context?.requirements).toHaveProperty('priority', 'high');
    });

    it('should update decisions section', async () => {
      await contextManager.updateSection(
        ClaudeMdSection.DECISIONS,
        'architecture: React\ndatabase: PostgreSQL'
      );

      const context = contextManager.getCurrentContext();
      expect(context?.decisions).toHaveProperty('architecture', 'React');
      expect(context?.decisions).toHaveProperty('database', 'PostgreSQL');
    });
  });

  describe('State Management', () => {
    beforeEach(async () => {
      await contextManager.loadContext();
    });

    it('should validate consistent state', async () => {
      const validation = await contextManager.validateStateConsistency();
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect and repair message count inconsistencies', async () => {
      // Add a message first
      await contextManager.addConversationMessage({
        id: 'msg-1',
        role: 'user',
        content: 'Test message',
        timestamp: new Date()
      });

      // Manually create inconsistency
      const context = contextManager.getCurrentContext()!;
      context.totalMessages = 0; // Wrong count

      const validation = await contextManager.validateStateConsistency();
      expect(validation.isValid).toBe(false);

      const repair = await contextManager.autoRepairStateConsistency();
      expect(repair.success).toBe(true);
      expect(repair.repairedIssues).toContain('Fixed total message count');

      const repairedContext = contextManager.getCurrentContext();
      expect(repairedContext?.totalMessages).toBe(1);
    });
  });

  describe('Recovery Management', () => {
    beforeEach(async () => {
      await contextManager.loadContext();
    });

    it('should create and manage recovery points', async () => {
      const sessionData = {
        executorStatus: 'running',
        agentState: AgentState.PROCESSING
      };

      const recoveryId = await contextManager.createSessionRecoveryPoint(sessionData);
      expect(recoveryId).toMatch(/^recovery-\d+-[a-z0-9]+$/);

      const recoveryPoints = contextManager.getAvailableRecoveryPoints();
      expect(recoveryPoints.length).toBeGreaterThan(0);

      const latestPoint = recoveryPoints[recoveryPoints.length - 1];
      expect(latestPoint.sessionSummary).toContain('執行器: running');
    });

    it('should perform health checks', async () => {
      const health = await contextManager.healthCheck();
      
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('issues');
      expect(health).toHaveProperty('performance');
      expect(health).toHaveProperty('recommendations');
    });
  });
});