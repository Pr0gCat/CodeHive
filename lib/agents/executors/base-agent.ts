import { AgentResult, AgentExecutionOptions } from '../types';
import { AgentExecutor } from '../executor';
import { ProjectContext } from '../project-manager';

export interface AgentCommand {
  name: string;
  description: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  examples: string[];
}

export abstract class BaseAgent {
  protected executor: AgentExecutor;
  protected context: ProjectContext;

  constructor(context: ProjectContext) {
    this.executor = new AgentExecutor();
    this.context = context;
  }

  abstract getAgentType(): string;
  abstract getCapabilities(): string[];
  abstract getSupportedCommands(): AgentCommand[];
  abstract validateCommand(command: string): { valid: boolean; error?: string };

  async execute(command: string, options: AgentExecutionOptions = {}): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // Validate command
      const validation = this.validateCommand(command);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Invalid command',
          executionTime: Date.now() - startTime,
          tokensUsed: 50, // Minimal token usage for validation errors
        };
      }

      // Pre-execution setup
      await this.preExecution(command);

      // Build the full prompt
      const prompt = this.buildPrompt(command);

      // Execute with Claude Code
      const result = await this.executor.execute(prompt, {
        workingDirectory: this.context.localPath,
        timeout: options.timeout || 300000, // 5 minutes default
        maxRetries: options.maxRetries || 2,
        environment: options.environment,
        projectId: this.context.id,
        agentType: this.getAgentType(),
      });

      // Post-execution processing
      if (result.success) {
        await this.postExecution(command, result);
      }

      return {
        ...result,
        artifacts: await this.generateArtifacts(command, result),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        tokensUsed: 100, // Estimated token usage for failed executions
      };
    }
  }

  protected abstract buildPrompt(command: string): string;

  protected async preExecution(command: string): Promise<void> {
    // Override in subclasses for pre-execution setup
  }

  protected async postExecution(command: string, result: AgentResult): Promise<void> {
    // Override in subclasses for post-execution cleanup
  }

  protected async generateArtifacts(command: string, result: AgentResult): Promise<Record<string, unknown>> {
    // Override in subclasses to generate specific artifacts
    return {};
  }

  protected getProjectInfo(): string {
    return `
Project: ${this.context.name}
Framework: ${this.context.framework || 'Unknown'}
Language: ${this.context.language || 'Unknown'}
Path: ${this.context.localPath}
Dependencies: ${this.context.dependencies?.length || 0} packages
Source Files: ${this.context.structure?.sourceFiles.length || 0}
Test Files: ${this.context.structure?.testFiles.length || 0}
    `.trim();
  }

  protected getCommonInstructions(): string {
    return `
IMPORTANT INSTRUCTIONS:
- Work within the project directory: ${this.context.localPath}
- Follow existing code patterns and conventions
- Provide specific file paths and line numbers in outputs
- Handle errors gracefully with informative messages
- Use appropriate tools for the detected framework: ${this.context.framework || 'generic'}
- Be concise but thorough in explanations
- Include relevant code examples when helpful

FILE OPERATION GUIDELINES:
- You can read, write, and modify files within the project directory
- Always validate file paths before operations
- Create backups of important files before making significant changes
- Use proper file permissions and handle errors gracefully
- When modifying files, explain what changes you're making and why

TECH STACK CONFIGURATION:
- Framework: ${this.context.techStack?.framework || this.context.framework || 'Not specified'}
- Language: ${this.context.techStack?.language || this.context.language || 'Not specified'}
- Package Manager: ${this.context.techStack?.packageManager || 'Not specified'}
- Test Framework: ${this.context.techStack?.testFramework || 'Not specified'}
- Lint Tool: ${this.context.techStack?.lintTool || 'Not specified'}
- Build Tool: ${this.context.techStack?.buildTool || 'Not specified'}

OUTPUT FORMAT:
- Start with a brief summary of what you're doing
- Provide detailed analysis/results in the main body
- List any files modified or created
- End with next recommended steps
- Use markdown formatting for better readability
    `.trim();
  }
}

export class AgentRegistry {
  private static agents: Map<string, new (context: ProjectContext) => BaseAgent> = new Map();

  static register(agentType: string, agentClass: new (context: ProjectContext) => BaseAgent): void {
    this.agents.set(agentType, agentClass);
  }

  static create(agentType: string, context: ProjectContext): BaseAgent | null {
    const AgentClass = this.agents.get(agentType);
    if (!AgentClass) {
      return null;
    }
    return new AgentClass(context);
  }

  static getAvailableAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  static isSupported(agentType: string): boolean {
    return this.agents.has(agentType);
  }
}