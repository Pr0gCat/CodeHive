import { HierarchyManager } from '../../../lib/models/hierarchy-manager';
import { PrismaClient } from '@prisma/client';
import { ModelStatus, Priority, TaskType } from '../../../lib/models/types';

describe('HierarchyManager', () => {
  let manager: HierarchyManager;
  let prisma: PrismaClient;
  const testProjectId = 'test-project-id';

  beforeAll(async () => {
    // 使用測試資料庫
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || 'file:./test.db'
        }
      }
    });
    
    // 運行資料庫遷移
    await prisma.$executeRaw`PRAGMA foreign_keys = OFF`;
    try {
      // 創建所有表
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "epics" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "projectId" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "businessValue" TEXT,
          "acceptanceCriteria" TEXT,
          "priority" INTEGER NOT NULL DEFAULT 0,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "phase" TEXT,
          "estimatedEffort" INTEGER,
          "actualEffort" INTEGER,
          "tokenUsage" INTEGER NOT NULL DEFAULT 0,
          "createdBy" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "startedAt" DATETIME,
          "completedAt" DATETIME
        )
      `;
      
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "stories" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "epicId" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "userStory" TEXT,
          "description" TEXT,
          "acceptanceCriteria" TEXT,
          "priority" INTEGER NOT NULL DEFAULT 0,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "storyPoints" INTEGER,
          "iteration" INTEGER,
          "tokenUsage" INTEGER NOT NULL DEFAULT 0,
          "actualTime" INTEGER,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "startedAt" DATETIME,
          "completedAt" DATETIME,
          CONSTRAINT "stories_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "epics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `;
      
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "tasks" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "storyId" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "type" TEXT NOT NULL,
          "acceptanceCriteria" TEXT,
          "expectedOutcome" TEXT,
          "priority" INTEGER NOT NULL DEFAULT 0,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "estimatedTime" INTEGER,
          "actualTime" INTEGER,
          "retryCount" INTEGER NOT NULL DEFAULT 0,
          "assignedAgent" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "startedAt" DATETIME,
          "completedAt" DATETIME,
          CONSTRAINT "tasks_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `;
      
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "instructions" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "taskId" TEXT NOT NULL,
          "directive" TEXT NOT NULL,
          "expectedOutcome" TEXT NOT NULL,
          "validationCriteria" TEXT,
          "sequence" INTEGER NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "output" TEXT,
          "error" TEXT,
          "tokenUsage" INTEGER NOT NULL DEFAULT 0,
          "executionTime" INTEGER,
          "executedBy" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "startedAt" DATETIME,
          "completedAt" DATETIME,
          CONSTRAINT "instructions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `;
      
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "epic_dependencies" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "dependentEpicId" TEXT NOT NULL,
          "requiredEpicId" TEXT NOT NULL,
          "dependencyType" TEXT NOT NULL DEFAULT 'BLOCKS',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "epic_dependencies_dependentEpicId_fkey" FOREIGN KEY ("dependentEpicId") REFERENCES "epics" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "epic_dependencies_requiredEpicId_fkey" FOREIGN KEY ("requiredEpicId") REFERENCES "epics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `;
      
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "task_dependencies" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "dependentTaskId" TEXT NOT NULL,
          "requiredTaskId" TEXT NOT NULL,
          "dependencyType" TEXT NOT NULL DEFAULT 'BLOCKS',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "task_dependencies_dependentTaskId_fkey" FOREIGN KEY ("dependentTaskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "task_dependencies_requiredTaskId_fkey" FOREIGN KEY ("requiredTaskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `;
      
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "instruction_dependencies" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "dependentInstructionId" TEXT NOT NULL,
          "requiredInstructionId" TEXT NOT NULL,
          "dependencyType" TEXT NOT NULL DEFAULT 'SEQUENTIAL',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "instruction_dependencies_dependentInstructionId_fkey" FOREIGN KEY ("dependentInstructionId") REFERENCES "instructions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "instruction_dependencies_requiredInstructionId_fkey" FOREIGN KEY ("requiredInstructionId") REFERENCES "instructions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `;
    } finally {
      await prisma.$executeRaw`PRAGMA foreign_keys = ON`;
    }
    
    manager = new HierarchyManager(prisma);
  });

  afterAll(async () => {
    // 清理測試資料
    await prisma.instruction.deleteMany();
    await prisma.task.deleteMany();
    await prisma.story.deleteMany();
    await prisma.epic.deleteMany();
    await prisma.$disconnect();
  });

  describe('Epic Management', () => {
    it('should create an epic', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: '使用者認證系統',
        description: '實作完整的使用者認證功能',
        businessValue: '提供安全的使用者存取控制',
        acceptanceCriteria: '使用者可以註冊、登入、登出',
        priority: Priority.HIGH,
        phase: 'MVP',
        estimatedEffort: 21
      });

      expect(epic).toBeDefined();
      expect(epic.title).toBe('使用者認證系統');
      expect(epic.status).toBe(ModelStatus.PENDING);
      expect(epic.priority).toBe(Priority.HIGH);
    });

    it('should update an epic', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: 'Test Epic'
      });

      const updated = await manager.updateEpic(epic.id, {
        status: ModelStatus.IN_PROGRESS,
        actualEffort: 13
      });

      expect(updated.status).toBe(ModelStatus.IN_PROGRESS);
      expect(updated.actualEffort).toBe(13);
      expect(updated.startedAt).toBeDefined();
    });

    it('should list epics with filter', async () => {
      // 創建多個 Epics
      await manager.createEpic({
        projectId: testProjectId,
        title: 'High Priority Epic',
        priority: Priority.HIGH
      });

      await manager.createEpic({
        projectId: testProjectId,
        title: 'Low Priority Epic',
        priority: Priority.LOW
      });

      const highPriorityEpics = await manager.listEpics({
        projectId: testProjectId,
        priority: Priority.HIGH
      });

      expect(highPriorityEpics.length).toBeGreaterThan(0);
      expect(highPriorityEpics.every(e => e.priority === Priority.HIGH)).toBe(true);
    });

    it('should get epic with relations', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: 'Epic with Relations'
      });

      const story = await manager.createStory({
        epicId: epic.id,
        title: 'Story 1'
      });

      const epicWithRelations = await manager.getEpic(epic.id, true);
      
      expect(epicWithRelations).toBeDefined();
      expect(epicWithRelations?.stories).toBeDefined();
      expect(epicWithRelations?.stories?.length).toBeGreaterThan(0);
    });
  });

  describe('Story Management', () => {
    let epicId: string;

    beforeAll(async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: 'Story Test Epic'
      });
      epicId = epic.id;
    });

    it('should create a story', async () => {
      const story = await manager.createStory({
        epicId,
        title: '使用者註冊功能',
        userStory: 'As a new user, I want to register an account so that I can access the platform',
        acceptanceCriteria: '- 可以輸入電子郵件和密碼\n- 密碼需要符合安全要求\n- 註冊成功後自動登入',
        priority: Priority.HIGH,
        storyPoints: 5
      });

      expect(story).toBeDefined();
      expect(story.title).toBe('使用者註冊功能');
      expect(story.epicId).toBe(epicId);
      expect(story.storyPoints).toBe(5);
    });

    it('should update a story', async () => {
      const story = await manager.createStory({
        epicId,
        title: 'Test Story'
      });

      const updated = await manager.updateStory(story.id, {
        status: ModelStatus.COMPLETED,
        actualTime: 180 // 3 hours in minutes
      });

      expect(updated.status).toBe(ModelStatus.COMPLETED);
      expect(updated.completedAt).toBeDefined();
    });

    it('should list stories by epic', async () => {
      const stories = await manager.listStories({
        epicId
      });

      expect(stories.length).toBeGreaterThan(0);
      expect(stories.every(s => s.epicId === epicId)).toBe(true);
    });
  });

  describe('Task Management', () => {
    let storyId: string;

    beforeAll(async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: 'Task Test Epic'
      });

      const story = await manager.createStory({
        epicId: epic.id,
        title: 'Task Test Story'
      });
      
      storyId = story.id;
    });

    it('should create a task', async () => {
      const task = await manager.createTask({
        storyId,
        title: '建立註冊表單元件',
        description: '使用 React 建立使用者註冊表單',
        type: TaskType.DEV,
        acceptanceCriteria: '- 表單包含所有必要欄位\n- 有適當的驗證\n- 響應式設計',
        expectedOutcome: '可運作的註冊表單元件',
        priority: Priority.HIGH,
        estimatedTime: 120 // 2 hours
      });

      expect(task).toBeDefined();
      expect(task.title).toBe('建立註冊表單元件');
      expect(task.type).toBe(TaskType.DEV);
      expect(task.estimatedTime).toBe(120);
    });

    it('should handle task retry count', async () => {
      const task = await manager.createTask({
        storyId,
        title: 'Retry Test Task',
        type: TaskType.TEST
      });

      const updated = await manager.updateTask(task.id, {
        retryCount: 1,
        status: ModelStatus.FAILED
      });

      expect(updated.retryCount).toBe(1);
      expect(updated.status).toBe(ModelStatus.FAILED);
    });

    it('should get task with relations', async () => {
      const task = await manager.createTask({
        storyId,
        title: 'Task with Instructions',
        type: TaskType.DEV
      });

      await manager.createInstruction({
        taskId: task.id,
        directive: 'Create component file',
        expectedOutcome: 'Component.tsx file created',
        sequence: 1
      });

      const taskWithRelations = await manager.getTask(task.id, true);
      
      expect(taskWithRelations?.instructions).toBeDefined();
      expect(taskWithRelations?.instructions?.length).toBeGreaterThan(0);
    });
  });

  describe('Instruction Management', () => {
    let taskId: string;

    beforeAll(async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: 'Instruction Test Epic'
      });

      const story = await manager.createStory({
        epicId: epic.id,
        title: 'Instruction Test Story'
      });

      const task = await manager.createTask({
        storyId: story.id,
        title: 'Instruction Test Task',
        type: TaskType.DEV
      });
      
      taskId = task.id;
    });

    it('should create instructions in sequence', async () => {
      const instruction1 = await manager.createInstruction({
        taskId,
        directive: 'Step 1: Setup project',
        expectedOutcome: 'Project initialized',
        sequence: 1
      });

      const instruction2 = await manager.createInstruction({
        taskId,
        directive: 'Step 2: Install dependencies',
        expectedOutcome: 'Dependencies installed',
        sequence: 2
      });

      expect(instruction1.sequence).toBe(1);
      expect(instruction2.sequence).toBe(2);

      const instructions = await manager.listInstructions({ taskId });
      expect(instructions).toHaveLength(2);
      expect(instructions[0].sequence).toBeLessThan(instructions[1].sequence);
    });

    it('should update instruction with execution result', async () => {
      const instruction = await manager.createInstruction({
        taskId,
        directive: 'Execute test',
        expectedOutcome: 'Tests pass',
        sequence: 3
      });

      const updated = await manager.updateInstruction(instruction.id, {
        status: ModelStatus.COMPLETED,
        output: 'All tests passed successfully',
        tokenUsage: 150,
        executionTime: 2500
      });

      expect(updated.status).toBe(ModelStatus.COMPLETED);
      expect(updated.output).toContain('tests passed');
      expect(updated.tokenUsage).toBe(150);
      expect(updated.completedAt).toBeDefined();
    });
  });

  describe('Dependency Management', () => {
    it('should create epic dependencies', async () => {
      const epic1 = await manager.createEpic({
        projectId: testProjectId,
        title: 'Backend API'
      });

      const epic2 = await manager.createEpic({
        projectId: testProjectId,
        title: 'Frontend UI'
      });

      const dependency = await manager.createEpicDependency({
        dependentId: epic2.id,
        requiredId: epic1.id,
        dependencyType: 'BLOCKS'
      });

      expect(dependency).toBeDefined();
      expect(dependency.dependentEpicId).toBe(epic2.id);
      expect(dependency.requiredEpicId).toBe(epic1.id);
    });

    it('should create task dependencies', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: 'Dependency Test Epic'
      });

      const story = await manager.createStory({
        epicId: epic.id,
        title: 'Dependency Test Story'
      });

      const task1 = await manager.createTask({
        storyId: story.id,
        title: 'Database Setup',
        type: TaskType.DEV
      });

      const task2 = await manager.createTask({
        storyId: story.id,
        title: 'API Development',
        type: TaskType.DEV
      });

      const dependency = await manager.createTaskDependency({
        dependentId: task2.id,
        requiredId: task1.id
      });

      expect(dependency).toBeDefined();
    });
  });

  describe('Statistics and Progress', () => {
    it('should calculate hierarchy statistics', async () => {
      const stats = await manager.getHierarchyStatistics(testProjectId);

      expect(stats).toBeDefined();
      expect(stats.totalEpics).toBeGreaterThanOrEqual(0);
      expect(stats.totalStories).toBeGreaterThanOrEqual(0);
      expect(stats.totalTasks).toBeGreaterThanOrEqual(0);
      expect(stats.totalInstructions).toBeGreaterThanOrEqual(0);
    });

    it('should calculate epic statistics', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: 'Statistics Test Epic'
      });

      const story = await manager.createStory({
        epicId: epic.id,
        title: 'Stats Story'
      });

      const task = await manager.createTask({
        storyId: story.id,
        title: 'Stats Task',
        type: TaskType.DEV
      });

      const stats = await manager.getEpicStatistics(epic.id);

      expect(stats).toBeDefined();
      expect(stats.id).toBe(epic.id);
      expect(stats.totalStories).toBe(1);
      expect(stats.totalTasks).toBe(1);
      expect(stats.progress).toBeGreaterThanOrEqual(0);
      expect(stats.progress).toBeLessThanOrEqual(100);
    });

    it('should track hierarchy progress', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: 'Progress Test Epic'
      });

      const story = await manager.createStory({
        epicId: epic.id,
        title: 'Progress Story'
      });

      const task = await manager.createTask({
        storyId: story.id,
        title: 'Progress Task',
        type: TaskType.DEV
      });

      const instruction = await manager.createInstruction({
        taskId: task.id,
        directive: 'Do something',
        expectedOutcome: 'Something done',
        sequence: 1
      });

      // 更新一些項目為完成
      await manager.updateInstruction(instruction.id, {
        status: ModelStatus.COMPLETED
      });

      const progress = await manager.getHierarchyProgress(epic.id);

      expect(progress).toBeDefined();
      expect(progress.epicId).toBe(epic.id);
      expect(progress.stories).toHaveLength(1);
      expect(progress.stories[0].tasks).toHaveLength(1);
      expect(progress.stories[0].tasks[0].completedInstructions).toBe(1);
    });
  });

  describe('Validation', () => {
    it('should validate hierarchy structure', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: 'Validation Test Epic'
      });

      const story = await manager.createStory({
        epicId: epic.id,
        title: 'Validation Story'
      });

      const task = await manager.createTask({
        storyId: story.id,
        title: 'Validation Task',
        type: TaskType.DEV
      });

      const instruction = await manager.createInstruction({
        taskId: task.id,
        directive: 'Valid directive',
        expectedOutcome: 'Valid outcome',
        sequence: 1
      });

      const validation = await manager.validateHierarchy(epic.id);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect validation errors', async () => {
      const epic = await manager.createEpic({
        projectId: testProjectId,
        title: '' // Empty title should cause error
      });

      const validation = await manager.validateHierarchy(epic.id);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Event Emissions', () => {
    it('should emit events on creation', (done) => {
      manager.once('epic:created', (epic) => {
        expect(epic).toBeDefined();
        expect(epic.title).toBe('Event Test Epic');
        done();
      });

      manager.createEpic({
        projectId: testProjectId,
        title: 'Event Test Epic'
      });
    });

    it('should emit events on update', (done) => {
      manager.createEpic({
        projectId: testProjectId,
        title: 'Update Event Epic'
      }).then(epic => {
        manager.once('epic:updated', (updated) => {
          expect(updated.id).toBe(epic.id);
          expect(updated.status).toBe(ModelStatus.IN_PROGRESS);
          done();
        });

        manager.updateEpic(epic.id, {
          status: ModelStatus.IN_PROGRESS
        });
      });
    });
  });
});