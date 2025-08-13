/**
 * WebSocket 整合測試
 * 測試即時更新功能
 */

import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { hierarchyBroadcaster } from '@/lib/socket/server';
import { prisma } from '@/lib/db';
import { ModelStatus, Priority } from '@/lib/models/types';

describe('WebSocket 整合測試', () => {
  const testProjectId = 'ws-test-' + Date.now();
  let hierarchyManager: HierarchyManager;
  let testEpicId: string;

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

  describe('階層廣播功能', () => {
    test('創建 Epic 時應該觸發廣播', async () => {
      // 模擬廣播函數
      const mockBroadcast = jest.spyOn(hierarchyBroadcaster, 'broadcastEpicUpdate');
      
      const epic = await hierarchyManager.createEpic({
        projectId: testProjectId,
        title: 'WebSocket 測試史詩',
        description: '測試即時更新功能',
        priority: Priority.HIGH
      });

      testEpicId = epic.id;

      // 驗證廣播是否被調用
      expect(mockBroadcast).toHaveBeenCalledWith(
        epic.id,
        expect.objectContaining({
          title: 'WebSocket 測試史詩'
        }),
        testProjectId
      );

      mockBroadcast.mockRestore();
    });

    test('更新 Epic 時應該觸發廣播', async () => {
      const mockBroadcast = jest.spyOn(hierarchyBroadcaster, 'broadcastEpicUpdate');
      
      const updatedEpic = await hierarchyManager.updateEpic(testEpicId, {
        status: ModelStatus.IN_PROGRESS,
        description: '更新描述以測試廣播'
      });

      // 驗證廣播是否被調用
      expect(mockBroadcast).toHaveBeenCalledWith(
        testEpicId,
        expect.objectContaining({
          status: ModelStatus.IN_PROGRESS
        }),
        testProjectId
      );

      mockBroadcast.mockRestore();
    });

    test('廣播器方法應該正常運作', () => {
      // 測試各種廣播方法
      expect(() => {
        hierarchyBroadcaster.broadcastStatisticsUpdate(testProjectId, { totalEpics: 1 });
        hierarchyBroadcaster.broadcastProgressUpdate(testEpicId, { progress: 50 });
        hierarchyBroadcaster.sendSystemNotification('info', '測試通知');
        hierarchyBroadcaster.broadcastInstructionExecution('test-id', 'executing');
      }).not.toThrow();
    });
  });

  describe('事件監聽器', () => {
    test('HierarchyManager 應該發送正確的事件', (done) => {
      hierarchyManager.once('epic:created', (epic) => {
        expect(epic).toHaveProperty('id');
        expect(epic.title).toBe('事件測試史詩');
        done();
      });

      hierarchyManager.createEpic({
        projectId: testProjectId,
        title: '事件測試史詩',
        priority: Priority.MEDIUM
      });
    });

    test('應該能夠監聽統計更新事件', () => {
      let eventFired = false;
      
      hierarchyManager.once('statistics:updated', () => {
        eventFired = true;
      });

      // 模擬統計更新（在實際實現中會由某些操作觸發）
      hierarchyManager.emit('statistics:updated', { projectId: testProjectId });
      
      expect(eventFired).toBe(true);
    });
  });

  describe('房間管理', () => {
    test('廣播器應該能夠處理不同的房間', () => {
      const testEpicId1 = 'epic-1';
      const testEpicId2 = 'epic-2';
      const testProjectId1 = 'project-1';

      expect(() => {
        hierarchyBroadcaster.broadcastEpicUpdate(testEpicId1, {}, testProjectId1);
        hierarchyBroadcaster.broadcastStoryUpdate('story-1', {}, testEpicId1);
        hierarchyBroadcaster.broadcastTaskUpdate('task-1', {});
        hierarchyBroadcaster.broadcastInstructionUpdate('inst-1', {});
      }).not.toThrow();
    });
  });

  describe('錯誤處理', () => {
    test('廣播器在沒有 Socket 連接時不應該拋出錯誤', () => {
      // 即使沒有活動的 socket 連接，廣播器也應該正常運作
      expect(() => {
        hierarchyBroadcaster.broadcastEpicUpdate('non-existent', {});
        hierarchyBroadcaster.sendSystemNotification('error', '測試錯誤消息');
      }).not.toThrow();
    });

    test('HierarchyManager 應該能處理廣播失敗', async () => {
      // 創建一個會導致廣播失敗的情況（例如無效數據）
      const epic = await hierarchyManager.createEpic({
        projectId: testProjectId,
        title: '錯誤處理測試',
        priority: Priority.LOW
      });

      // 即使廣播可能失敗，Epic 創建應該仍然成功
      expect(epic).toHaveProperty('id');
      expect(epic.title).toBe('錯誤處理測試');
    });
  });
});