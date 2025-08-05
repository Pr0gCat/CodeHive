import { TDDCycleEngine } from '@/lib/tdd/cycle-engine';
import {
  clearAllMocks,
  mockCycle,
  mockProject,
} from '../../helpers/test-utils';

// Mock the AI integration module
jest.doMock('@/lib/tdd/ai-integration', () => ({
  AITDDIntegration: jest.fn().mockImplementation(() => ({
    generateTestCode: jest.fn().mockResolvedValue({
      test: {
        id: 'generated-test-id',
        name: 'should work correctly',
        code: 'AI generated test code',
        status: 'FAILING',
      },
      decision: null,
    }),
    generateImplementationCode: jest.fn().mockResolvedValue({
      artifact: {
        id: 'generated-artifact-id',
        name: 'implementation',
        content: 'AI generated implementation',
        type: 'CODE',
      },
      decision: null,
    }),
    refactorCode: jest.fn().mockResolvedValue({
      artifact: {
        id: 'refactored-artifact-id',
        name: 'refactored-implementation',
        content: 'AI refactored code',
        type: 'CODE',
      },
      decision: null,
    }),
  })),
}));

// Mock workspace and branch managers
jest.mock('@/lib/workspace/workspace-manager', () => ({
  WorkspaceManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    createSnapshot: jest.fn().mockResolvedValue({
      snapshotId: 'test-snapshot-id',
      files: [],
    }),
  })),
}));

jest.mock('@/lib/git/branch-manager', () => ({
  BranchManager: jest.fn().mockImplementation(() => ({
    createFeatureBranch: jest.fn().mockResolvedValue({
      success: true,
      output: 'Branch created successfully',
    }),
    createCheckpointBranch: jest.fn().mockResolvedValue({
      success: true,
      output: 'Checkpoint created',
    }),
    commitChanges: jest.fn().mockResolvedValue({
      success: true,
      output: 'Changes committed',
    }),
    rollbackToCheckpoint: jest.fn().mockResolvedValue({
      success: true,
      output: 'Rolled back successfully',
    }),
    createMergeRequest: jest.fn().mockResolvedValue({
      success: true,
      output: 'https://github.com/user/repo/pull/123',
    }),
  })),
}));

