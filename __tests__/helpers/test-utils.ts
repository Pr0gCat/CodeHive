import { jest } from '@jest/globals'

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
}

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
}

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
}

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
}

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
}

// Mock exec function
export const mockExec = (stdout: string = '', stderr: string = '') => {
  const { exec } = require('child_process')
  exec.mockImplementation((command: string, options: any, callback?: Function) => {
    const result = { stdout, stderr }
    if (callback) {
      callback(null, result)
    }
    return Promise.resolve(result)
  })
}

// Mock fs functions
export const mockFs = () => {
  const fs = require('fs')
  return {
    mkdir: fs.promises.mkdir.mockResolvedValue(undefined),
    writeFile: fs.promises.writeFile.mockResolvedValue(undefined),
    readFile: fs.promises.readFile.mockResolvedValue('file content'),
    readdir: fs.promises.readdir.mockResolvedValue([]),
    stat: fs.promises.stat.mockResolvedValue({ mtime: new Date() }),
    access: fs.promises.access.mockResolvedValue(undefined),
    copyFile: fs.promises.copyFile.mockResolvedValue(undefined),
    rm: fs.promises.rm.mockResolvedValue(undefined),
  }
}

// Mock prisma methods
export const mockPrisma = () => {
  const { prisma } = require('@/lib/db')
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
  }
}

// Clear all mocks
export const clearAllMocks = () => {
  jest.clearAllMocks()
  const { prisma } = require('@/lib/db')
  Object.values(prisma).forEach((model: any) => {
    if (typeof model === 'object') {
      Object.values(model).forEach((method: any) => {
        if (jest.isMockFunction(method)) {
          method.mockClear()
        }
      })
    }
  })
}