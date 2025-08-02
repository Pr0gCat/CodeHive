import { claudeCode } from '@/lib/claude-code';
import { tokenTracker } from '@/lib/claude-code/token-tracker';
import { logger } from '@/lib/logging/structured-logger';
import {
    canRunParallelAgent,
    checkRateLimit,
    checkTokenLimit,
    getProjectSettings,
    logTokenUsage,
} from './project-settings';
import { AgentExecutionOptions, AgentResult } from './types';

export interface ExecutorOptions extends AgentExecutionOptions {
  projectId?: string;
  agentType?: string;
}

export class AgentExecutor {
  constructor() {
    // No need to store path anymore, claudeCode handles it
  }

  async execute(
    prompt: string,
    options: ExecutorOptions = {}
  ): Promise<AgentResult> {
    const startTime = Date.now();
    let {
      timeout = 300000, // 5 minutes default
      maxRetries = 3,
    } = options;

    const {
      workingDirectory = process.cwd(),
      environment = {},
      projectId,
      agentType,
    } = options;

    // Get project settings and override defaults if projectId is provided
    if (projectId) {
      const settings = await getProjectSettings(projectId);
      timeout = settings.agentTimeout;
      maxRetries = settings.maxRetries;
    }

    // Estimate tokens for rate limiting (rough estimate)
    const estimatedTokens = Math.ceil(prompt.length / 4) * 2; // Input + estimated output

    // Check project-specific limits if projectId is provided
    if (projectId) {
      // Check rate limits
      const rateLimitCheck = await checkRateLimit(projectId);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: `Rate limit exceeded: ${rateLimitCheck.reason}`,
          executionTime: Date.now() - startTime,
          tokensUsed: 0,
        };
      }

      // Check token limits
      const tokenLimitCheck = await checkTokenLimit(projectId, estimatedTokens);
      if (!tokenLimitCheck.allowed) {
        return {
          success: false,
          error: `Token limit exceeded: ${tokenLimitCheck.reason}`,
          executionTime: Date.now() - startTime,
          tokensUsed: 0,
        };
      }

      // Check parallel agent limits
      const parallelCheck = await canRunParallelAgent(projectId);
      if (!parallelCheck.allowed) {
        return {
          success: false,
          error: `Parallel execution limit reached: ${parallelCheck.reason}`,
          executionTime: Date.now() - startTime,
          tokensUsed: 0,
        };
      }

      // Also check legacy token tracker for backward compatibility
      const canExecute = await tokenTracker.canExecute(
        projectId,
        estimatedTokens
      );
      if (!canExecute.allowed) {
        return {
          success: false,
          error: canExecute.reason,
          executionTime: Date.now() - startTime,
          tokensUsed: 0,
        };
      }
    }

    let attempt = 0;
    let lastError: Error | null = null;
    let totalTokensUsed = 0;

    while (attempt < maxRetries) {
      attempt++;

      try {
        // Log the prompt in development environment
        if (process.env.NODE_ENV === 'development') {
          logger.debug('🤖 [Claude Code Executor] Sending prompt', {
            module: 'agents',
            projectId,
            agentType,
            workingDirectory,
            attempt,
            promptLength: prompt.length,
          }, {
            promptPreview: prompt.length > 200
              ? prompt.substring(0, 200) + '...[truncated]'
              : prompt,
            fullPrompt: prompt.length <= 500 ? prompt : '[too long to display]',
          });
        }

        // Use enhanced file operations if we have a project context
        const result =
          projectId && workingDirectory !== process.cwd()
            ? await claudeCode.executeWithFileOperations(
                prompt,
                workingDirectory,
                {
                  timeout,
                  environment,
                }
              )
            : await claudeCode.execute(prompt, {
                workingDirectory,
                timeout,
                environment,
              });

        const executionTime = Date.now() - startTime;
        totalTokensUsed = result.tokensUsed || 0;

        // Log the result in development environment
        if (process.env.NODE_ENV === 'development') {
          logger.debug('[Claude Code Executor] Execution result', {
            module: 'agents',
            projectId,
            agentType,
            success: result.success,
            executionTime: `${executionTime}ms`,
            tokensUsed: totalTokensUsed,
            outputLength: result.output?.length || 0,
          }, {
            outputPreview: result.output && result.output.length > 300
              ? result.output.substring(0, 300) + '...[truncated]'
              : result.output,
            error: result.error || null,
          });
        }

        if (result.success) {
          // Track token usage with new system
          if (projectId && totalTokensUsed > 0) {
            const inputTokens = Math.ceil(prompt.length / 4);
            const outputTokens = totalTokensUsed - inputTokens;

            await logTokenUsage(
              projectId,
              agentType || 'unknown',
              inputTokens,
              outputTokens
            );

            // Also track with legacy system for backward compatibility
            await tokenTracker.trackUsage({
              projectId,
              agentType: agentType || 'unknown',
              tokensUsed: totalTokensUsed,
              timestamp: new Date(),
            });
          }

          return {
            success: true,
            output: result.output,
            executionTime,
            tokensUsed: totalTokensUsed,
          };
        } else {
          throw new Error(result.error || 'Execution failed');
        }
      } catch (error) {
        lastError = error as Error;

        // Log error in development environment
        if (process.env.NODE_ENV === 'development') {
          logger.error(
            `❌ [Claude Code Executor] Attempt ${attempt} failed`,
            {
              module: 'agents',
              projectId,
              agentType,
              attempt,
            },
            error as Error,
            {
              error: error instanceof Error ? error.message : String(error),
            }
          );
        }

        console.error(`Agent execution attempt ${attempt} failed:`, error);

        // If it's the last attempt, don't retry
        if (attempt >= maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        if (process.env.NODE_ENV === 'development') {
          logger.info(`⏳ [Claude Code Executor] Retrying in ${delay}ms...`, {
            module: 'agents',
            projectId,
            agentType,
            attempt,
            maxRetries,
            delay,
          });
        }
        await this.sleep(delay);
      }
    }

    const executionTime = Date.now() - startTime;

    // Track failed execution tokens (minimal usage)
    if (projectId) {
      const inputTokens = Math.ceil(prompt.length / 4);

      await logTokenUsage(
        projectId,
        agentType || 'unknown',
        inputTokens,
        0 // No output tokens for failed executions
      );

      // Also track with legacy system for backward compatibility
      await tokenTracker.trackUsage({
        projectId,
        agentType: agentType || 'unknown',
        tokensUsed: inputTokens,
        timestamp: new Date(),
      });
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error occurred',
      executionTime,
      tokensUsed: estimatedTokens / 2,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    return claudeCode.checkHealth();
  }

  // Get Claude Code version
  async getVersion(): Promise<string> {
    const result = await claudeCode.executeVersion();
    if (result.success) {
      return result.output || 'Unknown version';
    } else {
      throw new Error(`Failed to get Claude Code version: ${result.error}`);
    }
  }
}
