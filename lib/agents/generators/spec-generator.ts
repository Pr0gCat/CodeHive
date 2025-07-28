import { AgentSpec } from '../types';
import { ProjectContext } from '../project-manager';

export class SpecificationGenerator {
  async generateCodeAnalyzer(context: ProjectContext): Promise<AgentSpec> {
    const capabilities = [
      'Static code analysis',
      'Type checking',
      'Linting and formatting',
      'Security vulnerability scanning',
      'Code quality metrics',
      'Dependency analysis',
    ];

    const dependencies = ['eslint', 'typescript', 'prettier'];
    if (context.language === 'python') {
      dependencies.push('pylint', 'black', 'mypy');
    }

    const constraints = {
      maxFileSize: 1000000, // 1MB
      timeout: 300, // 5 minutes
      excludePatterns: ['node_modules/**', 'dist/**', 'build/**'],
    };

    const prompt = this.buildPrompt('code-analyzer', context, `
You are a Code Analyzer agent specialized in ${context.language || 'multi-language'} projects.
Your primary role is to analyze code quality, detect issues, and provide improvement suggestions.

Project Context:
- Framework: ${context.framework || 'Unknown'}
- Language: ${context.language || 'Unknown'}
- Dependencies: ${context.dependencies?.length || 0} packages

Core Responsibilities:
1. Perform static code analysis
2. Check for type errors and lint issues
3. Identify security vulnerabilities
4. Assess code quality metrics
5. Recommend improvements

Always provide specific, actionable feedback with file locations and line numbers.
Focus on critical issues first, then suggestions for optimization.
`);

    return {
      name: 'code-analyzer',
      type: 'analyzer',
      purpose: 'Analyze code quality and detect issues',
      capabilities,
      dependencies,
      constraints,
      prompt,
    };
  }

  async generateFileModifier(context: ProjectContext): Promise<AgentSpec> {
    const capabilities = [
      'File creation and modification',
      'Code refactoring',
      'Template generation',
      'Configuration updates',
      'Import/export management',
      'Code formatting',
    ];

    const dependencies = ['prettier', 'typescript'];
    if (context.framework === 'React' || context.framework === 'Next.js') {
      dependencies.push('react', '@types/react');
    }

    const constraints = {
      maxFileSize: 500000, // 500KB
      timeout: 240, // 4 minutes
      backupRequired: true,
      allowedExtensions: this.getAllowedExtensions(context.language),
    };

    const prompt = this.buildPrompt('file-modifier', context, `
You are a File Modifier agent for ${context.framework || 'generic'} projects.
Your role is to safely create, modify, and refactor files while maintaining code quality.

Project Context:
- Framework: ${context.framework || 'Unknown'}
- Language: ${context.language || 'Unknown'}
- Source Files: ${context.structure?.sourceFiles.length || 0}

Core Responsibilities:
1. Create new files from templates
2. Modify existing files safely
3. Refactor code while preserving functionality
4. Update imports and dependencies
5. Apply consistent formatting

Safety Rules:
- Always create backups before major changes
- Validate syntax before saving
- Maintain existing code style and patterns
- Test critical paths after modifications
`);

    return {
      name: 'file-modifier',
      type: 'modifier',
      purpose: 'Create and modify project files safely',
      capabilities,
      dependencies,
      constraints,
      prompt,
    };
  }

