import { taskManager } from '@/lib/tasks/task-manager';
import { validatePath } from '@/lib/utils/security';
import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface GitCloneOptions {
  url: string;
  targetPath: string;
  branch?: string;
  depth?: number;
  taskId?: string; // For progress tracking
  phaseId?: string; // For progress tracking
}

export interface GitCommandResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

export class GitClient {
  private reposDir: string;

  constructor() {
    // Ensure repos directory exists
    this.reposDir = join(process.cwd(), 'repos');
    if (!existsSync(this.reposDir)) {
      mkdirSync(this.reposDir, { recursive: true });
    }
  }

  async clone(options: GitCloneOptions): Promise<GitCommandResult> {
    const { url, targetPath, branch, depth, taskId, phaseId } = options;

    // Validate inputs
    if (!url || !targetPath) {
      return {
        success: false,
        error: 'URL and target path are required',
      };
    }
    
    // Validate Git URL
    const urlValidation = await this.validateGitUrl(url);
    if (!urlValidation.valid) {
      return {
        success: false,
        error: urlValidation.error,
      };
    }
    
    // Validate target path
    const safePath = validatePath(this.reposDir, targetPath);
    if (!safePath) {
      return {
        success: false,
        error: 'Invalid target path',
      };
    }

    // Build git clone command
    const args = ['clone', '--progress'];

    if (depth && depth > 0) {
      args.push('--depth', depth.toString());
    }

    if (branch) {
      args.push('--branch', branch);
    }

    args.push(url, safePath);

    // Execute with real progress tracking
    return this.executeGitCommandWithProgress(args, undefined, taskId, phaseId);
  }

  async pull(repoPath: string): Promise<GitCommandResult> {
    // Validate repository path
    const safePath = validatePath(this.reposDir, repoPath);
    if (!safePath || !existsSync(safePath)) {
      return {
        success: false,
        error: `Repository path does not exist or is invalid`,
      };
    }

    return this.executeGitCommand(['pull'], safePath);
  }

  async status(repoPath: string): Promise<GitCommandResult> {
    // Validate repository path
    const safePath = validatePath(this.reposDir, repoPath);
    if (!safePath || !existsSync(safePath)) {
      return {
        success: false,
        error: `Repository path does not exist or is invalid`,
      };
    }

    return this.executeGitCommand(['status', '--porcelain'], safePath);
  }

  async getCurrentBranch(repoPath: string): Promise<string | null> {
    // Validate repository path
    const safePath = validatePath(this.reposDir, repoPath);
    if (!safePath) {
      return null;
    }
    
    const result = await this.executeGitCommand(
      ['branch', '--show-current'],
      safePath
    );
    return result.success ? result.output?.trim() || null : null;
  }

  async getRemoteUrl(repoPath: string): Promise<string | null> {
    // Validate repository path
    const safePath = validatePath(this.reposDir, repoPath);
    if (!safePath) {
      return null;
    }
    
    const result = await this.executeGitCommand(
      ['remote', 'get-url', 'origin'],
      safePath
    );
    return result.success ? result.output?.trim() || null : null;
  }

  async init(repoPath: string): Promise<GitCommandResult> {
    // Validate repository path
    const safePath = validatePath(this.reposDir, repoPath);
    if (!safePath) {
      return {
        success: false,
        error: 'Invalid repository path',
      };
    }
    
    // Ensure directory exists
    if (!existsSync(safePath)) {
      mkdirSync(safePath, { recursive: true });
    }

    return this.executeGitCommand(['init'], safePath);
  }

  async initialCommit(
    repoPath: string,
    message: string = 'Initial commit'
  ): Promise<GitCommandResult> {
    // Validate repository path
    const safePath = validatePath(this.reposDir, repoPath);
    if (!safePath) {
      return {
        success: false,
        error: 'Invalid repository path',
      };
    }
    
    // Add all files
    const addResult = await this.executeGitCommand(['add', '.'], safePath);
    if (!addResult.success) {
      return addResult;
    }

    // Create initial commit
    return this.executeGitCommand(['commit', '-m', message], safePath);
  }

  async isValidRepository(repoPath: string): Promise<boolean> {
    // Validate repository path
    const safePath = validatePath(this.reposDir, repoPath);
    if (!safePath || !existsSync(safePath)) {
      return false;
    }

    const gitDir = join(safePath, '.git');
    return existsSync(gitDir);
  }

  async validateGitUrl(
    url: string
  ): Promise<{ valid: boolean; error?: string }> {
    // Basic URL validation
    const gitUrlPattern = /^(https?:\/\/|git@|ssh:\/\/|git:\/\/).+\.git$/i;
    const githubPattern = /^https:\/\/github\.com\/[\w-]+\/[\w-]+(\.git)?$/i;
    const gitlabPattern = /^https:\/\/gitlab\.com\/[\w-]+\/[\w-]+(\.git)?$/i;

    if (!url) {
      return { valid: false, error: 'URL is required' };
    }

    if (
      !gitUrlPattern.test(url) &&
      !githubPattern.test(url) &&
      !gitlabPattern.test(url)
    ) {
      return {
        valid: false,
        error:
          'Invalid Git URL format. Expected format: https://github.com/user/repo.git',
      };
    }

    return { valid: true };
  }

