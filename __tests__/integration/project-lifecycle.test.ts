import { prisma } from '@/lib/db';
import { TaskManager } from '@/lib/tasks/task-manager';
import { createProjectAsyncAsync } from '@/lib/tasks/project-creation';
import { runImportAsync } from '@/lib/tasks/project-import';
import { CycleEngine } from '@/lib/tdd/cycle-engine';
import { mockFs, mockExec, clearAllMocks } from '@/__tests__/helpers/test-utils';
import { promises as fs } from 'fs';
import { exec } from 'child_process';

jest.mock('@/lib/db', () => ({
  prisma: {
    project: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    cycle: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    test: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    artifact: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    taskExecution: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    taskPhase: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    taskEvent: {
      create: jest.fn(),
    },
  },
}));

jest.mock('fs/promises');
jest.mock('child_process');

const mockPrismaDb = prisma as jest.Mocked<typeof prisma>;

describe('Project Lifecycle Integration Tests', () => {
  let taskManager: TaskManager;
  let cycleEngine: CycleEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    clearAllMocks();
    mockFs();
    mockExec('Command executed successfully', '');
    taskManager = new TaskManager();
    cycleEngine = new CycleEngine('test-project-id');
  });

  describe('Project Creation Workflow', () => {
    it('should complete full project creation lifecycle', async () => {
      const projectData = {
        name: 'Integration Test Project',
        description: 'A project for integration testing',
        localPath: '/test/integration/project',
        framework: 'next',
        language: 'typescript',
        packageManager: 'npm',
        testFramework: 'jest',
        lintTool: 'eslint',
        buildTool: 'webpack',
      };

      const mockProject = {
        id: 'integration-project-id',
        ...projectData,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTask = {
        id: 'integration-task-id',
        type: 'PROJECT_CREATE',
        status: 'COMPLETED',
        projectId: 'integration-project-id',
        metadata: {},
        result: { success: true, project: mockProject },
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
      };

      // Mock successful project creation
      mockPrismaDb.project.create.mockResolvedValueOnce(mockProject);
      mockPrismaDb.taskExecution.create.mockResolvedValueOnce(mockTask);
      mockPrismaDb.taskExecution.update.mockResolvedValue(mockTask);
      mockPrismaDb.taskPhase.create.mockResolvedValue({} as any);
      mockPrismaDb.taskPhase.update.mockResolvedValue({} as any);
      mockPrismaDb.taskEvent.create.mockResolvedValue({} as any);

      // Execute project creation workflow
      const result = await createProjectAsync(projectData);

      expect(result.success).toBe(true);
      expect(result.project).toEqual(mockProject);
      expect(mockPrismaDb.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: projectData.name,
          description: projectData.description,
          localPath: projectData.localPath,
          framework: projectData.framework,
          language: projectData.language,
        }),
      });
    });

    it('should handle project creation failure and cleanup', async () => {
      const projectData = {
        name: 'Failing Project',
        description: 'A project that fails to create',
        localPath: '/test/failing/project',
        framework: 'next',
        language: 'typescript',
        packageManager: 'npm',
        testFramework: 'jest',
        lintTool: 'eslint',
        buildTool: 'webpack',
      };

      // Mock project creation failure
      mockPrismaDb.project.create.mockRejectedValueOnce(
        new Error('Database constraint violation')
      );
      mockPrismaDb.taskExecution.create.mockResolvedValue({} as any);
      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.taskPhase.create.mockResolvedValue({} as any);
      mockPrismaDb.taskEvent.create.mockResolvedValue({} as any);

      // Execute project creation workflow
      const result = await createProjectAsync(projectData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database constraint violation');
    });
  });

  describe('Project Import Workflow', () => {
    it('should complete full project import lifecycle', async () => {
      const importData = {
        gitUrl: 'https://github.com/test/repo.git',
        localPath: '/test/import/project',
        name: 'Imported Project',
        description: 'An imported project for testing',
      };

      const mockProject = {
        id: 'imported-project-id',
        ...importData,
        status: 'ACTIVE',
        framework: 'react',
        language: 'javascript',
        packageManager: 'yarn',
        testFramework: 'jest',
        lintTool: 'eslint',
        buildTool: 'webpack',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTask = {
        id: 'import-task-id',
        type: 'PROJECT_IMPORT',
        status: 'COMPLETED',
        projectId: 'imported-project-id',
        metadata: {},
        result: { success: true, project: mockProject },
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
      };

      // Mock successful project import
      mockPrismaDb.project.create.mockResolvedValueOnce(mockProject);
      mockPrismaDb.taskExecution.create.mockResolvedValueOnce(mockTask);
      mockPrismaDb.taskExecution.update.mockResolvedValue(mockTask);
      mockPrismaDb.taskPhase.create.mockResolvedValue({} as any);
      mockPrismaDb.taskPhase.update.mockResolvedValue({} as any);
      mockPrismaDb.taskEvent.create.mockResolvedValue({} as any);

      // Mock successful git clone
      mockExec('Cloning into "/test/import/project"...\nReceiving objects: 100% (10/10), done.', '');

      // Execute project import workflow
      const result = await runImportAsync(importData);

      expect(result.success).toBe(true);
      expect(result.project).toEqual(mockProject);
    });

    it('should handle git clone failure during import', async () => {
      const importData = {
        gitUrl: 'https://github.com/test/private-repo.git',
        localPath: '/test/import/private',
        name: 'Private Project',
        description: 'A private project that requires authentication',
      };

      // Mock git clone failure
      mockExec('', 'fatal: repository \'https://github.com/test/private-repo.git\' not found');
      mockPrismaDb.taskExecution.create.mockResolvedValue({} as any);
      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.taskPhase.create.mockResolvedValue({} as any);
      mockPrismaDb.taskEvent.create.mockResolvedValue({} as any);

      // Execute project import workflow
      const result = await runImportAsync(importData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('repository');
    });
  });

  describe('TDD Cycle Workflow', () => {
    it('should complete full TDD cycle (RED → GREEN → REFACTOR → REVIEW)', async () => {
      const mockProject = {
        id: 'tdd-project-id',
        name: 'TDD Project',
        localPath: '/test/tdd/project',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCycle = {
        id: 'tdd-cycle-id',
        projectId: 'tdd-project-id',
        title: 'User Authentication',
        description: 'Implement user authentication system',
        phase: 'RED',
        status: 'ACTIVE',
        acceptanceCriteria: JSON.stringify([
          'Users can register with email and password',
          'Users can login with valid credentials',
          'Users can logout securely',
        ]),
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      };

      const mockTest = {
        id: 'auth-test-id',
        cycleId: 'tdd-cycle-id',
        name: 'should authenticate user with valid credentials',
        description: 'Test for user authentication',
        code: 'describe("User Authentication", () => { it("should authenticate user", () => { expect(true).toBe(false); }); });',
        filePath: 'tests/auth.test.ts',
        status: 'FAILING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockArtifact = {
        id: 'auth-implementation-id',
        cycleId: 'tdd-cycle-id',
        type: 'CODE',
        name: 'authentication-service',
        path: 'src/services/auth.ts',
        content: 'export class AuthService { authenticate(email: string, password: string): boolean { return true; } }',
        purpose: 'User authentication implementation',
        phase: 'GREEN',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock database operations for TDD cycle
      mockPrismaDb.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaDb.cycle.create.mockResolvedValue(mockCycle);
      mockPrismaDb.cycle.findUnique.mockResolvedValue(mockCycle);
      mockPrismaDb.cycle.update.mockImplementation((args) => 
        Promise.resolve({ ...mockCycle, ...args.data })
      );
      mockPrismaDb.test.create.mockResolvedValue(mockTest);
      mockPrismaDb.test.findMany.mockResolvedValue([mockTest]);
      mockPrismaDb.test.update.mockImplementation((args) => 
        Promise.resolve({ ...mockTest, ...args.data })
      );
      mockPrismaDb.artifact.create.mockResolvedValue(mockArtifact);
      mockPrismaDb.artifact.findMany.mockResolvedValue([mockArtifact]);

      // Phase 1: RED - Create failing tests
      const redResult = await cycleEngine.startRedPhase(mockCycle.id, [
        'Users can register with email and password',
        'Users can login with valid credentials',
      ]);

      expect(redResult.success).toBe(true);
      expect(mockPrismaDb.test.create).toHaveBeenCalled();

      // Phase 2: GREEN - Implement code to pass tests
      const greenResult = await cycleEngine.startGreenPhase(mockCycle.id);

      expect(greenResult.success).toBe(true);
      expect(mockPrismaDb.artifact.create).toHaveBeenCalled();

      // Phase 3: REFACTOR - Improve code quality
      const refactorResult = await cycleEngine.startRefactorPhase(mockCycle.id);

      expect(refactorResult.success).toBe(true);

      // Phase 4: REVIEW - Final review and completion
      const reviewResult = await cycleEngine.startReviewPhase(mockCycle.id);

      expect(reviewResult.success).toBe(true);
      expect(mockPrismaDb.cycle.update).toHaveBeenCalledWith({
        where: { id: mockCycle.id },
        data: {
          phase: 'REVIEW',
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should handle TDD cycle failure and rollback', async () => {
      const mockCycle = {
        id: 'failing-cycle-id',
        projectId: 'tdd-project-id',
        title: 'Failing Feature',
        description: 'A feature that fails during implementation',
        phase: 'RED',
        status: 'ACTIVE',
        acceptanceCriteria: JSON.stringify(['Feature should work']),
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      };

      // Mock test creation failure
      mockPrismaDb.cycle.findUnique.mockResolvedValue(mockCycle);
      mockPrismaDb.test.create.mockRejectedValueOnce(
        new Error('Test generation failed')
      );

      // Attempt to start RED phase
      const result = await cycleEngine.startRedPhase(mockCycle.id, ['Feature should work']);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test generation failed');
    });
  });

  describe('End-to-End Project Workflow', () => {
    it('should complete project creation → TDD cycle → completion workflow', async () => {
      // Step 1: Create project
      const projectData = {
        name: 'E2E Test Project',
        description: 'End-to-end workflow test',
        localPath: '/test/e2e/project',
        framework: 'next',
        language: 'typescript',
        packageManager: 'npm',
        testFramework: 'jest',
        lintTool: 'eslint',
        buildTool: 'webpack',
      };

      const mockProject = {
        id: 'e2e-project-id',
        ...projectData,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaDb.project.create.mockResolvedValueOnce(mockProject);
      mockPrismaDb.taskExecution.create.mockResolvedValue({} as any);
      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.taskPhase.create.mockResolvedValue({} as any);
      mockPrismaDb.taskPhase.update.mockResolvedValue({} as any);
      mockPrismaDb.taskEvent.create.mockResolvedValue({} as any);

      const createResult = await createProjectAsync(projectData);
      expect(createResult.success).toBe(true);

      // Step 2: Create and execute TDD cycle
      const mockCycle = {
        id: 'e2e-cycle-id',
        projectId: 'e2e-project-id',
        title: 'Core Feature',
        description: 'Implement core feature',
        phase: 'RED',
        status: 'ACTIVE',
        acceptanceCriteria: JSON.stringify(['Feature works correctly']),
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      };

      mockPrismaDb.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaDb.cycle.create.mockResolvedValue(mockCycle);
      mockPrismaDb.cycle.findUnique.mockResolvedValue(mockCycle);
      mockPrismaDb.cycle.update.mockResolvedValue({ ...mockCycle, status: 'COMPLETED' });
      mockPrismaDb.test.create.mockResolvedValue({} as any);
      mockPrismaDb.test.findMany.mockResolvedValue([]);
      mockPrismaDb.artifact.create.mockResolvedValue({} as any);
      mockPrismaDb.artifact.findMany.mockResolvedValue([]);

      const cycleEngine = new CycleEngine('e2e-project-id');

      // Execute complete TDD cycle
      const redResult = await cycleEngine.startRedPhase(mockCycle.id, ['Feature works correctly']);
      const greenResult = await cycleEngine.startGreenPhase(mockCycle.id);
      const refactorResult = await cycleEngine.startRefactorPhase(mockCycle.id);
      const reviewResult = await cycleEngine.startReviewPhase(mockCycle.id);

      expect(redResult.success).toBe(true);
      expect(greenResult.success).toBe(true);
      expect(refactorResult.success).toBe(true);
      expect(reviewResult.success).toBe(true);

      // Verify project completion
      expect(mockPrismaDb.cycle.update).toHaveBeenCalledWith({
        where: { id: mockCycle.id },
        data: {
          phase: 'REVIEW',
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        },
      });
    });
  });
});
