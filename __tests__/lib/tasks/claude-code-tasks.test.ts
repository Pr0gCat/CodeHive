import { ClaudeCodeTaskExecutor } from '@/lib/tasks/claude-code-tasks';
import { claudeCode } from '@/lib/claude-code';
import { prisma } from '@/lib/db';
import { projectLogger } from '@/lib/logging/project-logger';

jest.mock('@/lib/claude-code', () => ({
  claudeCode: {
    execute: jest.fn(),
  },
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
    },
    kanbanCard: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    tokenUsage: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logging/project-logger', () => ({
  projectLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

const mockClaudeCode = claudeCode as jest.Mocked<typeof claudeCode>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockLogger = projectLogger as jest.Mocked<typeof projectLogger>;

describe('ClaudeCodeTaskExecutor', () => {
  let executor: ClaudeCodeTaskExecutor;

  const mockProject = {
    id: 'test-project-id',
    name: 'Test Project',
    localPath: '/path/to/project',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStory = {
    id: 'test-story-id',
    title: 'Initialize Claude Code for project',
    description: 'Set up Claude Code configuration',
    status: 'TODO',
    tags: '["claude-code", "initialization"]',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new ClaudeCodeTaskExecutor();
  });

  describe('executeInitCommand', () => {
    beforeEach(() => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.kanbanCard.update.mockResolvedValue({ ...mockStory, status: 'IN_PROGRESS' });
    });

    it('should successfully execute Claude Code /init command', async () => {
      const mockResult = {
        success: true,
        output: 'Claude Code initialized successfully',
        tokensUsed: 1500,
        durationMs: 30000,
        tokenDetails: {
          inputTokens: 1000,
          outputTokens: 500,
        },
      };
      mockClaudeCode.execute.mockResolvedValue(mockResult);

      const result = await executor.executeInitCommand('test-project-id', 'test-story-id');

      expect(result).toEqual({
        success: true,
        output: 'Claude Code initialized successfully',
        tokensUsed: 1500,
      });

      // Verify project was found
      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-project-id' },
      });

      // Verify story status was updated to IN_PROGRESS
      expect(mockPrisma.kanbanCard.update).toHaveBeenCalledWith({
        where: { id: 'test-story-id' },
        data: {
          status: 'IN_PROGRESS',
          updatedAt: expect.any(Date),
        },
      });

      // Verify Claude Code was executed with correct parameters
      expect(mockClaudeCode.execute).toHaveBeenCalledWith('/init', {
        workingDirectory: '/path/to/project',
        timeout: 1800000,
        outputFormat: 'stream-json',
        projectId: 'test-project-id',
        onProgress: expect.any(Function),
      });

      // Verify story status was updated to DONE
      expect(mockPrisma.kanbanCard.update).toHaveBeenCalledWith({
        where: { id: 'test-story-id' },
        data: {
          status: 'DONE',
          updatedAt: expect.any(Date),
        },
      });

      // Verify token usage was logged
      expect(mockPrisma.tokenUsage.create).toHaveBeenCalledWith({
        data: {
          projectId: 'test-project-id',
          agentType: 'claude-init',
          inputTokens: 1000,
          outputTokens: 500,
          timestamp: expect.any(Date),
        },
      });

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'test-project-id',
        'claude-init',
        'Starting Claude Code /init for project: Test Project',
        {
          projectPath: '/path/to/project',
          storyId: 'test-story-id',
        }
      );
    });

    it('should handle Claude Code execution failure', async () => {
      const mockResult = {
        success: false,
        error: 'Configuration file not found',
        tokensUsed: 200,
      };
      mockClaudeCode.execute.mockResolvedValue(mockResult);
      mockPrisma.kanbanCard.findUnique.mockResolvedValue({
        ...mockStory,
        description: 'Original description',
      });

      const result = await executor.executeInitCommand('test-project-id', 'test-story-id');

      expect(result).toEqual({
        success: false,
        error: 'Configuration file not found',
        tokensUsed: 200,
      });

      // Verify story status was updated to TODO with error message
      expect(mockPrisma.kanbanCard.update).toHaveBeenCalledWith({
        where: { id: 'test-story-id' },
        data: {
          status: 'TODO',
          description: expect.stringContaining('❌ **Execution Failed**: Configuration file not found'),
          updatedAt: expect.any(Date),
        },
      });

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'test-project-id',
        'claude-init',
        'Claude Code /init failed',
        {
          error: 'Configuration file not found',
          storyId: 'test-story-id',
        }
      );
    });

    it('should handle project not found error', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await executor.executeInitCommand('invalid-project-id', 'test-story-id');

      expect(result).toEqual({
        success: false,
        error: 'Project not found: invalid-project-id',
        tokensUsed: 0,
      });

      expect(mockClaudeCode.execute).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.project.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const result = await executor.executeInitCommand('test-project-id', 'test-story-id');

      expect(result).toEqual({
        success: false,
        error: 'Database connection failed',
        tokensUsed: 0,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'test-project-id',
        'claude-init',
        'Claude Code /init execution error',
        {
          error: 'Database connection failed',
          storyId: 'test-story-id',
        }
      );
    });

    it('should calculate token split when tokenDetails not provided', async () => {
      const mockResult = {
        success: true,
        output: 'Success',
        tokensUsed: 1000,
        // No tokenDetails provided
      };
      mockClaudeCode.execute.mockResolvedValue(mockResult);

      await executor.executeInitCommand('test-project-id', 'test-story-id');

      expect(mockPrisma.tokenUsage.create).toHaveBeenCalledWith({
        data: {
          projectId: 'test-project-id',
          agentType: 'claude-init',
          inputTokens: 700, // 70% of 1000
          outputTokens: 300, // 30% of 1000
          timestamp: expect.any(Date),
        },
      });
    });

    it('should not log token usage when no tokens used', async () => {
      const mockResult = {
        success: true,
        output: 'Success',
        tokensUsed: 0,
      };
      mockClaudeCode.execute.mockResolvedValue(mockResult);

      await executor.executeInitCommand('test-project-id', 'test-story-id');

      expect(mockPrisma.tokenUsage.create).not.toHaveBeenCalled();
    });

    it('should handle progress events correctly', async () => {
      const mockResult = {
        success: true,
        output: 'Success',
        tokensUsed: 1000,
      };
      mockClaudeCode.execute.mockResolvedValue(mockResult);

      await executor.executeInitCommand('test-project-id', 'test-story-id');

      // Get the onProgress callback that was passed to claudeCode.execute
      const executeCall = mockClaudeCode.execute.mock.calls[0];
      const options = executeCall[1];
      const onProgress = options.onProgress;

      // Test the progress callback
      onProgress({ type: 'assistant', content: 'Progress update' });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'test-project-id',
        'claude-init-progress',
        'Claude Code /init progress',
        {
          eventType: 'assistant',
          storyId: 'test-story-id',
        }
      );
    });

    it('should handle story update errors during error handling', async () => {
      mockPrisma.project.findUnique.mockRejectedValue(new Error('Database error'));
      mockPrisma.kanbanCard.update.mockRejectedValue(new Error('Update failed'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await executor.executeInitCommand('test-project-id', 'test-story-id');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to update story with error status:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('isClaudeInitTask', () => {
    it('should identify Claude Code /init tasks by title', () => {
      const stories = [
        { title: 'Initialize Claude Code /init for project' },
        { title: 'Set up Claude Code /init configuration' },
        { title: 'Initialize Claude project setup' },
        { title: 'CLAUDE CODE /INIT setup' }, // case insensitive
      ];

      stories.forEach(story => {
        expect(executor.isClaudeInitTask(story)).toBe(true);
      });
    });

    it('should identify Claude Code /init tasks by tags', () => {
      const story = {
        title: 'Project setup',
        tags: ['claude-code', 'initialization'],
      };

      expect(executor.isClaudeInitTask(story)).toBe(true);
    });

    it('should identify Claude Code /init tasks by tags from JSON string', () => {
      const story = {
        title: 'Project setup',
        tags: '["claude-code", "initialization"]',
      };

      expect(executor.isClaudeInitTask(story)).toBe(true);
    });

    it('should not identify regular tasks as Claude Code /init tasks', () => {
      const stories = [
        { title: 'Implement user authentication' },
        { title: 'Create dashboard UI' },
        { title: 'Initialize database schema' },
        { title: 'Set up code review process' },
        { title: 'Claude documentation', tags: ['docs'] },
      ];

      stories.forEach(story => {
        expect(executor.isClaudeInitTask(story)).toBe(false);
      });
    });

    it('should handle missing tags gracefully', () => {
      const story = { title: 'Regular task' };
      expect(executor.isClaudeInitTask(story)).toBe(false);
    });

    it('should handle invalid JSON tags gracefully', () => {
      const story = {
        title: 'Regular task',
        tags: 'invalid-json',
      };

      expect(() => executor.isClaudeInitTask(story)).toThrow();
    });
  });

  describe('getOriginalDescription', () => {
    it('should return original description without error messages', async () => {
      const storyWithError = {
        description: `Original description here

❌ **Execution Failed**: Some error message

Please check the project logs for more details.`,
      };
      mockPrisma.kanbanCard.findUnique.mockResolvedValue(storyWithError);

      const result = await (executor as any).getOriginalDescription('test-story-id');

      expect(result).toBe('Original description here');
    });

    it('should return full description when no error messages present', async () => {
      const story = {
        description: 'Clean description without any error messages',
      };
      mockPrisma.kanbanCard.findUnique.mockResolvedValue(story);

      const result = await (executor as any).getOriginalDescription('test-story-id');

      expect(result).toBe('Clean description without any error messages');
    });

    it('should return empty string when story not found', async () => {
      mockPrisma.kanbanCard.findUnique.mockResolvedValue(null);

      const result = await (executor as any).getOriginalDescription('invalid-story-id');

      expect(result).toBe('');
    });

    it('should return empty string when description is null', async () => {
      const story = { description: null };
      mockPrisma.kanbanCard.findUnique.mockResolvedValue(story);

      const result = await (executor as any).getOriginalDescription('test-story-id');

      expect(result).toBe('');
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.kanbanCard.findUnique.mockRejectedValue(new Error('Database error'));

      const result = await (executor as any).getOriginalDescription('test-story-id');

      expect(result).toBe('');
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      const { claudeCodeTaskExecutor } = require('@/lib/tasks/claude-code-tasks');
      expect(claudeCodeTaskExecutor).toBeInstanceOf(ClaudeCodeTaskExecutor);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete successful flow with all logging', async () => {
      const mockResult = {
        success: true,
        output: 'Full initialization complete',
        tokensUsed: 2500,
        durationMs: 45000,
        tokenDetails: {
          inputTokens: 1800,
          outputTokens: 700,
        },
      };
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockClaudeCode.execute.mockResolvedValue(mockResult);

      const result = await executor.executeInitCommand('test-project-id', 'test-story-id');

      expect(result.success).toBe(true);
      expect(result.tokensUsed).toBe(2500);

      // Verify all logging calls were made
      expect(mockLogger.info).toHaveBeenCalledTimes(2); // Start and completion logs
      expect(mockLogger.error).not.toHaveBeenCalled();

      // Verify story was updated twice (IN_PROGRESS -> DONE)
      expect(mockPrisma.kanbanCard.update).toHaveBeenCalledTimes(2);
    });

    it('should handle complete failure flow with error recovery', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockClaudeCode.execute.mockResolvedValue({
        success: false,
        error: 'Critical initialization failure',
        tokensUsed: 100,
      });
      mockPrisma.kanbanCard.findUnique.mockResolvedValue({
        description: 'Original task description',
      });

      const result = await executor.executeInitCommand('test-project-id', 'test-story-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Critical initialization failure');

      // Verify error logging and recovery
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockPrisma.kanbanCard.update).toHaveBeenCalledWith({
        where: { id: 'test-story-id' },
        data: {
          status: 'TODO',
          description: expect.stringContaining('❌ **Execution Failed**'),
          updatedAt: expect.any(Date),
        },
      });
    });
  });
});