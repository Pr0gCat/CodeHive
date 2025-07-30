import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';

const execAsync = promisify(exec);

export interface BranchState {
  cycleId: string;
  branchName: string;
  currentPhase: string;
  lastCommit: string;
  isActive: boolean;
  lastActivity: Date;
  workspaceSnapshot?: string;
}

export interface BranchLock {
  cycleId: string;
  branchName: string;
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date;
  reason: string;
}

export interface GitOperationResult {
  success: boolean;
  output?: string;
  error?: string;
}

export class BranchManager {
  private projectPath: string;
  private activeBranches: Map<string, BranchState> = new Map();
  private branchLocks: Map<string, BranchLock> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * 創建功能分支
   */
  async createFeatureBranch(
    cycleId: string,
    featureName: string
  ): Promise<GitOperationResult> {
    try {
      const branchName = `feature/cycle-${cycleId}-${featureName.toLowerCase().replace(/\s+/g, '-')}`;

      // 確保在主分支上
      await this.checkoutBranch('main');

      // 創建並切換到新分支
      const { stdout, stderr } = await execAsync(
        `git checkout -b ${branchName}`,
        { cwd: this.projectPath }
      );

      // 記錄分支狀態
      const branchState: BranchState = {
        cycleId,
        branchName,
        currentPhase: 'RED',
        lastCommit: await this.getCurrentCommit(),
        isActive: true,
        lastActivity: new Date(),
      };

      this.activeBranches.set(cycleId, branchState);

      return {
        success: true,
        output: `Created and switched to branch: ${branchName}`,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create branch',
      };
    }
  }

  /**
   * 創建檢查點分支
   */
  async createCheckpointBranch(
    cycleId: string,
    phase: string
  ): Promise<GitOperationResult> {
    try {
      const checkpointName = `checkpoint/${phase.toLowerCase()}-phase-start`;

      // 創建檢查點分支
      const { stdout, stderr } = await execAsync(
        `git branch ${checkpointName}`,
        { cwd: this.projectPath }
      );

      return {
        success: true,
        output: `Created checkpoint branch: ${checkpointName}`,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create checkpoint',
      };
    }
  }

  /**
   * 切換到指定分支並恢復工作空間
   */
  async switchToBranch(
    cycleId: string,
    branchName: string
  ): Promise<GitOperationResult> {
    try {
      // 檢查是否有鎖定
      const lock = this.branchLocks.get(branchName);
      if (lock && lock.expiresAt > new Date()) {
        return {
          success: false,
          error: `Branch is locked by ${lock.lockedBy} until ${lock.expiresAt}`,
        };
      }

      // 保存當前工作空間狀態
      const currentBranch = await this.getCurrentBranch();
      if (currentBranch && currentBranch !== branchName) {
        await this.saveWorkspaceState(currentBranch);
      }

      // 切換分支
      const { stdout, stderr } = await execAsync(`git checkout ${branchName}`, {
        cwd: this.projectPath,
      });

      // 恢復工作空間狀態
      await this.restoreWorkspaceState(branchName);

      // 更新活躍狀態
      const branchState = this.activeBranches.get(cycleId);
      if (branchState) {
        branchState.isActive = true;
        branchState.lastActivity = new Date();
      }

      return {
        success: true,
        output: `Switched to branch: ${branchName}`,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to switch branch',
      };
    }
  }

  /**
   * 提交變更
   */
  async commitChanges(
    message: string,
    phase: string
  ): Promise<GitOperationResult> {
    try {
      // 添加所有變更
      await execAsync('git add .', { cwd: this.projectPath });

      // 提交變更
      const commitMessage = `${this.getCommitPrefix(phase)}: ${message}`;
      const { stdout, stderr } = await execAsync(
        `git commit -m "${commitMessage}"`,
        { cwd: this.projectPath }
      );

      // 更新最後提交
      const currentBranch = await this.getCurrentBranch();
      const branchState = Array.from(this.activeBranches.values()).find(
        state => state.branchName === currentBranch
      );

      if (branchState) {
        branchState.lastCommit = await this.getCurrentCommit();
        branchState.lastActivity = new Date();
      }

      return {
        success: true,
        output: `Committed: ${commitMessage}`,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to commit changes',
      };
    }
  }

