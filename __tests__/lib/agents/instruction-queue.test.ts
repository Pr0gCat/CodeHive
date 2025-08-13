import { InstructionQueue, Priority, QueueItemStatus } from '../../../lib/agents/instruction-queue';
import { Instruction } from '../../../lib/agents/project-agent';

describe('InstructionQueue', () => {
  let queue: InstructionQueue;
  let mockInstruction: Instruction;

  beforeEach(() => {
    queue = new InstructionQueue({
      maxSize: 100,
      maxConcurrent: 1
    });

    mockInstruction = {
      id: 'test-instruction-1',
      taskId: 'test-task-1',
      expectedOutcome: 'Test outcome',
      criteria: 'Test criteria',
      directive: 'Test directive',
      status: 'pending'
    };
  });

  afterEach(() => {
    queue.removeAllListeners();
  });

  describe('Basic Queue Operations', () => {
    it('should enqueue items correctly', () => {
      const itemId = queue.enqueue(mockInstruction, {
        priority: Priority.HIGH
      });

      expect(typeof itemId).toBe('string');
      expect(itemId.length).toBeGreaterThan(0);
      
      const stats = queue.getStats();
      expect(stats.pendingItems).toBe(1);
      expect(stats.totalItems).toBe(1);
    });

    it('should dequeue items in priority order', () => {
      // 新增不同優先級的項目
      const lowId = queue.enqueue(mockInstruction, { priority: Priority.LOW });
      const highId = queue.enqueue(mockInstruction, { priority: Priority.HIGH });
      const normalId = queue.enqueue(mockInstruction, { priority: Priority.NORMAL });

      // 應該按優先級順序取出
      const first = queue.dequeue();
      expect(first?.id).toBe(highId);

      // 完成第一個以允許取出下一個
      queue.complete(highId, {});

      const second = queue.dequeue();
      expect(second?.id).toBe(normalId);

      // 完成第二個
      queue.complete(normalId, {});

      const third = queue.dequeue();
      expect(third?.id).toBe(lowId);
    });

    it('should return null when dequeue empty queue', () => {
      const item = queue.dequeue();
      expect(item).toBeNull();
    });

    it('should respect maxConcurrent limit', () => {
      queue.enqueue(mockInstruction);
      queue.enqueue(mockInstruction);

      // 第一個應該成功
      const first = queue.dequeue();
      expect(first).not.toBeNull();

      // 第二個應該失敗（因為maxConcurrent=1）
      const second = queue.dequeue();
      expect(second).toBeNull();
    });
  });

  describe('Item Status Management', () => {
    it('should complete items successfully', () => {
      const itemId = queue.enqueue(mockInstruction);
      const item = queue.dequeue();
      
      expect(item).not.toBeNull();
      expect(item!.status).toBe(QueueItemStatus.PROCESSING);

      const completed = queue.complete(itemId, { result: 'success' });
      expect(completed).toBe(true);

      const stats = queue.getStats();
      expect(stats.completedItems).toBe(1);
      expect(stats.processingItems).toBe(0);
    });

    it('should handle item failures with retry', () => {
      const itemId = queue.enqueue(mockInstruction, { maxRetries: 2 });
      queue.dequeue(); // 開始處理

      const failed = queue.fail(itemId, 'Test error');
      expect(failed).toBe(true);

      // 應該會重新排程
      setTimeout(() => {
        const retryItem = queue.dequeue();
        expect(retryItem).not.toBeNull();
        expect(retryItem!.retryCount).toBe(1);
      }, 100);
    });

    it('should cancel items correctly', () => {
      const itemId = queue.enqueue(mockInstruction);
      
      const cancelled = queue.cancel(itemId);
      expect(cancelled).toBe(true);

      const item = queue.getItem(itemId);
      expect(item?.status).toBe(QueueItemStatus.CANCELLED);
    });
  });

  describe('Priority and Scheduling', () => {
    it('should reschedule items with new priority', () => {
      const itemId = queue.enqueue(mockInstruction, { priority: Priority.LOW });
      queue.enqueue(mockInstruction, { priority: Priority.NORMAL });

      // 重新安排為高優先級
      const rescheduled = queue.reschedule(itemId, Priority.HIGH);
      expect(rescheduled).toBe(true);

      // 現在應該先取得重新安排的項目
      const item = queue.dequeue();
      expect(item?.id).toBe(itemId);
      expect(item?.priority).toBe(Priority.HIGH);
    });

    it('should handle dependencies correctly', () => {
      // 建立有依賴的項目
      const dep1Id = queue.enqueue(mockInstruction, { tags: ['dependency'] });
      const dep2Id = queue.enqueue(mockInstruction, { 
        dependencies: [dep1Id],
        tags: ['dependent'] 
      });

      // 依賴項目應該先執行
      const first = queue.dequeue();
      expect(first?.id).toBe(dep1Id);

      // 完成依賴項目
      queue.complete(dep1Id, {});

      // 現在應該可以執行依賴它的項目
      const second = queue.dequeue();
      expect(second?.id).toBe(dep2Id);
    });
  });

  describe('Statistics and Info', () => {
    it('should provide accurate statistics', () => {
      queue.enqueue(mockInstruction);
      queue.enqueue(mockInstruction);
      
      const stats = queue.getStats();
      expect(stats.totalItems).toBe(2);
      expect(stats.pendingItems).toBe(2);
      expect(stats.processingItems).toBe(0);
      expect(stats.completedItems).toBe(0);
    });

    it('should provide queue info', () => {
      const itemId = queue.enqueue(mockInstruction, {
        priority: Priority.HIGH,
        tags: ['test']
      });

      const info = queue.getQueueInfo();
      expect(info.pendingItems).toHaveLength(1);
      expect(info.pendingItems[0].id).toBe(itemId);
      expect(info.pendingItems[0].priority).toBe(Priority.HIGH);
      expect(info.totalSize).toBe(1);
    });

    it('should find items by tag', () => {
      queue.enqueue(mockInstruction, { tags: ['tag1', 'tag2'] });
      queue.enqueue(mockInstruction, { tags: ['tag2', 'tag3'] });
      queue.enqueue(mockInstruction, { tags: ['tag3'] });

      const tag2Items = queue.getItemsByTag('tag2');
      expect(tag2Items).toHaveLength(2);

      const tag1Items = queue.getItemsByTag('tag1');
      expect(tag1Items).toHaveLength(1);
    });
  });

  describe('Event Handling', () => {
    it('should emit events for queue operations', (done) => {
      let eventCount = 0;

      queue.on('item:enqueued', (event) => {
        expect(event.priority).toBeDefined();
        expect(event.queueSize).toBeDefined();
        eventCount++;
      });

      queue.on('item:dequeued', (event) => {
        expect(event.itemId).toBeDefined();
        expect(event.waitTime).toBeGreaterThanOrEqual(0);
        eventCount++;
      });

      queue.on('item:completed', (event) => {
        expect(event.itemId).toBeDefined();
        eventCount++;
        
        if (eventCount === 3) {
          done();
        }
      });

      const itemId = queue.enqueue(mockInstruction);
      const item = queue.dequeue();
      queue.complete(itemId, {});
    });

    it('should emit stats updates', (done) => {
      queue.on('stats:updated', (stats) => {
        expect(stats.totalItems).toBeGreaterThan(0);
        done();
      });

      queue.enqueue(mockInstruction);
    });
  });

  describe('Queue Management', () => {
    it('should clear queue correctly', () => {
      queue.enqueue(mockInstruction);
      queue.enqueue(mockInstruction);

      let clearedCount = 0;
      queue.on('queue:cleared', (event) => {
        clearedCount = event.clearedCount;
      });

      queue.clear();

      expect(clearedCount).toBe(2);
      expect(queue.getStats().totalItems).toBe(0);
    });

    it('should respect max queue size', () => {
      const smallQueue = new InstructionQueue({ maxSize: 2 });

      smallQueue.enqueue(mockInstruction);
      smallQueue.enqueue(mockInstruction);

      // 第三個應該失敗
      expect(() => {
        smallQueue.enqueue(mockInstruction);
      }).toThrow('Queue is full');
    });
  });
});