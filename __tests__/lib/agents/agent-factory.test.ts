import { AgentFactory } from '@/lib/execution/agent-factory';
import { AgentRegistry } from '@/lib/execution/base-agent';

// Mock the agent registry
jest.mock('@/lib/execution/base-agent', () => ({
  AgentRegistry: {
    create: jest.fn(),
    getAvailableAgents: jest.fn(),
    isSupported: jest.fn(),
  },
}));

// Mock agent implementations to prevent import errors
jest.mock('@/lib/execution/code-analyzer', () => ({}));
jest.mock('@/lib/execution/documentation', () => ({}));
jest.mock('@/lib/execution/git-operations', () => ({}));
jest.mock('@/lib/execution/test-runner', () => ({}));

const mockAgentRegistry = AgentRegistry as jest.Mocked<typeof AgentRegistry>;

describe('AgentFactory', () => {
  const mockProjectContext = {
    id: 'test-project-id',
    name: 'Test Project',
    localPath: '/path/to/project',
    techStack: {
      framework: 'Next.js',
      language: 'typescript',
      testFramework: 'jest',
    },
    structure: {
      files: [
        { path: 'src/index.ts', type: 'source' },
        { path: 'README.md', type: 'documentation' },
      ],
      testFiles: ['src/__tests__/index.test.ts'],
      directories: ['src', '__tests__'],
    },
    gitUrl: 'https://github.com/user/repo.git',
  };

  const mockAgent = {
    name: 'test-agent',
    description: 'Test agent for testing',
    execute: jest.fn(),
    validateCommand: jest.fn(),
    getCapabilities: jest.fn(),
    getSupportedCommands: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgentRegistry.getAvailableAgents.mockReturnValue([
      'code-analyzer',
      'test-runner',
      'git-operations',
      'documentation',
    ]);
  });

  describe('createAgent', () => {
    it('should create agent using AgentRegistry', async () => {
      mockAgentRegistry.create.mockResolvedValue(mockAgent);

      const result = await AgentFactory.createAgent('code-analyzer', mockProjectContext);

      expect(result).toBe(mockAgent);
      expect(mockAgentRegistry.create).toHaveBeenCalledWith('code-analyzer', mockProjectContext);
    });

    it('should return null when agent creation fails', async () => {
      mockAgentRegistry.create.mockResolvedValue(null);

      const result = await AgentFactory.createAgent('invalid-agent', mockProjectContext);

      expect(result).toBeNull();
    });
  });

  describe('getAvailableAgents', () => {
    it('should return available agents from registry', () => {
      const result = AgentFactory.getAvailableAgents();

      expect(result).toEqual(['code-analyzer', 'test-runner', 'git-operations', 'documentation']);
      expect(mockAgentRegistry.getAvailableAgents).toHaveBeenCalled();
    });
  });

  describe('isAgentSupported', () => {
    it('should check agent support through registry', () => {
      mockAgentRegistry.isSupported.mockReturnValue(true);

      const result = AgentFactory.isAgentSupported('code-analyzer');

      expect(result).toBe(true);
      expect(mockAgentRegistry.isSupported).toHaveBeenCalledWith('code-analyzer');
    });

    it('should return false for unsupported agents', () => {
      mockAgentRegistry.isSupported.mockReturnValue(false);

      const result = AgentFactory.isAgentSupported('unsupported-agent');

      expect(result).toBe(false);
    });
  });

  describe('executeAgent', () => {
    const mockExecutionRequest = {
      agentType: 'code-analyzer',
      command: 'analyze code quality',
      projectContext: mockProjectContext,
      options: { timeout: 30000 },
    };

    it('should successfully execute agent command', async () => {
      const mockResult = {
        success: true,
        output: 'Code analysis complete',
        executionTime: 5000,
        tokensUsed: 1500,
      };

      mockAgentRegistry.create.mockResolvedValue(mockAgent);
      mockAgent.execute.mockResolvedValue(mockResult);

      const result = await AgentFactory.executeAgent(mockExecutionRequest);

      expect(result).toEqual(mockResult);
      expect(mockAgent.execute).toHaveBeenCalledWith('analyze code quality', { timeout: 30000 });
    });

    it('should handle unsupported agent type', async () => {
      mockAgentRegistry.create.mockResolvedValue(null);

      const result = await AgentFactory.executeAgent({
        ...mockExecutionRequest,
        agentType: 'unsupported-agent',
      });

      expect(result).toEqual({
        success: false,
        error: 'Unsupported agent type: unsupported-agent',
        executionTime: 0,
        tokensUsed: 0,
      });
    });

    it('should handle agent execution errors', async () => {
      mockAgentRegistry.create.mockResolvedValue(mockAgent);
      mockAgent.execute.mockRejectedValue(new Error('Execution failed'));

      const result = await AgentFactory.executeAgent(mockExecutionRequest);

      expect(result).toEqual({
        success: false,
        error: 'Execution failed',
        executionTime: 0,
        tokensUsed: 50,
      });
    });

    it('should handle unknown errors', async () => {
      mockAgentRegistry.create.mockResolvedValue(mockAgent);
      mockAgent.execute.mockRejectedValue('String error');

      const result = await AgentFactory.executeAgent(mockExecutionRequest);

      expect(result).toEqual({
        success: false,
        error: 'Unknown error during agent execution',
        executionTime: 0,
        tokensUsed: 50,
      });
    });

    it('should use default options when not provided', async () => {
      mockAgentRegistry.create.mockResolvedValue(mockAgent);
      mockAgent.execute.mockResolvedValue({ success: true });

      await AgentFactory.executeAgent({
        agentType: 'code-analyzer',
        command: 'test command',
        projectContext: mockProjectContext,
      });

      expect(mockAgent.execute).toHaveBeenCalledWith('test command', {});
    });
  });

  describe('validateCommand', () => {
    beforeEach(() => {
      mockAgent.validateCommand.mockReturnValue({ valid: true });
      mockAgent.getSupportedCommands.mockReturnValue([
        { name: 'analyze', description: 'Analyze code', examples: ['analyze --all'] },
      ]);
    });

    it('should validate command successfully', async () => {
      mockAgentRegistry.create.mockResolvedValue(mockAgent);

      const result = await AgentFactory.validateCommand(
        'code-analyzer',
        'analyze code',
        mockProjectContext
      );

      expect(result).toEqual({ valid: true });
      expect(mockAgent.validateCommand).toHaveBeenCalledWith('analyze code');
    });

    it('should handle unsupported agent type', async () => {
      mockAgentRegistry.create.mockResolvedValue(null);
      mockAgentRegistry.getAvailableAgents.mockReturnValue(['code-analyzer', 'test-runner']);

      const result = await AgentFactory.validateCommand(
        'unsupported-agent',
        'test command',
        mockProjectContext
      );

      expect(result).toEqual({
        valid: false,
        error: 'Unsupported agent type: unsupported-agent',
        suggestions: ['code-analyzer', 'test-runner'],
      });
    });

    it('should handle invalid command with suggestions', async () => {
      mockAgentRegistry.create.mockResolvedValue(mockAgent);
      mockAgent.validateCommand.mockReturnValue({
        valid: false,
        error: 'Invalid command format',
      });

      const result = await AgentFactory.validateCommand(
        'code-analyzer',
        'invalid command',
        mockProjectContext
      );

      expect(result).toEqual({
        valid: false,
        error: 'Invalid command format',
        suggestions: expect.arrayContaining([expect.stringContaining('analyze')]),
      });
    });

    it('should handle validation errors', async () => {
      mockAgentRegistry.create.mockRejectedValue(new Error('Validation error'));

      const result = await AgentFactory.validateCommand(
        'code-analyzer',
        'test command',
        mockProjectContext
      );

      expect(result).toEqual({
        valid: false,
        error: 'Validation error',
      });
    });
  });

  describe('getAgentCapabilities', () => {
    beforeEach(() => {
      mockAgent.getCapabilities.mockReturnValue(['analyze', 'lint', 'format']);
      mockAgent.getSupportedCommands.mockReturnValue([
        { name: 'analyze', description: 'Analyze code', examples: ['analyze --all'] },
        { name: 'lint', description: 'Run linter', examples: ['lint src/'] },
      ]);
    });

    it('should return agent capabilities and commands', async () => {
      mockAgentRegistry.create.mockResolvedValue(mockAgent);

      const result = await AgentFactory.getAgentCapabilities('code-analyzer', mockProjectContext);

      expect(result).toEqual({
        capabilities: ['analyze', 'lint', 'format'],
        commands: [
          { name: 'analyze', description: 'Analyze code', examples: ['analyze --all'] },
          { name: 'lint', description: 'Run linter', examples: ['lint src/'] },
        ],
      });
    });

    it('should return null for unsupported agent', async () => {
      mockAgentRegistry.create.mockResolvedValue(null);

      const result = await AgentFactory.getAgentCapabilities('unsupported-agent', mockProjectContext);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockAgentRegistry.create.mockRejectedValue(new Error('Error getting capabilities'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await AgentFactory.getAgentCapabilities('code-analyzer', mockProjectContext);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error getting agent capabilities:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getAgentDescription', () => {
    it('should return descriptions for known agents', () => {
      const descriptions = {
        'code-analyzer': 'Analyzes code quality, performs type checking, linting, security scans, and provides optimization recommendations.',
        'test-runner': 'Executes tests, creates test suites, fixes failing tests, and provides comprehensive testing coverage.',
        'git-operations': 'Manages version control operations including commits, branches, merges, and repository maintenance.',
        'documentation': 'Generates and maintains project documentation including READMEs, code docs, API references, and developer guides.',
        'project-manager': 'Orchestrates multiple agents, analyzes project health, and provides strategic development recommendations.',
      };

      Object.entries(descriptions).forEach(([agentType, expectedDescription]) => {
        expect(AgentFactory.getAgentDescription(agentType)).toBe(expectedDescription);
      });
    });

    it('should return default message for unknown agent', () => {
      expect(AgentFactory.getAgentDescription('unknown-agent')).toBe('Unknown agent type');
    });
  });

  describe('getAgentTypeFromCommand', () => {
    it('should identify code-analyzer commands', () => {
      const commands = [
        'analyze the code',
        'run lint checks',
        'perform type check',
        'security scan',
        'create new file',
        'modify existing code',
        'refactor this function',
        'update the module',
        'format the code',
      ];

      commands.forEach(command => {
        expect(AgentFactory.getAgentTypeFromCommand(command)).toBe('code-analyzer');
      });
    });

    it('should identify test-runner commands', () => {
      const commands = [
        'run tests',
        'check test coverage',
        'create test spec',
        'execute test suite',
      ];

      commands.forEach(command => {
        expect(AgentFactory.getAgentTypeFromCommand(command)).toBe('test-runner');
      });
    });

    it('should identify git-operations commands', () => {
      const commands = [
        'git status',
        'commit changes',
        'create branch',
        'merge branches',
        'push to origin',
        'pull latest changes',
      ];

      commands.forEach(command => {
        expect(AgentFactory.getAgentTypeFromCommand(command)).toBe('git-operations');
      });
    });

    it('should identify documentation commands', () => {
      const commands = [
        'generate documentation',
        'update readme',
        'create changelog',
        'write user guide',
      ];

      commands.forEach(command => {
        expect(AgentFactory.getAgentTypeFromCommand(command)).toBe('documentation');
      });
    });

    it('should identify project-manager commands', () => {
      const commands = [
        'orchestrate the project',
        'manage dependencies',
        'coordinate team work',
      ];

      commands.forEach(command => {
        expect(AgentFactory.getAgentTypeFromCommand(command)).toBe('project-manager');
      });
    });

    it('should default to code-analyzer for ambiguous commands', () => {
      expect(AgentFactory.getAgentTypeFromCommand('some random command')).toBe('code-analyzer');
    });

    it('should handle case insensitive matching', () => {
      expect(AgentFactory.getAgentTypeFromCommand('ANALYZE THE CODE')).toBe('code-analyzer');
      expect(AgentFactory.getAgentTypeFromCommand('Run TESTS')).toBe('test-runner');
    });
  });

  describe('batchValidateCommands', () => {
    it('should validate multiple commands', async () => {
      const requests = [
        { agentType: 'code-analyzer', command: 'analyze code' },
        { agentType: 'test-runner', command: 'run tests' },
      ];

      mockAgentRegistry.create.mockResolvedValue(mockAgent);
      mockAgent.validateCommand.mockReturnValue({ valid: true });

      const results = await AgentFactory.batchValidateCommands(requests, mockProjectContext);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        request: requests[0],
        result: { valid: true },
      });
      expect(results[1]).toEqual({
        request: requests[1],
        result: { valid: true },
      });
    });

    it('should handle mixed validation results', async () => {
      const requests = [
        { agentType: 'code-analyzer', command: 'valid command' },
        { agentType: 'invalid-agent', command: 'invalid command' },
      ];

      mockAgentRegistry.create
        .mockResolvedValueOnce(mockAgent)
        .mockResolvedValueOnce(null);
      mockAgent.validateCommand.mockReturnValue({ valid: true });

      const results = await AgentFactory.batchValidateCommands(requests, mockProjectContext);

      expect(results).toHaveLength(2);
      expect(results[0].result.valid).toBe(true);
      expect(results[1].result.valid).toBe(false);
    });
  });

  describe('getRecommendedAgentSequence', () => {
    it('should recommend agents based on project context with tests and readme', () => {
      const recommendations = AgentFactory.getRecommendedAgentSequence(mockProjectContext);

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            agentType: 'code-analyzer',
            priority: 9,
            reason: 'Identify code quality issues and technical debt',
          }),
          expect.objectContaining({
            agentType: 'git-operations',
            priority: 8,
            reason: 'Ensure repository is in good state',
          }),
          expect.objectContaining({
            agentType: 'test-runner',
            priority: 6,
            reason: 'Verify current test health and coverage',
          }),
        ])
      );

      // Should be sorted by priority descending
      expect(recommendations[0].priority).toBeGreaterThanOrEqual(recommendations[1].priority);
    });

    it('should recommend test setup when no tests exist', () => {
      const contextWithoutTests = {
        ...mockProjectContext,
        structure: {
          ...mockProjectContext.structure,
          testFiles: [],
        },
      };

      const recommendations = AgentFactory.getRecommendedAgentSequence(contextWithoutTests);
      const testRecommendation = recommendations.find(r => r.agentType === 'test-runner');

      expect(testRecommendation).toEqual(
        expect.objectContaining({
          command: 'Set up testing framework and create basic tests',
          reason: 'No tests found - establish testing foundation',
          priority: 7,
        })
      );
    });

    it('should recommend README creation when missing', () => {
      const contextWithoutReadme = {
        ...mockProjectContext,
        structure: {
          ...mockProjectContext.structure,
          files: [{ path: 'src/index.ts', type: 'source' }],
        },
      };

      const recommendations = AgentFactory.getRecommendedAgentSequence(contextWithoutReadme);
      const docRecommendation = recommendations.find(r => r.agentType === 'documentation');

      expect(docRecommendation).toEqual(
        expect.objectContaining({
          command: 'Generate comprehensive README for the project',
          reason: 'No README found - create project documentation',
          priority: 5,
        })
      );
    });

    it('should not recommend git operations when no git URL', () => {
      const contextWithoutGit = {
        ...mockProjectContext,
        gitUrl: undefined,
      };

      const recommendations = AgentFactory.getRecommendedAgentSequence(contextWithoutGit);
      const gitRecommendation = recommendations.find(r => r.agentType === 'git-operations');

      expect(gitRecommendation).toBeUndefined();
    });

    it('should return recommendations sorted by priority', () => {
      const recommendations = AgentFactory.getRecommendedAgentSequence(mockProjectContext);

      for (let i = 0; i < recommendations.length - 1; i++) {
        expect(recommendations[i].priority).toBeGreaterThanOrEqual(recommendations[i + 1].priority);
      }
    });
  });

  describe('getCommandSuggestions', () => {
    beforeEach(() => {
      mockAgent.getSupportedCommands.mockReturnValue([
        {
          name: 'analyze',
          description: 'Analyze code quality and performance',
          examples: ['analyze --all', 'analyze src/'],
        },
        {
          name: 'lint',
          description: 'Run linting checks',
          examples: ['lint', 'lint --fix'],
        },
        {
          name: 'format',
          description: 'Format code according to style guide',
          examples: ['format src/', 'format --check'],
        },
      ]);
    });

    it('should provide suggestions based on command similarity', () => {
      const suggestions = (AgentFactory as any).getCommandSuggestions(mockAgent, 'analy');

      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('analyze'),
          expect.stringContaining('Try: "analyze --all"'),
        ])
      );
    });

    it('should provide general suggestions when no specific match found', () => {
      const suggestions = (AgentFactory as any).getCommandSuggestions(mockAgent, 'xyz');

      expect(suggestions).toHaveLength(3); // Limited to 3 general suggestions
      expect(suggestions[0]).toMatch(/Try: ".+" \(.+\)/);
    });

    it('should limit suggestions to 5 items', () => {
      // Mock many commands to test limit
      const manyCommands = Array.from({ length: 10 }, (_, i) => ({
        name: `command-${i}`,
        description: `Command ${i} description with analy`,
        examples: [`command-${i} --analy`],
      }));
      mockAgent.getSupportedCommands.mockReturnValue(manyCommands);

      const suggestions = (AgentFactory as any).getCommandSuggestions(mockAgent, 'analy');

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });
});