import { ProjectAgent, ProjectPhase, AgentState } from '../../../lib/agents/project-agent';
import { HierarchyIntegration } from '../../../lib/agents/hierarchy-integration';
import { HierarchyManager } from '../../../lib/models/hierarchy-manager';
import { ExecutionManager, ClaudeCodeExecutor } from '../../../lib/agents/executor';
import { ContextManager } from '../../../lib/agents/context-manager';
import { prisma } from '../../../lib/db';
import { ModelStatus } from '../../../lib/models/types';

// Mock Claude Code integration for testing
const mockClaudeCodeIntegration = {
  executeInstruction: async (instruction: any) => ({
    success: true,
    output: '指令執行成功',
    tokenUsage: { total: 150 }
  }),
  on: () => {},
  cleanup: () => {}
};

describe('AI-Driven Project Development System Integration', () => {
  let projectAgent: ProjectAgent;
  let hierarchyManager: HierarchyManager;
  let hierarchyIntegration: HierarchyIntegration;
  let executionManager: ExecutionManager;
  let contextManager: ContextManager;

  const testProjectId = `integration-test-${Date.now()}`;
  const testProjectPath = `/tmp/test-project-${Date.now()}`;

  beforeAll(async () => {
    // Initialize components
    hierarchyManager = new HierarchyManager(prisma);
    
    projectAgent = new ProjectAgent({
      projectId: testProjectId,
      projectPath: testProjectPath,
      maxTokens: 4000
    }, prisma);
    
    hierarchyIntegration = new HierarchyIntegration(projectAgent, hierarchyManager);
    
    const executorConfig = {
      workingDirectory: testProjectPath,
      timeout: 30000,
      maxRetries: 2,
      logExecution: true
    };
    
    executionManager = new ExecutionManager(prisma, executorConfig, 2);
    
    contextManager = new ContextManager(testProjectPath);

    // Claude Code integration is already mocked above
  });

  afterAll(async () => {
    await hierarchyIntegration.cleanup();
    await executionManager.cleanup();
    await projectAgent.cleanup();
  });

  describe('Complete Development Workflow', () => {
    let epicId: string;
    let storyId: string;
    let taskId: string;
    let instructionId: string;

    it('should initialize project agent', async () => {
      await projectAgent.initialize();
      
      expect(projectAgent.getState()).toBe(AgentState.LISTENING);
      expect(projectAgent.getPhase()).toBe(ProjectPhase.REQUIREMENTS);
    });

    it('should handle requirements gathering conversation', async () => {
      const response = await projectAgent.handleConversation('我需要建立一個使用者管理系統');
      
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      
      const history = projectAgent.getConversationHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 2].content).toContain('使用者管理系統');
    });

    it('should transition to MVP phase', async () => {
      await projectAgent.transitionPhase(ProjectPhase.MVP, 'ready for development');
      
      expect(projectAgent.getPhase()).toBe(ProjectPhase.MVP);
    });

    it('should create project epic for MVP phase', async () => {
      const epic = await hierarchyIntegration.createProjectEpic(
        testProjectId,
        ProjectPhase.MVP,
        { userManagement: true, authentication: true }
      );
      
      epicId = epic.id;
      expect(epic.title).toContain('MVP');
      expect(epic.phase).toBe(ProjectPhase.MVP);
    });

    it('should generate stories from conversation history', async () => {
      const conversationHistory = projectAgent.getConversationHistory();
      
      const stories = await hierarchyIntegration.generateStoriesFromConversation(
        epicId,
        conversationHistory
      );
      
      expect(stories.length).toBeGreaterThan(0);
      storyId = stories[0].id;
      expect(stories[0].epicId).toBe(epicId);
    });

    it('should generate tasks for story', async () => {
      const tasks = await hierarchyIntegration.generateTasksForStory(storyId);
      
      expect(tasks.length).toBeGreaterThan(0);
      taskId = tasks[0].id;
      expect(tasks[0].storyId).toBe(storyId);
    });

    it('should generate instructions for task', async () => {
      const instructions = await hierarchyIntegration.generateInstructionsForTask(taskId);
      
      expect(instructions.length).toBeGreaterThan(0);
      instructionId = instructions[0].id;
      expect(instructions[0].taskId).toBe(taskId);
      expect(instructions[0].sequence).toBe(1);
    });

    it('should update project context with current hierarchy', async () => {
      await projectAgent.updateCurrentTask(epicId, storyId, taskId);
      
      const contextData = projectAgent.getProjectContextData();
      expect(contextData?.currentEpicId).toBe(epicId);
      expect(contextData?.currentStoryId).toBe(storyId);
      expect(contextData?.currentTaskId).toBe(taskId);
    });

    it('should execute instruction through hierarchy integration', async () => {
      const result = await hierarchyIntegration.executeInstruction(instructionId);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('成功');
      expect(result.tokenUsage).toBe(150);
    });

    it('should mark task as completed', async () => {
      await projectAgent.markTaskCompleted(taskId, '任務成功完成');
      
      const contextData = projectAgent.getProjectContextData();
      expect(contextData?.completedTasks).toContain(taskId);
    });

    it('should track hierarchy progress', async () => {
      const progress = await hierarchyManager.getHierarchyProgress(epicId);
      
      expect(progress.epicId).toBe(epicId);
      expect(progress.stories.length).toBeGreaterThan(0);
      expect(progress.stories[0].tasks.length).toBeGreaterThan(0);
    });

    it('should create session recovery point', async () => {
      const recoveryId = await projectAgent.createSessionRecoveryPoint();
      
      expect(recoveryId).toBeDefined();
      expect(typeof recoveryId).toBe('string');
    });

    it('should perform health check', async () => {
      const health = await projectAgent.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.agentHealth.initialized).toBe(true);
      expect(health.agentHealth.hasValidContext).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle instruction execution failure', async () => {
      // Temporarily modify the mock to return failure
      const originalExecute = mockClaudeCodeIntegration.executeInstruction;
      mockClaudeCodeIntegration.executeInstruction = async () => ({
        success: false,
        error: '執行失敗',
        tokenUsage: { total: 25 }
      });

      const epic = await hierarchyIntegration.createProjectEpic(testProjectId, ProjectPhase.MVP);
      const stories = await hierarchyIntegration.generateStoriesFromConversation(epic.id, []);
      const tasks = await hierarchyIntegration.generateTasksForStory(stories[0].id);
      const instructions = await hierarchyIntegration.generateInstructionsForTask(tasks[0].id);
      
      const result = await hierarchyIntegration.executeInstruction(instructions[0].id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('執行失敗');
      
      // Restore original mock
      mockClaudeCodeIntegration.executeInstruction = originalExecute;
    });

    it('should handle session recovery', async () => {
      const recoveryId = await projectAgent.createSessionRecoveryPoint();
      const recovered = await projectAgent.recoverSession(recoveryId);
      
      expect(recovered).toBe(true);
    });

    it('should validate hierarchy structure', async () => {
      const epic = await hierarchyIntegration.createProjectEpic(testProjectId, ProjectPhase.MVP);
      const validation = await hierarchyManager.validateHierarchy(epic.id);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe('Execution Management', () => {
    it('should manage execution queue', async () => {
      const epic = await hierarchyIntegration.createProjectEpic(testProjectId, ProjectPhase.MVP);
      const stories = await hierarchyIntegration.generateStoriesFromConversation(epic.id, []);
      const tasks = await hierarchyIntegration.generateTasksForStory(stories[0].id);
      const instructions = await hierarchyIntegration.generateInstructionsForTask(tasks[0].id);
      
      const instruction = instructions[0];
      const queueStatus = executionManager.getQueueStatus();
      
      expect(queueStatus.maxConcurrent).toBe(2);
      expect(queueStatus.queueLength).toBeGreaterThanOrEqual(0);
      expect(queueStatus.runningCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics and Analytics', () => {
    it('should calculate project statistics', async () => {
      const stats = await hierarchyManager.getHierarchyStatistics(testProjectId);
      
      expect(stats.totalEpics).toBeGreaterThan(0);
      expect(stats.totalStories).toBeGreaterThan(0);
      expect(stats.totalTasks).toBeGreaterThan(0);
      expect(stats.totalInstructions).toBeGreaterThan(0);
    });

    it('should track epic progress', async () => {
      const epics = await hierarchyManager.listEpics({ projectId: testProjectId });
      
      if (epics.length > 0) {
        const epicStats = await hierarchyManager.getEpicStatistics(epics[0].id);
        
        expect(epicStats.id).toBe(epics[0].id);
        expect(epicStats.progress).toBeGreaterThanOrEqual(0);
        expect(epicStats.progress).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Phase Transitions', () => {
    it('should transition from MVP to Continuous phase', async () => {
      await projectAgent.transitionPhase(ProjectPhase.CONTINUOUS, 'MVP completed');
      
      expect(projectAgent.getPhase()).toBe(ProjectPhase.CONTINUOUS);
    });

    it('should handle continuous development conversation', async () => {
      const response = await projectAgent.handleConversation('需要添加新功能');
      
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });
  });

  describe('Context Management', () => {
    it('should persist and reload context', async () => {
      await projectAgent.reloadContext();
      const contextData = projectAgent.getProjectContextData();
      
      expect(contextData).toBeDefined();
      expect(contextData?.phase).toBe(ProjectPhase.CONTINUOUS);
    });

    it('should check if context needs reload', async () => {
      const needsReload = await projectAgent.shouldReloadContext();
      expect(typeof needsReload).toBe('boolean');
    });
  });
});