  async generateTestRunner(context: ProjectContext): Promise<AgentSpec> {
    const capabilities = [
      'Test execution',
      'Test creation',
      'Coverage analysis',
      'Performance testing',
      'Integration testing',
      'Test report generation',
    ];

    const dependencies = ['jest', 'vitest', 'mocha', 'chai'];
    if (context.framework === 'React' || context.framework === 'Next.js') {
      dependencies.push('@testing-library/react', '@testing-library/jest-dom');
    }

    const hasTests = (context.structure?.testFiles.length || 0) > 0;
    const testFramework = this.detectTestFramework(context);

    const constraints = {
      timeout: 600, // 10 minutes for full test suite
      parallelExecution: true,
      coverageThreshold: 80,
    };

    const prompt = this.buildPrompt('test-runner', context, `
You are a Test Runner agent for ${context.framework || 'generic'} projects.
Your role is to execute tests, create missing tests, and ensure code quality through testing.

Project Context:
- Framework: ${context.framework || 'Unknown'}
- Test Framework: ${testFramework}
- Existing Tests: ${hasTests ? 'Yes' : 'No'} (${context.structure?.testFiles.length || 0} files)

Core Responsibilities:
1. Execute existing test suites
2. Create tests for untested code
3. Generate coverage reports
4. Identify flaky or failing tests
5. Suggest testing improvements

Testing Strategy:
${hasTests ? 
'- Run existing tests and analyze results\n- Improve test coverage for low-coverage areas' : 
'- Set up testing framework\n- Create basic test structure\n- Write unit tests for core functionality'}

Always provide clear test results with pass/fail status and coverage metrics.
`);

    return {
      name: 'test-runner',
      type: 'tester',
      purpose: 'Execute and create tests to ensure code quality',
      capabilities,
      dependencies,
      constraints,
      prompt,
    };
  }

  async generateGitOperationsAgent(context: ProjectContext): Promise<AgentSpec> {
    const capabilities = [
      'Git status and history',
      'Branch management',
      'Commit operations',
      'Merge and rebase',
      'Remote operations',
      'Conflict resolution',
    ];

    const dependencies = ['git'];

    const constraints = {
      timeout: 180, // 3 minutes
      requireCleanWorkingDirectory: false,
      autoCommitPatterns: ['package-lock.json', 'yarn.lock'],
    };

    const prompt = this.buildPrompt('git-operations', context, `
You are a Git Operations agent for the ${context.name} project.
Your role is to manage version control operations safely and efficiently.

Project Context:
- Repository: ${context.gitUrl || 'Local only'}
- Project Path: ${context.localPath}

Core Responsibilities:
1. Check repository status and health
2. Create meaningful commits
3. Manage branches safely
4. Handle merge conflicts
5. Sync with remote repositories

Git Workflow:
- Always check status before operations
- Use conventional commit messages
- Create branches for features
- Never force push to main/master
- Keep commit history clean
`);

    return {
      name: 'git-operations',
      type: 'git',
      purpose: 'Manage version control operations',
      capabilities,
      dependencies,
      constraints,
      prompt,
    };
  }

  async generateFrameworkSpecialist(context: ProjectContext): Promise<AgentSpec> {
    const framework = context.framework!;
    const capabilities = this.getFrameworkCapabilities(framework);
    const dependencies = this.getFrameworkDependencies(framework);

    const constraints = {
      timeout: 300, // 5 minutes
      frameworkVersion: 'latest',
      bestPractices: true,
    };

    const prompt = this.buildPrompt('framework-specialist', context, `
You are a ${framework} Specialist agent with deep expertise in ${framework} development.
Your role is to provide framework-specific guidance and optimizations.

Project Context:
- Framework: ${framework}
- Language: ${context.language || 'Unknown'}
- Dependencies: ${context.dependencies?.filter(d => this.isFrameworkRelated(d, framework)).length || 0} ${framework}-related packages

Core Responsibilities:
1. Optimize ${framework} configuration
2. Implement ${framework} best practices
3. Resolve ${framework}-specific issues
4. Suggest ${framework} performance improvements
5. Update ${framework} dependencies

Specialization Focus:
${this.getFrameworkSpecialization(framework)}

Always follow ${framework} conventions and latest best practices.
Provide specific examples and code snippets when making recommendations.
`);

    return {
      name: `${framework.toLowerCase()}-specialist`,
      type: 'specialist',
      purpose: `Provide ${framework}-specific expertise and optimization`,
      capabilities,
      dependencies,
      constraints,
      prompt,
    };
  }

