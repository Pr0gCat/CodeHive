import { HierarchyIntegration } from '../../../lib/agents/hierarchy-integration';
import { ProjectAgent, ProjectPhase } from '../../../lib/agents/project-agent';
import { HierarchyManager } from '../../../lib/models/hierarchy-manager';
import { prisma } from '../../../lib/db';
import { ModelStatus, Priority } from '../../../lib/models/types';

// Mock ProjectAgent
const mockProjectAgent = {
  updateCurrentTask: jest.fn(),
  executeInstruction: jest.fn(),
  on: jest.fn(),
  emit: jest.fn()
} as any;

describe('HierarchyIntegration', () => {
  let integration: HierarchyIntegration;
  let hierarchyManager: HierarchyManager;
  const testProjectId = `test-integration-${Date.now()}`;

  beforeAll(() => {
    hierarchyManager = new HierarchyManager(prisma);
    integration = new HierarchyIntegration(mockProjectAgent, hierarchyManager);
  });

  afterAll(async () => {
    await integration.cleanup();
  });

  describe('Epic Creation', () => {
    it('should create project epic for requirements phase', async () => {
      const epic = await integration.createProjectEpic(
        testProjectId,
        ProjectPhase.REQUIREMENTS
      );

      expect(epic).toBeDefined();
      expect(epic.projectId).toBe(testProjectId);
      expect(epic.phase).toBe(ProjectPhase.REQUIREMENTS);
      expect(epic.title).toContain('需求分析');
      expect(epic.priority).toBe(Priority.MEDIUM);
    });

    it('should create project epic for MVP phase', async () => {
      const epic = await integration.createProjectEpic(
        testProjectId,
        ProjectPhase.MVP
      );

      expect(epic).toBeDefined();
      expect(epic.phase).toBe(ProjectPhase.MVP);
      expect(epic.priority).toBe(Priority.HIGH); // MVP should be high priority
    });
  });

  describe('Story Generation', () => {
    let epicId: string;

    beforeAll(async () => {
      const epic = await integration.createProjectEpic(
        testProjectId,
        ProjectPhase.MVP
      );
      epicId = epic.id;
    });

    it('should generate stories from conversation', async () => {
      const conversationHistory = [
        { role: 'user', content: '我需要一個登入功能' },
        { role: 'assistant', content: '我會幫你建立登入功能' }
      ];

      const stories = await integration.generateStoriesFromConversation(
        epicId,
        conversationHistory
      );

      expect(stories).toBeDefined();
      expect(stories.length).toBeGreaterThan(0);
      expect(stories[0].epicId).toBe(epicId);
      expect(stories[0].title).toContain('認證');
    });
  });

  describe('Task Generation', () => {
    let storyId: string;

    beforeAll(async () => {
      const epic = await integration.createProjectEpic(
        testProjectId,
        ProjectPhase.MVP
      );
      
      const stories = await integration.generateStoriesFromConversation(
        epic.id,
        []
      );
      
      storyId = stories[0].id;
    });

    it('should generate tasks for story', async () => {
      const tasks = await integration.generateTasksForStory(storyId);

      expect(tasks).toBeDefined();
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].storyId).toBe(storyId);
      expect(tasks.some(t => t.title.includes('前端'))).toBe(true);
      expect(tasks.some(t => t.title.includes('後端'))).toBe(true);
    });
  });

  describe('Instruction Generation', () => {
    let taskId: string;

    beforeAll(async () => {
      const epic = await integration.createProjectEpic(
        testProjectId,
        ProjectPhase.MVP
      );
      
      const stories = await integration.generateStoriesFromConversation(
        epic.id,
        []
      );
      
      const tasks = await integration.generateTasksForStory(stories[0].id);
      taskId = tasks[0].id;
    });

    it('should generate instructions for task', async () => {
      const instructions = await integration.generateInstructionsForTask(taskId);

      expect(instructions).toBeDefined();
      expect(instructions.length).toBe(3); // 分析、實作、測試
      expect(instructions[0].sequence).toBe(1);
      expect(instructions[1].sequence).toBe(2);
      expect(instructions[2].sequence).toBe(3);
      expect(instructions[0].directive).toContain('分析');
      expect(instructions[1].directive).toContain('實作');
      expect(instructions[2].directive).toContain('測試');
    });
  });

  describe('Instruction Execution', () => {
    let instructionId: string;

    beforeAll(async () => {
      const epic = await integration.createProjectEpic(
        testProjectId,
        ProjectPhase.MVP
      );
      
      const stories = await integration.generateStoriesFromConversation(
        epic.id,
        []
      );
      
      const tasks = await integration.generateTasksForStory(stories[0].id);
      const instructions = await integration.generateInstructionsForTask(tasks[0].id);
      instructionId = instructions[0].id;
    });

    it('should execute instruction successfully', async () => {
      // Mock successful execution
      mockProjectAgent.executeInstruction.mockResolvedValue({
        success: true,
        output: '指令執行成功',
        tokenUsage: { total: 100 }
      });

      const result = await integration.executeInstruction(instructionId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.output).toBe('指令執行成功');
      expect(result.tokenUsage).toBe(100);
      expect(mockProjectAgent.executeInstruction).toHaveBeenCalled();
    });

    it('should handle instruction execution failure', async () => {
      // Mock failed execution
      mockProjectAgent.executeInstruction.mockResolvedValue({
        success: false,
        error: '執行失敗',
        tokenUsage: { total: 50 }
      });

      const result = await integration.executeInstruction(instructionId);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBe('執行失敗');
      expect(result.tokenUsage).toBe(50);
    });
  });

  describe('State Management', () => {
    it('should get and set current state', () => {
      const state = {
        epicId: 'epic-1',
        storyId: 'story-1',
        taskId: 'task-1',
        instructionId: 'instruction-1'
      };

      integration.setCurrentState(state);
      const currentState = integration.getCurrentState();

      expect(currentState).toEqual(state);
    });
  });

  describe('Progress Tracking', () => {
    let epicId: string;

    beforeAll(async () => {
      const epic = await integration.createProjectEpic(
        testProjectId,
        ProjectPhase.MVP
      );
      epicId = epic.id;
    });

    it('should get next pending instruction', async () => {
      // Create a complete hierarchy
      const stories = await integration.generateStoriesFromConversation(epicId, []);
      const tasks = await integration.generateTasksForStory(stories[0].id);
      const instructions = await integration.generateInstructionsForTask(tasks[0].id);

      // Set current task
      integration.setCurrentState({ taskId: tasks[0].id });

      const nextInstruction = await integration.getNextInstruction();

      expect(nextInstruction).toBeDefined();
      expect(nextInstruction?.taskId).toBe(tasks[0].id);
      expect(nextInstruction?.status).toBe(ModelStatus.PENDING);
    });

    it('should return null when no pending instructions', async () => {
      // Set invalid task ID
      integration.setCurrentState({ taskId: 'invalid-task-id' });

      const nextInstruction = await integration.getNextInstruction();

      expect(nextInstruction).toBeNull();
    });
  });
});