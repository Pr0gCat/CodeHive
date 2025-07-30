import { BaseAgent, AgentCommand, AgentRegistry } from './base-agent';
import { AgentResult } from '../types';

export class CodeAnalyzerAgent extends BaseAgent {
  getAgentType(): string {
    return 'code-analyzer';
  }

  getCapabilities(): string[] {
    return [
      'Static code analysis',
      'Type checking',
      'Lint error detection',
      'Security vulnerability scanning',
      'Code quality assessment',
      'Dependency analysis',
      'Performance bottleneck identification',
      'Best practices validation',
    ];
  }

  getSupportedCommands(): AgentCommand[] {
    return [
      {
        name: 'analyze-project',
        description: 'Perform comprehensive project analysis',
        examples: [
          'Analyze the entire project for issues',
          'Run full code analysis and report findings',
        ],
      },
      {
        name: 'type-check',
        description: 'Run TypeScript type checking',
        parameters: [
          {
            name: 'fix',
            type: 'boolean',
            required: false,
            description: 'Attempt to fix type errors automatically',
          },
        ],
        examples: ['Run TypeScript type checking', 'Type check and fix errors'],
      },
      {
        name: 'lint-check',
        description: 'Run linting and code style checks',
        parameters: [
          {
            name: 'fix',
            type: 'boolean',
            required: false,
            description: 'Attempt to fix lint errors automatically',
          },
        ],
        examples: ['Run ESLint on the project', 'Lint check and fix issues'],
      },
      {
        name: 'security-scan',
        description: 'Scan for security vulnerabilities',
        examples: [
          'Scan dependencies for security issues',
          'Check code for security vulnerabilities',
        ],
      },
      {
        name: 'performance-audit',
        description: 'Analyze code for performance issues',
        examples: [
          'Analyze performance bottlenecks',
          'Review code for optimization opportunities',
        ],
      },
      {
        name: 'dependency-audit',
        description: 'Analyze project dependencies',
        examples: [
          'Check for outdated dependencies',
          'Analyze dependency tree for issues',
        ],
      },
    ];
  }

  validateCommand(command: string): { valid: boolean; error?: string } {
    const normalizedCommand = command.toLowerCase().trim();

    // Check for supported command patterns
    const supportedPatterns = [
      /^analyze/,
      /^type.?check/,
      /^lint/,
      /^security.?scan/,
      /^performance.?audit/,
      /^dependency.?audit/,
      /^fix.*type.*error/,
      /^fix.*lint.*error/,
      /^run.*typescript/,
      /^run.*eslint/,
    ];

    const isSupported = supportedPatterns.some(pattern =>
      pattern.test(normalizedCommand)
    );

    if (!isSupported) {
      return {
        valid: false,
        error: `Unsupported command. Code Analyzer supports: analysis, type checking, linting, security scanning, performance auditing, and dependency auditing.`,
      };
    }

    return { valid: true };
  }

  protected buildPrompt(command: string): string {
    const projectInfo = this.getProjectInfo();
    const commonInstructions = this.getCommonInstructions();

    let specificInstructions = '';
    const normalizedCommand = command.toLowerCase();

    if (
      normalizedCommand.includes('analyze') ||
      normalizedCommand.includes('full')
    ) {
      specificInstructions = this.getFullAnalysisInstructions();
    } else if (normalizedCommand.includes('type')) {
      specificInstructions = this.getTypeCheckInstructions(
        normalizedCommand.includes('fix')
      );
    } else if (normalizedCommand.includes('lint')) {
      specificInstructions = this.getLintInstructions(
        normalizedCommand.includes('fix')
      );
    } else if (normalizedCommand.includes('security')) {
      specificInstructions = this.getSecurityScanInstructions();
    } else if (normalizedCommand.includes('performance')) {
      specificInstructions = this.getPerformanceAuditInstructions();
    } else if (normalizedCommand.includes('dependency')) {
      specificInstructions = this.getDependencyAuditInstructions();
    } else {
      specificInstructions = this.getGeneralAnalysisInstructions();
    }

    return `
You are a Code Analyzer agent specialized in ${this.context.language || 'multi-language'} development with expertise in ${this.context.framework || 'various frameworks'}.

${projectInfo}

TASK: ${command}

${specificInstructions}

${commonInstructions}

Remember: Provide actionable insights with specific file references and concrete improvement suggestions.
    `.trim();
  }

  private getFullAnalysisInstructions(): string {
    return `
FULL PROJECT ANALYSIS:
1. Run type checking (if TypeScript project)
2. Run linting and code style checks
3. Analyze code quality and maintainability
4. Check for security vulnerabilities
5. Review performance implications
6. Assess architectural patterns
7. Identify technical debt

ANALYSIS STEPS:
${this.getAnalysisSteps()}

Provide a comprehensive report with:
- Executive summary of project health
- Critical issues requiring immediate attention
- Recommendations for improvement
- Code quality metrics and scores
    `;
  }

  private getTypeCheckInstructions(shouldFix: boolean): string {
    if (this.context.language !== 'typescript') {
      return `
This project is not using TypeScript. Instead, perform:
1. JavaScript static analysis
2. Check for common JS errors
3. Validate function signatures and usage
4. Look for undefined variables or properties
      `;
    }

    return `
TYPESCRIPT TYPE CHECKING:
1. Run: tsc --noEmit --project .
2. Analyze type errors and their locations
3. Identify the root causes of type issues
4. ${shouldFix ? 'Attempt to fix type errors by adding types, interfaces, or type assertions' : 'Provide specific solutions for each type error'}

FOCUS AREAS:
- Missing type annotations
- Incorrect type usage
- Generic type issues
- Import/export type problems
- Configuration issues in tsconfig.json
    `;
  }

