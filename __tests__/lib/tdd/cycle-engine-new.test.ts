import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { TDDCycleEngine, FeatureRequest, CycleResult } from '@/lib/tdd/cycle-engine';
import { prisma, CyclePhase, CycleStatus, TestStatus, QueryUrgency } from '@/lib/db';
import { BranchManager } from '@/lib/git/branch-manager';
import { WorkspaceManager } from '@/lib/workspace/workspace-manager';

// Mock prisma models
const mockCycle = {
  create: mock(() => Promise.resolve({})),
  findUnique: mock(() => Promise.resolve(null)),
  update: mock(() => Promise.resolve({})),
};

const mockTest = {
  create: mock(() => Promise.resolve({})),
  findMany: mock(() => Promise.resolve([])),
  updateMany: mock(() => Promise.resolve({})),
};

const mockArtifact = {
  create: mock(() => Promise.resolve({})),
  findMany: mock(() => Promise.resolve([])),
};

const mockQuery = {
  create: mock(() => Promise.resolve({})),
  findMany: mock(() => Promise.resolve([])),
};

// Override prisma models
(prisma as any).cycle = mockCycle;
(prisma as any).test = mockTest;
(prisma as any).artifact = mockArtifact;
(prisma as any).query = mockQuery;

// Mock BranchManager and WorkspaceManager
const mockBranchManager = {
  createFeatureBranch: mock(() => Promise.resolve('feature/test-branch')),
  switchBranch: mock(() => Promise.resolve()),
  commitChanges: mock(() => Promise.resolve()),
};

const mockWorkspaceManager = {
  initializeWorkspace: mock(() => Promise.resolve()),
  captureSnapshot: mock(() => Promise.resolve('snapshot-123')),
  restoreSnapshot: mock(() => Promise.resolve()),
  getChangedFiles: mock(() => Promise.resolve([])),
};

