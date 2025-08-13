/**
 * 基本階層系統整合測試
 * 測試核心 CRUD 功能
 */

import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { ModelStatus, Priority } from '@/lib/models/types';

describe('基本階層系統整合測試', () => {
  const testProjectId = 'test-basic-' + Date.now();
  let hierarchyManager: HierarchyManager;
  let testEpicId: string;
  let testStoryId: string;
  let testTaskId: string;
  let testInstructionId: string;

  beforeAll(async () => {
    hierarchyManager = new HierarchyManager(prisma);
  });

  afterAll(async () => {
    // 清理測試數據
    try {
      await prisma.instruction.deleteMany({
        where: { task: { story: { epic: { projectId: testProjectId } } } }
      });
      await prisma.task.deleteMany({
        where: { story: { epic: { projectId: testProjectId } } }
      });
      await prisma.story.deleteMany({
        where: { epic: { projectId: testProjectId } }
      });
      await prisma.epic.deleteMany({
        where: { projectId: testProjectId }
      });
    } catch (error) {
      console.warn('清理測試數據失敗:', error);
    }
  });

  describe('HierarchyManager 基本 CRUD', () => {
    test('應該能夠創建 Epic', async () => {
      const epic = await hierarchyManager.createEpic({
        projectId: testProjectId,
        title: '測試史詩',
        description: '這是一個測試史詩',
        priority: Priority.HIGH
      });

      expect(epic).toHaveProperty('id');
      expect(epic.title).toBe('測試史詩');
      expect(epic.projectId).toBe(testProjectId);
      expect(epic.status).toBe(ModelStatus.PENDING);

      testEpicId = epic.id;
    });

    test('應該能夠獲取 Epic', async () => {
      const epic = await hierarchyManager.getEpic(testEpicId);
      
      expect(epic).not.toBeNull();
      expect(epic?.id).toBe(testEpicId);
      expect(epic?.title).toBe('測試史詩');
    });

    test('應該能夠創建 Story', async () => {
      const story = await hierarchyManager.createStory({
        epicId: testEpicId,
        title: '測試故事',
        userStory: '作為用戶，我想要測試功能',
        priority: Priority.MEDIUM
      });

      expect(story).toHaveProperty('id');
      expect(story.title).toBe('測試故事');
      expect(story.epicId).toBe(testEpicId);
      expect(story.status).toBe(ModelStatus.PENDING);

      testStoryId = story.id;
    });

    test('應該能夠創建 Task', async () => {
      const task = await hierarchyManager.createTask({
        storyId: testStoryId,
        title: '測試任務',
        description: '這是一個測試任務',
        type: 'DEV', // 必填字段
        priority: Priority.MEDIUM
      });

      expect(task).toHaveProperty('id');
      expect(task.title).toBe('測試任務');
      expect(task.storyId).toBe(testStoryId);
      expect(task.status).toBe(ModelStatus.PENDING);

      testTaskId = task.id;
    });

    test('應該能夠創建 Instruction', async () => {
      const instruction = await hierarchyManager.createInstruction({
        taskId: testTaskId,
        directive: '執行測試指令',
        expectedOutcome: '測試成功',
        sequence: 1
      });

      expect(instruction).toHaveProperty('id');
      expect(instruction.directive).toBe('執行測試指令');
      expect(instruction.taskId).toBe(testTaskId);
      expect(instruction.status).toBe(ModelStatus.PENDING);

      testInstructionId = instruction.id;
    });

    test('應該能夠列出 Epics', async () => {
      const epics = await hierarchyManager.listEpics({ projectId: testProjectId });
      
      expect(Array.isArray(epics)).toBe(true);
      expect(epics.length).toBeGreaterThan(0);
      expect(epics[0].title).toBe('測試史詩');
    });

    test('應該能夠列出 Stories', async () => {
      const stories = await hierarchyManager.listStories({ epicId: testEpicId });
      
      expect(Array.isArray(stories)).toBe(true);
      expect(stories.length).toBeGreaterThan(0);
      expect(stories[0].title).toBe('測試故事');
    });

    test('應該能夠列出 Tasks', async () => {
      const tasks = await hierarchyManager.listTasks({ storyId: testStoryId });
      
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].title).toBe('測試任務');
    });

    test('應該能夠列出 Instructions', async () => {
      const instructions = await hierarchyManager.listInstructions({ taskId: testTaskId });
      
      expect(Array.isArray(instructions)).toBe(true);
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions[0].directive).toBe('執行測試指令');
    });

    test('應該能夠獲取階層統計', async () => {
      const stats = await hierarchyManager.getHierarchyStatistics(testProjectId);
      
      expect(stats).toHaveProperty('totalEpics');
      expect(stats).toHaveProperty('totalStories');
      expect(stats).toHaveProperty('totalTasks');
      expect(stats).toHaveProperty('totalInstructions');
      
      expect(stats.totalEpics).toBe(1);
      expect(stats.totalStories).toBe(1);
      expect(stats.totalTasks).toBe(1);
      expect(stats.totalInstructions).toBe(1);
    });

    test('應該能夠獲取 Epic 統計', async () => {
      const epicStats = await hierarchyManager.getEpicStatistics(testEpicId);
      
      expect(epicStats).toHaveProperty('id');
      expect(epicStats).toHaveProperty('title');
      expect(epicStats).toHaveProperty('totalStories');
      expect(epicStats).toHaveProperty('totalTasks');
      expect(epicStats).toHaveProperty('progress');
      
      expect(epicStats.id).toBe(testEpicId);
      expect(epicStats.totalStories).toBe(1);
      expect(epicStats.totalTasks).toBe(1);
    });
  });

  describe('更新功能', () => {
    test('應該能夠更新 Epic 狀態', async () => {
      const updatedEpic = await hierarchyManager.updateEpic(testEpicId, {
        status: ModelStatus.IN_PROGRESS
      });

      expect(updatedEpic.status).toBe(ModelStatus.IN_PROGRESS);
    });

    test('應該能夠更新 Story 狀態', async () => {
      const updatedStory = await hierarchyManager.updateStory(testStoryId, {
        status: ModelStatus.IN_PROGRESS
      });

      expect(updatedStory.status).toBe(ModelStatus.IN_PROGRESS);
    });

    test('應該能夠更新 Task 狀態', async () => {
      const updatedTask = await hierarchyManager.updateTask(testTaskId, {
        status: ModelStatus.IN_PROGRESS
      });

      expect(updatedTask.status).toBe(ModelStatus.IN_PROGRESS);
    });

    test('應該能夠更新 Instruction 狀態', async () => {
      const updatedInstruction = await hierarchyManager.updateInstruction(testInstructionId, {
        status: ModelStatus.COMPLETED,
        output: '測試完成',
        executionTime: 1000,
        tokenUsage: 100
      });

      expect(updatedInstruction.status).toBe(ModelStatus.COMPLETED);
      expect(updatedInstruction.output).toBe('測試完成');
    });
  });

  describe('關聯查詢', () => {
    test('應該能夠獲取帶關聯的 Epic', async () => {
      const epic = await hierarchyManager.getEpic(testEpicId, true);
      
      expect(epic).not.toBeNull();
      expect(epic?.stories).toBeDefined();
      expect(Array.isArray(epic?.stories)).toBe(true);
      expect(epic?.stories?.length).toBeGreaterThan(0);
    });

    test('應該能夠獲取帶關聯的 Story', async () => {
      const story = await hierarchyManager.getStory(testStoryId, true);
      
      expect(story).not.toBeNull();
      expect(story?.tasks).toBeDefined();
      expect(Array.isArray(story?.tasks)).toBe(true);
      expect(story?.tasks?.length).toBeGreaterThan(0);
    });

    test('應該能夠獲取帶關聯的 Task', async () => {
      const task = await hierarchyManager.getTask(testTaskId, true);
      
      expect(task).not.toBeNull();
      expect(task?.instructions).toBeDefined();
      expect(Array.isArray(task?.instructions)).toBe(true);
      expect(task?.instructions?.length).toBeGreaterThan(0);
    });
  });
});