describe('TDDCycleEngine', () => {
  let tddEngine: TDDCycleEngine;
  const testProjectId = 'test-project-id';
  const testProjectPath = '/test/project/path';

  beforeEach(() => {
    clearAllMocks();
    tddEngine = new TDDCycleEngine(testProjectId, testProjectPath);
    // mockPrisma(); // This line is removed as per the edit hint
  });

  describe('startCycle', () => {
    const mockFeatureRequest = {
      title: 'User Authentication',
      description: 'Implement user login and registration',
      acceptanceCriteria: [
        'Users can register with email and password',
        'Users can login with valid credentials',
        'Invalid credentials are rejected',
      ],
      constraints: ['Must use JWT tokens'],
      projectId: testProjectId,
    };

    it('should create a new cycle and feature branch', async () => {
      const { prisma } = require('@/lib/db');
      const createdCycle = { ...mockCycle, ...mockFeatureRequest };
      prisma.cycle.create.mockResolvedValue(createdCycle);

      const result = await tddEngine.startCycle(mockFeatureRequest);

      expect(prisma.cycle.create).toHaveBeenCalledWith({
        data: {
          projectId: testProjectId,
          title: mockFeatureRequest.title,
          description: mockFeatureRequest.description,
          phase: 'RED',
          status: 'ACTIVE',
          acceptanceCriteria: JSON.stringify(
            mockFeatureRequest.acceptanceCriteria
          ),
          constraints: JSON.stringify(mockFeatureRequest.constraints),
        },
      });

      expect(result.title).toBe(mockFeatureRequest.title);
      expect(result.phase).toBe('RED');
    });

    it('should rollback cycle creation if branch creation fails', async () => {
      const { BranchManager } = require('@/lib/git/branch-manager');
      const mockBranchManager = new BranchManager();
      mockBranchManager.createFeatureBranch.mockResolvedValue({
        success: false,
        error: 'Git error',
      });

      const { prisma } = require('@/lib/db');
      prisma.cycle.create.mockResolvedValue({ id: 'test-cycle-id' });

      await expect(tddEngine.startCycle(mockFeatureRequest)).rejects.toThrow(
        'Failed to create feature branch: Git error'
      );

      expect(prisma.cycle.delete).toHaveBeenCalledWith({
        where: { id: 'test-cycle-id' },
      });
    });
  });

  describe('executePhase', () => {
    it('should return blocked status when blocking queries exist', async () => {
      const { prisma } = require('@/lib/db');
      const cycleWithBlockingQuery = {
        ...mockCycle,
        queries: [
          {
            id: 'blocking-query-id',
            urgency: 'BLOCKING',
            status: 'PENDING',
          },
        ],
      };
      prisma.cycle.findUnique.mockResolvedValue(cycleWithBlockingQuery);

      const result = await tddEngine.executePhase('test-cycle-id');

      expect(result.status).toBe('BLOCKED');
      expect(result.queries).toHaveLength(1);
    });

    it('should throw error for unknown phase', async () => {
      const { prisma } = require('@/lib/db');
      const cycleWithUnknownPhase = {
        ...mockCycle,
        phase: 'UNKNOWN_PHASE',
        queries: [],
      };
      prisma.cycle.findUnique.mockResolvedValue(cycleWithUnknownPhase);

      await expect(tddEngine.executePhase('test-cycle-id')).rejects.toThrow(
        'Unknown cycle phase: UNKNOWN_PHASE'
      );
    });

    it('should throw error for non-existent cycle', async () => {
      const { prisma } = require('@/lib/db');
      prisma.cycle.findUnique.mockResolvedValue(null);

      await expect(tddEngine.executePhase('invalid-cycle-id')).rejects.toThrow(
        'Cycle invalid-cycle-id not found'
      );
    });
  });

  describe('RED Phase', () => {
    it('should generate tests and transition to GREEN phase', async () => {
      const { prisma } = require('@/lib/db');
      const redPhaseCycle = {
        ...mockCycle,
        phase: 'RED',
        acceptanceCriteria: JSON.stringify(['Should work correctly']),
        queries: [],
        project: mockProject,
      };
      prisma.cycle.findUnique.mockResolvedValue(redPhaseCycle);
      prisma.cycle.update.mockResolvedValue({
        ...redPhaseCycle,
        phase: 'GREEN',
      });

      const result = await tddEngine.executePhase('test-cycle-id');

      expect(result.status).toBe('COMPLETED');
      expect(result.nextPhase).toBe('GREEN');
      expect(prisma.cycle.update).toHaveBeenCalledWith({
        where: { id: 'test-cycle-id' },
        data: {
          phase: 'GREEN',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should create checkpoint and commit changes', async () => {
      const { BranchManager } = require('@/lib/git/branch-manager');
      const mockBranchManager = new BranchManager();

      const { prisma } = require('@/lib/db');
      const redPhaseCycle = {
        ...mockCycle,
        phase: 'RED',
        acceptanceCriteria: JSON.stringify(['Should work correctly']),
        queries: [],
        project: mockProject,
      };
      prisma.cycle.findUnique.mockResolvedValue(redPhaseCycle);

      await tddEngine.executePhase('test-cycle-id');

      expect(mockBranchManager.createCheckpointBranch).toHaveBeenCalledWith(
        'test-cycle-id',
        'red'
      );
      expect(mockBranchManager.commitChanges).toHaveBeenCalledWith(
        'add failing tests for Test Feature',
        'RED'
      );
    });
  });

  describe('GREEN Phase', () => {
    it('should generate implementation and transition to REFACTOR phase', async () => {
      const { prisma } = require('@/lib/db');
      const greenPhaseCycle = {
        ...mockCycle,
        phase: 'GREEN',
        tests: [
          {
            id: 'test-1',
            status: 'FAILING',
            name: 'should work',
          },
        ],
        queries: [],
        project: mockProject,
      };
      prisma.cycle.findUnique.mockResolvedValue(greenPhaseCycle);
      prisma.cycle.update.mockResolvedValue({
        ...greenPhaseCycle,
        phase: 'REFACTOR',
      });

      const result = await tddEngine.executePhase('test-cycle-id');

      expect(result.status).toBe('COMPLETED');
      expect(result.nextPhase).toBe('REFACTOR');
      expect(prisma.test.update).toHaveBeenCalled();
    });
  });

  describe('REFACTOR Phase', () => {
    it('should refactor code and transition to REVIEW phase', async () => {
      const { prisma } = require('@/lib/db');
      const refactorPhaseCycle = {
        ...mockCycle,
        phase: 'REFACTOR',
        artifacts: [
          {
            id: 'artifact-1',
            type: 'CODE',
            content: 'original code',
          },
        ],
        queries: [],
        project: mockProject,
      };
      prisma.cycle.findUnique.mockResolvedValue(refactorPhaseCycle);
      prisma.cycle.update.mockResolvedValue({
        ...refactorPhaseCycle,
        phase: 'REVIEW',
      });

      const result = await tddEngine.executePhase('test-cycle-id');

      expect(result.status).toBe('COMPLETED');
      expect(result.nextPhase).toBe('REVIEW');
    });
  });

  describe('REVIEW Phase', () => {
    it('should complete cycle when all tests pass', async () => {
      const { prisma } = require('@/lib/db');
      const reviewPhaseCycle = {
        ...mockCycle,
        phase: 'REVIEW',
        tests: [
          { id: 'test-1', status: 'PASSING' },
          { id: 'test-2', status: 'PASSING' },
        ],
        queries: [],
        project: mockProject,
      };
      prisma.cycle.findUnique.mockResolvedValue(reviewPhaseCycle);
      prisma.cycle.update.mockResolvedValue({
        ...reviewPhaseCycle,
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      const result = await tddEngine.executePhase('test-cycle-id');

      expect(result.status).toBe('COMPLETED');
      expect(prisma.cycle.update).toHaveBeenCalledWith({
        where: { id: 'test-cycle-id' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should rollback to GREEN phase when tests fail', async () => {
      const { prisma } = require('@/lib/db');
      const reviewPhaseCycle = {
        ...mockCycle,
        phase: 'REVIEW',
        tests: [
          { id: 'test-1', status: 'PASSING' },
          { id: 'test-2', status: 'FAILING' },
        ],
        queries: [],
        project: mockProject,
      };
      prisma.cycle.findUnique.mockResolvedValue(reviewPhaseCycle);
      prisma.cycle.update.mockResolvedValue({
        ...reviewPhaseCycle,
        phase: 'GREEN',
      });

      const { BranchManager } = require('@/lib/git/branch-manager');
      const mockBranchManager = new BranchManager();

      const result = await tddEngine.executePhase('test-cycle-id');

      expect(result.status).toBe('FAILED');
      expect(result.nextPhase).toBe('GREEN');
      expect(mockBranchManager.rollbackToCheckpoint).toHaveBeenCalledWith(
        'checkpoint/green-phase-start'
      );
    });

    it('should create merge request on successful completion', async () => {
      const { prisma } = require('@/lib/db');
      const reviewPhaseCycle = {
        ...mockCycle,
        phase: 'REVIEW',
        tests: [{ id: 'test-1', status: 'PASSING' }],
        queries: [],
        project: mockProject,
      };
      prisma.cycle.findUnique.mockResolvedValue(reviewPhaseCycle);

      const { BranchManager } = require('@/lib/git/branch-manager');
      const mockBranchManager = new BranchManager();

      await tddEngine.executePhase('test-cycle-id');

      expect(mockBranchManager.createMergeRequest).toHaveBeenCalledWith(
        'test-cycle-id'
      );
    });
  });

  describe('AI Integration', () => {
    it('should use AI to generate tests with fallback', async () => {
      const { AITDDIntegration } = require('@/lib/tdd/ai-integration');
      const mockAI = new AITDDIntegration();

      // Mock AI failure
      mockAI.generateTestCode.mockRejectedValue(
        new Error('AI service unavailable')
      );

      const { prisma } = require('@/lib/db');
      const redPhaseCycle = {
        ...mockCycle,
        phase: 'RED',
        acceptanceCriteria: JSON.stringify(['Should work correctly']),
        queries: [],
        project: mockProject,
      };
      prisma.cycle.findUnique.mockResolvedValue(redPhaseCycle);

      // Should not throw and should create test with template
      const result = await tddEngine.executePhase('test-cycle-id');

      expect(result.status).toBe('COMPLETED');
      expect(prisma.test.create).toHaveBeenCalled();
    });

    it('should handle AI decision points', async () => {
      const { AITDDIntegration } = require('@/lib/tdd/ai-integration');
      const mockAI = new AITDDIntegration();

      // Mock AI with decision point
      mockAI.generateTestCode.mockResolvedValue({
        test: {
          id: 'ai-test-id',
          name: 'AI generated test',
          code: 'AI test code',
        },
        decision: {
          id: 'decision-id',
          title: 'Architecture Decision',
        },
      });

      const { prisma } = require('@/lib/db');
      const redPhaseCycle = {
        ...mockCycle,
        phase: 'RED',
        acceptanceCriteria: JSON.stringify(['Should work correctly']),
        queries: [],
        project: mockProject,
      };
      prisma.cycle.findUnique.mockResolvedValue(redPhaseCycle);

      await tddEngine.executePhase('test-cycle-id');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Decision point created')
      );
    });
  });
});
