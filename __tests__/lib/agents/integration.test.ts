import { ProjectExecutor, ExecutorStatus } from '../../../lib/agents/project-executor';
import { ProjectAgent } from '../../../lib/agents/project-agent';
import { Priority } from '../../../lib/agents/instruction-queue';

// 簡單的整合測試
describe('Agent Integration Tests', () => {
  describe('ProjectExecutor Integration', () => {
    it('should integrate with InstructionQueue correctly', () => {
      // 測試基本整合，不需要實際執行
      const mockPrisma = {} as any;
      const mockProjectAgent = {
        executeInstruction: jest.fn().mockResolvedValue({
          success: true,
          output: 'Test output'
        })
      } as any;

      const executor = new ProjectExecutor(mockPrisma, mockProjectAgent, {
        projectId: 'test-project',
        pollingInterval: 100
      });

      expect(executor.getStatus()).toBe(ExecutorStatus.STOPPED);
      expect(executor.isRunning()).toBe(false);
      
      const queueInfo = executor.getQueueInfo();
      expect(queueInfo.items).toHaveLength(0);
      expect(queueInfo.currentExecution).toBeNull();

      executor.cleanup();
    });

    it('should handle priority-based scheduling', async () => {
      const mockPrisma = {} as any;
      const mockProjectAgent = {
        executeInstruction: jest.fn().mockResolvedValue({
          success: true,
          output: 'Test output'
        })
      } as any;

      const executor = new ProjectExecutor(mockPrisma, mockProjectAgent, {
        projectId: 'test-project'
      });

      const mockInstruction = {
        id: 'test-instruction',
        taskId: 'test-task',
        expectedOutcome: 'Test outcome',
        criteria: 'Test criteria',
        directive: 'Test directive',
        status: 'pending' as const
      };

      // 新增不同優先級的指令
      await executor.addInstruction(mockInstruction, { 
        priority: Priority.LOW 
      });
      
      await executor.addInstruction(mockInstruction, { 
        priority: Priority.HIGH 
      });

      const queueInfo = executor.getQueueInfo();
      expect(queueInfo.items).toHaveLength(2);
      
      // 高優先級應該在前面
      expect(queueInfo.items[0].priority).toBe(Priority.HIGH);
      expect(queueInfo.items[1].priority).toBe(Priority.LOW);

      await executor.cleanup();
    });

    it('should provide comprehensive queue information', async () => {
      const mockPrisma = {} as any;
      const mockProjectAgent = {} as any;

      const executor = new ProjectExecutor(mockPrisma, mockProjectAgent, {
        projectId: 'test-project'
      });

      const stats = executor.getStats();
      expect(stats).toHaveProperty('totalExecuted');
      expect(stats).toHaveProperty('totalCompleted');
      expect(stats).toHaveProperty('totalFailed');
      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('averageExecutionTime');

      await executor.cleanup();
    });
  });
});