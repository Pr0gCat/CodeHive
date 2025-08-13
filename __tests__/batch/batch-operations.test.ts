/**
 * 批量操作整合測試
 * 測試批量處理和工作流程自動化功能
 */

import { BatchOperationsManager } from '@/lib/batch/batch-operations';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { prisma } from '@/lib/db';
import { Priority } from '@/lib/models/types';

describe('批量操作整合測試', () => {
  const testProjectId = 'batch-test-' + Date.now();
  let hierarchyManager: HierarchyManager;
  let batchManager: BatchOperationsManager;
  let testEpicId: string;
  let testStoryId: string;

  beforeAll(async () => {
    hierarchyManager = new HierarchyManager(prisma);
    batchManager = new BatchOperationsManager(prisma, hierarchyManager);

    // 創建測試數據
    const epic = await hierarchyManager.createEpic({
      projectId: testProjectId,
      title: '批量操作測試史詩',
      description: '用於測試批量操作功能',
      priority: Priority.HIGH
    });
    testEpicId = epic.id;

    const story = await hierarchyManager.createStory({
      epicId: testEpicId,
      title: '批量操作測試故事',
      userStory: '作為用戶，我想要測試批量操作功能',
      priority: Priority.MEDIUM
    });
    testStoryId = story.id;
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

  describe('批量創建操作', () => {
    test('應該能夠批量創建任務', async () => {
      const tasks = [
        {
          storyId: testStoryId,
          title: '批量任務 1',
          type: 'DEV',
          priority: Priority.MEDIUM
        },
        {
          storyId: testStoryId,
          title: '批量任務 2',
          type: 'TEST',
          priority: Priority.LOW
        },
        {
          storyId: testStoryId,
          title: '批量任務 3',
          type: 'REVIEW',
          priority: Priority.HIGH
        }
      ];

      const operationId = await batchManager.createBatchOperation({
        type: 'create',
        targetType: 'task',
        items: tasks,
        options: {
          continueOnError: true,
          maxConcurrency: 2,
          validateFirst: true
        },
        createdBy: 'test-user'
      });

      expect(operationId).toBeTruthy();

      // 等待操作完成
      await new Promise(resolve => setTimeout(resolve, 2000));

      const operation = batchManager.getBatchOperation(operationId);
      expect(operation).toBeTruthy();
      expect(operation!.status).toBe('completed');
      expect(operation!.successfulItems).toBe(3);
      expect(operation!.failedItems).toBe(0);

      // 驗證任務是否被創建
      const createdTasks = await hierarchyManager.listTasks({ storyId: testStoryId });
      expect(createdTasks.length).toBeGreaterThanOrEqual(3);
    }, 10000);

    test('應該能夠處理批量創建中的錯誤', async () => {
      const invalidTasks = [
        {
          storyId: testStoryId,
          title: '有效任務',
          type: 'DEV',
          priority: Priority.MEDIUM
        },
        {
          // 缺少必要字段
          storyId: testStoryId,
          title: '',  // 空標題應該造成錯誤
          priority: Priority.LOW
        }
      ];

      const operationId = await batchManager.createBatchOperation({
        type: 'create',
        targetType: 'task',
        items: invalidTasks,
        options: {
          continueOnError: true,
          validateFirst: true
        },
        createdBy: 'test-user'
      });

      // 等待操作完成
      await new Promise(resolve => setTimeout(resolve, 2000));

      const operation = batchManager.getBatchOperation(operationId);
      expect(operation).toBeTruthy();
      expect(operation!.errors.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('工作流程執行', () => {
    test('應該能夠執行預設的史詩到故事工作流程', async () => {
      // 創建一個新的史詩來觸發工作流程
      const newEpic = await hierarchyManager.createEpic({
        projectId: testProjectId,
        title: '工作流程測試史詩',
        description: '用於測試自動化工作流程',
        priority: Priority.HIGH
      });

      // 執行工作流程
      const executionId = await batchManager.executeWorkflow('epic-to-stories', {
        epic: newEpic
      });

      expect(executionId).toBeTruthy();

      // 等待工作流程完成
      await new Promise(resolve => setTimeout(resolve, 3000));

      const execution = batchManager.getWorkflowExecution(executionId);
      expect(execution).toBeTruthy();
      expect(execution!.status).toBe('completed');

      // 驗證是否生成了故事
      const stories = await hierarchyManager.listStories({ epicId: newEpic.id });
      expect(stories.length).toBeGreaterThan(0);
    }, 15000);

    test('應該能夠處理工作流程中的錯誤', async () => {
      // 嘗試執行一個不存在的工作流程
      try {
        await batchManager.executeWorkflow('non-existent-workflow', {});
        fail('應該拋出錯誤');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('工作流程不存在');
      }
    });

    test('應該能夠添加和執行自定義工作流程', async () => {
      const customWorkflow = {
        id: 'test-custom-workflow',
        name: '測試自定義工作流程',
        description: '用於測試的自定義工作流程',
        triggers: [
          {
            type: 'manual',
            conditions: {}
          }
        ],
        steps: [
          {
            id: 'test-step',
            type: 'wait',
            config: {
              duration: 100
            }
          }
        ],
        conditions: [],
        isActive: true
      };

      batchManager.addWorkflow(customWorkflow);

      const workflows = batchManager.getAllWorkflows();
      const addedWorkflow = workflows.find(w => w.id === 'test-custom-workflow');
      expect(addedWorkflow).toBeTruthy();
      expect(addedWorkflow!.name).toBe('測試自定義工作流程');

      // 執行自定義工作流程
      const executionId = await batchManager.executeWorkflow('test-custom-workflow', {});
      expect(executionId).toBeTruthy();

      // 等待執行完成
      await new Promise(resolve => setTimeout(resolve, 500));

      const execution = batchManager.getWorkflowExecution(executionId);
      expect(execution).toBeTruthy();
      expect(execution!.status).toBe('completed');
    });
  });

  describe('操作管理', () => {
    test('應該能夠取消執行中的操作', async () => {
      // 創建一個長時間運行的操作
      const longRunningTasks = Array.from({ length: 10 }, (_, i) => ({
        storyId: testStoryId,
        title: `長時間任務 ${i + 1}`,
        type: 'DEV',
        priority: Priority.LOW
      }));

      const operationId = await batchManager.createBatchOperation({
        type: 'create',
        targetType: 'task',
        items: longRunningTasks,
        options: {
          delay: 500, // 較長的延遲
          maxConcurrency: 1
        },
        createdBy: 'test-user'
      });

      // 稍等一下讓操作開始
      await new Promise(resolve => setTimeout(resolve, 100));

      let operation = batchManager.getBatchOperation(operationId);
      expect(operation!.status).toBe('running');

      // 取消操作
      await batchManager.cancelBatchOperation(operationId);

      operation = batchManager.getBatchOperation(operationId);
      expect(operation!.status).toBe('cancelled');
    });

    test('應該能夠獲取批量操作統計', async () => {
      const stats = batchManager.getBatchStats();

      expect(stats).toHaveProperty('totalOperations');
      expect(stats).toHaveProperty('runningOperations');
      expect(stats).toHaveProperty('completedOperations');
      expect(stats).toHaveProperty('failedOperations');
      expect(stats).toHaveProperty('totalItemsProcessed');
      expect(stats).toHaveProperty('successRate');

      expect(typeof stats.totalOperations).toBe('number');
      expect(typeof stats.successRate).toBe('number');
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(1);
    });

    test('應該能夠列出所有操作', async () => {
      const operations = batchManager.getAllBatchOperations();
      
      expect(Array.isArray(operations)).toBe(true);
      expect(operations.length).toBeGreaterThan(0);

      // 檢查操作結構
      const firstOperation = operations[0];
      expect(firstOperation).toHaveProperty('id');
      expect(firstOperation).toHaveProperty('type');
      expect(firstOperation).toHaveProperty('targetType');
      expect(firstOperation).toHaveProperty('status');
      expect(firstOperation).toHaveProperty('progress');
    });
  });

  describe('事件系統', () => {
    test('應該發送批量操作相關事件', (done) => {
      let eventsReceived = 0;
      const requiredEvents = ['batch:created', 'batch:completed'];

      requiredEvents.forEach(eventType => {
        batchManager.once(eventType, () => {
          eventsReceived++;
          if (eventsReceived === requiredEvents.length) {
            done();
          }
        });
      });

      // 創建一個簡單的批量操作來觸發事件
      batchManager.createBatchOperation({
        type: 'create',
        targetType: 'task',
        items: [{
          storyId: testStoryId,
          title: '事件測試任務',
          type: 'DEV',
          priority: Priority.LOW
        }],
        createdBy: 'test-user'
      });
    }, 5000);

    test('應該發送工作流程相關事件', (done) => {
      batchManager.once('workflow:completed', (execution) => {
        expect(execution).toHaveProperty('id');
        expect(execution).toHaveProperty('status');
        expect(execution.status).toBe('completed');
        done();
      });

      batchManager.executeWorkflow('epic-to-stories', {
        epic: { id: testEpicId, title: '測試史詩' }
      });
    }, 5000);
  });

  describe('驗證功能', () => {
    test('應該在創建前驗證項目', async () => {
      const invalidItems = [
        {
          // 缺少必要的 storyId
          title: '無效任務',
          type: 'DEV',
          priority: Priority.LOW
        }
      ];

      const operationId = await batchManager.createBatchOperation({
        type: 'create',
        targetType: 'task',
        items: invalidItems,
        options: {
          validateFirst: true,
          continueOnError: false
        },
        createdBy: 'test-user'
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const operation = batchManager.getBatchOperation(operationId);
      expect(operation).toBeTruthy();
      expect(operation!.status).toBe('failed');
      expect(operation!.errors.length).toBeGreaterThan(0);
    });
  });
});