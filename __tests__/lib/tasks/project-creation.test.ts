import { createProjectAsync } from '@/lib/tasks/project-creation';
import { prisma } from '@/lib/db';
import { TaskManager } from '@/lib/tasks/task-manager';
import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';

jest.mock('@/lib/db', () => ({
  prisma: {
    project: {
      update: jest.fn(),
    },
    taskExecution: {
      update: jest.fn(),
    },
  },
}));

jest.mock('fs/promises');
jest.mock('node-fetch');

jest.mock('@/lib/git', () => ({
  gitClient: {
    generateProjectPath: jest.fn((name: string) => `/generated/path/${name}`),
  },
}));

jest.mock('@/lib/sprints/default-sprint', () => ({
  createDefaultFirstSprint: jest.fn(),
}));

jest.mock('@/lib/agents/project-manager', () => ({
  ProjectManager: jest.fn().mockImplementation(() => ({
    manageKanbanBoard: jest.fn(),
  })),
}));

const mockPrismaDb = prisma as jest.Mocked<typeof prisma>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock TaskManager
const mockTaskManager = {
  updatePhaseProgress: jest.fn(),
  completeTask: jest.fn(),
  getInstance: jest.fn(),
};

jest.mock('@/lib/tasks/task-manager', () => ({
  TaskManager: {
    getInstance: () => mockTaskManager,
  },
}));

const { createDefaultFirstSprint } = require('@/lib/sprints/default-sprint');
const { ProjectManager } = require('@/lib/agents/project-manager');

