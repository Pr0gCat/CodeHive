import { render } from '@testing-library/react';
import { ReactElement } from 'react';

// Test utility functions
export const createMockProject = (overrides = {}) => ({
  id: 'test-project-id',
  name: 'Test Project',
  description: 'Test project description',
  repositoryUrl: 'https://github.com/test/project',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockCycle = (overrides = {}) => ({
  id: 'test-cycle-id',
  projectId: 'test-project-id',
  name: 'Test Cycle',
  description: 'Test cycle description',
  phase: 'RED',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockTest = (overrides = {}) => ({
  id: 'test-test-id',
  cycleId: 'test-cycle-id',
  name: 'should work correctly',
  description: 'Test for: Should work correctly',
  filePath: 'tests/should-work-correctly.test.ts',
  status: 'FAILING',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockArtifact = (overrides = {}) => ({
  id: 'test-artifact-id',
  cycleId: 'test-cycle-id',
  name: 'test-implementation',
  type: 'CODE',
  phase: 'GREEN',
  path: 'src/test-implementation.ts',
  content: 'implementation code',
  purpose: 'Implementation for test',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Mock data generators
export const mockProject = {
  id: 'test-project-id',
  name: 'Test Project',
  description: 'Test project description',
  localPath: '/test/project/path',
  status: 'ACTIVE',
  framework: 'Next.js',
  language: 'typescript',
  packageManager: 'bun',
  testFramework: 'jest',
  lintTool: 'eslint',
  buildTool: 'webpack',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
};

export const mockCycle = {
  id: 'test-cycle-id',
  projectId: 'test-project-id',
  title: 'Test Feature',
  description: 'Test feature description',
  phase: 'RED',
  status: 'ACTIVE',
  acceptanceCriteria: JSON.stringify(['Should work correctly']),
  constraints: null,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  completedAt: null,
  project: mockProject,
  tests: [],
  artifacts: [],
  queries: [],
};

export const mockTest = {
  id: 'test-test-id',
  cycleId: 'test-cycle-id',
  name: 'should work correctly',
  description: 'Test for: Should work correctly',
  code: 'test code',
  filePath: 'tests/should-work-correctly.test.ts',
  status: 'FAILING',
  lastRun: null,
  duration: null,
  errorOutput: null,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
};

export const mockArtifact = {
  id: 'test-artifact-id',
  cycleId: 'test-cycle-id',
  type: 'CODE',
  name: 'test-implementation',
  path: 'src/test-implementation.ts',
  content: 'implementation code',
  purpose: 'Implementation for test',
  phase: 'GREEN',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
};

export const mockQuery = {
  id: 'test-query-id',
  projectId: 'test-project-id',
  cycleId: 'test-cycle-id',
  type: 'ARCHITECTURE',
  title: 'Test Query',
  question: 'Test question?',
  context: JSON.stringify({ test: 'context' }),
  urgency: 'ADVISORY',
  priority: 'MEDIUM',
  status: 'PENDING',
  answer: null,
  answeredAt: null,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  comments: [],
};

// Mock exec function
export const mockExec = (stdout: string = '', stderr: string = '') => {
  const { exec } = require('child_process');
  exec.mockImplementation(
    (command: string, options: Record<string, unknown>, callback?: Function) => {
      const result = { stdout, stderr };
      if (callback) {
        callback(null, result);
      }
      return Promise.resolve(result);
    }
  );
};

// Mock fs functions
export const mockFs = () => {
  const fs = require('fs');
  
  // Ensure fs.promises methods are mocked
  if (!fs.promises.mkdir.mockResolvedValue) {
    fs.promises.mkdir = jest.fn().mockResolvedValue(undefined);
  }
  if (!fs.promises.writeFile.mockResolvedValue) {
    fs.promises.writeFile = jest.fn().mockResolvedValue(undefined);
  }
  if (!fs.promises.readFile.mockResolvedValue) {
    fs.promises.readFile = jest.fn().mockResolvedValue('file content');
  }
  if (!fs.promises.readdir.mockResolvedValue) {
    fs.promises.readdir = jest.fn().mockResolvedValue([]);
  }
  if (!fs.promises.stat.mockResolvedValue) {
    fs.promises.stat = jest.fn().mockResolvedValue({ mtime: new Date() });
  }
  if (!fs.promises.access.mockResolvedValue) {
    fs.promises.access = jest.fn().mockResolvedValue(undefined);
  }
  if (!fs.promises.copyFile.mockResolvedValue) {
    fs.promises.copyFile = jest.fn().mockResolvedValue(undefined);
  }
  if (!fs.promises.rm.mockResolvedValue) {
    fs.promises.rm = jest.fn().mockResolvedValue(undefined);
  }
  
  return {
    mkdir: fs.promises.mkdir,
    writeFile: fs.promises.writeFile,
    readFile: fs.promises.readFile,
    readdir: fs.promises.readdir,
    stat: fs.promises.stat,
    access: fs.promises.access,
    copyFile: fs.promises.copyFile,
    rm: fs.promises.rm,
  };
};

// Mock prisma methods
export const mockPrisma = () => {
  const { prisma } = require('@/lib/db');
  return {
    project: {
      findUnique: prisma.project.findUnique.mockResolvedValue(mockProject),
      findMany: prisma.project.findMany.mockResolvedValue([mockProject]),
      create: prisma.project.create.mockResolvedValue(mockProject),
      update: prisma.project.update.mockResolvedValue(mockProject),
      delete: prisma.project.delete.mockResolvedValue(mockProject),
    },
    cycle: {
      findUnique: prisma.cycle.findUnique.mockResolvedValue(mockCycle),
      findMany: prisma.cycle.findMany.mockResolvedValue([mockCycle]),
      create: prisma.cycle.create.mockResolvedValue(mockCycle),
      update: prisma.cycle.update.mockResolvedValue(mockCycle),
      delete: prisma.cycle.delete.mockResolvedValue(mockCycle),
    },
    test: {
      findUnique: prisma.test.findUnique.mockResolvedValue(mockTest),
      findMany: prisma.test.findMany.mockResolvedValue([mockTest]),
      create: prisma.test.create.mockResolvedValue(mockTest),
      update: prisma.test.update.mockResolvedValue(mockTest),
      delete: prisma.test.delete.mockResolvedValue(mockTest),
    },
    artifact: {
      findUnique: prisma.artifact.findUnique.mockResolvedValue(mockArtifact),
      findMany: prisma.artifact.findMany.mockResolvedValue([mockArtifact]),
      create: prisma.artifact.create.mockResolvedValue(mockArtifact),
      update: prisma.artifact.update.mockResolvedValue(mockArtifact),
      delete: prisma.artifact.delete.mockResolvedValue(mockArtifact),
    },
    query: {
      findUnique: prisma.query.findUnique.mockResolvedValue(mockQuery),
      findMany: prisma.query.findMany.mockResolvedValue([mockQuery]),
      create: prisma.query.create.mockResolvedValue(mockQuery),
      update: prisma.query.update.mockResolvedValue(mockQuery),
      delete: prisma.query.delete.mockResolvedValue(mockQuery),
      count: prisma.query.count.mockResolvedValue(1),
      updateMany: prisma.query.updateMany.mockResolvedValue({ count: 1 }),
    },
    queryComment: {
      create: prisma.queryComment.create.mockResolvedValue({
        id: 'test-comment-id',
        queryId: 'test-query-id',
        content: 'Test comment',
        author: 'user',
        createdAt: new Date('2023-01-01'),
      }),
    },
  };
};

// Clear all mocks
export const clearAllMocks = () => {
  jest.clearAllMocks();
  const { prisma } = require('@/lib/db');
  Object.values(prisma).forEach((model: Record<string, unknown>) => {
    if (typeof model === 'object') {
      Object.values(model).forEach((method: unknown) => {
        if (typeof method === 'function' && '_isMockFunction' in method) {
          (method as jest.Mock).mockClear();
        }
      });
    }
  });
};

// Custom render function with providers
export const renderWithProviders = (ui: ReactElement) => {
  return render(ui);
};

// Test suite for utility functions
describe('Test Utilities', () => {
  describe('createMockProject', () => {
    it('should create a mock project with default values', () => {
      const project = createMockProject();
      
      expect(project.id).toBe('test-project-id');
      expect(project.name).toBe('Test Project');
      expect(project.description).toBe('Test project description');
      expect(project.repositoryUrl).toBe('https://github.com/test/project');
      expect(project.createdAt).toBeInstanceOf(Date);
      expect(project.updatedAt).toBeInstanceOf(Date);
    });

    it('should allow overriding default values', () => {
      const project = createMockProject({
        name: 'Custom Project',
        description: 'Custom description',
      });
      
      expect(project.name).toBe('Custom Project');
      expect(project.description).toBe('Custom description');
      expect(project.id).toBe('test-project-id'); // Default value preserved
    });
  });

  describe('createMockCycle', () => {
    it('should create a mock cycle with default values', () => {
      const cycle = createMockCycle();
      
      expect(cycle.id).toBe('test-cycle-id');
      expect(cycle.projectId).toBe('test-project-id');
      expect(cycle.name).toBe('Test Cycle');
      expect(cycle.phase).toBe('RED');
      expect(cycle.status).toBe('ACTIVE');
    });

    it('should allow overriding default values', () => {
      const cycle = createMockCycle({
        phase: 'GREEN',
        status: 'COMPLETED',
      });
      
      expect(cycle.phase).toBe('GREEN');
      expect(cycle.status).toBe('COMPLETED');
    });
  });

  describe('createMockTest', () => {
    it('should create a mock test with default values', () => {
      const test = createMockTest();
      
      expect(test.id).toBe('test-test-id');
      expect(test.cycleId).toBe('test-cycle-id');
      expect(test.name).toBe('should work correctly');
      expect(test.status).toBe('FAILING');
      expect(test.filePath).toBe('tests/should-work-correctly.test.ts');
    });

    it('should allow overriding default values', () => {
      const test = createMockTest({
        status: 'PASSING',
        name: 'should pass the test',
      });
      
      expect(test.status).toBe('PASSING');
      expect(test.name).toBe('should pass the test');
    });
  });

  describe('createMockArtifact', () => {
    it('should create a mock artifact with default values', () => {
      const artifact = createMockArtifact();
      
      expect(artifact.id).toBe('test-artifact-id');
      expect(artifact.cycleId).toBe('test-cycle-id');
      expect(artifact.name).toBe('test-implementation');
      expect(artifact.type).toBe('CODE');
      expect(artifact.phase).toBe('GREEN');
      expect(artifact.content).toBe('implementation code');
    });

    it('should allow overriding default values', () => {
      const artifact = createMockArtifact({
        type: 'DOCUMENTATION',
        phase: 'REFACTOR',
      });
      
      expect(artifact.type).toBe('DOCUMENTATION');
      expect(artifact.phase).toBe('REFACTOR');
    });
  });

  describe('clearAllMocks', () => {
    it('should clear all mocks', () => {
      // This test ensures the function exists and can be called
      expect(typeof clearAllMocks).toBe('function');
      expect(() => clearAllMocks()).not.toThrow();
    });
  });
});