  private getLintInstructions(shouldFix: boolean): string {
    const lintCommand = this.context.dependencies?.includes('eslint')
      ? 'eslint'
      : this.context.framework === 'Next.js'
        ? 'next lint'
        : 'eslint';

    return `
LINTING AND CODE STYLE:
1. Run: ${lintCommand} ${shouldFix ? '--fix' : ''} .
2. Analyze linting errors and warnings
3. Check code formatting consistency
4. Review ESLint configuration

FOCUS AREAS:
- Code style violations
- Potential bugs and anti-patterns
- Unused variables and imports
- Accessibility issues (if applicable)
- React hooks usage (if React project)
${shouldFix ? '- Apply automatic fixes where safe' : '- Provide manual fix suggestions'}
    `;
  }

  private getSecurityScanInstructions(): string {
    return `
SECURITY VULNERABILITY SCAN:
1. Check package.json for known vulnerable dependencies
2. Analyze code for security anti-patterns
3. Review authentication and authorization logic
4. Check for exposed secrets or sensitive data
5. Validate input sanitization

SECURITY CHECKS:
- SQL injection vulnerabilities
- XSS (Cross-Site Scripting) risks
- CSRF protection
- Insecure dependencies
- Hardcoded secrets or API keys
- File system access security
- Environment variable exposure
    `;
  }

  private getPerformanceAuditInstructions(): string {
    const frameworkSpecificChecks = this.getFrameworkPerformanceChecks();

    return `
PERFORMANCE ANALYSIS:
1. Identify performance bottlenecks
2. Analyze bundle size and optimization
3. Review database queries and API calls
4. Check for memory leaks and inefficient algorithms

${frameworkSpecificChecks}

PERFORMANCE AREAS:
- Large bundle sizes
- Inefficient re-renders
- Blocking operations
- Unoptimized images or assets
- Inefficient data structures
- Missing caching strategies
    `;
  }

  private getDependencyAuditInstructions(): string {
    return `
DEPENDENCY ANALYSIS:
1. Check for outdated packages
2. Identify unused dependencies
3. Analyze dependency tree for conflicts
4. Review license compatibility
5. Check for security vulnerabilities in dependencies

DEPENDENCY CHECKS:
- Run: npm audit (or equivalent)
- Check for major version updates available
- Identify circular dependencies
- Review bundle impact of large dependencies
- Suggest lighter alternatives where appropriate
    `;
  }

  private getGeneralAnalysisInstructions(): string {
    return `
GENERAL CODE ANALYSIS:
Based on the command, focus on the most relevant aspects:
1. Code quality and maintainability
2. Adherence to best practices
3. Potential bugs and issues
4. Architecture and design patterns
5. Documentation quality

Provide specific, actionable feedback with file references.
    `;
  }

  private getAnalysisSteps(): string {
    const steps = ['1. Run type checking (if applicable)'];

    if (
      this.context.dependencies?.includes('eslint') ||
      this.context.framework === 'Next.js'
    ) {
      steps.push('2. Run ESLint analysis');
    }

    if (this.context.dependencies?.includes('prettier')) {
      steps.push('3. Check code formatting');
    }

    steps.push(
      '4. Analyze project structure and organization',
      '5. Review code complexity and maintainability',
      '6. Check for security vulnerabilities',
      '7. Assess performance implications'
    );

    return steps.join('\n');
  }

  private getFrameworkPerformanceChecks(): string {
    switch (this.context.framework) {
      case 'Next.js':
        return `
NEXT.JS SPECIFIC CHECKS:
- Image optimization usage
- Bundle analyzer results
- Static generation vs SSR usage
- API route performance
- Client-side bundle size
        `;
      case 'React':
        return `
REACT SPECIFIC CHECKS:
- Component re-render optimization
- useMemo and useCallback usage
- Context provider optimization
- Virtual DOM performance
- Component bundle splitting
        `;
      case 'Vue.js':
        return `
VUE.JS SPECIFIC CHECKS:
- Reactive data optimization
- Component caching
- Computed property efficiency
- Event handler optimization
- Bundle size analysis
        `;
      default:
        return 'GENERAL FRAMEWORK CHECKS:\n- Bundle optimization\n- Asset loading\n- Runtime performance';
    }
  }

  protected async generateArtifacts(
    command: string,
    result: AgentResult
  ): Promise<Record<string, unknown>> {
    return {
      analysisType: this.determineAnalysisType(command),
      projectLanguage: this.context.language,
      projectFramework: this.context.framework,
      analysisTimestamp: new Date().toISOString(),
      commandExecuted: command,
    };
  }

  private determineAnalysisType(command: string): string {
    const normalizedCommand = command.toLowerCase();

    if (normalizedCommand.includes('type')) return 'type-checking';
    if (normalizedCommand.includes('lint')) return 'linting';
    if (normalizedCommand.includes('security')) return 'security-scan';
    if (normalizedCommand.includes('performance')) return 'performance-audit';
    if (normalizedCommand.includes('dependency')) return 'dependency-audit';
    if (
      normalizedCommand.includes('analyze') ||
      normalizedCommand.includes('full')
    )
      return 'full-analysis';

    return 'general-analysis';
  }
}

// Register the agent
AgentRegistry.register('code-analyzer', CodeAnalyzerAgent);
