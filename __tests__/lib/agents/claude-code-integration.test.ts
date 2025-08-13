import { ClaudeCodeIntegration, ExecutionStatus } from '../../../lib/agents/claude-code-integration';
import { Instruction } from '../../../lib/agents/project-agent';

describe('ClaudeCodeIntegration', () => {
  let integration: ClaudeCodeIntegration;
  let mockInstruction: Instruction;

  beforeEach(() => {
    integration = new ClaudeCodeIntegration({
      workingDirectory: '/tmp/test',
      timeout: 5000
    });

    mockInstruction = {
      id: 'test-instruction-1',
      taskId: 'test-task-1',
      expectedOutcome: 'Create a simple Hello World program',
      criteria: 'Program should output "Hello World" when executed',
      directive: 'Write a simple program that prints Hello World',
      status: 'pending'
    };
  });

  afterEach(() => {
    integration.cleanup();
  });

  describe('Configuration and Status', () => {
    it('should initialize with correct status', () => {
      expect(integration.getStatus()).toBe(ExecutionStatus.IDLE);
      expect(integration.isRunning()).toBe(false);
    });

    it('should accept custom configuration', () => {
      const customIntegration = new ClaudeCodeIntegration({
        workingDirectory: '/custom/path',
        timeout: 10000,
        maxTokens: 2000,
        apiKey: 'test-key'
      });

      expect(customIntegration.getStatus()).toBe(ExecutionStatus.IDLE);
      customIntegration.cleanup();
    });
  });

  describe('Prompt Preparation', () => {
    it('should prepare comprehensive prompts', () => {
      // 測試私有方法的功能（透過模擬執行）
      const promptTest = (integration as any).preparePrompt(mockInstruction);
      
      expect(typeof promptTest).toBe('string');
      expect(promptTest).toContain('CodeHive 專案代理任務執行');
      expect(promptTest).toContain(mockInstruction.directive);
      expect(promptTest).toContain(mockInstruction.expectedOutcome);
      expect(promptTest).toContain(mockInstruction.criteria);
      expect(promptTest).toContain('EXECUTION_STATUS');
    });
  });

  describe('Result Processing', () => {
    it('should extract structured execution status correctly', () => {
      const mockOutput = `
Task execution completed successfully.

Files created:
- hello.js

EXECUTION_STATUS: SUCCESS
CRITERIA_MET: YES
SUMMARY: Successfully created Hello World program
`;

      const statusInfo = (integration as any).extractExecutionStatus(mockOutput);
      
      expect(statusInfo.status).toBe('SUCCESS');
      expect(statusInfo.criteriaMet).toBe('YES');
      expect(statusInfo.summary).toContain('Successfully created');
    });

    it('should extract failure status correctly', () => {
      const mockOutput = `
Task execution encountered errors.

Error: File permission denied

EXECUTION_STATUS: FAILURE
CRITERIA_MET: NO
SUMMARY: Unable to create file due to permission issues
`;

      const statusInfo = (integration as any).extractExecutionStatus(mockOutput);
      
      expect(statusInfo.status).toBe('FAILURE');
      expect(statusInfo.criteriaMet).toBe('NO');
      expect(statusInfo.summary).toContain('permission issues');
    });

    it('should check success based on structured output', () => {
      const successOutput = `
EXECUTION_STATUS: SUCCESS
CRITERIA_MET: YES
SUMMARY: Task completed
`;

      const failureOutput = `
EXECUTION_STATUS: FAILURE
CRITERIA_MET: NO
SUMMARY: Task failed
`;

      const statusInfoSuccess = (integration as any).extractExecutionStatus(successOutput);
      const statusInfoFailure = (integration as any).extractExecutionStatus(failureOutput);
      
      const successResult = (integration as any).checkSuccess(
        successOutput,
        mockInstruction,
        statusInfoSuccess
      );
      
      const failureResult = (integration as any).checkSuccess(
        failureOutput,
        mockInstruction,
        statusInfoFailure
      );

      expect(successResult).toBe(true);
      expect(failureResult).toBe(false);
    });

    it('should fallback to heuristic success detection', () => {
      const heuristicOutput = `
任務已成功完成！
建立了 Hello World 程式
程式可以正常輸出 "Hello World"
`;

      const emptyStatusInfo = {};
      
      const result = (integration as any).checkSuccess(
        heuristicOutput,
        mockInstruction,
        emptyStatusInfo
      );

      expect(result).toBe(true);
    });

    it('should extract token usage information', () => {
      const outputWithTokens = `
Task completed.
Token usage: input=150, output=200, total=350
`;

      const tokenUsage = (integration as any).extractTokenUsage(outputWithTokens);
      
      expect(tokenUsage).toEqual({
        input: 150,
        output: 200,
        total: 350
      });
    });

    it('should extract error messages appropriately', () => {
      const errorOutput = `
Task failed with error.
Error: Invalid syntax in file
Process exited with code 1
`;

      const statusInfo = { status: 'FAILURE', summary: undefined };
      const errorMessage = (integration as any).extractErrorMessage(errorOutput, statusInfo);
      
      expect(errorMessage).toContain('Invalid syntax');
    });
  });

  describe('Validation', () => {
    it('should validate output against criteria', async () => {
      // Mock the Claude Code execution for validation
      jest.spyOn(integration as any, 'runClaudeCode').mockResolvedValue(
        'Output validation: 通過 - The output meets all specified criteria.'
      );

      const isValid = await integration.validateOutput(
        'Hello World!',
        'Output should contain greeting'
      );

      expect(isValid).toBe(true);
    });

    it('should handle validation failures', async () => {
      jest.spyOn(integration as any, 'runClaudeCode').mockResolvedValue(
        'Output validation: 失敗 - The output does not meet requirements.'
      );

      const isValid = await integration.validateOutput(
        'Goodbye!',
        'Output should contain greeting'
      );

      expect(isValid).toBe(false);
    });

    it('should handle validation errors gracefully', async () => {
      jest.spyOn(integration as any, 'runClaudeCode').mockRejectedValue(
        new Error('Validation service unavailable')
      );

      const isValid = await integration.validateOutput(
        'Test output',
        'Test criteria'
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Process Management', () => {
    it('should stop execution correctly', () => {
      integration.stop();
      expect(integration.getStatus()).toBe(ExecutionStatus.IDLE);
    });

    it('should handle cleanup properly', () => {
      expect(() => {
        integration.cleanup();
      }).not.toThrow();
    });
  });

  describe('Event Handling', () => {
    it('should emit output events', (done) => {
      integration.on('output', (data) => {
        expect(typeof data).toBe('string');
        done();
      });

      // 模擬輸出事件
      integration.emit('output', 'Test output');
    });

    it('should emit completion events', (done) => {
      integration.on('execution:completed', (result) => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('output');
        done();
      });

      // 模擬完成事件
      integration.emit('execution:completed', {
        success: true,
        output: 'Test result',
        duration: 1000
      });
    });
  });
});