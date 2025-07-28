import { BaseAgent, AgentCommand, AgentRegistry } from './base-agent';
import { AgentResult } from '../types';

export class GitOperationsAgent extends BaseAgent {
  getAgentType(): string {
    return 'git-operations';
  }

  getCapabilities(): string[] {
    return [
      'Git status and history analysis',
      'Branch management',
      'Commit operations',
      'Merge and rebase operations',
      'Remote repository operations',
      'Conflict resolution',
      'Git configuration',
      'Repository cleanup',
    ];
  }

  getSupportedCommands(): AgentCommand[] {
    return [
      {
        name: 'status',
        description: 'Check git status and repository health',
        examples: [
          'Check git status',
          'Show repository status and changes',
          'Analyze current git state',
        ],
      },
      {
        name: 'commit',
        description: 'Create commits with appropriate messages',
        parameters: [
          {
            name: 'message',
            type: 'string',
            required: false,
            description: 'Commit message (will be generated if not provided)',
          },
          {
            name: 'stage-all',
            type: 'boolean',
            required: false,
            description: 'Stage all changes before committing',
          },
        ],
        examples: [
          'Commit current changes with appropriate message',
          'Stage and commit all changes',
          'Create commit with message "Fix user authentication bug"',
        ],
      },
      {
        name: 'branch',
        description: 'Branch management operations',
        parameters: [
          {
            name: 'action',
            type: 'string',
            required: true,
            description: 'Branch action: create, switch, delete, list',
          },
          {
            name: 'name',
            type: 'string',
            required: false,
            description: 'Branch name for create/switch/delete actions',
          },
        ],
        examples: [
          'Create new branch feature/user-profile',
          'Switch to main branch',
          'List all branches',
          'Delete merged branches',
        ],
      },
      {
        name: 'sync',
        description: 'Synchronize with remote repository',
        examples: [
          'Pull latest changes from remote',
          'Push current branch to remote',
          'Sync with remote repository',
        ],
      },
      {
        name: 'history',
        description: 'Analyze git history and logs',
        examples: [
          'Show recent commit history',
          'Analyze git log for patterns',
          'Show changes since last release',
        ],
      },
      {
        name: 'cleanup',
        description: 'Clean up repository and optimize',
        examples: [
          'Clean up merged branches',
          'Remove untracked files',
          'Optimize repository',
        ],
      },
    ];
  }

  validateCommand(command: string): { valid: boolean; error?: string } {
    const normalizedCommand = command.toLowerCase().trim();
    
    // Check for supported command patterns
    const supportedPatterns = [
      /^(git\s+)?status/,
      /^(git\s+)?commit/,
      /^(git\s+)?branch/,
      /^(git\s+)?checkout/,
      /^(git\s+)?switch/,
      /^(git\s+)?merge/,
      /^(git\s+)?pull/,
      /^(git\s+)?push/,
      /^(git\s+)?sync/,
      /^(git\s+)?history/,
      /^(git\s+)?log/,
      /^(git\s+)?cleanup/,
      /^(git\s+)?reset/,
      /^(git\s+)?stash/,
      /^create.*branch/,
      /^switch.*branch/,
      /^delete.*branch/,
    ];

    const isSupported = supportedPatterns.some(pattern => pattern.test(normalizedCommand));
    
    if (!isSupported) {
      return {
        valid: false,
        error: `Unsupported command. Git Operations supports: status, commit, branch management, sync, history, and cleanup operations.`,
      };
    }

    // Check for potentially dangerous operations
    const dangerousPatterns = [
      /force.?push/,
      /reset.*hard/,
      /clean.*-fd/,
      /rebase.*-i/,
    ];

    const isDangerous = dangerousPatterns.some(pattern => pattern.test(normalizedCommand));
    if (isDangerous) {
      return {
        valid: false,
        error: 'Potentially destructive Git operations are not supported for safety. Use Git directly for advanced operations.',
      };
    }

    return { valid: true };
  }