  private executeGitCommand(
    args: string[],
    cwd: string = process.cwd()
  ): Promise<GitCommandResult> {
    return new Promise(resolve => {
      const child = spawn('git', args, {
        cwd,
        shell: false,
        windowsHide: true,
      });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.stderr?.on('data', data => {
        errorOutput += data.toString();
      });

      child.on('exit', code => {
        if (code === 0) {
          resolve({
            success: true,
            output,
            exitCode: code,
          });
        } else {
          resolve({
            success: false,
            output,
            error: errorOutput || `Git command failed with exit code ${code}`,
            exitCode: code ?? undefined,
          });
        }
      });

      child.on('error', error => {
        resolve({
          success: false,
          error: error.message,
        });
      });
    });
  }

  /**
   * Execute Git command with real progress tracking
   */
  private executeGitCommandWithProgress(
    args: string[],
    cwd: string = process.cwd(),
    taskId?: string,
    phaseId?: string
  ): Promise<GitCommandResult> {
    return new Promise(resolve => {
      const child = spawn('git', args, {
        cwd,
        shell: false,
        windowsHide: true,
      });

      let output = '';
      let errorOutput = '';
      let lastProgress = 0;

      const updateProgress = async (
        progress: number,
        message: string,
        details?: Record<string, unknown>
      ) => {
        if (taskId && phaseId && progress !== lastProgress) {
          lastProgress = progress;
          await taskManager.updatePhaseProgress(taskId, phaseId, progress, {
            type: 'PHASE_PROGRESS',
            message,
            details,
          });
        }
      };

      child.stdout?.on('data', data => {
        output += data.toString();
      });

      child.stderr?.on('data', async data => {
        const text = data.toString();
        errorOutput += text;

        // Parse Git progress output
        // Git clone progress format: "Receiving objects: 50% (1234/2468)"
        // Git clone progress format: "Resolving deltas: 75% (123/164)"
        const progressMatch = text.match(
          /(Receiving objects|Resolving deltas|Checking out files):\s*(\d+)%/
        );
        if (progressMatch) {
          const [, stage, percent] = progressMatch;
          const progress = parseInt(percent, 10);

          let adjustedProgress: number;
          let message: string;

          if (stage === 'Receiving objects') {
            // Receiving is 0-70% of the total process
            adjustedProgress = Math.min(progress * 0.7, 70);
            message = `下載儲存庫內容: ${progress}%`;
          } else if (stage === 'Resolving deltas') {
            // Resolving is 70-90% of the total process
            adjustedProgress = 70 + Math.min(progress * 0.2, 20);
            message = `解析變更紀錄: ${progress}%`;
          } else if (stage === 'Checking out files') {
            // Checkout is 90-100% of the total process
            adjustedProgress = 90 + Math.min(progress * 0.1, 10);
            message = `檢出檔案: ${progress}%`;
          } else {
            adjustedProgress = progress;
            message = `${stage}: ${progress}%`;
          }

          await updateProgress(adjustedProgress, message, {
            stage,
            rawProgress: progress,
            rawText: text.trim(),
          });
        }

        // Check for other Git status messages
        if (text.includes('Cloning into')) {
          await updateProgress(5, '開始克隆儲存庫...', { status: 'starting' });
        } else if (text.includes('remote: Enumerating objects')) {
          await updateProgress(10, '列舉遠程物件...', {
            status: 'enumerating',
          });
        } else if (text.includes('remote: Counting objects')) {
          await updateProgress(15, '計算物件數量...', { status: 'counting' });
        } else if (text.includes('remote: Compressing objects')) {
          await updateProgress(20, '壓縮物件...', { status: 'compressing' });
        }
      });

      child.on('exit', async code => {
        if (code === 0) {
          // Ensure 100% progress on success
          await updateProgress(100, '克隆完成', { status: 'completed' });

          resolve({
            success: true,
            output,
            exitCode: code,
          });
        } else {
          resolve({
            success: false,
            output,
            error: errorOutput || `Git command failed with exit code ${code}`,
            exitCode: code ?? undefined,
          });
        }
      });

      child.on('error', error => {
        resolve({
          success: false,
          error: error.message,
        });
      });
    });
  }

  getReposDirectory(): string {
    return this.reposDir;
  }

  generateProjectPath(projectName: string): string {
    // Sanitize project name for filesystem
    const sanitized = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');

    return join(this.reposDir, sanitized);
  }
}

export const gitClient = new GitClient();
