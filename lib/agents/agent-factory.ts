import { BaseAgent, AgentRegistry } from './executors/base-agent';
import { ProjectContext } from './project-manager';
import { AgentResult, AgentExecutionOptions } from './types';

// Import all agent implementations to register them
import './executors/code-analyzer';
import './executors/test-runner';
import './executors/git-operations';
import './executors/documentation';

export interface AgentExecutionRequest {
  agentType: string;
  command: string;
  projectContext: ProjectContext;
  options?: AgentExecutionOptions;
}

export interface AgentValidationResult {
  valid: boolean;
  error?: string;
  suggestions?: string[];
}

export class AgentFactory {
  static async createAgent(
    agentType: string,
    projectContext: ProjectContext
  ): Promise<BaseAgent | null> {
    return AgentRegistry.create(agentType, projectContext);
  }

  static getAvailableAgents(): string[] {
    return AgentRegistry.getAvailableAgents();
  }

  static isAgentSupported(agentType: string): boolean {
    return AgentRegistry.isSupported(agentType);
  }

  static async executeAgent(
    request: AgentExecutionRequest
  ): Promise<AgentResult> {
    const { agentType, command, projectContext, options = {} } = request;

    try {
      // Create agent instance
      const agent = await this.createAgent(agentType, projectContext);
      if (!agent) {
        return {
          success: false,
          error: `Unsupported agent type: ${agentType}`,
          executionTime: 0,
          tokensUsed: 0,
        };
      }

      // Execute command
      const result = await agent.execute(command, options);
      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during agent execution',
        executionTime: 0,
        tokensUsed: 50, // Minimal token usage for factory errors
      };
    }
  }

  static async validateCommand(
    agentType: string,
    command: string,
    projectContext: ProjectContext
  ): Promise<AgentValidationResult> {
    try {
      const agent = await this.createAgent(agentType, projectContext);
      if (!agent) {
        return {
          valid: false,
          error: `Unsupported agent type: ${agentType}`,
          suggestions: this.getAvailableAgents(),
        };
      }

      const validation = agent.validateCommand(command);

      if (!validation.valid) {
        return {
          valid: false,
          error: validation.error,
          suggestions: this.getCommandSuggestions(agent, command),
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error:
          error instanceof Error ? error.message : 'Unknown validation error',
      };
    }
  }

  static async getAgentCapabilities(
    agentType: string,
    projectContext: ProjectContext
  ): Promise<{
    capabilities: string[];
    commands: any[];
  } | null> {
    try {
      const agent = await this.createAgent(agentType, projectContext);
      if (!agent) return null;

      return {
        capabilities: agent.getCapabilities(),
        commands: agent.getSupportedCommands(),
      };
    } catch (error) {
      console.error('Error getting agent capabilities:', error);
      return null;
    }
  }

  static getAgentDescription(agentType: string): string {
    switch (agentType) {
      case 'code-analyzer':
        return 'Analyzes code quality, performs type checking, linting, security scans, and provides optimization recommendations.';
      case 'test-runner':
        return 'Executes tests, creates test suites, fixes failing tests, and provides comprehensive testing coverage.';
      case 'git-operations':
        return 'Manages version control operations including commits, branches, merges, and repository maintenance.';
      case 'documentation':
        return 'Generates and maintains project documentation including READMEs, code docs, API references, and developer guides.';
      case 'project-manager':
        return 'Orchestrates multiple agents, analyzes project health, and provides strategic development recommendations.';
      default:
        return 'Unknown agent type';
    }
  }

  private static getCommandSuggestions(
    agent: BaseAgent,
    command: string
  ): string[] {
    const supportedCommands = agent.getSupportedCommands();
    const suggestions: string[] = [];

    // Simple fuzzy matching for suggestions
    const normalizedCommand = command.toLowerCase();

    for (const cmd of supportedCommands) {
      // Check if command name or description contains similar words
      if (
        cmd.name.toLowerCase().includes(normalizedCommand) ||
        normalizedCommand.includes(cmd.name.toLowerCase()) ||
        cmd.description.toLowerCase().includes(normalizedCommand)
      ) {
        suggestions.push(`${cmd.name}: ${cmd.description}`);
      }

      // Check examples
      for (const example of cmd.examples) {
        if (
          example.toLowerCase().includes(normalizedCommand) ||
          normalizedCommand.includes(example.toLowerCase().split(' ')[0])
        ) {
          suggestions.push(`Try: "${example}"`);
        }
      }
    }

    // If no specific suggestions found, return general command examples
    if (suggestions.length === 0) {
      return supportedCommands
        .slice(0, 3)
        .map(cmd => `Try: "${cmd.examples[0]}" (${cmd.description})`);
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  static getAgentTypeFromCommand(command: string): string {
    const normalizedCommand = command.toLowerCase();

    // Command pattern matching to suggest appropriate agent type
    if (
      normalizedCommand.includes('analyze') ||
      normalizedCommand.includes('lint') ||
      normalizedCommand.includes('type check') ||
      normalizedCommand.includes('security')
    ) {
      return 'code-analyzer';
    }

    if (
      normalizedCommand.includes('create') ||
      normalizedCommand.includes('modify') ||
      normalizedCommand.includes('refactor') ||
      normalizedCommand.includes('update') ||
      normalizedCommand.includes('format')
    ) {
      return 'code-analyzer'; // Claude Code handles file operations directly
    }

    if (
      normalizedCommand.includes('test') ||
      normalizedCommand.includes('coverage') ||
      normalizedCommand.includes('spec')
    ) {
      return 'test-runner';
    }

    if (
      normalizedCommand.includes('git') ||
      normalizedCommand.includes('commit') ||
      normalizedCommand.includes('branch') ||
      normalizedCommand.includes('merge') ||
      normalizedCommand.includes('push') ||
      normalizedCommand.includes('pull')
    ) {
      return 'git-operations';
    }

    if (
      normalizedCommand.includes('document') ||
      normalizedCommand.includes('readme') ||
      normalizedCommand.includes('changelog') ||
      normalizedCommand.includes('guide')
    ) {
      return 'documentation';
    }

    if (
      normalizedCommand.includes('orchestrate') ||
      normalizedCommand.includes('manage') ||
      normalizedCommand.includes('coordinate')
    ) {
      return 'project-manager';
    }

    // Default to code analyzer for ambiguous commands
    return 'code-analyzer';
  }

  static async batchValidateCommands(
    requests: Array<{ agentType: string; command: string }>,
    projectContext: ProjectContext
  ): Promise<
    Array<{
      request: { agentType: string; command: string };
      result: AgentValidationResult;
    }>
  > {
    const results = [];

    for (const request of requests) {
      const result = await this.validateCommand(
        request.agentType,
        request.command,
        projectContext
      );
      results.push({ request, result });
    }

    return results;
  }

  static getRecommendedAgentSequence(projectContext: ProjectContext): Array<{
    agentType: string;
    command: string;
    reason: string;
    priority: number;
  }> {
    const recommendations = [];
    const hasTests = (projectContext.structure?.testFiles.length || 0) > 0;
    const hasReadme =
      projectContext.structure?.files.some(f =>
        f.path.toLowerCase().includes('readme')
      ) || false;

    // Code analysis should usually come first
    recommendations.push({
      agentType: 'code-analyzer',
      command: 'Analyze the entire project for issues and improvements',
      reason: 'Identify code quality issues and technical debt',
      priority: 9,
    });

    // Git operations for repository health
    if (projectContext.gitUrl) {
      recommendations.push({
        agentType: 'git-operations',
        command: 'Check git status and repository health',
        reason: 'Ensure repository is in good state',
        priority: 8,
      });
    }

    // Testing setup/execution based on current state
    if (!hasTests) {
      recommendations.push({
        agentType: 'test-runner',
        command: 'Set up testing framework and create basic tests',
        reason: 'No tests found - establish testing foundation',
        priority: 7,
      });
    } else {
      recommendations.push({
        agentType: 'test-runner',
        command: 'Run all tests and generate coverage report',
        reason: 'Verify current test health and coverage',
        priority: 6,
      });
    }

    // Documentation based on current state
    if (!hasReadme) {
      recommendations.push({
        agentType: 'documentation',
        command: 'Generate comprehensive README for the project',
        reason: 'No README found - create project documentation',
        priority: 5,
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }
}

export default AgentFactory;