  protected buildPrompt(command: string): string {
    const projectInfo = this.getProjectInfo();
    const commonInstructions = this.getCommonInstructions();
    const gitInfo = this.getGitRepositoryInfo();
    
    let specificInstructions = '';
    const normalizedCommand = command.toLowerCase();

    if (normalizedCommand.includes('status')) {
      specificInstructions = this.getStatusInstructions();
    } else if (normalizedCommand.includes('commit')) {
      specificInstructions = this.getCommitInstructions(command);
    } else if (normalizedCommand.includes('branch') || normalizedCommand.includes('checkout') || normalizedCommand.includes('switch')) {
      specificInstructions = this.getBranchInstructions(command);
    } else if (normalizedCommand.includes('sync') || normalizedCommand.includes('pull') || normalizedCommand.includes('push')) {
      specificInstructions = this.getSyncInstructions(command);
    } else if (normalizedCommand.includes('history') || normalizedCommand.includes('log')) {
      specificInstructions = this.getHistoryInstructions(command);
    } else if (normalizedCommand.includes('cleanup')) {
      specificInstructions = this.getCleanupInstructions();
    } else {
      specificInstructions = this.getGeneralGitInstructions(command);
    }

    return `
You are a Git Operations agent specialized in safe version control operations for ${this.context.framework || 'software'} projects.

${projectInfo}

${gitInfo}

TASK: ${command}

${specificInstructions}

GIT SAFETY RULES:
- Always check repository status before operations
- Never force push to main/master branches
- Create meaningful commit messages following conventions
- Backup important changes before destructive operations
- Verify branch context before operations
- Handle merge conflicts carefully
- Respect .gitignore and .gitattributes files

${commonInstructions}

Remember: Version control is critical - always prioritize safety and clarity over speed.
    `.trim();
  }

  private getGitRepositoryInfo(): string {
    return `
GIT REPOSITORY INFO:
- Repository URL: ${this.context.gitUrl || 'Local repository only'}
- Project Path: ${this.context.localPath}
- Expected Branch: main/master (will be detected)
- Conventional Commits: Recommended for this project
    `.trim();
  }

  private getStatusInstructions(): string {
    return `
GIT STATUS ANALYSIS:
1. Run 'git status' to check working directory state
2. Analyze staged and unstaged changes
3. Check for untracked files
4. Identify any conflicts or issues
5. Report branch information and remote status

STATUS REPORT SHOULD INCLUDE:
- Current branch and remote tracking status
- Staged changes (ready to commit)
- Unstaged changes (modified but not staged)
- Untracked files and directories
- Any merge conflicts or issues
- Recommendations for next steps

HEALTH CHECKS:
- Repository integrity
- Remote connectivity (if applicable)
- Branch synchronization status
- Potential issues or warnings
    `;
  }

  private getCommitInstructions(command: string): string {
    const commitMessageGuidelines = this.getCommitMessageGuidelines();

    return `
COMMIT OPERATION INSTRUCTIONS:
1. Check current repository status
2. Review staged changes (or stage changes if requested)
3. Generate appropriate commit message if not provided
4. Create commit with descriptive message
5. Verify commit was created successfully

${commitMessageGuidelines}

COMMIT PROCESS:
- Verify changes are ready for commit
- Ensure no conflicts or errors exist
- Stage appropriate files (avoid staging build artifacts)
- Create clear, descriptive commit message
- Execute commit operation
- Confirm commit success

PRE-COMMIT CHECKS:
- No build artifacts or temporary files
- All tests pass (if applicable)
- Code follows project conventions
- Sensitive information is not included
    `;
  }

  private getBranchInstructions(command: string): string {
    return `
BRANCH MANAGEMENT INSTRUCTIONS:
1. Analyze current branch context
2. Execute requested branch operation safely
3. Verify operation success
4. Update local tracking if needed
5. Provide status and next steps

BRANCH OPERATIONS:
- CREATE: Create new branch from current HEAD
- SWITCH: Change to existing branch safely
- LIST: Show all local and remote branches
- DELETE: Remove merged branches only

BRANCH SAFETY:
- Always check for uncommitted changes before switching
- Verify branch exists before switching
- Never delete branches with unmerged changes
- Use descriptive branch names (feature/, fix/, etc.)
- Follow project branching conventions

BRANCH NAMING CONVENTIONS:
- feature/description-of-feature
- fix/description-of-fix
- hotfix/critical-issue
- release/version-number
- experiment/experimental-feature
    `;
  }

  private getSyncInstructions(command: string): string {
    return `
REPOSITORY SYNCHRONIZATION:
1. Check remote repository connectivity
2. Analyze local vs remote branch status
3. Execute sync operation (pull/push) safely
4. Handle any conflicts that arise
5. Verify synchronization success

SYNC OPERATIONS:
- PULL: Fetch and merge remote changes
- PUSH: Upload local commits to remote
- FETCH: Download remote changes without merging

SYNC SAFETY:
- Always check for local changes before pull
- Resolve conflicts before pushing
- Never force push to shared branches
- Verify remote branch exists before push
- Handle authentication properly

CONFLICT RESOLUTION:
- Identify conflicted files
- Analyze conflict markers
- Provide resolution strategies
- Verify resolution completeness
- Complete merge process
    `;
  }

