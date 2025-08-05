import { BranchManager } from '@/lib/git/branch-manager';
import { clearAllMocks, mockExec, mockPrisma } from '../../helpers/test-utils';

describe('BranchManager', () => {
  let branchManager: BranchManager;
  const testProjectPath = '/test/project/path';

  beforeEach(() => {
    clearAllMocks();
    branchManager = new BranchManager(testProjectPath);
    mockPrisma();
  });

  describe('createFeatureBranch', () => {
    it('should create and switch to a new feature branch', async () => {
      mockExec('Switched to branch feature/cycle-test-id-test-feature');

      const result = await branchManager.createFeatureBranch(
        'test-id',
        'Test Feature'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain(
        'Created and switched to branch: feature/cycle-test-id-test-feature'
      );
    });

    it('should handle git command failures', async () => {
      const { exec } = require('child_process');
      exec.mockImplementation(
        (
          command: string,
          options: Record<string, unknown>,
          callback: Function
        ) => {
          callback(new Error('Git command failed'));
        }
      );

      const result = await branchManager.createFeatureBranch(
        'test-id',
        'Test Feature'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Git command failed');
    });

    it('should sanitize feature names for branch creation', async () => {
      mockExec(
        'Switched to branch feature/cycle-test-id-test-feature-with-spaces'
      );

      const result = await branchManager.createFeatureBranch(
        'test-id',
        'Test Feature With Spaces'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain(
        'feature/cycle-test-id-test-feature-with-spaces'
      );
    });
  });

  describe('createCheckpointBranch', () => {
    it('should create a checkpoint branch', async () => {
      mockExec('Branch checkpoint/red-phase-start created');

      const result = await branchManager.createCheckpointBranch(
        'test-id',
        'red'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain(
        'Created checkpoint branch: checkpoint/red-phase-start'
      );
    });

    it('should handle checkpoint creation failures', async () => {
      const { exec } = require('child_process');
      exec.mockImplementation(
        (
          command: string,
          options: Record<string, unknown>,
          callback: Function
        ) => {
          callback(new Error('Failed to create checkpoint'));
        }
      );

      const result = await branchManager.createCheckpointBranch(
        'test-id',
        'red'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create checkpoint');
    });
  });

  describe('commitChanges', () => {
    it('should commit changes with proper message format', async () => {
      mockExec('1 file changed, 10 insertions(+)');

      const result = await branchManager.commitChanges('add tests', 'RED');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Committed: feat(tests): add tests');
    });

    it('should handle commit failures', async () => {
      const { exec } = require('child_process');
      exec.mockImplementation(
        (
          command: string,
          options: Record<string, unknown>,
          callback: Function
        ) => {
          callback(new Error('Nothing to commit'));
        }
      );

      const result = await branchManager.commitChanges('add tests', 'RED');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Nothing to commit');
    });

    it('should use correct commit prefixes for different phases', async () => {
      mockExec('1 file changed, 10 insertions(+)');

      const phases = [
        { phase: 'RED', prefix: 'feat(tests)' },
        { phase: 'GREEN', prefix: 'feat(impl)' },
        { phase: 'REFACTOR', prefix: 'refactor' },
        { phase: 'REVIEW', prefix: 'test(review)' },
      ];

      for (const { phase, prefix } of phases) {
        const result = await branchManager.commitChanges('test message', phase);
        expect(result.output).toContain(`${prefix}: test message`);
      }
    });
  });

  describe('rollbackToCheckpoint', () => {
    it('should rollback to specified checkpoint', async () => {
      mockExec('HEAD is now at abc123 checkpoint commit');

      const result = await branchManager.rollbackToCheckpoint(
        'checkpoint/red-phase-start'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain(
        'Rolled back to checkpoint: checkpoint/red-phase-start'
      );
    });

    it('should handle rollback failures', async () => {
      const { exec } = require('child_process');
      exec.mockImplementation(
        (
          command: string,
          options: Record<string, unknown>,
          callback: Function
        ) => {
          callback(new Error('Checkpoint not found'));
        }
      );

      const result =
        await branchManager.rollbackToCheckpoint('checkpoint/invalid');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Checkpoint not found');
    });
  });

  describe('acquireLock', () => {
    it('should acquire lock when branch is not locked', async () => {
      const result = await branchManager.acquireLock(
        'cycle-id',
        'feature-branch',
        'test-agent'
      );

      expect(result).toBe(true);
    });

    it('should reject lock when branch is already locked', async () => {
      // First lock should succeed
      const firstLock = await branchManager.acquireLock(
        'cycle-id',
        'feature-branch',
        'agent1'
      );
      expect(firstLock).toBe(true);

      // Second lock should fail
      const secondLock = await branchManager.acquireLock(
        'cycle-id',
        'feature-branch',
        'agent2'
      );
      expect(secondLock).toBe(false);
    });

    it('should allow lock after expiration', async () => {
      // Mock current time
      const originalDate = Date.now;
      Date.now = jest.fn(() => 1000000);

      const firstLock = await branchManager.acquireLock(
        'cycle-id',
        'feature-branch',
        'agent1'
      );
      expect(firstLock).toBe(true);

      // Move time forward past expiration (30 minutes + 1ms)
      Date.now = jest.fn(() => 1000000 + 30 * 60 * 1000 + 1);

      const secondLock = await branchManager.acquireLock(
        'cycle-id',
        'feature-branch',
        'agent2'
      );
      expect(secondLock).toBe(true);

      // Restore original Date.now
      Date.now = originalDate;
    });
  });

  describe('releaseLock', () => {
    it('should release lock successfully', async () => {
      await branchManager.acquireLock(
        'cycle-id',
        'feature-branch',
        'test-agent'
      );
      await branchManager.releaseLock('feature-branch');

      // Should be able to acquire lock again
      const result = await branchManager.acquireLock(
        'cycle-id',
        'feature-branch',
        'other-agent'
      );
      expect(result).toBe(true);
    });
  });

  describe('createMergeRequest', () => {
    it('should create PR with gh CLI', async () => {
      // Set up branch state first
      (branchManager as any).activeBranches.set('test-cycle-id', {
        branchName: 'feature/test-feature',
        cycleId: 'test-cycle-id',
      });

      mockExec('https://github.com/user/repo/pull/123');

      const { prisma } = require('@/lib/db');
      prisma.cycle.findUnique.mockResolvedValue({
        id: 'test-cycle-id',
        title: 'Test Feature',
      });

      const result = await branchManager.createMergeRequest('test-cycle-id');

      expect(result.success).toBe(true);
      expect(result.output).toContain('github.com');
    });

    it('should handle missing cycle', async () => {
      const result = await branchManager.createMergeRequest('invalid-cycle-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Branch state not found');
    });

    it('should handle gh CLI failures', async () => {
      const result = await branchManager.createMergeRequest('test-cycle-id-without-branch');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Branch state not found');
    });
  });

  describe('switchToBranch', () => {
    it('should switch to branch successfully', async () => {
      mockExec('Switched to branch feature-branch');

      const result = await branchManager.switchToBranch(
        'cycle-id',
        'feature-branch'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Switched to branch: feature-branch');
    });

    it('should respect branch locks', async () => {
      await branchManager.acquireLock(
        'cycle-id',
        'locked-branch',
        'test-agent'
      );

      const result = await branchManager.switchToBranch(
        'other-cycle-id',
        'locked-branch'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Branch is locked');
    });

    it('should handle git checkout failures', async () => {
      const { exec } = require('child_process');
      exec.mockImplementation(
        (
          command: string,
          options: Record<string, unknown>,
          callback: Function
        ) => {
          callback(new Error('Branch not found'));
        }
      );

      const result = await branchManager.switchToBranch(
        'cycle-id',
        'nonexistent-branch'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Branch not found');
    });
  });
});