describe('Project Creation', () => {
  const mockProjectData = {
    name: 'Test Project',
    description: 'A test project for unit testing',
    localPath: '/test/project/path',
    framework: 'next',
    language: 'typescript',
    packageManager: 'npm',
    testFramework: 'jest',
    lintTool: 'eslint',
    buildTool: 'webpack',
    initializeGit: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  describe('createProjectAsync', () => {
    it('should create project successfully with all phases', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      // Mock successful operations
      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.access.mockRejectedValueOnce(new Error('Directory does not exist')); // For mkdir check
      mockTaskManager.updatePhaseProgress.mockResolvedValue(undefined);
      mockTaskManager.completeTask.mockResolvedValue(undefined);
      createDefaultFirstSprint.mockResolvedValue({ success: true });

      // Mock successful description generation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { summary: 'AI-generated project description' },
        }),
      } as any);

      await createProjectAsync(taskId, projectId, mockProjectData);

      // Verify task execution update
      expect(mockPrismaDb.taskExecution.update).toHaveBeenCalledWith({
        where: { taskId },
        data: { status: 'RUNNING' },
      });

      // Verify all phases were executed
      expect(mockTaskManager.updatePhaseProgress).toHaveBeenCalledWith(
        taskId,
        'validation',
        0,
        {
          type: 'PHASE_START',
          message: 'Starting validation (recovery)',
        }
      );

      expect(mockTaskManager.updatePhaseProgress).toHaveBeenCalledWith(
        taskId,
        'setup',
        0,
        {
          type: 'PHASE_START',
          message: 'Creating project structure',
        }
      );

      expect(mockTaskManager.updatePhaseProgress).toHaveBeenCalledWith(
        taskId,
        'sprint_setup',
        0,
        {
          type: 'PHASE_START',
          message: 'Creating default first sprint with README task',
        }
      );

      expect(mockTaskManager.updatePhaseProgress).toHaveBeenCalledWith(
        taskId,
        'completion',
        0,
        {
          type: 'PHASE_START',
          message: 'Finalizing project setup',
        }
      );

      // Verify project update
      expect(mockPrismaDb.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          description: 'AI-generated project description',
          localPath: '/test/project/path',
          status: 'ACTIVE',
          framework: 'next',
          language: 'typescript',
          packageManager: 'npm',
          testFramework: 'jest',
          lintTool: 'eslint',
          buildTool: 'webpack',
        },
      });

      // Verify task completion
      expect(mockTaskManager.completeTask).toHaveBeenCalledWith(taskId, {
        project: {
          id: projectId,
          name: 'Test Project',
          localPath: '/test/project/path',
        },
        recovered: true,
      });
    });

    it('should use generated path when localPath is null', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';
      const dataWithoutPath = { ...mockProjectData, localPath: null };

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.access.mockRejectedValueOnce(new Error('Directory does not exist'));
      mockTaskManager.updatePhaseProgress.mockResolvedValue(undefined);
      mockTaskManager.completeTask.mockResolvedValue(undefined);
      createDefaultFirstSprint.mockResolvedValue({ success: true });
      mockFetch.mockResolvedValueOnce({ ok: false } as any);

      await createProjectAsync(taskId, projectId, dataWithoutPath);

      expect(mockPrismaDb.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: expect.objectContaining({
          localPath: '/generated/path/Test Project',
        }),
      });
    });

    it('should handle existing project directory', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.access.mockResolvedValueOnce(undefined); // Directory exists
      mockTaskManager.updatePhaseProgress.mockResolvedValue(undefined);
      mockTaskManager.completeTask.mockResolvedValue(undefined);
      createDefaultFirstSprint.mockResolvedValue({ success: true });
      mockFetch.mockResolvedValueOnce({ ok: false } as any);

      await createProjectAsync(taskId, projectId, mockProjectData);

      // Should not call mkdir for project directory since it exists
      expect(mockFs.mkdir).toHaveBeenCalledTimes(1); // Only for parent directory
    });

    it('should handle sprint creation failure gracefully', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.access.mockRejectedValueOnce(new Error('Directory does not exist'));
      mockTaskManager.updatePhaseProgress.mockResolvedValue(undefined);
      mockTaskManager.completeTask.mockResolvedValue(undefined);
      createDefaultFirstSprint.mockRejectedValueOnce(new Error('Sprint creation failed'));
      mockFetch.mockResolvedValueOnce({ ok: false } as any);

      await createProjectAsync(taskId, projectId, mockProjectData);

      // Should still complete successfully
      expect(mockTaskManager.updatePhaseProgress).toHaveBeenCalledWith(
        taskId,
        'sprint_setup',
        100,
        {
          type: 'PHASE_COMPLETE',
          message: 'Sprint creation skipped due to error',
        }
      );

      expect(mockTaskManager.completeTask).toHaveBeenCalled();
    });

    it('should handle description generation failure', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.access.mockRejectedValueOnce(new Error('Directory does not exist'));
      mockTaskManager.updatePhaseProgress.mockResolvedValue(undefined);
      mockTaskManager.completeTask.mockResolvedValue(undefined);
      createDefaultFirstSprint.mockResolvedValue({ success: true });
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await createProjectAsync(taskId, projectId, mockProjectData);

      // Should use original description
      expect(mockPrismaDb.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: expect.objectContaining({
          description: 'A test project for unit testing',
        }),
      });
    });

    it('should use default description when none provided', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';
      const dataWithoutDescription = { ...mockProjectData, description: undefined };

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.access.mockRejectedValueOnce(new Error('Directory does not exist'));
      mockTaskManager.updatePhaseProgress.mockResolvedValue(undefined);
      mockTaskManager.completeTask.mockResolvedValue(undefined);
      createDefaultFirstSprint.mockResolvedValue({ success: true });
      mockFetch.mockResolvedValueOnce({ ok: false } as any);

      await createProjectAsync(taskId, projectId, dataWithoutDescription);

      expect(mockPrismaDb.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: expect.objectContaining({
          description: 'Software project',
        }),
      });
    });

    it('should handle AI description generation success', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.access.mockRejectedValueOnce(new Error('Directory does not exist'));
      mockTaskManager.updatePhaseProgress.mockResolvedValue(undefined);
      mockTaskManager.completeTask.mockResolvedValue(undefined);
      createDefaultFirstSprint.mockResolvedValue({ success: true });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { summary: 'Advanced AI-generated description for testing' },
        }),
      } as any);

      await createProjectAsync(taskId, projectId, mockProjectData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/agents/project-manager',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze',
            projectId: projectId,
          }),
        }
      );

      expect(mockPrismaDb.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: expect.objectContaining({
          description: 'Advanced AI-generated description for testing',
        }),
      });
    });

    it('should handle project creation errors', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';
      const error = new Error('Database connection failed');

      mockPrismaDb.taskExecution.update.mockRejectedValueOnce(error);
      mockTaskManager.updatePhaseProgress.mockResolvedValue(undefined);

      await expect(
        createProjectAsync(taskId, projectId, mockProjectData)
      ).rejects.toThrow('Database connection failed');

      expect(mockTaskManager.updatePhaseProgress).toHaveBeenCalledWith(
        taskId,
        'error',
        100,
        {
          type: 'ERROR',
          message: 'Project creation recovery failed: Database connection failed',
        }
      );
    });

    it('should handle filesystem errors during directory creation', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';
      const fsError = new Error('Permission denied');

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockFs.mkdir.mockRejectedValueOnce(fsError);
      mockTaskManager.updatePhaseProgress.mockResolvedValue(undefined);

      await expect(
        createProjectAsync(taskId, projectId, mockProjectData)
      ).rejects.toThrow('Permission denied');
    });

    it('should handle optional technology stack parameters', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';
      const minimalData = {
        name: 'Minimal Project',
        localPath: '/minimal/path',
      };

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.access.mockRejectedValueOnce(new Error('Directory does not exist'));
      mockTaskManager.updatePhaseProgress.mockResolvedValue(undefined);
      mockTaskManager.completeTask.mockResolvedValue(undefined);
      createDefaultFirstSprint.mockResolvedValue({ success: true });
      mockFetch.mockResolvedValueOnce({ ok: false } as any);

      await createProjectAsync(taskId, projectId, minimalData);

      expect(mockPrismaDb.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: expect.objectContaining({
          framework: null,
          language: null,
          packageManager: null,
          testFramework: null,
          lintTool: null,
          buildTool: null,
        }),
      });
    });

    it('should trigger Kanban board optimization after completion', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.access.mockRejectedValueOnce(new Error('Directory does not exist'));
      mockTaskManager.updatePhaseProgress.mockResolvedValue(undefined);
      mockTaskManager.completeTask.mockResolvedValue(undefined);
      createDefaultFirstSprint.mockResolvedValue({ success: true });
      mockFetch.mockResolvedValueOnce({ ok: false } as any);

      const mockManageKanbanBoard = jest.fn();
      ProjectManager.mockImplementation(() => ({
        manageKanbanBoard: mockManageKanbanBoard,
      }));

      await createProjectAsync(taskId, projectId, mockProjectData);

      // Wait for setImmediate to execute
      await new Promise(resolve => setImmediate(resolve));

      expect(ProjectManager).toHaveBeenCalled();
      expect(mockManageKanbanBoard).toHaveBeenCalledWith(projectId);
    });

    it('should handle Kanban optimization errors gracefully', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.access.mockRejectedValueOnce(new Error('Directory does not exist'));
      mockTaskManager.updatePhaseProgress.mockResolvedValue(undefined);
      mockTaskManager.completeTask.mockResolvedValue(undefined);
      createDefaultFirstSprint.mockResolvedValue({ success: true });
      mockFetch.mockResolvedValueOnce({ ok: false } as any);

      const mockManageKanbanBoard = jest.fn().mockRejectedValue(new Error('Kanban error'));
      ProjectManager.mockImplementation(() => ({
        manageKanbanBoard: mockManageKanbanBoard,
      }));

      // Should not throw - error should be handled internally
      await expect(
        createProjectAsync(taskId, projectId, mockProjectData)
      ).resolves.not.toThrow();
    });
  });
});
