import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface GitCloneOptions {
  url: string;
  targetPath: string;
  branch?: string;
  depth?: number;
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
    const { url, targetPath, branch, depth } = options;
    
    // Validate inputs
    if (!url || !targetPath) {
      return {
        success: false,
        error: 'URL and target path are required',
      };
    }

    // Build git clone command
    const args = ['clone'];
    
    if (depth && depth > 0) {
      args.push('--depth', depth.toString());
    }
    
    if (branch) {
      args.push('--branch', branch);
    }
    
    args.push(url, targetPath);

    return this.executeGitCommand(args);
  }

  async pull(repoPath: string): Promise<GitCommandResult> {
    if (!existsSync(repoPath)) {
      return {
        success: false,
        error: `Repository path does not exist: ${repoPath}`,
      };
    }

    return this.executeGitCommand(['pull'], repoPath);
  }

  async status(repoPath: string): Promise<GitCommandResult> {
    if (!existsSync(repoPath)) {
      return {
        success: false,
        error: `Repository path does not exist: ${repoPath}`,
      };
    }

    return this.executeGitCommand(['status', '--porcelain'], repoPath);
  }

  async getCurrentBranch(repoPath: string): Promise<string | null> {
    const result = await this.executeGitCommand(['branch', '--show-current'], repoPath);
    return result.success ? result.output?.trim() || null : null;
  }

  async getRemoteUrl(repoPath: string): Promise<string | null> {
    const result = await this.executeGitCommand(['remote', 'get-url', 'origin'], repoPath);
    return result.success ? result.output?.trim() || null : null;
  }

  async isValidRepository(repoPath: string): Promise<boolean> {
    if (!existsSync(repoPath)) {
      return false;
    }

    const gitDir = join(repoPath, '.git');
    return existsSync(gitDir);
  }

  async validateGitUrl(url: string): Promise<{ valid: boolean; error?: string }> {
    // Basic URL validation
    const gitUrlPattern = /^(https?:\/\/|git@|ssh:\/\/|git:\/\/).+\.git$/i;
    const githubPattern = /^https:\/\/github\.com\/[\w-]+\/[\w-]+(\.git)?$/i;
    const gitlabPattern = /^https:\/\/gitlab\.com\/[\w-]+\/[\w-]+(\.git)?$/i;
    
    if (!url) {
      return { valid: false, error: 'URL is required' };
    }

    if (!gitUrlPattern.test(url) && !githubPattern.test(url) && !gitlabPattern.test(url)) {
      return { 
        valid: false, 
        error: 'Invalid Git URL format. Expected format: https://github.com/user/repo.git' 
      };
    }

    return { valid: true };
  }

  private executeGitCommand(
    args: string[], 
    cwd: string = process.cwd()
  ): Promise<GitCommandResult> {
    return new Promise((resolve) => {
      const child = spawn('git', args, {
        cwd,
        shell: false,
        windowsHide: true,
      });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('exit', (code) => {
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

      child.on('error', (error) => {
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