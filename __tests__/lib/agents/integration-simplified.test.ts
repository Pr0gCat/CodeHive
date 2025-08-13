import { HierarchyIntegration } from '../../../lib/agents/hierarchy-integration';
import { HierarchyManager } from '../../../lib/models/hierarchy-manager';
import { ProjectPhase } from '../../../lib/agents/project-agent';
import { prisma } from '../../../lib/db';
import { ModelStatus } from '../../../lib/models/types';

// Simple mock for ProjectAgent
const mockProjectAgent = {
  updateCurrentTask: async () => {},
  executeInstruction: async () => ({
    success: true,
    output: '指令執行成功',
    tokenUsage: { total: 150 }
  }),
  on: () => {},
  emit: () => {}
} as any;

describe('AI-Driven Project Development System - Simplified Integration', () => {
  let hierarchyManager: HierarchyManager;
  let hierarchyIntegration: HierarchyIntegration;
  
  const testProjectId = `simplified-integration-${Date.now()}`;

  beforeAll(() => {
    hierarchyManager = new HierarchyManager(prisma);
    hierarchyIntegration = new HierarchyIntegration(mockProjectAgent, hierarchyManager);
  });

  afterAll(async () => {
    await hierarchyIntegration.cleanup();
  });

  describe('Complete Workflow', () => {
    let epicId: string;
    let storyId: string;
    let taskId: string;

    it('should create project epic', async () => {
      const epic = await hierarchyIntegration.createProjectEpic(
        testProjectId,
        ProjectPhase.MVP
      );
      
      epicId = epic.id;
      expect(epic.title).toContain('MVP');
      expect(epic.projectId).toBe(testProjectId);
      expect(epic.status).toBe(ModelStatus.PENDING);
    });

    it('should generate stories from conversation', async () => {
      const stories = await hierarchyIntegration.generateStoriesFromConversation(
        epicId,
        [
          { role: 'user', content: '我需要建立使用者認證系統' },
          { role: 'assistant', content: '我會幫你建立認證系統' }
        ]
      );
      
      expect(stories.length).toBeGreaterThan(0);
      storyId = stories[0].id;
      expect(stories[0].epicId).toBe(epicId);
      expect(stories[0].title).toContain('認證');
    });

    it('should generate tasks for story', async () => {
      const tasks = await hierarchyIntegration.generateTasksForStory(storyId);
      
      expect(tasks.length).toBeGreaterThan(0);
      taskId = tasks[0].id;
      expect(tasks[0].storyId).toBe(storyId);
      expect(tasks.some(t => t.title.includes('前端'))).toBe(true);
      expect(tasks.some(t => t.title.includes('後端'))).toBe(true);
    });

    it('should generate instructions for task', async () => {
      const instructions = await hierarchyIntegration.generateInstructionsForTask(taskId);
      
      expect(instructions.length).toBe(3); // 分析、實作、測試
      expect(instructions[0].taskId).toBe(taskId);
      expect(instructions[0].sequence).toBe(1);
      expect(instructions[1].sequence).toBe(2);
      expect(instructions[2].sequence).toBe(3);
    });

    it('should execute instruction', async () => {
      const instructions = await hierarchyManager.listInstructions({ taskId });
      const instruction = instructions[0];
      
      const result = await hierarchyIntegration.executeInstruction(instruction.id);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('成功');
      expect(result.tokenUsage).toBe(150);
    });

    it('should track hierarchy progress', async () => {
      const progress = await hierarchyManager.getHierarchyProgress(epicId);
      
      expect(progress.epicId).toBe(epicId);
      expect(progress.stories.length).toBeGreaterThan(0);
      expect(progress.stories[0].storyId).toBe(storyId);
    });

    it('should calculate statistics', async () => {
      const stats = await hierarchyManager.getHierarchyStatistics(testProjectId);
      
      expect(stats.totalEpics).toBeGreaterThanOrEqual(1);
      expect(stats.totalStories).toBeGreaterThanOrEqual(1);
      expect(stats.totalTasks).toBeGreaterThanOrEqual(2);
      expect(stats.totalInstructions).toBeGreaterThanOrEqual(3);
    });

    it('should validate hierarchy structure', async () => {
      const validation = await hierarchyManager.validateHierarchy(epicId);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });
  });

  describe('State Management', () => {
    it('should manage current state', () => {
      const state = {
        epicId: 'epic-1',
        storyId: 'story-1',
        taskId: 'task-1',
        instructionId: 'instruction-1'
      };

      hierarchyIntegration.setCurrentState(state);
      const currentState = hierarchyIntegration.getCurrentState();

      expect(currentState).toEqual(state);
    });

    it('should get next pending instruction', async () => {
      const epic = await hierarchyIntegration.createProjectEpic(testProjectId, ProjectPhase.MVP);
      const stories = await hierarchyIntegration.generateStoriesFromConversation(epic.id, []);
      const tasks = await hierarchyIntegration.generateTasksForStory(stories[0].id);
      const instructions = await hierarchyIntegration.generateInstructionsForTask(tasks[0].id);

      hierarchyIntegration.setCurrentState({ taskId: tasks[0].id });
      const nextInstruction = await hierarchyIntegration.getNextInstruction();

      expect(nextInstruction).toBeDefined();
      expect(nextInstruction?.taskId).toBe(tasks[0].id);
      expect(nextInstruction?.status).toBe(ModelStatus.PENDING);
    });
  });

  describe('Epic Statistics', () => {
    let epicId: string;

    beforeAll(async () => {
      const epic = await hierarchyIntegration.createProjectEpic(testProjectId, ProjectPhase.MVP);
      const stories = await hierarchyIntegration.generateStoriesFromConversation(epic.id, []);
      const tasks = await hierarchyIntegration.generateTasksForStory(stories[0].id);
      epicId = epic.id;
    });

    it('should calculate epic statistics', async () => {
      const stats = await hierarchyManager.getEpicStatistics(epicId);
      
      expect(stats.id).toBe(epicId);
      expect(stats.totalStories).toBe(1);
      expect(stats.totalTasks).toBeGreaterThanOrEqual(2);
      expect(stats.progress).toBeGreaterThanOrEqual(0);
      expect(stats.progress).toBeLessThanOrEqual(100);
    });
  });
});