import { TokenBasedResourceManager } from '@/lib/resources/token-management';
import { prisma } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  prisma: {
    tokenUsage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    projectSettings: {
      findUnique: jest.fn(),
    },
    cycle: {
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    projectLog: {
      create: jest.fn(),
    },
    kanbanCard: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/config', () => ({
  getConfig: jest.fn().mockResolvedValue({
    claudeDailyTokenLimit: 100000,
  }),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('TokenBasedResourceManager', () => {
  let tokenManager: TokenBasedResourceManager;

  const mockUsageRecord = {
    id: 'usage-1',
    projectId: 'test-project-id',
    agentType: 'tdd-developer',
    taskId: 'task-1',
    inputTokens: 700,
    outputTokens: 300,
    timestamp: new Date('2023-01-01T10:00:00Z'),
  };

  const mockProjectSettings = {
    projectId: 'test-project-id',
    maxTokensPerDay: 50000,
  };

  const mockStory = {
    id: 'story-1',
    title: 'Test Story',
    priority: 'MEDIUM',
    tddEnabled: true,
    epic: { id: 'epic-1', title: 'Test Epic' },
    cycles: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tokenManager = new TokenBasedResourceManager();
  });

  describe('singleton pattern', () => {
    it('should return same instance when getInstance is called multiple times', () => {
      const instance1 = TokenBasedResourceManager.getInstance();
      const instance2 = TokenBasedResourceManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('getTokenStatus', () => {
    beforeEach(() => {
      mockPrisma.tokenUsage.findMany.mockResolvedValue([mockUsageRecord]);
      mockPrisma.projectSettings.findUnique.mockResolvedValue(mockProjectSettings);
      mockPrisma.cycle.count.mockResolvedValue(5);
    });

    it('should return comprehensive token status', async () => {
      const status = await tokenManager.getTokenStatus('test-project-id');

      expect(status).toEqual({
        currentUsage: {
          today: 1000,
          thisWeek: 1000,
          thisMonth: 1000,
        },
        limits: {
          dailyLimit: 50000,
          weeklyGuideline: 250000,
          monthlyBudget: 1000000,
          emergencyReserve: 5000,
        },
        remaining: {
          today: 49000,
          thisWeek: 249000,
          thisMonth: 999000,
        },
        breakdown: {
          byAgent: { 'tdd-developer': 1000 },
          byEpic: {},
          byTask: { 'task-1': 1000 },
          byCycle: [
            {
              cycleId: 'usage-1',
              tokens: 1000,
              timestamp: new Date('2023-01-01T10:00:00Z'),
            },
          ],
        },
        projection: expect.objectContaining({
          burnRate: expect.any(Number),
          estimatedCyclesRemaining: expect.any(Number),
          estimatedTimeToLimit: expect.any(String),
          status: 'ACTIVE',
        }),
      });
    });

    it('should use default limits when no project settings exist', async () => {
      mockPrisma.projectSettings.findUnique.mockResolvedValue(null);

      const status = await tokenManager.getTokenStatus('test-project-id');

      expect(status.limits.dailyLimit).toBe(100000);
      expect(status.limits.weeklyGuideline).toBe(500000);
      expect(status.limits.monthlyBudget).toBe(2000000);
    });

    it('should calculate correct projection status based on usage', async () => {
      // Mock high usage to trigger CRITICAL status
      const highUsageRecord = {
        ...mockUsageRecord,
        inputTokens: 40000,
        outputTokens: 7000,
      };
      mockPrisma.tokenUsage.findMany.mockResolvedValue([highUsageRecord]);

      const status = await tokenManager.getTokenStatus('test-project-id');

      expect(status.projection.status).toBe('CRITICAL');
    });

    it('should calculate BLOCKED status when limit exceeded', async () => {
      const exceededUsageRecord = {
        ...mockUsageRecord,
        inputTokens: 45000,
        outputTokens: 10000,
      };
      mockPrisma.tokenUsage.findMany.mockResolvedValue([exceededUsageRecord]);

      const status = await tokenManager.getTokenStatus('test-project-id');

      expect(status.projection.status).toBe('BLOCKED');
    });
  });

  describe('canExecuteWork', () => {
    beforeEach(() => {
      mockPrisma.tokenUsage.findMany.mockResolvedValue([mockUsageRecord]);
      mockPrisma.projectSettings.findUnique.mockResolvedValue(mockProjectSettings);
      mockPrisma.cycle.count.mockResolvedValue(5);
    });

    it('should allow work when sufficient tokens remain', async () => {
      const result = await tokenManager.canExecuteWork('test-project-id', 5000);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny work when tokens would exceed daily limit', async () => {
      const result = await tokenManager.canExecuteWork('test-project-id', 60000);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Daily token limit would be exceeded');
      expect(result.alternativeAction).toContain('tomorrow');
    });

    it('should warn when tokens are low but still allow work', async () => {
      // Set up scenario where remaining tokens are less than 20% of daily limit
      const highUsageRecord = {
        ...mockUsageRecord,
        inputTokens: 35000,
        outputTokens: 5000,
      };
      mockPrisma.tokenUsage.findMany.mockResolvedValue([highUsageRecord]);

      const result = await tokenManager.canExecuteWork('test-project-id', 5000);

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('WARNING');
      expect(result.alternativeAction).toContain('simple tasks');
    });
  });

  describe('logTokenUsage', () => {
    beforeEach(() => {
      mockPrisma.tokenUsage.create.mockResolvedValue(mockUsageRecord);
      mockPrisma.tokenUsage.findMany.mockResolvedValue([]);
      mockPrisma.projectSettings.findUnique.mockResolvedValue(mockProjectSettings);
      mockPrisma.cycle.count.mockResolvedValue(0);
    });

    it('should log token usage with provided input/output tokens', async () => {
      await tokenManager.logTokenUsage(
        'test-project-id',
        'tdd-developer',
        'generate-test',
        1000,
        { inputTokens: 700, outputTokens: 300, taskId: 'task-1' }
      );

      expect(mockPrisma.tokenUsage.create).toHaveBeenCalledWith({
        data: {
          projectId: 'test-project-id',
          agentType: 'tdd-developer',
          taskId: 'task-1',
          inputTokens: 700,
          outputTokens: 300,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should calculate input/output split when not provided', async () => {
      await tokenManager.logTokenUsage(
        'test-project-id',
        'tdd-developer',
        'generate-test',
        1000
      );

      expect(mockPrisma.tokenUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inputTokens: 700, // 70% of 1000
          outputTokens: 300, // 30% of 1000
        }),
      });
    });

    it('should check limits after logging usage', async () => {
      const highUsageRecord = {
        ...mockUsageRecord,
        inputTokens: 47000,
        outputTokens: 8000,
      };
      mockPrisma.tokenUsage.findMany.mockResolvedValue([highUsageRecord]);

      await tokenManager.logTokenUsage(
        'test-project-id',
        'tdd-developer',
        'generate-test',
        1000
      );

      // Should trigger handleLimitChecks and potentially pause work
      expect(mockPrisma.cycle.updateMany).toHaveBeenCalledWith({
        where: {
          projectId: 'test-project-id',
          status: 'IN_PROGRESS',
        },
        data: {
          status: 'PAUSED',
        },
      });
    });
  });

  describe('prioritizeWork', () => {
    beforeEach(() => {
      mockPrisma.tokenUsage.findMany.mockResolvedValue([mockUsageRecord]);
      mockPrisma.projectSettings.findUnique.mockResolvedValue(mockProjectSettings);
      mockPrisma.cycle.count.mockResolvedValue(5);
    });

    it('should categorize stories by estimated token usage', async () => {
      const stories = [
        { ...mockStory, id: 'story-1', priority: 'LOW', tddEnabled: false }, // 500 tokens
        { ...mockStory, id: 'story-2', priority: 'MEDIUM', tddEnabled: false }, // 1000 tokens
        { ...mockStory, id: 'story-3', priority: 'HIGH', tddEnabled: true }, // 2250 tokens (1500 * 1.5)
      ];
      mockPrisma.kanbanCard.findMany.mockResolvedValue(stories);

      const result = await tokenManager.prioritizeWork('test-project-id');

      expect(result.highPriority).toContain('story-1'); // 500 tokens < 500
      expect(result.mediumPriority).toContain('story-2'); // 1000 tokens < 2000
      expect(result.lowPriority).toContain('story-3'); // 2250 tokens >= 2000
      expect(result.blocked).toHaveLength(0);
    });

    it('should block stories when insufficient tokens remain', async () => {
      // Set up high usage scenario
      const highUsageRecord = {
        ...mockUsageRecord,
        inputTokens: 45000,
        outputTokens: 4000,
      };
      mockPrisma.tokenUsage.findMany.mockResolvedValue([highUsageRecord]);

      const stories = [
        { ...mockStory, id: 'story-1', priority: 'MEDIUM', tddEnabled: false }, // 1000 tokens
      ];
      mockPrisma.kanbanCard.findMany.mockResolvedValue(stories);

      const result = await tokenManager.prioritizeWork('test-project-id');

      expect(result.blocked).toContain('story-1');
      expect(result.highPriority).toHaveLength(0);
    });
  });

  describe('pauseWorkForLimits', () => {
    it('should pause all in-progress cycles', async () => {
      await tokenManager.pauseWorkForLimits('test-project-id', 'Daily limit reached');

      expect(mockPrisma.cycle.updateMany).toHaveBeenCalledWith({
        where: {
          projectId: 'test-project-id',
          status: 'IN_PROGRESS',
        },
        data: {
          status: 'PAUSED',
        },
      });
    });

    it('should create system log entry', async () => {
      await tokenManager.pauseWorkForLimits('test-project-id', 'Daily limit reached');

      expect(mockPrisma.projectLog.create).toHaveBeenCalledWith({
        data: {
          projectId: 'test-project-id',
          level: 'WARN',
          source: 'RESOURCE_MANAGEMENT',
          message: 'Work paused: Daily limit reached',
          metadata: expect.stringContaining('pauseReason'),
        },
      });
    });
  });

  describe('resumeWorkAfterReset', () => {
    it('should resume all paused cycles', async () => {
      await tokenManager.resumeWorkAfterReset('test-project-id');

      expect(mockPrisma.cycle.updateMany).toHaveBeenCalledWith({
        where: {
          projectId: 'test-project-id',
          status: 'PAUSED',
        },
        data: {
          status: 'IN_PROGRESS',
        },
      });
    });

    it('should create resumption log entry', async () => {
      await tokenManager.resumeWorkAfterReset('test-project-id');

      expect(mockPrisma.projectLog.create).toHaveBeenCalledWith({
        data: {
          projectId: 'test-project-id',
          level: 'INFO',
          source: 'RESOURCE_MANAGEMENT',
          message: 'Work resumed after token budget reset',
          metadata: expect.stringContaining('resumedAt'),
        },
      });
    });
  });

  describe('private methods via integration', () => {
    beforeEach(() => {
      mockPrisma.tokenUsage.findMany.mockResolvedValue([
        mockUsageRecord,
        {
          ...mockUsageRecord,
          id: 'usage-2',
          agentType: 'code-reviewer',
          inputTokens: 200,
          outputTokens: 100,
          taskId: 'task-2',
        },
      ]);
      mockPrisma.projectSettings.findUnique.mockResolvedValue(mockProjectSettings);
      mockPrisma.cycle.count.mockResolvedValue(3);
    });

    it('should calculate usage breakdown correctly', async () => {
      const status = await tokenManager.getTokenStatus('test-project-id');

      expect(status.breakdown.byAgent).toEqual({
        'tdd-developer': 1000,
        'code-reviewer': 300,
      });
      expect(status.breakdown.byTask).toEqual({
        'task-1': 1000,
        'task-2': 300,
      });
      expect(status.currentUsage.today).toBe(1300);
    });

    it('should calculate burn rate based on time of day', async () => {
      // Mock current time to be 12:00 PM (12 hours passed)
      const mockDate = new Date('2023-01-01T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const status = await tokenManager.getTokenStatus('test-project-id');

      expect(status.projection.burnRate).toBeCloseTo(1300 / 12, 1); // ~108.33 tokens per hour
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully in getTokenStatus', async () => {
      mockPrisma.tokenUsage.findMany.mockRejectedValue(new Error('Database error'));

      await expect(
        tokenManager.getTokenStatus('test-project-id')
      ).rejects.toThrow('Database error');
    });

    it('should handle missing project settings gracefully', async () => {
      mockPrisma.projectSettings.findUnique.mockResolvedValue(null);
      mockPrisma.tokenUsage.findMany.mockResolvedValue([]);
      mockPrisma.cycle.count.mockResolvedValue(0);

      const status = await tokenManager.getTokenStatus('test-project-id');

      expect(status.limits.dailyLimit).toBe(100000); // Default from config
    });
  });

  describe('edge cases', () => {
    it('should handle zero usage correctly', async () => {
      mockPrisma.tokenUsage.findMany.mockResolvedValue([]);
      mockPrisma.projectSettings.findUnique.mockResolvedValue(mockProjectSettings);
      mockPrisma.cycle.count.mockResolvedValue(0);

      const status = await tokenManager.getTokenStatus('test-project-id');

      expect(status.currentUsage.today).toBe(0);
      expect(status.remaining.today).toBe(50000);
      expect(status.projection.status).toBe('ACTIVE');
    });

    it('should handle early morning usage correctly', async () => {
      // Mock very early time (1 AM)
      const mockDate = new Date('2023-01-01T01:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      mockPrisma.tokenUsage.findMany.mockResolvedValue([mockUsageRecord]);
      mockPrisma.projectSettings.findUnique.mockResolvedValue(mockProjectSettings);
      mockPrisma.cycle.count.mockResolvedValue(5);

      const status = await tokenManager.getTokenStatus('test-project-id');

      expect(status.projection.burnRate).toBeGreaterThan(0);
      expect(status.projection.estimatedTimeToLimit).not.toBe('No limit expected');
    });
  });
});