import { QueryManager } from '@/lib/queries/query-manager'
import { mockPrisma, mockQuery, clearAllMocks } from '../../helpers/test-utils'

describe('QueryManager', () => {
  let queryManager: QueryManager

  beforeEach(() => {
    clearAllMocks()
    queryManager = new QueryManager()
    mockPrisma()
  })

  describe('createQuery', () => {
    const mockQueryData = {
      projectId: 'test-project-id',
      cycleId: 'test-cycle-id',
      type: 'ARCHITECTURE' as const,
      title: 'Test Architecture Decision',
      question: 'Should we use REST or GraphQL?',
      context: { options: ['REST', 'GraphQL'] },
      urgency: 'BLOCKING' as const,
      priority: 'HIGH' as const,
    }

    it('should create a query successfully', async () => {
      const { prisma } = require('@/lib/db')
      prisma.query.create.mockResolvedValue({
        ...mockQuery,
        ...mockQueryData,
        context: JSON.stringify(mockQueryData.context),
      })

      const result = await queryManager.createQuery(mockQueryData)

      expect(prisma.query.create).toHaveBeenCalledWith({
        data: {
          projectId: mockQueryData.projectId,
          cycleId: mockQueryData.cycleId,
          type: mockQueryData.type,
          title: mockQueryData.title,
          question: mockQueryData.question,
          context: JSON.stringify(mockQueryData.context),
          urgency: mockQueryData.urgency,
          priority: mockQueryData.priority,
          status: 'PENDING',
        },
        include: {
          cycle: true,
          comments: true,
        },
      })

      expect(result.title).toBe(mockQueryData.title)
    })

    it('should pause cycle for blocking queries', async () => {
      const { prisma } = require('@/lib/db')
      const blockingQuery = {
        ...mockQueryData,
        urgency: 'BLOCKING' as const,
      }

      await queryManager.createQuery(blockingQuery)

      expect(prisma.cycle.update).toHaveBeenCalledWith({
        where: { id: 'test-cycle-id' },
        data: {
          status: 'PAUSED',
          updatedAt: expect.any(Date),
        },
      })
    })

    it('should not pause cycle for advisory queries', async () => {
      const { prisma } = require('@/lib/db')
      const advisoryQuery = {
        ...mockQueryData,
        urgency: 'ADVISORY' as const,
      }

      await queryManager.createQuery(advisoryQuery)

      expect(prisma.cycle.update).not.toHaveBeenCalled()
    })

    it('should set default priority based on urgency', async () => {
      const { prisma } = require('@/lib/db')
      const queryWithoutPriority = {
        ...mockQueryData,
        priority: undefined,
      }

      await queryManager.createQuery(queryWithoutPriority as any)

      expect(prisma.query.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 'HIGH', // Should default to HIGH for BLOCKING
        }),
        include: expect.any(Object),
      })
    })
  })

  describe('getQueries', () => {
    it('should get queries with filters', async () => {
      const { prisma } = require('@/lib/db')
      const filters = {
        projectId: 'test-project-id',
        status: 'PENDING' as const,
        urgency: 'BLOCKING' as const,
      }

      await queryManager.getQueries(filters)

      expect(prisma.query.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'test-project-id',
          status: 'PENDING',
          urgency: 'BLOCKING',
        },
        include: {
          cycle: true,
          comments: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [
          { urgency: 'asc' },
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
      })
    })

    it('should handle empty filters', async () => {
      const { prisma } = require('@/lib/db')

      await queryManager.getQueries({})

      expect(prisma.query.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: expect.any(Array),
      })
    })
  })

  describe('getPendingQueries', () => {
    it('should get only pending queries for a project', async () => {
      await queryManager.getPendingQueries('test-project-id')

      const { prisma } = require('@/lib/db')
      expect(prisma.query.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'test-project-id',
          status: 'PENDING',
        },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      })
    })
  })

  describe('answerQuery', () => {
    it('should answer query and resume cycle', async () => {
      const { prisma } = require('@/lib/db')
      const answeredQuery = {
        ...mockQuery,
        urgency: 'BLOCKING',
        cycleId: 'test-cycle-id',
        answer: 'Use REST API',
        status: 'ANSWERED',
      }
      prisma.query.update.mockResolvedValue(answeredQuery)

      const result = await queryManager.answerQuery('test-query-id', 'Use REST API')

      expect(prisma.query.update).toHaveBeenCalledWith({
        where: { id: 'test-query-id' },
        data: {
          answer: 'Use REST API',
          answeredAt: expect.any(Date),
          status: 'ANSWERED',
        },
        include: {
          cycle: true,
        },
      })

      expect(prisma.queryComment.create).toHaveBeenCalledWith({
        data: {
          queryId: 'test-query-id',
          content: 'Query answered: Use REST API',
          author: 'system',
        },
      })

      expect(prisma.cycle.update).toHaveBeenCalledWith({
        where: { id: 'test-cycle-id' },
        data: {
          status: 'ACTIVE',
          updatedAt: expect.any(Date),
        },
      })

      expect(result.shouldContinue).toBe(true)
    })

    it('should evaluate negative answers correctly', async () => {
      const { prisma } = require('@/lib/db')
      prisma.query.update.mockResolvedValue({
        ...mockQuery,
        answer: 'No, stop development',
      })

      const result = await queryManager.answerQuery('test-query-id', 'No, stop development')

      expect(result.shouldContinue).toBe(false)
      expect(result.alternativeAction).toBe('retry_with_different_approach')
    })

    it('should not resume cycle for advisory queries', async () => {
      const { prisma } = require('@/lib/db')
      const advisoryQuery = {
        ...mockQuery,
        urgency: 'ADVISORY',
        cycleId: null,
      }
      prisma.query.update.mockResolvedValue(advisoryQuery)

      await queryManager.answerQuery('test-query-id', 'Good suggestion')

      // Should not call cycle update for advisory queries
      expect(prisma.cycle.update).not.toHaveBeenCalled()
    })
  })

  describe('dismissQuery', () => {
    it('should dismiss query successfully', async () => {
      const { prisma } = require('@/lib/db')
      const dismissedQuery = {
        ...mockQuery,
        status: 'DISMISSED',
      }
      prisma.query.update.mockResolvedValue(dismissedQuery)

      const result = await queryManager.dismissQuery('test-query-id')

      expect(prisma.query.update).toHaveBeenCalledWith({
        where: { id: 'test-query-id' },
        data: {
          status: 'DISMISSED',
          updatedAt: expect.any(Date),
        },
      })

      expect(prisma.queryComment.create).toHaveBeenCalledWith({
        data: {
          queryId: 'test-query-id',
          content: 'Query dismissed by user',
          author: 'system',
        },
      })

      expect(result.status).toBe('DISMISSED')
    })
  })

  describe('addComment', () => {
    it('should add comment to query', async () => {
      const { prisma } = require('@/lib/db')
      const mockComment = {
        id: 'test-comment-id',
        queryId: 'test-query-id',
        content: 'Additional context',
        author: 'user',
        createdAt: new Date(),
      }
      prisma.queryComment.create.mockResolvedValue(mockComment)

      const result = await queryManager.addComment('test-query-id', 'Additional context')

      expect(prisma.queryComment.create).toHaveBeenCalledWith({
        data: {
          queryId: 'test-query-id',
          content: 'Additional context',
          author: 'user',
        },
      })

      expect(result.content).toBe('Additional context')
    })

    it('should support different comment authors', async () => {
      const { prisma } = require('@/lib/db')

      await queryManager.addComment('test-query-id', 'AI suggestion', 'ai')

      expect(prisma.queryComment.create).toHaveBeenCalledWith({
        data: {
          queryId: 'test-query-id',
          content: 'AI suggestion',
          author: 'ai',
        },
      })
    })
  })

  describe('hasBlockingQueries', () => {
    it('should return true when blocking queries exist', async () => {
      const { prisma } = require('@/lib/db')
      prisma.query.count.mockResolvedValue(2)

      const result = await queryManager.hasBlockingQueries('test-cycle-id')

      expect(prisma.query.count).toHaveBeenCalledWith({
        where: {
          cycleId: 'test-cycle-id',
          status: 'PENDING',
          urgency: 'BLOCKING',
        },
      })

      expect(result).toBe(true)
    })

    it('should return false when no blocking queries exist', async () => {
      const { prisma } = require('@/lib/db')
      prisma.query.count.mockResolvedValue(0)

      const result = await queryManager.hasBlockingQueries('test-cycle-id')

      expect(result).toBe(false)
    })
  })

  describe('expireOldQueries', () => {
    it('should expire old advisory queries', async () => {
      const { prisma } = require('@/lib/db')
      prisma.query.updateMany.mockResolvedValue({ count: 3 })

      const result = await queryManager.expireOldQueries(7)

      expect(prisma.query.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          urgency: 'ADVISORY',
          createdAt: { lt: expect.any(Date) },
        },
        data: {
          status: 'EXPIRED',
        },
      })

      expect(result).toBe(3)
    })

    it('should use default expiration period', async () => {
      const { prisma } = require('@/lib/db')
      
      await queryManager.expireOldQueries()

      const callArgs = prisma.query.updateMany.mock.calls[0][0]
      const cutoffDate = callArgs.where.createdAt.lt
      const expectedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      
      // Check that the cutoff date is approximately 7 days ago (within 1 minute tolerance)
      expect(Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())).toBeLessThan(60000)
    })
  })

  describe('getDecisionStats', () => {
    it('should calculate decision statistics', async () => {
      const { prisma } = require('@/lib/db')
      const mockQueries = [
        { ...mockQuery, status: 'PENDING', urgency: 'BLOCKING' },
        { ...mockQuery, id: 'query-2', status: 'ANSWERED', urgency: 'ADVISORY', answeredAt: new Date(), createdAt: new Date(Date.now() - 60000) },
        { ...mockQuery, id: 'query-3', status: 'DISMISSED', urgency: 'ADVISORY' },
        { ...mockQuery, id: 'query-4', status: 'EXPIRED', urgency: 'ADVISORY' },
      ]
      prisma.query.findMany.mockResolvedValue(mockQueries)

      const stats = await queryManager.getDecisionStats('test-project-id')

      expect(stats).toEqual({
        total: 4,
        pending: 1,
        answered: 1,
        dismissed: 1,
        expired: 1,
        blocking: 1,
        avgResponseTime: 1, // 1 minute
      })
    })

    it('should handle empty query list', async () => {
      const { prisma } = require('@/lib/db')
      prisma.query.findMany.mockResolvedValue([])

      const stats = await queryManager.getDecisionStats('test-project-id')

      expect(stats).toEqual({
        total: 0,
        pending: 0,
        answered: 0,
        dismissed: 0,
        expired: 0,
        blocking: 0,
        avgResponseTime: 0,
      })
    })
  })

  describe('createDecisionBranch', () => {
    it('should create decision branch info', async () => {
      const { prisma } = require('@/lib/db')
      const queryWithContext = {
        ...mockQuery,
        context: JSON.stringify({ existing: 'context' }),
        cycleId: 'test-cycle-id',
      }
      prisma.query.findUnique.mockResolvedValue(queryWithContext)

      await queryManager.createDecisionBranch(
        'test-query-id',
        'feature/decision-branch',
        'Test decision branch'
      )

      expect(prisma.query.update).toHaveBeenCalledWith({
        where: { id: 'test-query-id' },
        data: {
          context: JSON.stringify({
            existing: 'context',
            decisionBranch: {
              name: 'feature/decision-branch',
              description: 'Test decision branch',
              createdAt: expect.any(Date),
            },
          }),
        },
      })

      expect(prisma.queryComment.create).toHaveBeenCalledWith({
        data: {
          queryId: 'test-query-id',
          content: 'Decision branch created: feature/decision-branch - Test decision branch',
          author: 'system',
        },
      })
    })

    it('should handle query without cycle', async () => {
      const { prisma } = require('@/lib/db')
      prisma.query.findUnique.mockResolvedValue(null)

      await expect(
        queryManager.createDecisionBranch('invalid-query-id', 'branch', 'description')
      ).rejects.toThrow('Query not found or not associated with a cycle')
    })
  })
})