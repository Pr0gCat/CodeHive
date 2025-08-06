import { AgentExecutor } from '@/lib/claude-code/executor';
import { getConfig } from '@/lib/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

jest.mock('@/lib/config');
jest.mock('child_process');
jest.mock('util');

const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockExec = exec as jest.MockedFunction<typeof exec>;
const mockExecAsync = execAsync as jest.MockedFunction<typeof execAsync>;

describe('AgentExecutor', () => {
  let executor: AgentExecutor;
  const mockConfig = {
    claudeCodePath: '/usr/local/bin/claude',
    maxTokensPerProject: 10000,
    maxRequestsPerProject: 100,
    isProduction: false,
    databaseUrl: 'file:./test.db',
    enableUsageTracking: true,
    enableRealTimeUpdates: true,
    defaultProjectFramework: 'next',
    defaultProjectLanguage: 'typescript',
    defaultPackageManager: 'npm',
    defaultTestFramework: 'jest',
    defaultLintTool: 'eslint',
    defaultBuildTool: 'webpack',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfig.mockResolvedValue(mockConfig);
    executor = new AgentExecutor('test-project-id', '/test/project/path');
  });

  describe('constructor', () => {
    it('should initialize with project ID and path', () => {
      expect(executor).toBeInstanceOf(AgentExecutor);
    });
  });

  describe('executeCommand', () => {
    it('should execute Claude Code command successfully', async () => {
      const mockOutput = {
        stdout: 'Command executed successfully',
        stderr: '',
      };

      mockExecAsync.mockResolvedValueOnce(mockOutput);

      const result = await executor.executeCommand('analyze project structure');

      expect(result.success).toBe(true);
      expect(result.output).toBe('Command executed successfully');
      expect(result.error).toBeNull();
    });

    it('should handle command execution errors', async () => {
      const mockError = new Error('Command failed') as any;
      mockError.stdout = 'Partial output';
      mockError.stderr = 'Error details';

      mockExecAsync.mockRejectedValueOnce(mockError);

      const result = await executor.executeCommand('invalid command');

      expect(result.success).toBe(false);
      expect(result.output).toBe('Partial output');
      expect(result.error).toBe('Error details');
    });

    it('should respect timeout settings', async () => {
      const mockError = new Error('Command timed out') as any;
      mockError.code = 'TIMEOUT';
      mockError.stdout = '';
      mockError.stderr = 'Command timed out after 30000ms';

      mockExecAsync.mockRejectedValueOnce(mockError);

      const result = await executor.executeCommand('long running command');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should include working directory in command execution', async () => {
      const mockOutput = {
        stdout: 'Command executed in correct directory',
        stderr: '',
      };

      mockExecAsync.mockResolvedValueOnce(mockOutput);

      await executor.executeCommand('pwd');

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('claude'),
        expect.objectContaining({
          cwd: '/test/project/path',
          timeout: 30000,
        })
      );
    });
  });

  describe('validateCommand', () => {
    it('should validate safe commands', () => {
      const safeCommands = [
        'analyze project structure',
        'generate tests for user authentication',
        'refactor user service',
        'create API documentation',
        'review code quality',
      ];

      safeCommands.forEach(command => {
        expect(() => executor.validateCommand(command)).not.toThrow();
      });
    });

    it('should reject potentially dangerous commands', () => {
      const dangerousCommands = [
        'rm -rf /',
        'sudo rm -rf /usr',
        'format C:',
        'dd if=/dev/zero of=/dev/sda',
        'kill -9 -1',
      ];

      dangerousCommands.forEach(command => {
        expect(() => executor.validateCommand(command)).toThrow();
      });
    });

    it('should reject empty or invalid commands', () => {
      const invalidCommands = ['', ' ', '\n', '\t'];

      invalidCommands.forEach(command => {
        expect(() => executor.validateCommand(command)).toThrow();
      });
    });
  });

  describe('rateLimiting', () => {
    it('should track command execution for rate limiting', async () => {
      const mockOutput = {
        stdout: 'Command executed',
        stderr: '',
      };

      mockExecAsync.mockResolvedValue(mockOutput);

      // Execute multiple commands rapidly
      const promises = Array.from({ length: 5 }, (_, i) =>
        executor.executeCommand(`command ${i}`)
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle rate limit exceeded scenarios', async () => {
      // Mock a scenario where rate limit is exceeded
      const mockError = new Error('Rate limit exceeded') as any;
      mockError.code = 'RATE_LIMITED';
      mockError.stdout = '';
      mockError.stderr = 'Too many requests';

      mockExecAsync.mockRejectedValueOnce(mockError);

      const result = await executor.executeCommand('test command');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit');
    });
  });

  describe('error handling', () => {
    it('should handle non-zero exit codes', async () => {
      const mockError = new Error('Command failed') as any;
      mockError.code = 1;
      mockError.stdout = 'Some output';
      mockError.stderr = 'Error occurred';

      mockExecAsync.mockRejectedValueOnce(mockError);

      const result = await executor.executeCommand('failing command');

      expect(result.success).toBe(false);
      expect(result.output).toBe('Some output');
      expect(result.error).toBe('Error occurred');
    });

    it('should handle system-level errors', async () => {
      const mockError = new Error('ENOENT: no such file or directory') as any;
      mockError.code = 'ENOENT';
      mockError.stdout = '';
      mockError.stderr = 'Claude Code binary not found';

      mockExecAsync.mockRejectedValueOnce(mockError);

      const result = await executor.executeCommand('test command');

      expect(result.success).toBe(false);
      expect(result.error).toContain('no such file');
    });
  });

  describe('configuration integration', () => {
    it('should use configuration settings', async () => {
      mockGetConfig.mockResolvedValueOnce({
        ...mockConfig,
        claudeCodePath: '/custom/path/claude',
      });

      const customExecutor = new AgentExecutor('test-project', '/test/path');
      const mockOutput = {
        stdout: 'Custom path used',
        stderr: '',
      };

      mockExecAsync.mockResolvedValueOnce(mockOutput);

      await customExecutor.executeCommand('test command');

      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('/custom/path/claude'),
        expect.any(Object)
      );
    });

    it('should handle configuration loading errors', async () => {
      mockGetConfig.mockRejectedValueOnce(new Error('Config load failed'));

      const configErrorExecutor = new AgentExecutor('test-project', '/test/path');

      const result = await configErrorExecutor.executeCommand('test command');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration');
    });
  });

  describe('cleanup', () => {
    it('should provide cleanup method', () => {
      expect(typeof executor.cleanup).toBe('function');
      expect(() => executor.cleanup()).not.toThrow();
    });
  });
});
