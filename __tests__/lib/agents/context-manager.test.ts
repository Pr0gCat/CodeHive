import { ContextManager, ClaudeMdSection, ProjectContextData } from '../../../lib/agents/context-manager';
import { ProjectPhase, AgentState, ConversationMessage } from '../../../lib/agents/project-agent';
import * as path from 'path';

describe('ContextManager', () => {
  let contextManager: ContextManager;
  let mockProjectPath: string;
  let mockClaudeMdPath: string;

  beforeEach(() => {
    mockProjectPath = '/tmp/test-project';
    mockClaudeMdPath = path.join(mockProjectPath, '.codehive', 'CLAUDE.md');
    contextManager = new ContextManager(mockProjectPath, mockClaudeMdPath);
  });

  describe('Basic Context Management', () => {
    it('should create default context when initialized', async () => {
      const context = await contextManager.loadContext();

      expect(context).toBeDefined();
      expect(context.projectId).toBe('test-project');
      expect(context.phase).toBe(ProjectPhase.REQUIREMENTS);
      expect(context.agentState).toBe(AgentState.IDLE);
      expect(context.conversationSummary).toContain('專案剛剛開始');
    });

    it('should return current context', () => {
      // Context should be null initially
      const context = contextManager.getCurrentContext();
      expect(context).toBeNull();
    });
  });

  describe('Conversation History Management', () => {
    beforeEach(async () => {
      await contextManager.loadContext();
    });

    it('should add conversation messages', async () => {
      const message: ConversationMessage = {
        id: 'msg-1',
        role: 'user',
        content: '請幫我建立一個用戶註冊功能',
        timestamp: new Date(),
        metadata: { source: 'web' }
      };

      await contextManager.addConversationMessage(message);

      const context = contextManager.getCurrentContext();
      expect(context?.recentMessages).toHaveLength(1);
      expect(context?.recentMessages[0].content).toBe(message.content);
      expect(context?.totalMessages).toBe(1);
    });

    it('should add multiple conversation messages', async () => {
      const messages: ConversationMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: '第一個訊息',
          timestamp: new Date()
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: '第二個訊息',
          timestamp: new Date()
        }
      ];

      await contextManager.addConversationMessages(messages);

      const context = contextManager.getCurrentContext();
      expect(context?.recentMessages).toHaveLength(2);
      expect(context?.totalMessages).toBe(2);
    });

    it('should get conversation history with limit', async () => {
      // Add 10 messages
      for (let i = 0; i < 10; i++) {
        const message: ConversationMessage = {
          id: `msg-${i}`,
          role: 'user',
          content: `訊息 ${i}`,
          timestamp: new Date()
        };
        await contextManager.addConversationMessage(message);
      }

      const allMessages = contextManager.getConversationHistory();
      const limitedMessages = contextManager.getConversationHistory(5);

      expect(allMessages).toHaveLength(10);
      expect(limitedMessages).toHaveLength(5);
      expect(limitedMessages[0].content).toContain('5'); // Should be the last 5 messages
    });

    it('should search conversation history', async () => {
      const messages: ConversationMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: '請幫我建立用戶註冊功能',
          timestamp: new Date()
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: '好的，我將協助您建立註冊系統',
          timestamp: new Date()
        },
        {
          id: 'msg-3',
          role: 'user',
          content: '還需要密碼重設功能',
          timestamp: new Date()
        }
      ];

      await contextManager.addConversationMessages(messages);

      const searchResults = contextManager.searchConversationHistory('註冊');
      expect(searchResults).toHaveLength(2);
      expect(searchResults[0].content).toContain('註冊');
      expect(searchResults[1].content).toContain('註冊');

      const noResults = contextManager.searchConversationHistory('不存在的關鍵字');
      expect(noResults).toHaveLength(0);
    });

    it('should provide conversation statistics', async () => {
      const messages: ConversationMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: '用戶訊息',
          timestamp: new Date('2023-01-01T10:00:00Z')
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: '助理回應',
          timestamp: new Date('2023-01-01T10:01:00Z')
        },
        {
          id: 'msg-3',
          role: 'system',
          content: '系統訊息',
          timestamp: new Date('2023-01-01T10:02:00Z')
        }
      ];

      await contextManager.addConversationMessages(messages);

      const stats = contextManager.getConversationStats();
      expect(stats.totalMessages).toBe(3);
      expect(stats.userMessages).toBe(1);
      expect(stats.assistantMessages).toBe(1);
      expect(stats.systemMessages).toBe(1);
      expect(stats.recentMessageCount).toBe(3);
      expect(stats.averageMessageLength).toBeGreaterThan(0);
      expect(stats.conversationStartTime).toEqual(new Date('2023-01-01T10:00:00Z'));
      expect(stats.lastMessageTime).toEqual(new Date('2023-01-01T10:02:00Z'));
    });

    it('should clear old conversation history', async () => {
      // Add 25 messages
      for (let i = 0; i < 25; i++) {
        const message: ConversationMessage = {
          id: `msg-${i}`,
          role: 'user',
          content: `訊息 ${i}`,
          timestamp: new Date()
        };
        await contextManager.addConversationMessage(message);
      }

      let context = contextManager.getCurrentContext();
      expect(context?.recentMessages).toHaveLength(20); // Auto-limited to 20

      const clearedCount = await contextManager.clearOldConversationHistory(10);
      
      context = contextManager.getCurrentContext();
      expect(context?.recentMessages).toHaveLength(10);
      expect(clearedCount).toBe(10);
    });
  });

  describe('State Persistence and Recovery', () => {
    beforeEach(async () => {
      await contextManager.loadContext();
    });

    it('should create state snapshots', async () => {
      const snapshotId = await contextManager.createStateSnapshot('test_reason');
      
      expect(snapshotId).toMatch(/^snapshot-\d+-[a-z0-9]+$/);

      const snapshots = contextManager.getAvailableSnapshots();
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].reason).toBe('test_reason');
    });

    it('should restore from state snapshots', async () => {
      // Create initial state
      const context = contextManager.getCurrentContext()!;
      context.conversationSummary = 'Initial summary';

      // Create snapshot
      const snapshotId = await contextManager.createStateSnapshot('before_change');

      // Change state
      context.conversationSummary = 'Changed summary';

      // Restore
      const restored = await contextManager.restoreFromStateSnapshot(snapshotId);
      
      expect(restored).toBe(true);
      const restoredContext = contextManager.getCurrentContext();
      expect(restoredContext?.conversationSummary).toBe('Initial summary');
    });

    it('should export project state', async () => {
      const exportedState = await contextManager.exportProjectState();
      
      expect(exportedState.context).toBeDefined();
      expect(exportedState.version).toBe('1.0');
      expect(exportedState.exportTimestamp).toBeDefined();
    });
  });

  describe('Session Recovery', () => {
    beforeEach(async () => {
      await contextManager.loadContext();
    });

    it('should create session recovery points', async () => {
      const sessionData = {
        executorStatus: 'running',
        currentInstruction: { directive: 'Create user login' },
        queueState: { size: 3 },
        agentState: AgentState.PROCESSING
      };

      const recoveryId = await contextManager.createSessionRecoveryPoint(sessionData);
      
      expect(recoveryId).toMatch(/^recovery-\d+-[a-z0-9]+$/);

      const recoveryPoints = contextManager.getAvailableRecoveryPoints();
      expect(recoveryPoints).toHaveLength(1);
      expect(recoveryPoints[0].sessionSummary).toContain('執行器: running');
    });

    it('should recover sessions', async () => {
      const sessionData = {
        executorStatus: 'stopped',
        agentState: AgentState.IDLE
      };

      const recoveryId = await contextManager.createSessionRecoveryPoint(sessionData);
      
      const recovery = await contextManager.recoverSession(recoveryId);
      
      expect(recovery.success).toBe(true);
      expect(recovery.recoveredSessionData).toEqual(sessionData);
    });

    it('should perform auto recovery', async () => {
      const recovery = await contextManager.autoRecoverSession();
      
      // With valid context, should not need recovery
      expect(recovery.success).toBe(true);
      expect(recovery.recoveryAttempted).toBe(false);
    });

    it('should cleanup old recovery points', async () => {
      // Create multiple recovery points
      for (let i = 0; i < 8; i++) {
        await contextManager.createSessionRecoveryPoint({
          executorStatus: `status-${i}`
        });
      }

      let recoveryPoints = contextManager.getAvailableRecoveryPoints();
      expect(recoveryPoints).toHaveLength(5); // Auto-limited to 5

      const cleaned = await contextManager.cleanupOldRecoveryPoints(3);
      
      recoveryPoints = contextManager.getAvailableRecoveryPoints();
      expect(recoveryPoints).toHaveLength(3);
      expect(cleaned).toBe(2);
    });
  });

  describe('Task Management', () => {
    beforeEach(async () => {
      await contextManager.loadContext();
    });

    it('should update project phase', async () => {
      await contextManager.updatePhase(ProjectPhase.MVP, '需求收集完成');

      const context = contextManager.getCurrentContext();
      expect(context?.phase).toBe(ProjectPhase.MVP);
      expect(context?.phaseStartedAt).toBeDefined();
      
      // Should record decision
      const decisionKeys = Object.keys(context?.decisions || {});
      const phaseTransitionDecision = decisionKeys.find(key => key.includes('phase_transition'));
      expect(phaseTransitionDecision).toBeDefined();
    });

    it('should update current task', async () => {
      await contextManager.updateCurrentTask('epic-1', 'story-1', 'task-1');

      const context = contextManager.getCurrentContext();
      expect(context?.currentEpicId).toBe('epic-1');
      expect(context?.currentStoryId).toBe('story-1');
      expect(context?.currentTaskId).toBe('task-1');
    });

    it('should complete tasks', async () => {
      await contextManager.completeTask('task-1', '任務已成功完成');

      const context = contextManager.getCurrentContext();
      expect(context?.completedTasks).toContain('task-1');
      expect(context?.completedTaskCount).toBe(1);
      expect(context?.metadata.completedTaskSummaries?.['task-1'].summary).toBe('任務已成功完成');
    });
  });

  describe('Section Management', () => {
    beforeEach(async () => {
      await contextManager.loadContext();
    });

    it('should update specific sections', async () => {
      await contextManager.updateSection(
        ClaudeMdSection.REQUIREMENTS,
        'feature: 登入功能\npriority: high'
      );

      const context = contextManager.getCurrentContext();
      expect(context?.requirements).toHaveProperty('feature', '登入功能');
      expect(context?.requirements).toHaveProperty('priority', 'high');
    });

    it('should update decisions section', async () => {
      await contextManager.updateSection(
        ClaudeMdSection.DECISIONS,
        'architecture: React + Node.js\ndatabase: PostgreSQL'
      );

      const context = contextManager.getCurrentContext();
      expect(context?.decisions).toHaveProperty('architecture', 'React + Node.js');
      expect(context?.decisions).toHaveProperty('database', 'PostgreSQL');
    });
  });

  describe('Health Check and Validation', () => {
    beforeEach(async () => {
      await contextManager.loadContext();
    });

    it('should validate state consistency', async () => {
      const validation = await contextManager.validateStateConsistency();
      
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.recommendations).toHaveLength(0);
    });

    it('should detect state inconsistencies', async () => {
      // Create inconsistent state
      const context = contextManager.getCurrentContext()!;
      context.totalMessages = 10;
      context.recentMessages = []; // Inconsistent with totalMessages

      const validation = await contextManager.validateStateConsistency();
      
      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Total message count is inconsistent with recent messages');
    });

    it('should auto-repair state inconsistencies', async () => {
      // Create inconsistent state
      const context = contextManager.getCurrentContext()!;
      context.totalMessages = 0; // Inconsistent
      context.recentMessages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date()
        }
      ];

      const repair = await contextManager.autoRepairStateConsistency();
      
      expect(repair.success).toBe(true);
      expect(repair.repairedIssues).toContain('Fixed total message count');
      
      const repairedContext = contextManager.getCurrentContext();
      expect(repairedContext?.totalMessages).toBe(1);
    });

    it('should perform health checks', async () => {
      const health = await contextManager.healthCheck();
      
      // Health check should complete without error
      expect(health.performance).toBeDefined();
      expect(health.issues).toBeDefined();
      expect(health.recommendations).toBeDefined();
    });
  });
});