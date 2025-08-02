import { claudeCode } from '@/lib/claude-code';
import { prisma } from '@/lib/db';
import { projectLogger } from '@/lib/logging/project-logger';

/**
 * Handles execution of special Claude Code tasks like /init
 */
export class ClaudeCodeTaskExecutor {
  /**
   * Execute Claude Code /init command for a project
   */
  async executeInitCommand(projectId: string, storyId: string): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    tokensUsed: number;
  }> {
    try {
      // Get project details
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      projectLogger.info(projectId, 'claude-init', `Starting Claude Code /init for project: ${project.name}`, {
        projectPath: project.localPath,
        storyId,
      });

      // Update story status to IN_PROGRESS
      await prisma.kanbanCard.update({
        where: { id: storyId },
        data: {
          status: 'IN_PROGRESS',
          updatedAt: new Date(),
        },
      });

      // Execute Claude Code /init command
      const result = await claudeCode.execute('/init', {
        workingDirectory: project.localPath,
        timeout: 1800000, // 30 minutes for init command
        outputFormat: 'stream-json',
        projectId,
        onProgress: (event) => {
          // Log progress events
          if (event.type === 'assistant') {
            projectLogger.debug(projectId, 'claude-init-progress', 'Claude Code /init progress', {
              eventType: event.type,
              storyId,
            });
          }
        },
      });

      if (result.success) {
        projectLogger.info(projectId, 'claude-init', `Claude Code /init completed successfully`, {
          tokensUsed: result.tokensUsed,
          durationMs: result.durationMs,
          storyId,
        });

        // Update story status to DONE
        await prisma.kanbanCard.update({
          where: { id: storyId },
          data: {
            status: 'DONE',
            updatedAt: new Date(),
          },
        });

        // Log token usage
        if (result.tokensUsed && result.tokensUsed > 0) {
          await prisma.tokenUsage.create({
            data: {
              projectId,
              agentType: 'claude-init',
              inputTokens: result.tokenDetails?.inputTokens || Math.floor(result.tokensUsed * 0.7),
              outputTokens: result.tokenDetails?.outputTokens || Math.floor(result.tokensUsed * 0.3),
              timestamp: new Date(),
            },
          });
        }

        return {
          success: true,
          output: result.output,
          tokensUsed: result.tokensUsed || 0,
        };
      } else {
        projectLogger.error(projectId, 'claude-init', `Claude Code /init failed`, {
          error: result.error,
          storyId,
        });

        // Update story status back to TODO with error note
        await prisma.kanbanCard.update({
          where: { id: storyId },
          data: {
            status: 'TODO',
            description: `${await this.getOriginalDescription(storyId)}

❌ **Execution Failed**: ${result.error}

Please check the project logs for more details and retry when the issue is resolved.`,
            updatedAt: new Date(),
          },
        });

        return {
          success: false,
          error: result.error,
          tokensUsed: result.tokensUsed || 0,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      projectLogger.error(projectId, 'claude-init', `Claude Code /init execution error`, {
        error: errorMessage,
        storyId,
      });

      // Update story status with error
      try {
        await prisma.kanbanCard.update({
          where: { id: storyId },
          data: {
            status: 'TODO',
            description: `${await this.getOriginalDescription(storyId)}

❌ **Execution Error**: ${errorMessage}

Please check the project logs and configuration, then retry.`,
            updatedAt: new Date(),
          },
        });
      } catch (updateError) {
        console.error('Failed to update story with error status:', updateError);
      }

      return {
        success: false,
        error: errorMessage,
        tokensUsed: 0,
      };
    }
  }

  /**
   * Check if a story is a Claude Code /init task
   */
  isClaudeInitTask(story: { title: string; tags?: string[] | string }): boolean {
    const title = story.title.toLowerCase();
    const tags = typeof story.tags === 'string' ? JSON.parse(story.tags) : (story.tags || []);
    
    return (
      title.includes('claude code') && title.includes('/init') ||
      title.includes('initialize') && title.includes('claude') ||
      tags.includes('claude-code') && tags.includes('initialization')
    );
  }

  /**
   * Get the original description of a story (without error messages)
   */
  private async getOriginalDescription(storyId: string): Promise<string> {
    try {
      const story = await prisma.kanbanCard.findUnique({
        where: { id: storyId },
        select: { description: true },
      });

      if (!story?.description) {
        return '';
      }

      // Remove previous error messages
      const description = story.description;
      const errorIndex = description.indexOf('❌ **Execution');
      
      if (errorIndex > -1) {
        return description.substring(0, errorIndex).trim();
      }

      return description;
    } catch (error) {
      return '';
    }
  }
}

export const claudeCodeTaskExecutor = new ClaudeCodeTaskExecutor();