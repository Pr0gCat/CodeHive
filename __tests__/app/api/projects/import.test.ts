import { POST } from '@/app/api/projects/import/route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mockPrisma, clearAllMocks } from '@/__tests__/helpers/test-utils';

jest.mock('@/lib/db', () => ({
  prisma: {
    projectIndex: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    taskExecution: {
      create: jest.fn(),
    },
    taskPhase: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/tasks/project-import', () => ({
  runImportAsync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  access: jest.fn(),
  stat: jest.fn(),
}));

// Type the mocked prisma client properly
const mockPrismaDb = {
  projectIndex: {
    findFirst: prisma.projectIndex.findFirst as jest.MockedFunction<typeof prisma.projectIndex.findFirst>,
    create: prisma.projectIndex.create as jest.MockedFunction<typeof prisma.projectIndex.create>,
  },
  taskExecution: {
    create: prisma.taskExecution.create as jest.MockedFunction<typeof prisma.taskExecution.create>,
  },
  taskPhase: {
    create: prisma.taskPhase.create as jest.MockedFunction<typeof prisma.taskPhase.create>,
  },
};
const { runImportAsync } = require('@/lib/tasks/project-import');
const fs = require('fs/promises');

describe('/api/projects/import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllMocks();
  });

  describe('POST', () => {
    const validImportData = {
      gitUrl: 'https://github.com/user/repo.git',
      localPath: '/test/import/path',
      name: 'Imported Project',
      description: 'An imported project',
    };

    it('should import a project from remote repository successfully', async () => {
      const mockProject = {
        id: 'imported-project-id',
        name: 'Imported Project',
        description: 'An imported project',
        localPath: '/test/import/path',
        gitUrl: 'https://github.com/user/repo.git',
        status: 'ACTIVE',
        framework: 'next',
        language: 'typescript',
        packageManager: 'npm',
        testFramework: 'jest',
        lintTool: 'eslint',
        buildTool: 'webpack',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaDb.projectIndex.findFirst.mockResolvedValueOnce(null);
      fs.access.mockRejectedValueOnce(new Error('Path does not exist'));
      runImportAsync.mockResolvedValueOnce({
        success: true,
        project: mockProject,
        taskId: 'import-task-123',
      });

      const request = new NextRequest('http://localhost:3000/api/projects/import', {
        method: 'POST',
        body: JSON.stringify(validImportData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.project).toEqual(mockProject);
      expect(data.taskId).toBe('import-task-123');
    });

    it('should import a local project successfully', async () => {
      const localImportData = {
        localPath: '/existing/local/project',
        name: 'Local Project',
        description: 'A local project import',
      };

      const mockProject = {
        id: 'local-project-id',
        name: 'Local Project',
        description: 'A local project import',
        localPath: '/existing/local/project',
        gitUrl: null,
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

      mockPrismaDb.projectIndex.findFirst.mockResolvedValueOnce(null);
      fs.access.mockResolvedValueOnce(undefined);
      fs.stat.mockResolvedValueOnce({ isDirectory: () => true });
      runImportAsync.mockResolvedValueOnce({
        success: true,
        project: mockProject,
        taskId: 'local-import-task-123',
      });

      const request = new NextRequest('http://localhost:3000/api/projects/import', {
        method: 'POST',
        body: JSON.stringify(localImportData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.project).toEqual(mockProject);
    });

    it('should return 400 for invalid repository URL', async () => {
      const invalidUrlData = {
        ...validImportData,
        gitUrl: 'invalid-url',
      };

      const request = new NextRequest('http://localhost:3000/api/projects/import', {
        method: 'POST',
        body: JSON.stringify(invalidUrlData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid repository URL');
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteData = {
        localPath: '/test/path',
        // Missing name and description
      };

      const request = new NextRequest('http://localhost:3000/api/projects/import', {
        method: 'POST',
        body: JSON.stringify(incompleteData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });

    it('should return 409 for duplicate project name', async () => {
      const existingProject = {
        id: 'existing-id',
        name: 'Imported Project',
        localPath: '/different/path',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaDb.projectIndex.findFirst.mockResolvedValueOnce(existingProject);

      const request = new NextRequest('http://localhost:3000/api/projects/import', {
        method: 'POST',
        body: JSON.stringify(validImportData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('already exists');
    });

    it('should return 409 for conflicting local path', async () => {
      mockPrismaDb.projectIndex.findFirst
        .mockResolvedValueOnce(null) // No name conflict
        .mockResolvedValueOnce({ // Path conflict
          id: 'path-conflict-id',
          name: 'Different Project',
          localPath: '/test/import/path',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const request = new NextRequest('http://localhost:3000/api/projects/import', {
        method: 'POST',
        body: JSON.stringify(validImportData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('path already in use');
    });

    it('should return 400 for non-existent local directory', async () => {
      const localImportData = {
        localPath: '/non/existent/path',
        name: 'Non-existent Project',
        description: 'A project that does not exist',
      };

      mockPrismaDb.projectIndex.findFirst.mockResolvedValueOnce(null);
      fs.access.mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

      const request = new NextRequest('http://localhost:3000/api/projects/import', {
        method: 'POST',
        body: JSON.stringify(localImportData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('does not exist');
    });

    it('should return 400 for local path that is not a directory', async () => {
      const fileImportData = {
        localPath: '/path/to/file.txt',
        name: 'File Project',
        description: 'Trying to import a file instead of directory',
      };

      mockPrismaDb.projectIndex.findFirst.mockResolvedValueOnce(null);
      fs.access.mockResolvedValueOnce(undefined);
      fs.stat.mockResolvedValueOnce({ isDirectory: () => false });

      const request = new NextRequest('http://localhost:3000/api/projects/import', {
        method: 'POST',
        body: JSON.stringify(fileImportData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('not a directory');
    });

    it('should handle import process failure', async () => {
      mockPrismaDb.projectIndex.findFirst.mockResolvedValueOnce(null);
      fs.access.mockRejectedValueOnce(new Error('Path does not exist'));
      runImportAsync.mockResolvedValueOnce({
        success: false,
        error: 'Git clone failed: Authentication required',
      });

      const request = new NextRequest('http://localhost:3000/api/projects/import', {
        method: 'POST',
        body: JSON.stringify(validImportData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Git clone failed: Authentication required');
    });

    it('should validate supported repository providers', async () => {
      const unsupportedProviderData = {
        ...validImportData,
        gitUrl: 'https://bitbucket.org/user/repo.git',
      };

      const request = new NextRequest('http://localhost:3000/api/projects/import', {
        method: 'POST',
        body: JSON.stringify(unsupportedProviderData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unsupported repository provider');
    });

    it('should handle malformed JSON gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects/import', {
        method: 'POST',
        body: '{ invalid json }',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid JSON');
    });

    it('should handle database connection errors', async () => {
      mockPrismaDb.projectIndex.findFirst.mockRejectedValueOnce(
        new Error('Database connection lost')
      );

      const request = new NextRequest('http://localhost:3000/api/projects/import', {
        method: 'POST',
        body: JSON.stringify(validImportData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Internal server error');
    });
  });
});