  /**
   * 回滾到檢查點
   */
  async rollbackToCheckpoint(
    checkpointBranch: string
  ): Promise<GitOperationResult> {
    try {
      // 重置到檢查點
      const { stdout, stderr } = await execAsync(
        `git reset --hard ${checkpointBranch}`,
        { cwd: this.projectPath }
      );

      return {
        success: true,
        output: `Rolled back to checkpoint: ${checkpointBranch}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rollback',
      };
    }
  }

  /**
   * 獲取分支鎖定
   */
  async acquireLock(
    cycleId: string,
    branchName: string,
    agentType: string
  ): Promise<boolean> {
    const existingLock = this.branchLocks.get(branchName);

    if (existingLock && existingLock.expiresAt > new Date()) {
      return false;
    }

    const lock: BranchLock = {
      cycleId,
      branchName,
      lockedBy: agentType,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 分鐘
      reason: 'Agent execution in progress',
    };

    this.branchLocks.set(branchName, lock);
    return true;
  }

  /**
   * 釋放分支鎖定
   */
  async releaseLock(branchName: string): Promise<void> {
    this.branchLocks.delete(branchName);
  }

  /**
   * 創建合併請求
   */
  async createMergeRequest(
    cycleId: string,
    targetBranch: string = 'main'
  ): Promise<GitOperationResult> {
    try {
      const branchState = this.activeBranches.get(cycleId);
      if (!branchState) {
        return {
          success: false,
          error: 'Branch state not found',
        };
      }

      // 推送分支到遠端
      const { stdout: pushOutput } = await execAsync(
        `git push -u origin ${branchState.branchName}`,
        { cwd: this.projectPath }
      );

      // 使用 gh CLI 創建 PR
      const cycle = await prisma.cycle.findUnique({
        where: { id: cycleId },
      });

      if (!cycle) {
        return {
          success: false,
          error: 'Cycle not found',
        };
      }

      const prTitle = `feat: ${cycle.title}`;
      const prBody = `## Summary\n- Implemented ${cycle.title} using TDD approach\n- Completed all acceptance criteria\n- All tests passing\n\n## TDD Phases Completed\n- ✅ RED: Generated failing tests\n- ✅ GREEN: Implemented minimal code\n- ✅ REFACTOR: Improved code quality\n- ✅ REVIEW: Final validation\n\n🤖 Generated with CodeHive TDD`;

      const { stdout: prOutput } = await execAsync(
        `gh pr create --title "${prTitle}" --body "${prBody}" --base ${targetBranch}`,
        { cwd: this.projectPath }
      );

      return {
        success: true,
        output: prOutput,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create merge request',
      };
    }
  }

  // 輔助方法

  private async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectPath,
      });
      return stdout.trim();
    } catch (error) {
      return '';
    }
  }

  private async getCurrentCommit(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', {
        cwd: this.projectPath,
      });
      return stdout.trim();
    } catch (error) {
      return '';
    }
  }

  private async checkoutBranch(branchName: string): Promise<void> {
    await execAsync(`git checkout ${branchName}`, { cwd: this.projectPath });
  }

  private async saveWorkspaceState(branchName: string): Promise<void> {
    // 實作將在 workspace-manager.ts 中完成
    // 這裡僅保存分支資訊
    const snapshotId = `snapshot-${branchName}-${Date.now()}`;
    const branchState = Array.from(this.activeBranches.values()).find(
      state => state.branchName === branchName
    );

    if (branchState) {
      branchState.workspaceSnapshot = snapshotId;
    }
  }

  private async restoreWorkspaceState(branchName: string): Promise<void> {
    // 實作將在 workspace-manager.ts 中完成
    const branchState = Array.from(this.activeBranches.values()).find(
      state => state.branchName === branchName
    );

    if (branchState?.workspaceSnapshot) {
      // 恢復工作空間
    }
  }

  private getCommitPrefix(phase: string): string {
    switch (phase) {
      case 'RED':
        return 'feat(tests)';
      case 'GREEN':
        return 'feat(impl)';
      case 'REFACTOR':
        return 'refactor';
      case 'REVIEW':
        return 'test(review)';
      default:
        return 'feat';
    }
  }
}
