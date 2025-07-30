import { AITDDIntegration } from '@/lib/tdd/ai-integration'
import { mockPrisma, mockProject, mockTest, mockArtifact, clearAllMocks } from '../../helpers/test-utils'

// Mock AgentExecutor
jest.mock('@/lib/agents/executor', () => ({
  AgentExecutor: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({
      success: true,
      output: 'AI generated code',
    }),
  })),
}))

describe('AITDDIntegration', () => {
  let aiIntegration: AITDDIntegration

  beforeEach(() => {
    clearAllMocks()
    aiIntegration = new AITDDIntegration()
    mockPrisma()
  })

  describe('generateTestCode', () => {
    const mockRequest = {
      cycleId: 'test-cycle-id',
      acceptanceCriterion: 'Users can login with valid credentials',
      projectContext: {
        id: 'test-project-id',
        name: 'Test Project',
        localPath: '/test/path',
        techStack: {
          framework: 'Next.js',
          language: 'typescript',
          testFramework: 'jest',
        },
      },
    }

    it('should generate test code using AI', async () => {
      const { AgentExecutor } = require('@/lib/agents/executor')
      const mockExecutor = new AgentExecutor()
      mockExecutor.execute.mockResolvedValue({
        success: true,
        output: 'describe("Login", () => { it("should login with valid credentials", () => { expect(true).toBe(true); }); });',
      })

      const { prisma } = require('@/lib/db')
      prisma.test.create.mockResolvedValue({
        ...mockTest,
        name: 'should users can login with valid credentials',
      })

      const result = await aiIntegration.generateTestCode(mockRequest)

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.stringContaining('Users can login with valid credentials'),
        expect.objectContaining({
          workingDirectory: '/test/path',
          agentType: 'tdd-test-generator',
        })
      )

      expect(result.test).toBeDefined()
      expect(result.test.name).toContain('users can login')
    })

    it('should handle AI execution failures', async () => {
      const { AgentExecutor } = require('@/lib/agents/executor')
      const mockExecutor = new AgentExecutor()
      mockExecutor.execute.mockResolvedValue({
        success: false,
        error: 'AI service unavailable',
      })

      const { prisma } = require('@/lib/db')
      prisma.query.create.mockResolvedValue({
        id: 'decision-query-id',
        title: 'Unable to generate test automatically',
      })

      await expect(aiIntegration.generateTestCode(mockRequest))
        .rejects.toThrow('AI service unavailable')

      expect(prisma.query.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'CLARIFICATION',
          title: 'Unable to generate test automatically',
          urgency: 'BLOCKING',
        }),
      })
    })

    it('should detect decision points in AI output', async () => {
      const { AgentExecutor } = require('@/lib/agents/executor')
      const mockExecutor = new AgentExecutor()
      mockExecutor.execute.mockResolvedValue({
        success: true,
        output: 'Generated test code with architectural decision needed for database choice',
      })

      const result = await aiIntegration.generateTestCode(mockRequest)

      expect(result.decision).toBeDefined()
      expect(result.decision?.title).toContain('Architectural Decision')
    })
  })

  describe('generateImplementationCode', () => {
    const mockRequest = {
      cycleId: 'test-cycle-id',
      test: mockTest,
      projectContext: {
        id: 'test-project-id',
        name: 'Test Project',
        localPath: '/test/path',
        techStack: {
          framework: 'Next.js',
          language: 'typescript',
          testFramework: 'jest',
        },
      },
    }

    it('should generate implementation code using AI', async () => {
      const { AgentExecutor } = require('@/lib/agents/executor')
      const mockExecutor = new AgentExecutor()
      mockExecutor.execute.mockResolvedValue({
        success: true,
        output: 'export function login(credentials) { return validateUser(credentials); }',
      })

      const { prisma } = require('@/lib/db')
      prisma.artifact.create.mockResolvedValue({
        ...mockArtifact,
        content: 'export function login(credentials) { return validateUser(credentials); }',
      })

      const result = await aiIntegration.generateImplementationCode(mockRequest)

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.stringContaining('should work correctly'),
        expect.objectContaining({
          workingDirectory: '/test/path',
          agentType: 'tdd-implementation',
        })
      )

      expect(result.artifact).toBeDefined()
      expect(result.artifact.type).toBe('CODE')
    })

    it('should handle implementation failures with decision query', async () => {
      const { AgentExecutor } = require('@/lib/agents/executor')
      const mockExecutor = new AgentExecutor()
      mockExecutor.execute.mockResolvedValue({
        success: false,
        error: 'Complex implementation required',
      })

      await expect(aiIntegration.generateImplementationCode(mockRequest))
        .rejects.toThrow('Complex implementation required')

      const { prisma } = require('@/lib/db')
      expect(prisma.query.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'BUSINESS_LOGIC',
          urgency: 'BLOCKING',
        }),
      })
    })
  })

  describe('refactorCode', () => {
    const mockRequest = {
      cycleId: 'test-cycle-id',
      artifact: mockArtifact,
      projectContext: {
        id: 'test-project-id',
        name: 'Test Project',
        localPath: '/test/path',
        techStack: {
          framework: 'Next.js',
          language: 'typescript',
          testFramework: 'jest',
        },
      },
    }

    it('should refactor code using AI', async () => {
      const { AgentExecutor } = require('@/lib/agents/executor')
      const mockExecutor = new AgentExecutor()
      mockExecutor.execute.mockResolvedValue({
        success: true,
        output: 'Refactored code with better structure and error handling',
      })

      const { prisma } = require('@/lib/db')
      prisma.artifact.create.mockResolvedValue({
        ...mockArtifact,
        name: 'test-implementation.refactored',
        content: 'Refactored code with better structure and error handling',
      })

      const result = await aiIntegration.refactorCode(mockRequest)

      expect(mockExecutor.execute).toHaveBeenCalledWith(
        expect.stringContaining('implementation code'),
        expect.objectContaining({
          workingDirectory: '/test/path',
          agentType: 'tdd-refactoring',
        })
      )

      expect(result.artifact.name).toContain('refactored')
    })

    it('should handle refactoring failures gracefully', async () => {
      const { AgentExecutor } = require('@/lib/agents/executor')
      const mockExecutor = new AgentExecutor()
      mockExecutor.execute.mockResolvedValue({
        success: false,
        error: 'Refactoring too complex',
      })

      const result = await aiIntegration.refactorCode(mockRequest)

      // Should return original artifact on failure
      expect(result.artifact).toBe(mockArtifact)
      expect(result.decision).toBeDefined()
      expect(result.decision?.urgency).toBe('ADVISORY')
    })
  })

  describe('analyzeCodeQuality', () => {
    const mockArtifacts = [
      {
        ...mockArtifact,
        content: 'function veryLongFunctionNameThatExceedsReasonableLimitsAndShouldBeRefactoredForBetterReadabilityAndMaintainability() { /* very long code without error handling */ }',
      },
      {
        ...mockArtifact,
        id: 'artifact-2',
        content: 'function shortFunction() { try { return result; } catch (e) { throw e; } }',
      },
    ]

    it('should detect code quality issues', async () => {
      const queries = await aiIntegration.analyzeCodeQuality('test-cycle-id', mockArtifacts)

      expect(queries).toHaveLength(1) // Only first artifact should have issues
      expect(queries[0].type).toBe('ARCHITECTURE')
      expect(queries[0].urgency).toBe('ADVISORY')
      expect(queries[0].title).toContain('Code quality concerns')
    })

    it('should return empty array for good quality code', async () => {
      const goodArtifacts = [
        {
          ...mockArtifact,
          content: 'function goodFunction() { try { return validateInput(); } catch (error) { handleError(error); } }',
        },
      ]

      const queries = await aiIntegration.analyzeCodeQuality('test-cycle-id', goodArtifacts)

      expect(queries).toHaveLength(0)
    })
  })

  describe('buildTestGenerationPrompt', () => {
    it('should build comprehensive prompt for test generation', async () => {
      const criterion = 'Users can login with valid credentials'
      const context = {
        techStack: {
          framework: 'Next.js',
          language: 'TypeScript',
          testFramework: 'Jest',
        },
      }

      const prompt = aiIntegration['buildTestGenerationPrompt'](criterion, context as any)

      expect(prompt).toContain(criterion)
      expect(prompt).toContain('Next.js')
      expect(prompt).toContain('TypeScript')
      expect(prompt).toContain('Jest')
      expect(prompt).toContain('FAIL')
      expect(prompt).toContain('red phase')
    })
  })

  describe('buildImplementationPrompt', () => {
    it('should build prompt with test code context', async () => {
      const test = {
        ...mockTest,
        code: 'it("should login with valid credentials", () => { expect(login("user", "pass")).toBeTruthy(); });',
      }
      const context = {
        techStack: {
          framework: 'Next.js',
          language: 'TypeScript',
        },
      }

      const prompt = aiIntegration['buildImplementationPrompt'](test as any, context as any)

      expect(prompt).toContain(test.code)
      expect(prompt).toContain('MINIMAL implementation')
      expect(prompt).toContain('Next.js')
      expect(prompt).toContain('TypeScript')
    })
  })

  describe('mapToQueryType', () => {
    it('should map error types to correct query types', async () => {
      const mappings = [
        ['TEST_GENERATION_FAILED', 'CLARIFICATION'],
        ['IMPLEMENTATION_FAILED', 'BUSINESS_LOGIC'],
        ['REFACTORING_SUGGESTION', 'ARCHITECTURE'],
        ['CODE_QUALITY_ISSUE', 'ARCHITECTURE'],
        ['ARCHITECTURAL_DECISION', 'ARCHITECTURE'],
        ['UNKNOWN_TYPE', 'CLARIFICATION'],
      ]

      for (const [inputType, expectedType] of mappings) {
        const result = aiIntegration['mapToQueryType'](inputType)
        expect(result).toBe(expectedType)
      }
    })
  })

  describe('performCodeQualityChecks', () => {
    it('should detect various code quality issues', async () => {
      const badCode = `
        function veryLongFunctionWithTooManyLinesOfCodeThatShouldBeRefactoredIntoSmallerFunctionsForBetterMaintainabilityAndReadability() {
          // This is a very long line that exceeds 120 characters and should be wrapped or shortened for better readability and code standards
          const result = someVeryLongVariableNameThatIsUnnecessarilyVerboseAndShouldBeSimplified;
          return result;
        }
      `

      const issues = aiIntegration['performCodeQualityChecks'](badCode)

      expect(issues).toContain('File is too large, consider splitting into smaller modules')
      expect(issues).toContain('No error handling found')
      expect(issues).toContain('Some lines exceed 120 characters')
    })

    it('should return empty array for good code', async () => {
      const goodCode = `
        function login(user, pass) {
          try {
            return validateCredentials(user, pass);
          } catch (error) {
            handleError(error);
          }
        }
      `

      const issues = aiIntegration['performCodeQualityChecks'](goodCode)

      expect(issues).toHaveLength(0)
    })
  })
})