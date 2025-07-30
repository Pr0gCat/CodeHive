import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/projects/[id]/cycles/route'
import { GET as getCycle, DELETE as deleteCycle } from '@/app/api/cycles/[id]/route'
import { PUT as executePhase } from '@/app/api/cycles/[id]/execute/route'
import { mockPrisma, clearAllMocks } from '../../../helpers/test-utils'

// Mock the TDD engine
jest.mock('@/lib/tdd/cycle-engine', () => ({
  TDDCycleEngine: jest.fn().mockImplementation(() => ({
    startCycle: jest.fn().mockResolvedValue({
      id: 'new-cycle-id',
      title: 'Test Feature',
      phase: 'RED',
      status: 'ACTIVE',
    }),
    executePhase: jest.fn().mockResolvedValue({
      cycle: {
        id: 'test-cycle-id',
        phase: 'GREEN',
        status: 'ACTIVE',
      },
      tests: [],
      artifacts: [],
      status: 'COMPLETED',
      nextPhase: 'GREEN',
    }),
  })),
}))

describe('Cycles API Integration Tests', () => {
  beforeEach(() => {
    clearAllMocks()
    mockPrisma()
  })

  describe('GET /api/projects/[id]/cycles', () => {
    it('should return project cycles successfully', async () => {
      const { prisma } = require('@/lib/db')
      const mockCycles = [
        {
          id: 'cycle-1',
          title: 'Feature 1',
          phase: 'RED',
          status: 'ACTIVE',
          tests: [],
          artifacts: [],
          queries: [],
        },
        {
          id: 'cycle-2',
          title: 'Feature 2',
          phase: 'COMPLETED',
          status: 'COMPLETED',
          tests: [],
          artifacts: [],
          queries: [],
        },
      ]
      prisma.cycle.findMany.mockResolvedValue(mockCycles)

      const request = new NextRequest('http://localhost/api/projects/test-project/cycles')
      const response = await GET(request, { params: { id: 'test-project' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2)
      expect(data.data[0].title).toBe('Feature 1')

      expect(prisma.cycle.findMany).toHaveBeenCalledWith({
        where: { projectId: 'test-project' },
        include: {
          tests: { orderBy: { createdAt: 'asc' } },
          artifacts: { orderBy: { createdAt: 'desc' }, take: 10 },
          queries: { where: { status: 'PENDING' } },
        },
        orderBy: { createdAt: 'desc' },
      })
    })

    it('should handle database errors', async () => {
      const { prisma } = require('@/lib/db')
      prisma.cycle.findMany.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/projects/test-project/cycles')
      const response = await GET(request, { params: { id: 'test-project' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Database error')
    })
  })

  describe('POST /api/projects/[id]/cycles', () => {
    const validCycleRequest = {
      title: 'User Authentication',
      description: 'Implement login system',
      acceptanceCriteria: [
        'Users can login with email and password',
        'Invalid credentials are rejected',
      ],
      constraints: ['Must use JWT'],
    }

    it('should create new cycle successfully', async () => {
      const { prisma } = require('@/lib/db')
      prisma.project.findUnique.mockResolvedValue({
        id: 'test-project',
        localPath: '/test/path',
      })

      const { TDDCycleEngine } = require('@/lib/tdd/cycle-engine')
      const mockEngine = new TDDCycleEngine()

      const request = new NextRequest('http://localhost/api/projects/test-project/cycles', {
        method: 'POST',
        body: JSON.stringify(validCycleRequest),
      })

      const response = await POST(request, { params: { id: 'test-project' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.title).toBe('Test Feature')
      expect(mockEngine.startCycle).toHaveBeenCalledWith({
        ...validCycleRequest,
        projectId: 'test-project',
      })
    })

    it('should validate required fields', async () => {
      const invalidRequest = {
        title: 'Missing criteria',
        // acceptanceCriteria is missing
      }

      const request = new NextRequest('http://localhost/api/projects/test-project/cycles', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      })

      const response = await POST(request, { params: { id: 'test-project' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Missing required fields')
    })

    it('should handle non-existent project', async () => {
      const { prisma } = require('@/lib/db')
      prisma.project.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/projects/invalid-project/cycles', {
        method: 'POST',
        body: JSON.stringify(validCycleRequest),
      })

      const response = await POST(request, { params: { id: 'invalid-project' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Project not found')
    })

    it('should handle TDD engine failures', async () => {
      const { prisma } = require('@/lib/db')
      prisma.project.findUnique.mockResolvedValue({
        id: 'test-project',
        localPath: '/test/path',
      })

      const { TDDCycleEngine } = require('@/lib/tdd/cycle-engine')
      const mockEngine = new TDDCycleEngine()
      mockEngine.startCycle.mockRejectedValue(new Error('Git error'))

      const request = new NextRequest('http://localhost/api/projects/test-project/cycles', {
        method: 'POST',
        body: JSON.stringify(validCycleRequest),
      })

      const response = await POST(request, { params: { id: 'test-project' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Git error')
    })

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost/api/projects/test-project/cycles', {
        method: 'POST',
        body: 'invalid json',
      })

      const response = await POST(request, { params: { id: 'test-project' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
    })
  })

  describe('GET /api/cycles/[id]', () => {
    it('should return cycle details successfully', async () => {
      const { prisma } = require('@/lib/db')
      const mockCycle = {
        id: 'test-cycle-id',
        title: 'Test Cycle',
        tests: [{ id: 'test-1', name: 'Test 1' }],
        artifacts: [{ id: 'artifact-1', name: 'Artifact 1' }],
        queries: [{ id: 'query-1', title: 'Query 1', comments: [] }],
      }
      prisma.cycle.findUnique.mockResolvedValue(mockCycle)

      const request = new NextRequest('http://localhost/api/cycles/test-cycle-id')
      const response = await getCycle(request, { params: { id: 'test-cycle-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.title).toBe('Test Cycle')
      expect(data.data.tests).toHaveLength(1)
      expect(data.data.artifacts).toHaveLength(1)
      expect(data.data.queries).toHaveLength(1)
    })

    it('should handle non-existent cycle', async () => {
      const { prisma } = require('@/lib/db')
      prisma.cycle.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/cycles/invalid-cycle-id')
      const response = await getCycle(request, { params: { id: 'invalid-cycle-id' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Cycle not found')
    })
  })

  describe('DELETE /api/cycles/[id]', () => {
    it('should delete cycle successfully', async () => {
      const { prisma } = require('@/lib/db')
      prisma.cycle.findUnique.mockResolvedValue({ id: 'test-cycle-id' })
      prisma.cycle.delete.mockResolvedValue({ id: 'test-cycle-id' })

      const request = new NextRequest('http://localhost/api/cycles/test-cycle-id', {
        method: 'DELETE',
      })
      const response = await deleteCycle(request, { params: { id: 'test-cycle-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Cycle deleted successfully')
      expect(prisma.cycle.delete).toHaveBeenCalledWith({
        where: { id: 'test-cycle-id' },
      })
    })

    it('should handle non-existent cycle for deletion', async () => {
      const { prisma } = require('@/lib/db')
      prisma.cycle.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/cycles/invalid-cycle-id', {
        method: 'DELETE',
      })
      const response = await deleteCycle(request, { params: { id: 'invalid-cycle-id' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Cycle not found')
    })
  })

  describe('PUT /api/cycles/[id]/execute', () => {
    it('should execute cycle phase successfully', async () => {
      const { prisma } = require('@/lib/db')
      prisma.cycle.findUnique.mockResolvedValue({
        id: 'test-cycle-id',
        status: 'ACTIVE',
        project: { localPath: '/test/path' },
      })

      const { TDDCycleEngine } = require('@/lib/tdd/cycle-engine')
      const mockEngine = new TDDCycleEngine()

      const request = new NextRequest('http://localhost/api/cycles/test-cycle-id/execute', {
        method: 'PUT',
      })
      const response = await executePhase(request, { params: { id: 'test-cycle-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('COMPLETED')
      expect(data.data.nextPhase).toBe('GREEN')
      expect(mockEngine.executePhase).toHaveBeenCalledWith('test-cycle-id')
    })

    it('should handle blocked cycles', async () => {
      const { prisma } = require('@/lib/db')
      prisma.cycle.findUnique.mockResolvedValue({
        id: 'test-cycle-id',
        status: 'ACTIVE',
        project: { localPath: '/test/path' },
      })

      const { TDDCycleEngine } = require('@/lib/tdd/cycle-engine')
      const mockEngine = new TDDCycleEngine()
      mockEngine.executePhase.mockResolvedValue({
        cycle: { id: 'test-cycle-id' },
        tests: [],
        artifacts: [],
        queries: [{ id: 'query-1', urgency: 'BLOCKING' }],
        status: 'BLOCKED',
      })

      const request = new NextRequest('http://localhost/api/cycles/test-cycle-id/execute', {
        method: 'PUT',
      })
      const response = await executePhase(request, { params: { id: 'test-cycle-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('BLOCKED')
      expect(data.data.message).toContain('blocked by pending queries')
    })

    it('should handle failed phases', async () => {
      const { prisma } = require('@/lib/db')
      prisma.cycle.findUnique.mockResolvedValue({
        id: 'test-cycle-id',
        status: 'ACTIVE',
        project: { localPath: '/test/path' },
      })

      const { TDDCycleEngine } = require('@/lib/tdd/cycle-engine')
      const mockEngine = new TDDCycleEngine()
      mockEngine.executePhase.mockResolvedValue({
        cycle: { id: 'test-cycle-id' },
        tests: [],
        artifacts: [],
        status: 'FAILED',
      })

      const request = new NextRequest('http://localhost/api/cycles/test-cycle-id/execute', {
        method: 'PUT',
      })
      const response = await executePhase(request, { params: { id: 'test-cycle-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Phase execution failed')
    })

    it('should reject execution on paused cycles', async () => {
      const { prisma } = require('@/lib/db')
      prisma.cycle.findUnique.mockResolvedValue({
        id: 'test-cycle-id',
        status: 'PAUSED',
        project: { localPath: '/test/path' },
      })

      const request = new NextRequest('http://localhost/api/cycles/test-cycle-id/execute', {
        method: 'PUT',
      })
      const response = await executePhase(request, { params: { id: 'test-cycle-id' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Cycle is paused')
    })

    it('should handle non-existent cycle for execution', async () => {
      const { prisma } = require('@/lib/db')
      prisma.cycle.findUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/cycles/invalid-cycle-id/execute', {
        method: 'PUT',
      })
      const response = await executePhase(request, { params: { id: 'invalid-cycle-id' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Cycle not found')
    })

    it('should handle TDD engine execution errors', async () => {
      const { prisma } = require('@/lib/db')
      prisma.cycle.findUnique.mockResolvedValue({
        id: 'test-cycle-id',
        status: 'ACTIVE',
        project: { localPath: '/test/path' },
      })

      const { TDDCycleEngine } = require('@/lib/tdd/cycle-engine')
      const mockEngine = new TDDCycleEngine()
      mockEngine.executePhase.mockRejectedValue(new Error('AI service unavailable'))

      const request = new NextRequest('http://localhost/api/cycles/test-cycle-id/execute', {
        method: 'PUT',
      })
      const response = await executePhase(request, { params: { id: 'test-cycle-id' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('AI service unavailable')
    })
  })

  describe('Request validation and error handling', () => {
    it('should handle empty request body gracefully', async () => {
      const { prisma } = require('@/lib/db')
      prisma.project.findUnique.mockResolvedValue({
        id: 'test-project',
        localPath: '/test/path',
      })

      const request = new NextRequest('http://localhost/api/projects/test-project/cycles', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request, { params: { id: 'test-project' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should validate acceptanceCriteria is an array', async () => {
      const { prisma } = require('@/lib/db')
      prisma.project.findUnique.mockResolvedValue({
        id: 'test-project',
        localPath: '/test/path',
      })

      const invalidRequest = {
        title: 'Test Feature',
        acceptanceCriteria: 'not an array',
      }

      const request = new NextRequest('http://localhost/api/projects/test-project/cycles', {
        method: 'POST',
        body: JSON.stringify(invalidRequest),
      })

      const response = await POST(request, { params: { id: 'test-project' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('acceptanceCriteria array')
    })
  })
})