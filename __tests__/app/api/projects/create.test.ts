import { POST } from '@/app/api/projects/create/route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mockPrisma, clearAllMocks } from '@/__tests__/helpers/test-utils';

// Mock the entire db module
jest.mock('@/lib/db', () => ({
  prisma: {
    project: {
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

jest.mock('@/lib/tasks/project-creation', () => ({
  createProjectAsync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  access: jest.fn(),
  mkdir: jest.fn(),
}));

// Type the mocked prisma client properly
const mockPrismaDb = {
  project: {
    findFirst: prisma.project.findFirst as jest.MockedFunction<typeof prisma.project.findFirst>,
    create: prisma.project.create as jest.MockedFunction<typeof prisma.project.create>,
  },
  taskExecution: {
    create: prisma.taskExecution.create as jest.MockedFunction<typeof prisma.taskExecution.create>,
  },
  taskPhase: {
    create: prisma.taskPhase.create as jest.MockedFunction<typeof prisma.taskPhase.create>,
  },
};
const { createProjectAsync } = require('@/lib/tasks/project-creation');
const fs = require('fs/promises');

describe('/api/projects/create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllMocks();
  });

  describe('POST', () => {
    const validProjectData = {
      name: 'Test Project',
      description: 'A test project',
      localPath: '/test/project/path',
      framework: 'next',
      language: 'typescript',
      packageManager: 'npm',
      testFramework: 'jest',
      lintTool: 'eslint',
      buildTool: 'webpack',
    };

    it('should create a new project successfully', async () => {
      const mockProject = {
        id: 'test-project-id',
        name: 'Test Project',
        description: 'A test project',
        localPath: '/test/project/path',
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

      mockPrismaDb.project.findFirst.mockResolvedValueOnce(null);
      fs.access.mockRejectedValueOnce(new Error('Path does not exist'));
      createProjectAsync.mockResolvedValueOnce({
        success: true,
        project: mockProject,
        taskId: 'task-123',
      });

      const request = new NextRequest('http://localhost:3000/api/projects/create', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.project).toEqual(mockProject);
      expect(data.taskId).toBe('task-123');
    });

    it('should return 400 for invalid request data', async () => {
      const invalidData = {
        name: '', // Empty name
        description: 'A test project',
        localPath: '/test/project/path',
      };

      const request = new NextRequest('http://localhost:3000/api/projects/create', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('validation');
    });

    it('should return 409 for duplicate project name', async () => {
      const existingProject = {
        id: 'existing-project-id',
        name: 'Test Project',
        description: 'Existing project',
        summary: null,
        gitUrl: null,
        localPath: '/existing/path',
        status: 'ACTIVE',
        framework: null,
        language: null,
        packageManager: null,
        testFramework: null,
        lintTool: null,
        buildTool: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaDb.project.findFirst.mockResolvedValueOnce(existingProject);

      const request = new NextRequest('http://localhost:3000/api/projects/create', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('already exists');
    });

    it('should return 409 for existing directory path', async () => {
      mockPrismaDb.project.findFirst.mockResolvedValueOnce(null);
      fs.access.mockResolvedValueOnce(undefined); // Directory exists

      const request = new NextRequest('http://localhost:3000/api/projects/create', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('directory already exists');
    });

    it('should handle project creation failure', async () => {
      mockPrismaDb.project.findFirst.mockResolvedValueOnce(null);
      fs.access.mockRejectedValueOnce(new Error('Path does not exist'));
      createProjectAsync.mockResolvedValueOnce({
        success: false,
        error: 'Failed to initialize Git repository',
      });

      const request = new NextRequest('http://localhost:3000/api/projects/create', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to initialize Git repository');
    });

    it('should handle missing required fields', async () => {
      const incompleteData = {
        name: 'Test Project',
        // Missing required fields
      };

      const request = new NextRequest('http://localhost:3000/api/projects/create', {
        method: 'POST',
        body: JSON.stringify(incompleteData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects/create', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid JSON');
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaDb.project.findFirst.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost:3000/api/projects/create', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Internal server error');
    });

    it('should validate project path format', async () => {
      const invalidPathData = {
        ...validProjectData,
        localPath: 'invalid/relative/path', // Should be absolute
      };

      const request = new NextRequest('http://localhost:3000/api/projects/create', {
        method: 'POST',
        body: JSON.stringify(invalidPathData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('absolute path');
    });

    it('should validate framework and language combinations', async () => {
      const invalidCombinationData = {
        ...validProjectData,
        framework: 'react',
        language: 'python', // Invalid combination
      };

      const request = new NextRequest('http://localhost:3000/api/projects/create', {
        method: 'POST',
        body: JSON.stringify(invalidCombinationData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('incompatible');
    });
  });
});