describe('TDDCycleEngine', () => {
  let engine: TDDCycleEngine;

  beforeEach(() => {
    engine = new TDDCycleEngine(
      'test-project',
      mockBranchManager as any,
      mockWorkspaceManager as any
    );

    // Reset all mocks
    [mockCycle, mockTest, mockArtifact, mockQuery].forEach(model => {
      Object.values(model).forEach(fn => {
        if (fn.mockReset) fn.mockReset();
      });
    });
    Object.values(mockBranchManager).forEach(fn => {
      if (fn.mockReset) fn.mockReset();
    });
    Object.values(mockWorkspaceManager).forEach(fn => {
      if (fn.mockReset) fn.mockReset();
    });
  });

  describe('startCycle', () => {
    test('應該創建新的 TDD cycle', async () => {
      const featureRequest: FeatureRequest = {
        title: '使用者登入功能',
        description: '實作使用者登入系統',
        acceptanceCriteria: [
          '使用者可以輸入帳號密碼',
          '登入成功後導向首頁',
          '登入失敗顯示錯誤訊息',
        ],
        constraints: ['使用 JWT token', '支援 OAuth'],
        projectId: 'test-project',
      };

      const expectedCycle = {
        id: 'cycle-123',
        projectId: 'test-project',
        title: featureRequest.title,
        description: featureRequest.description,
        phase: CyclePhase.RED,
        status: CycleStatus.ACTIVE,
        acceptanceCriteria: featureRequest.acceptanceCriteria,
        constraints: featureRequest.constraints,
        currentBranch: 'feature/test-branch',
      };

      mockCycle.create.mockResolvedValue(expectedCycle);

      const result = await engine.startCycle(featureRequest);

      expect(mockBranchManager.createFeatureBranch).toHaveBeenCalledWith(
        expect.stringContaining('使用者登入功能')
      );
      expect(mockWorkspaceManager.initializeWorkspace).toHaveBeenCalledWith('test-project');
      expect(mockCycle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'test-project',
          title: featureRequest.title,
          phase: CyclePhase.RED,
          status: CycleStatus.ACTIVE,
        }),
      });
      expect(result).toEqual(expectedCycle);
    });

    test('應該處理空的 constraints', async () => {
      const featureRequest: FeatureRequest = {
        title: '簡單功能',
        acceptanceCriteria: ['基本需求'],
        projectId: 'test-project',
      };

      await engine.startCycle(featureRequest);

      expect(mockCycle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          constraints: [],
        }),
      });
    });
  });

  describe('executePhase', () => {
    test('應該執行 RED phase', async () => {
      const cycleId = 'cycle-123';
      const cycle = {
        id: cycleId,
        phase: CyclePhase.RED,
        status: CycleStatus.ACTIVE,
        acceptanceCriteria: ['需求1', '需求2'],
        queries: [],
      };

      mockCycle.findUnique.mockResolvedValue(cycle);
      mockCycle.update.mockResolvedValue({ ...cycle, phase: CyclePhase.GREEN });
      mockTest.create.mockResolvedValue({
        id: 'test-1',
        name: 'Test for 需求1',
        status: TestStatus.FAILING,
      });

      const result = await engine.executePhase(cycleId);

      expect(mockCycle.findUnique).toHaveBeenCalledWith({
        where: { id: cycleId },
        include: {
          tests: true,
          artifacts: true,
          queries: true,
        },
      });

      expect(mockTest.create).toHaveBeenCalledTimes(2); // 兩個 acceptance criteria
      expect(result.cycle.phase).toBe(CyclePhase.GREEN);
      expect(result.message).toContain('RED phase completed');
      expect(result.nextPhase).toBe(CyclePhase.GREEN);
    });

    test('應該執行 GREEN phase', async () => {
      const cycleId = 'cycle-123';
      const cycle = {
        id: cycleId,
        phase: CyclePhase.GREEN,
        status: CycleStatus.ACTIVE,
        tests: [
          { id: 'test-1', status: TestStatus.FAILING },
          { id: 'test-2', status: TestStatus.FAILING },
        ],
        artifacts: [],
        queries: [],
      };

      mockCycle.findUnique.mockResolvedValue(cycle);
      mockCycle.update.mockResolvedValue({ ...cycle, phase: CyclePhase.REFACTOR });
      mockTest.findMany.mockResolvedValue(cycle.tests);
      mockArtifact.create.mockResolvedValue({
        id: 'artifact-1',
        type: 'CODE',
        content: 'implementation code',
      });
      mockTest.updateMany.mockResolvedValue({ count: 2 });

      const result = await engine.executePhase(cycleId);

      expect(mockArtifact.create).toHaveBeenCalledTimes(2); // 為每個失敗的測試創建 artifact
      expect(mockTest.updateMany).toHaveBeenCalled();
      expect(result.cycle.phase).toBe(CyclePhase.REFACTOR);
      expect(result.message).toContain('GREEN phase completed');
    });

    test('應該執行 REFACTOR phase', async () => {
      const cycleId = 'cycle-123';
      const cycle = {
        id: cycleId,
        phase: CyclePhase.REFACTOR,
        status: CycleStatus.ACTIVE,
        artifacts: [
          { id: 'artifact-1', type: 'CODE', content: 'original code' },
        ],
        tests: [],
        queries: [],
      };

      mockCycle.findUnique.mockResolvedValue(cycle);
      mockCycle.update.mockResolvedValue({ ...cycle, phase: CyclePhase.REVIEW });
      mockArtifact.findMany.mockResolvedValue(cycle.artifacts);
      mockArtifact.create.mockResolvedValue({
        id: 'artifact-2',
        type: 'CODE',
        content: 'refactored code',
      });

      const result = await engine.executePhase(cycleId);

      expect(mockArtifact.create).toHaveBeenCalled(); // 創建重構後的 artifact
      expect(result.cycle.phase).toBe(CyclePhase.REVIEW);
      expect(result.message).toContain('REFACTOR phase completed');
    });

    test('應該執行 REVIEW phase', async () => {
      const cycleId = 'cycle-123';
      const cycle = {
        id: cycleId,
        phase: CyclePhase.REVIEW,
        status: CycleStatus.ACTIVE,
        artifacts: [
          { id: 'artifact-1', type: 'CODE' },
          { id: 'artifact-2', type: 'TEST' },
        ],
        tests: [
          { id: 'test-1', status: TestStatus.PASSING },
        ],
        queries: [],
      };

      mockCycle.findUnique.mockResolvedValue(cycle);
      mockCycle.update.mockResolvedValue({ ...cycle, status: CycleStatus.COMPLETED });
      mockArtifact.findMany.mockResolvedValue(cycle.artifacts);
      mockTest.findMany.mockResolvedValue(cycle.tests);

      const result = await engine.executePhase(cycleId);

      expect(mockBranchManager.commitChanges).toHaveBeenCalled();
      expect(result.cycle.status).toBe(CycleStatus.COMPLETED);
      expect(result.message).toContain('Cycle completed successfully');
      expect(result.complete).toBe(true);
    });

    test('應該處理 blocking queries', async () => {
      const cycleId = 'cycle-123';
      const cycle = {
        id: cycleId,
        phase: CyclePhase.RED,
        status: CycleStatus.ACTIVE,
        acceptanceCriteria: [],
        queries: [
          { id: 'query-1', urgency: QueryUrgency.BLOCKING, status: 'PENDING' },
        ],
      };

      mockCycle.findUnique.mockResolvedValue(cycle);

      const result = await engine.executePhase(cycleId);

      expect(result.blockedByQueries).toBe(true);
      expect(result.message).toContain('blocked by queries');
    });

    test('應該處理不存在的 cycle', async () => {
      mockCycle.findUnique.mockResolvedValue(null);

      await expect(engine.executePhase('non-existent')).rejects.toThrow(
        'Cycle non-existent not found'
      );
    });

    test('應該處理非活躍的 cycle', async () => {
      const cycle = {
        id: 'cycle-123',
        status: CycleStatus.PAUSED,
      };

      mockCycle.findUnique.mockResolvedValue(cycle);

      const result = await engine.executePhase('cycle-123');

      expect(result.message).toContain('not active');
    });
  });

  describe('pauseCycle', () => {
    test('應該暫停活躍的 cycle', async () => {
      const cycleId = 'cycle-123';
      const cycle = {
        id: cycleId,
        status: CycleStatus.ACTIVE,
      };

      mockCycle.findUnique.mockResolvedValue(cycle);
      mockCycle.update.mockResolvedValue({ ...cycle, status: CycleStatus.PAUSED });

      const result = await engine.pauseCycle(cycleId);

      expect(mockCycle.update).toHaveBeenCalledWith({
        where: { id: cycleId },
        data: { status: CycleStatus.PAUSED },
      });
      expect(result.status).toBe(CycleStatus.PAUSED);
    });
  });

  describe('resumeCycle', () => {
    test('應該恢復暫停的 cycle', async () => {
      const cycleId = 'cycle-123';
      const cycle = {
        id: cycleId,
        status: CycleStatus.PAUSED,
        currentBranch: 'feature/test',
      };

      mockCycle.findUnique.mockResolvedValue(cycle);
      mockCycle.update.mockResolvedValue({ ...cycle, status: CycleStatus.ACTIVE });

      const result = await engine.resumeCycle(cycleId);

      expect(mockBranchManager.switchBranch).toHaveBeenCalledWith('feature/test');
      expect(mockCycle.update).toHaveBeenCalledWith({
        where: { id: cycleId },
        data: { status: CycleStatus.ACTIVE },
      });
      expect(result.status).toBe(CycleStatus.ACTIVE);
    });
  });

  describe('addQuery', () => {
    test('應該添加查詢到 cycle', async () => {
      const cycleId = 'cycle-123';
      const query = {
        type: 'CLARIFICATION' as const,
        content: '需要澄清的問題',
        urgency: QueryUrgency.BLOCKING,
      };

      const expectedQuery = {
        id: 'query-123',
        cycleId,
        ...query,
        status: 'PENDING',
      };

      mockQuery.create.mockResolvedValue(expectedQuery);

      const result = await engine.addQuery(cycleId, query);

      expect(mockQuery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cycleId,
          ...query,
          status: 'PENDING',
        }),
      });
      expect(result).toEqual(expectedQuery);
    });
  });

  describe('getCycleStatus', () => {
    test('應該獲取 cycle 狀態', async () => {
      const cycleId = 'cycle-123';
      const cycle = {
        id: cycleId,
        phase: CyclePhase.GREEN,
        status: CycleStatus.ACTIVE,
        tests: [
          { status: TestStatus.PASSING },
          { status: TestStatus.FAILING },
        ],
        artifacts: [
          { type: 'CODE' },
          { type: 'TEST' },
        ],
        queries: [
          { status: 'ANSWERED' },
        ],
      };

      mockCycle.findUnique.mockResolvedValue(cycle);

      const result = await engine.getCycleStatus(cycleId);

      expect(result).toEqual({
        cycle,
        testsCount: 2,
        passingTests: 1,
        failingTests: 1,
        artifactsCount: 2,
        pendingQueries: 0,
      });
    });
  });
});