  private buildPrompt(agentType: string, context: ProjectContext, specificInstructions: string): string {
    return `${specificInstructions}

General Guidelines:
- Work within the project directory: ${context.localPath}
- Respect existing project structure and conventions
- Provide clear, actionable feedback
- Include file paths and line numbers in references
- Log important operations and decisions
- Handle errors gracefully with informative messages

Output Format:
- Start with a brief summary of actions taken
- Include specific details and locations
- End with next recommended steps
- Use markdown formatting for readability

Remember: You are working on the "${context.name}" project. Be helpful, precise, and safe.`;
  }

  private getAllowedExtensions(language?: string): string[] {
    const baseExtensions = ['.md', '.txt', '.json', '.yml', '.yaml'];
    
    switch (language) {
      case 'typescript':
        return [...baseExtensions, '.ts', '.tsx', '.js', '.jsx'];
      case 'javascript':
        return [...baseExtensions, '.js', '.jsx'];
      case 'python':
        return [...baseExtensions, '.py', '.pyi'];
      case 'java':
        return [...baseExtensions, '.java'];
      case 'go':
        return [...baseExtensions, '.go'];
      default:
        return [...baseExtensions, '.ts', '.js', '.py', '.java', '.go'];
    }
  }

  private detectTestFramework(context: ProjectContext): string {
    const deps = context.dependencies || [];
    
    if (deps.includes('vitest')) return 'Vitest';
    if (deps.includes('jest')) return 'Jest';
    if (deps.includes('mocha')) return 'Mocha';
    if (deps.includes('jasmine')) return 'Jasmine';
    if (deps.includes('ava')) return 'Ava';
    if (deps.includes('tape')) return 'Tape';
    
    return 'Unknown (will be detected/configured)';
  }

  private getFrameworkCapabilities(framework: string): string[] {
    const baseCapabilities = ['Configuration management', 'Best practices enforcement', 'Performance optimization'];
    
    switch (framework) {
      case 'Next.js':
        return [...baseCapabilities, 'SSR/SSG optimization', 'Route management', 'API routes', 'Image optimization'];
      case 'React':
        return [...baseCapabilities, 'Component optimization', 'Hook usage', 'State management', 'Performance profiling'];
      case 'Vue.js':
        return [...baseCapabilities, 'Composition API', 'Reactive data', 'Component lifecycle', 'Vuex management'];
      case 'Angular':
        return [...baseCapabilities, 'Dependency injection', 'Component architecture', 'RxJS patterns', 'CLI optimization'];
      default:
        return baseCapabilities;
    }
  }

  private getFrameworkDependencies(framework: string): string[] {
    switch (framework) {
      case 'Next.js':
        return ['next', 'react', 'react-dom'];
      case 'React':
        return ['react', 'react-dom'];
      case 'Vue.js':
        return ['vue', 'vue-router'];
      case 'Angular':
        return ['@angular/core', '@angular/cli'];
      default:
        return [];
    }
  }

  private isFrameworkRelated(dependency: string, framework: string): boolean {
    const frameworkPrefixes: Record<string, string[]> = {
      'Next.js': ['next', 'react'],
      'React': ['react', '@react'],
      'Vue.js': ['vue', '@vue'],
      'Angular': ['@angular', 'angular'],
    };

    const prefixes = frameworkPrefixes[framework] || [];
    return prefixes.some(prefix => dependency.startsWith(prefix));
  }

  private getFrameworkSpecialization(framework: string): string {
    switch (framework) {
      case 'Next.js':
        return `- App Router vs Pages Router optimization
- Server and Client Components
- Static generation and server-side rendering
- API route patterns and middleware
- Image and font optimization`;
      case 'React':
        return `- Modern Hook patterns and custom hooks
- Component composition and reusability
- State management (Context, Redux, Zustand)
- Performance optimization (memoization, lazy loading)
- Error boundaries and suspense`;
      case 'Vue.js':
        return `- Composition API patterns
- Reactive data and computed properties
- Component communication patterns
- Vuex/Pinia state management
- Vue Router and navigation guards`;
      default:
        return `- Framework-specific best practices
- Performance optimization techniques
- Common patterns and anti-patterns
- Ecosystem integration`;
    }
  }
}