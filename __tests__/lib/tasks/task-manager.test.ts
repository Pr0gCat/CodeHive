import { TaskManager } from '@/lib/tasks/task-manager';
import { prisma } from '@/lib/db';
import { TaskPhaseDefinition, TaskEventType } from '@/lib/types/shared';
import { mockPrisma, clearAllMocks } from '@/__tests__/helpers/test-utils';

jest.mock('@/lib/db', () => ({
  prisma: {
    taskExecution: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    taskPhase: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    taskEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const mockPrismaDb = prisma as jest.Mocked<typeof prisma>;

describe('TaskManager', () => {
  let taskManager: TaskManager;
  const mockProgressCallback = jest.fn();

  const mockPhases: TaskPhaseDefinition[] = [
    {
      id: 'validation',
      name: 'Validation',
      description: 'Validating inputs',
      estimatedDuration: 5000,
    },
    {
      id: 'execution',
      name: 'Execution',
      description: 'Executing task',
      estimatedDuration: 15000,
    },
    {
      id: 'cleanup',
      name: 'Cleanup',
      description: 'Cleaning up resources',
      estimatedDuration: 3000,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    clearAllMocks();
    taskManager = new TaskManager();
  });

  describe('createTask', () => {
    it('should create a new task with phases', async () => {
      const mockTask = {
        id: 'test-task-id',
        type: 'PROJECT_CREATE',
        status: 'PENDING',
        projectId: 'test-project-id',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
      };

      const mockTaskPhases = mockPhases.map((phase, index) => ({
        id: `phase-${index}`,
        taskId: 'test-task-id',
        phaseId: phase.id,
        name: phase.name,
        description: phase.description,
        status: 'PENDING',
        progress: 0,
        estimatedDuration: phase.estimatedDuration,
        actualDuration: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockPrismaDb.taskExecution.create.mockResolvedValueOnce(mockTask);
      mockPrismaDb.taskPhase.create.mockImplementation((data) => 
        Promise.resolve(mockTaskPhases.find(p => p.phaseId === data.data.phaseId)!)
      );

      const options = {
        projectId: 'test-project-id',
        metadata: { source: 'test' },
        progressCallback: mockProgressCallback,
      };

      const result = await taskManager.createTask(
        'test-task-id',
        'PROJECT_CREATE',
        mockPhases,
        options
      );

      expect(result).toEqual(mockTask);
      expect(mockPrismaDb.taskExecution.create).toHaveBeenCalledWith({
        data: {
          id: 'test-task-id',
          type: 'PROJECT_CREATE',
          status: 'PENDING',
          projectId: 'test-project-id',
          metadata: { source: 'test' },
        },
      });
      expect(mockPrismaDb.taskPhase.create).toHaveBeenCalledTimes(3);
    });

    it('should handle task creation without optional parameters', async () => {
      const mockTask = {
        id: 'simple-task-id',
        type: 'PROJECT_IMPORT',
        status: 'PENDING',
        projectId: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
      };

      mockPrismaDb.taskExecution.create.mockResolvedValueOnce(mockTask);
      mockPrismaDb.taskPhase.create.mockResolvedValue({} as any);

      const result = await taskManager.createTask(
        'simple-task-id',
        'PROJECT_IMPORT',
        mockPhases
      );

      expect(result).toEqual(mockTask);
      expect(mockPrismaDb.taskExecution.create).toHaveBeenCalledWith({
        data: {
          id: 'simple-task-id',
          type: 'PROJECT_IMPORT',
          status: 'PENDING',
          projectId: null,
          metadata: {},
        },
      });
    });
  });

  describe('startTask', () => {
    it('should start a task and update status', async () => {
      const mockUpdatedTask = {
        id: 'test-task-id',
        type: 'PROJECT_CREATE',
        status: 'IN_PROGRESS',
        projectId: 'test-project-id',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
      };

      mockPrismaDb.taskExecution.update.mockResolvedValueOnce(mockUpdatedTask);
      mockPrismaDb.taskEvent.create.mockResolvedValueOnce({} as any);

      const result = await taskManager.startTask('test-task-id');

      expect(result).toEqual(mockUpdatedTask);
      expect(mockPrismaDb.taskExecution.update).toHaveBeenCalledWith({
        where: { id: 'test-task-id' },
        data: {
          status: 'IN_PROGRESS',
          startedAt: expect.any(Date),
        },
      });
      expect(mockPrismaDb.taskEvent.create).toHaveBeenCalledWith({
        data: {
          taskId: 'test-task-id',
          type: 'TASK_STARTED',
          message: 'Task started',
          data: {},
          timestamp: expect.any(Date),
        },
      });
    });
  });

  describe('updatePhaseProgress', () => {
    it('should update phase progress and create event', async () => {
      const mockEvent = {
        id: 'event-id',
        taskId: 'test-task-id',
        type: 'PROGRESS' as TaskEventType,
        message: 'Progress update',
        data: { progress: 50 },
        timestamp: new Date(),
      };

      mockPrismaDb.taskPhase.update.mockResolvedValueOnce({} as any);
      mockPrismaDb.taskEvent.create.mockResolvedValueOnce(mockEvent);

      await taskManager.updatePhaseProgress(
        'test-task-id',
        'validation',
        50,
        {
          type: 'PROGRESS',
          message: 'Validation 50% complete',
          data: { files: 10 },
        }
      );

      expect(mockPrismaDb.taskPhase.update).toHaveBeenCalledWith({
        where: {
          taskId_phaseId: {
            taskId: 'test-task-id',
            phaseId: 'validation',
          },
        },
        data: {
          progress: 50,
          status: 'IN_PROGRESS',
          startedAt: expect.any(Date),
        },
      });

      expect(mockPrismaDb.taskEvent.create).toHaveBeenCalledWith({
        data: {
          taskId: 'test-task-id',
          phaseId: 'validation',
          type: 'PROGRESS',
          message: 'Validation 50% complete',
          data: { files: 10 },
          timestamp: expect.any(Date),
        },
      });
    });

    it('should mark phase as completed when progress reaches 100', async () => {
      mockPrismaDb.taskPhase.update.mockResolvedValueOnce({} as any);
      mockPrismaDb.taskEvent.create.mockResolvedValueOnce({} as any);

      await taskManager.updatePhaseProgress(
        'test-task-id',
        'validation',
        100,
        {
          type: 'PHASE_COMPLETED',
          message: 'Validation completed',
        }
      );

      expect(mockPrismaDb.taskPhase.update).toHaveBeenCalledWith({
        where: {
          taskId_phaseId: {
            taskId: 'test-task-id',
            phaseId: 'validation',
          },
        },
        data: {
          progress: 100,
          status: 'COMPLETED',
          startedAt: expect.any(Date),
          completedAt: expect.any(Date),
        },
      });
    });
  });

  describe('completeTask', () => {
    it('should complete a task with result', async () => {
      const mockCompletedTask = {
        id: 'test-task-id',
        type: 'PROJECT_CREATE',
        status: 'COMPLETED',
        projectId: 'test-project-id',
        metadata: {},
        result: { success: true, projectId: 'created-project' },
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
      };

      mockPrismaDb.taskExecution.update.mockResolvedValueOnce(mockCompletedTask);
      mockPrismaDb.taskEvent.create.mockResolvedValueOnce({} as any);

      const result = await taskManager.completeTask('test-task-id', {
        success: true,
        projectId: 'created-project',
      });

      expect(result).toEqual(mockCompletedTask);
      expect(mockPrismaDb.taskExecution.update).toHaveBeenCalledWith({
        where: { id: 'test-task-id' },
        data: {
          status: 'COMPLETED',
          result: { success: true, projectId: 'created-project' },
          completedAt: expect.any(Date),
        },
      });
    });

    it('should fail a task with error', async () => {
      const mockFailedTask = {
        id: 'test-task-id',
        type: 'PROJECT_CREATE',
        status: 'FAILED',
        projectId: 'test-project-id',
        metadata: {},
        error: 'Task failed due to validation error',
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
      };

      mockPrismaDb.taskExecution.update.mockResolvedValueOnce(mockFailedTask);
      mockPrismaDb.taskEvent.create.mockResolvedValueOnce({} as any);

      const result = await taskManager.failTask(
        'test-task-id',
        'Task failed due to validation error'
      );

      expect(result).toEqual(mockFailedTask);
      expect(mockPrismaDb.taskExecution.update).toHaveBeenCalledWith({
        where: { id: 'test-task-id' },
        data: {
          status: 'FAILED',
          error: 'Task failed due to validation error',
          completedAt: expect.any(Date),
        },
      });
    });
  });

  describe('getTaskStatus', () => {
    it('should return task with phases and events', async () => {
      const mockTask = {
        id: 'test-task-id',
        type: 'PROJECT_CREATE',
        status: 'IN_PROGRESS',
        projectId: 'test-project-id',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        phases: mockPhases.map((phase) => ({
          id: `phase-${phase.id}`,
          taskId: 'test-task-id',
          phaseId: phase.id,
          name: phase.name,
          description: phase.description,
          status: 'PENDING',
          progress: 0,
          estimatedDuration: phase.estimatedDuration,
          actualDuration: null,
          startedAt: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        events: [],
      };

      mockPrismaDb.taskExecution.findUnique.mockResolvedValueOnce(mockTask);

      const result = await taskManager.getTaskStatus('test-task-id');

      expect(result).toEqual(mockTask);
      expect(mockPrismaDb.taskExecution.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-task-id' },
        include: {
          phases: {
            orderBy: { createdAt: 'asc' },
          },
          events: {
            orderBy: { timestamp: 'asc' },
          },
        },
      });
    });

    it('should return null for non-existent task', async () => {
      mockPrismaDb.taskExecution.findUnique.mockResolvedValueOnce(null);

      const result = await taskManager.getTaskStatus('non-existent-task');

      expect(result).toBeNull();
    });
  });

  describe('cancelTask', () => {
    it('should cancel a running task', async () => {
      const mockCancelledTask = {
        id: 'test-task-id',
        type: 'PROJECT_CREATE',
        status: 'CANCELLED',
        projectId: 'test-project-id',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
      };

      mockPrismaDb.taskExecution.update.mockResolvedValueOnce(mockCancelledTask);
      mockPrismaDb.taskEvent.create.mockResolvedValueOnce({} as any);

      const result = await taskManager.cancelTask('test-task-id');

      expect(result).toEqual(mockCancelledTask);
      expect(mockPrismaDb.taskExecution.update).toHaveBeenCalledWith({
        where: { id: 'test-task-id' },
        data: {
          status: 'CANCELLED',
          completedAt: expect.any(Date),
        },
      });
    });
  });

  describe('progress callback integration', () => {
    it('should call progress callback when provided', async () => {
      const mockTask = {
        id: 'test-task-id',
        type: 'PROJECT_CREATE',
        status: 'PENDING',
        projectId: 'test-project-id',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
      };

      mockPrismaDb.taskExecution.create.mockResolvedValueOnce(mockTask);
      mockPrismaDb.taskPhase.create.mockResolvedValue({} as any);
      mockPrismaDb.taskPhase.update.mockResolvedValue({} as any);
      mockPrismaDb.taskEvent.create.mockResolvedValue({} as any);

      await taskManager.createTask(
        'test-task-id',
        'PROJECT_CREATE',
        mockPhases,
        {
          projectId: 'test-project-id',
          progressCallback: mockProgressCallback,
        }
      );

      await taskManager.updatePhaseProgress(
        'test-task-id',
        'validation',
        50,
        {
          type: 'PROGRESS',
          message: 'Progress update',
        }
      );

      expect(mockProgressCallback).toHaveBeenCalledWith({
        taskId: 'test-task-id',
        projectId: 'test-project-id',
        phase: 'validation',
        progress: 50,
        message: 'Progress update',
        timestamp: expect.any(String),
      });
    });
  });
});