  private getHistoryInstructions(command: string): string {
    return `
GIT HISTORY ANALYSIS:
1. Retrieve relevant git log information
2. Analyze commit patterns and frequency
3. Identify recent changes and contributors
4. Highlight important commits or milestones
5. Provide insights and recommendations

HISTORY ANALYSIS AREAS:
- Recent commit activity (last 10-20 commits)
- Branch merge patterns
- Contributor activity
- File change frequency
- Commit message quality
- Release patterns

LOG FORMATTING:
- Use clear, readable format
- Include commit hashes, dates, authors
- Show file changes summary
- Highlight merge commits
- Group related commits

INSIGHTS TO PROVIDE:
- Development velocity
- Code stability patterns
- Hot spots (frequently changed files)
- Potential issues or technical debt
- Recommendations for improvement
    `;
  }

  private getCleanupInstructions(): string {
    return `
REPOSITORY CLEANUP INSTRUCTIONS:
1. Identify cleanup opportunities
2. Execute safe cleanup operations
3. Remove unnecessary files and branches
4. Optimize repository performance
5. Report cleanup results

CLEANUP OPERATIONS:
- Remove merged feature branches
- Clean untracked files (carefully)
- Prune remote tracking branches
- Optimize repository database
- Update .gitignore if needed

CLEANUP SAFETY:
- Never remove branches with unmerged changes
- Backup important untracked files before removal
- Verify remote branch status before pruning
- Ask for confirmation on destructive operations
- Preserve important development artifacts

CLEANUP TARGETS:
- Merged feature branches
- Stale remote tracking branches
- Build artifacts and temp files
- Outdated cache files
- Unnecessary development files
    `;
  }

  private getGeneralGitInstructions(command: string): string {
    return `
GENERAL GIT OPERATION:
Based on the specific command, determine the appropriate Git action:
1. Analyze what Git operation is needed
2. Check repository state and safety
3. Execute the operation with proper validation
4. Handle any errors or conflicts
5. Provide clear status and next steps

Always prioritize repository safety and data integrity.
    `;
  }

  private getCommitMessageGuidelines(): string {
    return `
COMMIT MESSAGE GUIDELINES (Conventional Commits):
- feat: A new feature for the user
- fix: A bug fix for the user
- docs: Documentation changes
- style: Code style changes (formatting, etc.)
- refactor: Code refactoring without functionality changes
- test: Adding or updating tests
- chore: Maintenance tasks, dependency updates

FORMAT: type(scope): description
EXAMPLES:
- feat(auth): add OAuth2 authentication
- fix(api): resolve user creation validation error
- docs(readme): update installation instructions
- refactor(utils): simplify date formatting functions

MESSAGE STRUCTURE:
- First line: Brief summary (50 chars or less)
- Blank line
- Detailed explanation (if needed)
- Reference issues: "Fixes #123" or "Closes #456"
    `;
  }

  protected async generateArtifacts(command: string, result: AgentResult): Promise<Record<string, unknown>> {
    return {
      gitOperation: this.determineGitOperation(command),
      repositoryUrl: this.context.gitUrl,
      projectPath: this.context.localPath,
      operationTimestamp: new Date().toISOString(),
      commandExecuted: command,
    };
  }

  private determineGitOperation(command: string): string {
    const normalizedCommand = command.toLowerCase();
    
    if (normalizedCommand.includes('status')) return 'status-check';
    if (normalizedCommand.includes('commit')) return 'commit-operation';
    if (normalizedCommand.includes('branch') || normalizedCommand.includes('checkout') || normalizedCommand.includes('switch')) return 'branch-management';
    if (normalizedCommand.includes('sync') || normalizedCommand.includes('pull') || normalizedCommand.includes('push')) return 'synchronization';
    if (normalizedCommand.includes('history') || normalizedCommand.includes('log')) return 'history-analysis';
    if (normalizedCommand.includes('cleanup')) return 'repository-cleanup';
    if (normalizedCommand.includes('merge')) return 'merge-operation';
    if (normalizedCommand.includes('stash')) return 'stash-operation';
    
    return 'general-git-operation';
  }
}

// Register the agent
AgentRegistry.register('git-operations', GitOperationsAgent);