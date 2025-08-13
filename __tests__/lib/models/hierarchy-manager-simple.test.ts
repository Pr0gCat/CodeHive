import { HierarchyManager } from '../../../lib/models/hierarchy-manager';
import { prisma } from '../../../lib/db';
import { ModelStatus, Priority, TaskType } from '../../../lib/models/types';

describe('HierarchyManager - Core Functionality', () => {
  let manager: HierarchyManager;
  const testProjectId = `test-${Date.now()}`;

  beforeAll(() => {
    manager = new HierarchyManager(prisma);
  });

  afterAll(async () => {
    await manager.cleanup();
  });

  describe('Basic Model Operations', () => {
    it('should create and retrieve an epic', async () => {
      const epicData = {
        projectId: testProjectId,
        title: '測試史詩',
        description: '這是一個測試史詩',
        priority: Priority.HIGH
      };

      const epic = await manager.createEpic(epicData);
      
      expect(epic).toBeDefined();
      expect(epic.title).toBe('測試史詩');
      expect(epic.status).toBe(ModelStatus.PENDING);
      expect(epic.priority).toBe(Priority.HIGH);

      const retrieved = await manager.getEpic(epic.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(epic.id);
    });

    it('should create a story under an epic', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: '故事測試史詩'
      });

      const storyData = {
        epicId: epic.id,
        title: '用戶登入故事',
        userStory: 'As a user, I want to login',
        storyPoints: 5
      };

      const story = await manager.createStory(storyData);
      
      expect(story).toBeDefined();
      expect(story.title).toBe('用戶登入故事');
      expect(story.epicId).toBe(epic.id);
      expect(story.storyPoints).toBe(5);
    });

    it('should create a task under a story', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: '任務測試史詩'
      });

      const story = await manager.createStory({
        epicId: epic.id,
        title: '任務測試故事'
      });

      const taskData = {
        storyId: story.id,
        title: '建立登入表單',
        type: TaskType.DEV,
        estimatedTime: 120
      };

      const task = await manager.createTask(taskData);
      
      expect(task).toBeDefined();
      expect(task.title).toBe('建立登入表單');
      expect(task.type).toBe(TaskType.DEV);
      expect(task.estimatedTime).toBe(120);
    });

    it('should create an instruction under a task', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: '指令測試史詩'
      });

      const story = await manager.createStory({
        epicId: epic.id,
        title: '指令測試故事'
      });

      const task = await manager.createTask({
        storyId: story.id,
        title: '指令測試任務',
        type: TaskType.DEV
      });

      const instructionData = {
        taskId: task.id,
        directive: '建立 React 元件',
        expectedOutcome: 'Login.tsx 檔案已建立',
        sequence: 1
      };

      const instruction = await manager.createInstruction(instructionData);
      
      expect(instruction).toBeDefined();
      expect(instruction.directive).toBe('建立 React 元件');
      expect(instruction.sequence).toBe(1);
      expect(instruction.status).toBe(ModelStatus.PENDING);
    });
  });

  describe('Update Operations', () => {
    it('should update epic status', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: '更新測試史詩'
      });

      const updated = await manager.updateEpic(epic.id, {
        status: ModelStatus.IN_PROGRESS,
        actualEffort: 10
      });

      expect(updated.status).toBe(ModelStatus.IN_PROGRESS);
      expect(updated.actualEffort).toBe(10);
      expect(updated.startedAt).toBeDefined();
    });

    it('should update instruction with execution results', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: '執行測試史詩'
      });

      const story = await manager.createStory({
        epicId: epic.id,
        title: '執行測試故事'
      });

      const task = await manager.createTask({
        storyId: story.id,
        title: '執行測試任務',
        type: TaskType.DEV
      });

      const instruction = await manager.createInstruction({
        taskId: task.id,
        directive: '執行測試',
        expectedOutcome: '測試通過',
        sequence: 1
      });

      const updated = await manager.updateInstruction(instruction.id, {
        status: ModelStatus.COMPLETED,
        output: '所有測試都通過了',
        tokenUsage: 150,
        executionTime: 2000
      });

      expect(updated.status).toBe(ModelStatus.COMPLETED);
      expect(updated.output).toContain('通過');
      expect(updated.tokenUsage).toBe(150);
      expect(updated.executionTime).toBe(2000);
      expect(updated.completedAt).toBeDefined();
    });
  });

  describe('List Operations', () => {
    it('should list epics with filters', async () => {
      await manager.createEpic({
        projectId: testProjectId,
        title: '高優先級史詩',
        priority: Priority.HIGH
      });

      await manager.createEpic({
        projectId: testProjectId,
        title: '低優先級史詩',
        priority: Priority.LOW
      });

      const highPriorityEpics = await manager.listEpics({
        projectId: testProjectId,
        priority: Priority.HIGH
      });

      const allEpics = await manager.listEpics({
        projectId: testProjectId
      });

      expect(allEpics.length).toBeGreaterThanOrEqual(2);
      expect(highPriorityEpics.length).toBeGreaterThanOrEqual(1);
      expect(highPriorityEpics.every(e => e.priority === Priority.HIGH)).toBe(true);
    });

    it('should list instructions by task', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: '指令列表測試史詩'
      });

      const story = await manager.createStory({
        epicId: epic.id,
        title: '指令列表測試故事'
      });

      const task = await manager.createTask({
        storyId: story.id,
        title: '指令列表測試任務',
        type: TaskType.DEV
      });

      await manager.createInstruction({
        taskId: task.id,
        directive: '第一步',
        expectedOutcome: '完成第一步',
        sequence: 1
      });

      await manager.createInstruction({
        taskId: task.id,
        directive: '第二步',
        expectedOutcome: '完成第二步',
        sequence: 2
      });

      const instructions = await manager.listInstructions({ taskId: task.id });

      expect(instructions).toHaveLength(2);
      expect(instructions[0].sequence).toBe(1);
      expect(instructions[1].sequence).toBe(2);
    });
  });

  describe('Statistics', () => {
    it('should calculate project statistics', async () => {
      const stats = await manager.getHierarchyStatistics(testProjectId);

      expect(stats).toBeDefined();
      expect(typeof stats.totalEpics).toBe('number');
      expect(typeof stats.totalStories).toBe('number');
      expect(typeof stats.totalTasks).toBe('number');
      expect(typeof stats.totalInstructions).toBe('number');
      expect(stats.totalEpics).toBeGreaterThan(0);
    });

    it('should calculate epic statistics', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: '統計測試史詩'
      });

      const story = await manager.createStory({
        epicId: epic.id,
        title: '統計測試故事'
      });

      const stats = await manager.getEpicStatistics(epic.id);

      expect(stats).toBeDefined();
      expect(stats.id).toBe(epic.id);
      expect(stats.title).toBe('統計測試史詩');
      expect(stats.totalStories).toBe(1);
      expect(stats.progress).toBeGreaterThanOrEqual(0);
      expect(stats.progress).toBeLessThanOrEqual(100);
    });
  });

  describe('Relations', () => {
    it('should retrieve epic with nested relations', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: '關聯測試史詩'
      });

      const story = await manager.createStory({
        epicId: epic.id,
        title: '關聯測試故事'
      });

      const task = await manager.createTask({
        storyId: story.id,
        title: '關聯測試任務',
        type: TaskType.DEV
      });

      const epicWithRelations = await manager.getEpic(epic.id, true);

      expect(epicWithRelations).toBeDefined();
      expect(epicWithRelations?.stories).toBeDefined();
      expect(epicWithRelations?.stories?.length).toBe(1);
      expect(epicWithRelations?.stories?.[0].tasks).toBeDefined();
      expect(epicWithRelations?.stories?.[0].tasks?.length).toBe(1);
    });
  });

  describe('Event System', () => {
    it('should emit creation events', (done) => {
      manager.once('epic:created', (epic) => {
        expect(epic.title).toBe('事件測試史詩');
        done();
      });

      manager.createEpic({
        projectId: testProjectId,
        title: '事件測試史詩'
      });
    });
  });
});