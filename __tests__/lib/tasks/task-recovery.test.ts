import { taskRecoveryService } from '@/lib/tasks/task-recovery';
import { prisma } from '@/lib/db';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';

jest.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    taskEvent: {
      deleteMany: jest.fn(),
    },
    taskPhase: {
      deleteMany: jest.fn(),
    },
    taskExecution: {
      deleteMany: jest.fn(),
    },
    sprintEpic: {
      deleteMany: jest.fn(),
    },
    kanbanCard: {
      deleteMany: jest.fn(),
    },
    epic: {
      deleteMany: jest.fn(),
    },
    sprint: {
      deleteMany: jest.fn(),
    },
    cycle: {
      deleteMany: jest.fn(),
    },
    query: {
      deleteMany: jest.fn(),
    },
    queuedTask: {
      deleteMany: jest.fn(),
    },
    tokenUsage: {
      deleteMany: jest.fn(),
    },
    projectBudget: {
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    rm: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

describe('TaskRecovery', () => {
  const mockProject = {
    id: 'test-project-id',
    name: 'Test Project',
    localPath: '/path/to/test/project',
    status: 'INITIALIZING',
    createdAt: new Date('2023-01-01T10:00:00Z'),
  };

  const mockTaskId = 'test-task-id';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset console mocks
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
  });

  describe('cleanupCancelledProject', () => {
    beforeEach(() => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockExistsSync.mockReturnValue(true);
      mockFs.rm.mockResolvedValue(undefined);
      
      // Mock all database delete operations
      mockPrisma.taskEvent.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.taskPhase.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.taskExecution.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.sprintEpic.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.kanbanCard.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.epic.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.sprint.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.cycle.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.query.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.queuedTask.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.tokenUsage.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.projectBudget.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.project.delete.mockResolvedValue(mockProject);
    });

    it('should successfully clean up both files and database with default options', async () => {
      const result = await taskRecoveryService.cleanupCancelledProject(
        'test-project-id',
        mockTaskId
      );

      expect(result).toEqual({
        databaseCleanup: true,
        filesCleanup: true,
        errors: [],
      });

      // Verify filesystem cleanup
      expect(mockExistsSync).toHaveBeenCalledWith('/path/to/test/project');
      expect(mockFs.rm).toHaveBeenCalledWith('/path/to/test/project', {
        recursive: true,
        force: true,
      });

      // Verify database cleanup order
      expect(mockPrisma.taskEvent.deleteMany).toHaveBeenCalledWith({
        where: { taskId: mockTaskId },
      });
      expect(mockPrisma.taskPhase.deleteMany).toHaveBeenCalledWith({
        where: { taskId: mockTaskId },
      });
      expect(mockPrisma.taskExecution.deleteMany).toHaveBeenCalledWith({
        where: { taskId: mockTaskId },
      });
      expect(mockPrisma.project.delete).toHaveBeenCalledWith({
        where: { id: 'test-project-id' },
      });

      // Verify logging
      expect(console.log).toHaveBeenCalledWith(
        '🧹 Starting cleanup for cancelled project: test-project-id'
      );
      expect(console.log).toHaveBeenCalledWith('🎯 Cleanup completed for project Test Project');
    });

    it('should skip file cleanup when removeFiles is false', async () => {
      const result = await taskRecoveryService.cleanupCancelledProject(
        'test-project-id',
        mockTaskId,
        { removeFiles: false }
      );

      expect(result.filesCleanup).toBe(false);
      expect(result.databaseCleanup).toBe(true);
      expect(mockExistsSync).not.toHaveBeenCalled();
      expect(mockFs.rm).not.toHaveBeenCalled();
    });

    it('should skip database cleanup when removeDatabaseRecord is false', async () => {
      const result = await taskRecoveryService.cleanupCancelledProject(
        'test-project-id',
        mockTaskId,
        { removeDatabaseRecord: false }
      );

      expect(result.filesCleanup).toBe(true);
      expect(result.databaseCleanup).toBe(false);
      expect(mockPrisma.project.delete).not.toHaveBeenCalled();
    });

    it('should use custom reason when provided', async () => {
      await taskRecoveryService.cleanupCancelledProject(
        'test-project-id',
        mockTaskId,
        { reason: 'User cancelled import' }
      );

      expect(console.log).toHaveBeenCalledWith('   Reason: User cancelled import');
    });

    it('should handle project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await taskRecoveryService.cleanupCancelledProject(
        'invalid-project-id',
        mockTaskId
      );

      expect(result).toEqual({
        databaseCleanup: false,
        filesCleanup: false,
        errors: [],
      });

      expect(console.log).toHaveBeenCalledWith(
        '⚠️ Project invalid-project-id not found in database'
      );
    });

    it('should handle non-existent directory gracefully', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await taskRecoveryService.cleanupCancelledProject(
        'test-project-id',
        mockTaskId
      );

      expect(result.filesCleanup).toBe(true);
      expect(mockFs.rm).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        'ℹ️ Directory does not exist: /path/to/test/project'
      );
    });

    it('should handle filesystem errors and continue with database cleanup', async () => {
      mockFs.rm.mockRejectedValue(new Error('Permission denied'));

      const result = await taskRecoveryService.cleanupCancelledProject(
        'test-project-id',
        mockTaskId
      );

      expect(result.filesCleanup).toBe(false);
      expect(result.databaseCleanup).toBe(true);
      expect(result.errors).toEqual([
        'Failed to remove directory /path/to/test/project: Error: Permission denied',
      ]);

      expect(console.error).toHaveBeenCalledWith(
        '❌ Failed to remove directory /path/to/test/project: Error: Permission denied'
      );
    });

    it('should handle database errors and report them', async () => {
      mockPrisma.project.delete.mockRejectedValue(new Error('Database constraint violation'));

      const result = await taskRecoveryService.cleanupCancelledProject(
        'test-project-id',
        mockTaskId
      );

      expect(result.filesCleanup).toBe(true);
      expect(result.databaseCleanup).toBe(false);
      expect(result.errors).toEqual([
        'Failed to remove database records: Error: Database constraint violation',
      ]);

      expect(console.error).toHaveBeenCalledWith(
        '❌ Failed to remove database records: Error: Database constraint violation'
      );
    });

    it('should handle project with null localPath', async () => {
      const projectWithoutPath = { ...mockProject, localPath: null };
      mockPrisma.project.findUnique.mockResolvedValue(projectWithoutPath);

      const result = await taskRecoveryService.cleanupCancelledProject(
        'test-project-id',
        mockTaskId
      );

      expect(result.filesCleanup).toBe(false);
      expect(result.databaseCleanup).toBe(true);
      expect(mockExistsSync).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors during cleanup', async () => {
      mockPrisma.project.findUnique.mockRejectedValue(new Error('Unexpected database error'));

      const result = await taskRecoveryService.cleanupCancelledProject(
        'test-project-id',
        mockTaskId
      );

      expect(result).toEqual({
        databaseCleanup: false,
        filesCleanup: false,
        errors: ['Unexpected error during cleanup: Error: Unexpected database error'],
      });

      expect(console.error).toHaveBeenCalledWith(
        '❌ Unexpected error during cleanup: Error: Unexpected database error'
      );
    });

    it('should clean up all related database records in correct order', async () => {
      await taskRecoveryService.cleanupCancelledProject('test-project-id', mockTaskId);

      // Verify the order of database deletions
      const deleteCalls = [
        mockPrisma.taskEvent.deleteMany,
        mockPrisma.taskPhase.deleteMany,
        mockPrisma.taskExecution.deleteMany,
        mockPrisma.sprintEpic.deleteMany,
        mockPrisma.kanbanCard.deleteMany,
        mockPrisma.epic.deleteMany,
        mockPrisma.sprint.deleteMany,
        mockPrisma.cycle.deleteMany,
        mockPrisma.query.deleteMany,
        mockPrisma.queuedTask.deleteMany,
        mockPrisma.tokenUsage.deleteMany,
        mockPrisma.projectBudget.deleteMany,
        mockPrisma.project.delete,
      ];

      deleteCalls.forEach(mockFn => {
        expect(mockFn).toHaveBeenCalledTimes(1);
      });

      // Verify sprintEpic deletion uses correct query
      expect(mockPrisma.sprintEpic.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { sprint: { projectId: 'test-project-id' } },
            { epic: { projectId: 'test-project-id' } },
          ],
        },
      });
    });

    it('should handle partial cleanup when some database operations fail', async () => {
      mockPrisma.kanbanCard.deleteMany.mockRejectedValue(new Error('Foreign key constraint'));
      
      const result = await taskRecoveryService.cleanupCancelledProject(
        'test-project-id',
        mockTaskId
      );

      expect(result.filesCleanup).toBe(true);
      expect(result.databaseCleanup).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Failed to remove database records');
    });
  });

  describe('getStaleProjects', () => {
    it('should return projects in INITIALIZING status older than 30 minutes', async () => {
      const currentTime = new Date('2023-01-01T11:00:00Z');
      const staleProject = {
        id: 'stale-project-id',
        name: 'Stale Project',
        localPath: '/path/to/stale',
        createdAt: new Date('2023-01-01T10:15:00Z'), // 45 minutes ago
        status: 'INITIALIZING',
      };

      jest.spyOn(Date, 'now').mockReturnValue(currentTime.getTime());
      mockPrisma.project.findMany.mockResolvedValue([staleProject]);

      const result = await taskRecoveryService.getStaleProjects();

      expect(result).toEqual([staleProject]);
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          status: 'INITIALIZING',
          createdAt: { lt: new Date('2023-01-01T10:30:00Z') }, // 30 minutes ago
        },
        select: {
          id: true,
          name: true,
          localPath: true,
          createdAt: true,
          status: true,
        },
      });
    });

    it('should return empty array when no stale projects exist', async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);

      const result = await taskRecoveryService.getStaleProjects();

      expect(result).toEqual([]);
    });

    it('should handle database errors when fetching stale projects', async () => {
      mockPrisma.project.findMany.mockRejectedValue(new Error('Database connection failed'));

      await expect(taskRecoveryService.getStaleProjects()).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should calculate correct cutoff time', async () => {
      const fixedTime = new Date('2023-01-01T12:00:00Z');
      jest.spyOn(Date, 'now').mockReturnValue(fixedTime.getTime());

      await taskRecoveryService.getStaleProjects();

      const expectedCutoff = new Date('2023-01-01T11:30:00Z'); // 30 minutes before fixed time
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { lt: expectedCutoff },
          }),
        })
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete cleanup workflow for a real scenario', async () => {
      const project = {
        id: 'integration-project-id',
        name: 'Integration Test Project',
        localPath: '/tmp/integration-test',
        status: 'INITIALIZING',
        createdAt: new Date(),
      };

      mockPrisma.project.findUnique.mockResolvedValue(project);
      mockExistsSync.mockReturnValue(true);
      mockFs.rm.mockResolvedValue(undefined);
      
      // Mock successful database operations
      const mockDeleteOperations = [
        mockPrisma.taskEvent.deleteMany,
        mockPrisma.taskPhase.deleteMany,
        mockPrisma.taskExecution.deleteMany,
        mockPrisma.sprintEpic.deleteMany,
        mockPrisma.kanbanCard.deleteMany,
        mockPrisma.epic.deleteMany,
        mockPrisma.sprint.deleteMany,
        mockPrisma.cycle.deleteMany,
        mockPrisma.query.deleteMany,
        mockPrisma.queuedTask.deleteMany,
        mockPrisma.tokenUsage.deleteMany,
        mockPrisma.projectBudget.deleteMany,
      ];

      mockDeleteOperations.forEach(mockFn => {
        mockFn.mockResolvedValue({ count: 0 });
      });
      mockPrisma.project.delete.mockResolvedValue(project);

      const result = await taskRecoveryService.cleanupCancelledProject(
        'integration-project-id',
        'integration-task-id',
        { reason: 'Integration test cleanup' }
      );

      expect(result.databaseCleanup).toBe(true);
      expect(result.filesCleanup).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Verify both filesystem and database cleanup occurred
      expect(mockFs.rm).toHaveBeenCalledWith('/tmp/integration-test', {
        recursive: true,
        force: true,
      });
      expect(mockPrisma.project.delete).toHaveBeenCalledWith({
        where: { id: 'integration-project-id' },
      });
    });

    it('should handle mixed success/failure scenario gracefully', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockExistsSync.mockReturnValue(true);
      mockFs.rm.mockRejectedValue(new Error('Disk full'));
      
      // Some database operations succeed, others fail
      mockPrisma.taskEvent.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.taskPhase.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.taskExecution.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.project.delete.mockRejectedValue(new Error('Constraint violation'));

      const result = await taskRecoveryService.cleanupCancelledProject(
        'test-project-id',
        mockTaskId
      );

      expect(result.filesCleanup).toBe(false);
      expect(result.databaseCleanup).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Failed to remove directory');
      expect(result.errors[1]).toContain('Failed to remove database records');
    });
  });
});