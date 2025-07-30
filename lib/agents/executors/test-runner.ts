import { BaseAgent, AgentCommand, AgentRegistry } from './base-agent';
import { AgentResult } from '../types';

export class TestRunnerAgent extends BaseAgent {
  getAgentType(): string {
    return 'test-runner';
  }

  getCapabilities(): string[] {
    return [
      'Test execution and reporting',
      'Test creation and scaffolding',
      'Coverage analysis',
      'Performance testing',
      'Integration testing',
      'End-to-end testing',
      'Test debugging and fixing',
      'Test framework setup',
    ];
  }

  getSupportedCommands(): AgentCommand[] {
    return [
      {
        name: 'run-tests',
        description: 'Execute test suite',
        parameters: [
          {
            name: 'pattern',
            type: 'string',
            required: false,
            description: 'Test file pattern to match',
          },
          {
            name: 'coverage',
            type: 'boolean',
            required: false,
            description: 'Generate coverage report',
          },
        ],
        examples: [
          'Run all tests',
          'Run tests with coverage report',
          'Run tests matching pattern "user"',
        ],
      },
      {
        name: 'create-tests',
        description: 'Create test files for existing code',
        parameters: [
          {
            name: 'target',
            type: 'string',
            required: true,
            description: 'File or module to create tests for',
          },
        ],
        examples: [
          'Create tests for src/utils/helpers.ts',
          'Create tests for UserService component',
          'Generate test suite for API endpoints',
        ],
      },
      {
        name: 'fix-tests',
        description: 'Fix failing tests',
        examples: [
          'Fix failing unit tests',
          'Debug and fix test failures',
          'Update tests after code changes',
        ],
      },
      {
        name: 'setup-testing',
        description: 'Set up testing framework and configuration',
        examples: [
          'Set up Jest testing framework',
          'Configure testing for React components',
          'Initialize end-to-end testing setup',
        ],
      },
      {
        name: 'performance-test',
        description: 'Run performance and load tests',
        examples: [
          'Run performance benchmarks',
          'Test API endpoint performance',
          'Analyze component rendering performance',
        ],
      },
    ];
  }

  validateCommand(command: string): { valid: boolean; error?: string } {
    const normalizedCommand = command.toLowerCase().trim();

    // Check for supported command patterns
    const supportedPatterns = [
      /^run.*test/,
      /^test/,
      /^create.*test/,
      /^generate.*test/,
      /^fix.*test/,
      /^debug.*test/,
      /^setup.*test/,
      /^configure.*test/,
      /^performance.*test/,
      /^benchmark/,
      /^coverage/,
    ];

    const isSupported = supportedPatterns.some(pattern =>
      pattern.test(normalizedCommand)
    );

    if (!isSupported) {
      return {
        valid: false,
        error: `Unsupported command. Test Runner supports: running tests, creating tests, fixing tests, setup, and performance testing.`,
      };
    }

    return { valid: true };
  }

  protected buildPrompt(command: string): string {
    const projectInfo = this.getProjectInfo();
    const commonInstructions = this.getCommonInstructions();
    const testingInfo = this.getTestingEnvironmentInfo();

    let specificInstructions = '';
    const normalizedCommand = command.toLowerCase();

    if (
      normalizedCommand.includes('run') ||
      normalizedCommand.includes('execute')
    ) {
      specificInstructions = this.getRunTestsInstructions(command);
    } else if (
      normalizedCommand.includes('create') ||
      normalizedCommand.includes('generate')
    ) {
      specificInstructions = this.getCreateTestsInstructions(command);
    } else if (
      normalizedCommand.includes('fix') ||
      normalizedCommand.includes('debug')
    ) {
      specificInstructions = this.getFixTestsInstructions(command);
    } else if (
      normalizedCommand.includes('setup') ||
      normalizedCommand.includes('configure')
    ) {
      specificInstructions = this.getSetupTestingInstructions(command);
    } else if (
      normalizedCommand.includes('performance') ||
      normalizedCommand.includes('benchmark')
    ) {
      specificInstructions = this.getPerformanceTestInstructions(command);
    } else {
      specificInstructions = this.getGeneralTestInstructions(command);
    }

    return `
You are a Test Runner agent specialized in testing ${this.context.language || 'multi-language'} applications with ${this.context.framework || 'various frameworks'}.

${projectInfo}

${testingInfo}

TASK: ${command}

${specificInstructions}

TESTING PRINCIPLES:
- Write clear, descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Test both happy path and edge cases
- Mock external dependencies appropriately
- Maintain test isolation and independence
- Aim for high coverage but focus on critical paths

${commonInstructions}

Remember: Quality tests are as important as quality code. Test behavior, not implementation.
    `.trim();
  }

  private getTestingEnvironmentInfo(): string {
    const testFramework = this.detectTestFramework();
    const hasTests = (this.context.structure?.testFiles.length || 0) > 0;

    return `
TESTING ENVIRONMENT:
- Test Framework: ${testFramework}
- Existing Tests: ${hasTests ? 'Yes' : 'No'} (${this.context.structure?.testFiles.length || 0} files)
- Test Directory: ${this.getTestDirectory()}
- Framework: ${this.context.framework || 'Unknown'}
    `.trim();
  }

  private detectTestFramework(): string {
    const deps = this.context.dependencies || [];

    if (deps.includes('vitest')) return 'Vitest';
    if (deps.includes('jest')) return 'Jest';
    if (deps.includes('@testing-library/react'))
      return 'Jest + React Testing Library';
    if (deps.includes('mocha')) return 'Mocha';
    if (deps.includes('jasmine')) return 'Jasmine';
    if (deps.includes('ava')) return 'Ava';
    if (deps.includes('cypress')) return 'Cypress (E2E)';
    if (deps.includes('playwright')) return 'Playwright (E2E)';

    // Infer from framework
    if (this.context.framework === 'Next.js')
      return 'Jest + React Testing Library';
    if (this.context.framework === 'React')
      return 'Jest + React Testing Library';
    if (this.context.framework === 'Vue.js')
      return 'Vitest + Vue Testing Utils';

    return 'Unknown (will be detected/configured)';
  }

  private getTestDirectory(): string {
    // Common test directory patterns
    const testDirs = ['__tests__', 'tests', 'test', 'src/__tests__', 'spec'];

    for (const dir of testDirs) {
      const testFiles =
        this.context.structure?.testFiles.filter(
          f => f.includes(`/${dir}/`) || f.includes(`\\${dir}\\`)
        ) || [];
      if (testFiles.length > 0) return dir;
    }

    return '__tests__'; // Default
  }

  private getRunTestsInstructions(command: string): string {
    const testFramework = this.detectTestFramework();
    const testCommand = this.getTestCommand(testFramework);
    const coverageCommand = this.getCoverageCommand(testFramework);

    return `
TEST EXECUTION INSTRUCTIONS:
1. Execute the test suite using: ${testCommand}
2. Analyze test results and failures
3. Generate coverage report if requested: ${coverageCommand}
4. Provide detailed failure analysis
5. Suggest fixes for failing tests

TEST EXECUTION STEPS:
- Check test configuration files
- Run tests with appropriate flags
- Capture and analyze output
- Identify patterns in failures
- Report performance metrics

COVERAGE ANALYSIS:
- Lines covered vs uncovered
- Branch coverage analysis
- Function coverage metrics
- Critical paths without tests
- Coverage trends over time

FAILURE ANALYSIS:
- Categorize failure types (syntax, logic, dependency)
- Identify root causes
- Suggest specific fixes
- Check for flaky tests
    `;
  }

  private getCreateTestsInstructions(command: string): string {
    const testPatterns = this.getTestPatterns();

    return `
TEST CREATION INSTRUCTIONS:
1. Analyze the target code to understand functionality
2. Identify testable units and edge cases
3. Create comprehensive test suites
4. Follow project's testing conventions
5. Include setup and teardown as needed

${testPatterns}

TEST CREATION CHECKLIST:
- Test file naming follows conventions
- Import statements are correct
- Test describes behavior, not implementation
- Cover positive and negative cases
- Include boundary value testing
- Mock external dependencies properly
- Add proper assertions and expectations

TESTING STRATEGIES:
${this.getTestingStrategies()}
    `;
  }

  private getFixTestsInstructions(command: string): string {
    return `
TEST FIXING INSTRUCTIONS:
1. Run failing tests to understand the issues
2. Analyze error messages and stack traces
3. Identify the root cause of failures
4. Apply appropriate fixes
5. Verify fixes don't break other tests

COMMON TEST ISSUES:
- Outdated mocks or stubs
- Changed API interfaces
- Timing issues in async tests
- Incorrect test data or fixtures
- Missing dependencies or setup
- Environment-specific failures

DEBUGGING APPROACH:
- Isolate failing tests
- Check test dependencies and setup
- Verify mock configurations
- Review recent code changes
- Test in different environments
- Use debugging tools and logs

FIX STRATEGIES:
- Update test expectations for code changes
- Fix mock implementations
- Resolve timing issues with proper awaits
- Update test data and fixtures
- Fix environment configuration issues
    `;
  }

  private getSetupTestingInstructions(command: string): string {
    const frameworkSetup = this.getFrameworkTestingSetup();

    return `
TESTING SETUP INSTRUCTIONS:
1. Install appropriate testing framework and dependencies
2. Configure test runner and scripts
3. Set up test directory structure
4. Create basic test configuration files
5. Add example tests to verify setup

${frameworkSetup}

SETUP CHECKLIST:
- Install testing framework (Jest, Vitest, etc.)
- Configure test scripts in package.json
- Set up test directory structure
- Create configuration files (jest.config.js, etc.)
- Install testing utilities (@testing-library, etc.)
- Configure coverage reporting
- Set up CI/CD integration
- Create example tests

CONFIGURATION FILES:
- Test runner configuration
- Coverage reporting setup
- Mock configuration
- Test environment setup
- Babel/TypeScript configuration for tests
    `;
  }

  private getPerformanceTestInstructions(command: string): string {
    return `
PERFORMANCE TESTING INSTRUCTIONS:
1. Set up performance testing tools
2. Create performance benchmarks
3. Run performance tests
4. Analyze results and identify bottlenecks
5. Provide optimization recommendations

PERFORMANCE TESTING AREAS:
- Function execution time
- Memory usage patterns
- API response times
- Component rendering performance
- Bundle size impact
- Database query performance

TOOLS AND APPROACHES:
- Benchmark.js for function performance
- React DevTools Profiler for component performance
- Lighthouse for web performance
- Custom timing measurements
- Load testing for APIs
- Memory profiling tools

METRICS TO COLLECT:
- Execution time percentiles
- Memory allocation patterns
- CPU usage during tests
- Network request timing
- Rendering performance metrics
- Bundle size analysis
    `;
  }

  private getGeneralTestInstructions(command: string): string {
    return `
GENERAL TESTING INSTRUCTIONS:
Based on the specific command, determine the appropriate testing action:
1. Analyze what testing task is required
2. Plan the testing approach
3. Execute the testing task
4. Analyze and report results
5. Provide actionable recommendations

Focus on test quality, coverage, and maintainability.
    `;
  }

  private getTestCommand(framework: string): string {
    switch (framework) {
      case 'Vitest':
        return 'vitest run';
      case 'Jest':
        return 'jest';
      case 'Jest + React Testing Library':
        return 'npm test';
      case 'Mocha':
        return 'mocha';
      case 'Ava':
        return 'ava';
      case 'Cypress (E2E)':
        return 'cypress run';
      case 'Playwright (E2E)':
        return 'playwright test';
      default:
        return 'npm test';
    }
  }

  private getCoverageCommand(framework: string): string {
    switch (framework) {
      case 'Vitest':
        return 'vitest run --coverage';
      case 'Jest':
        return 'jest --coverage';
      case 'Jest + React Testing Library':
        return 'npm test -- --coverage';
      default:
        return 'npm test -- --coverage';
    }
  }

  private getTestPatterns(): string {
    const framework = this.detectTestFramework();

    if (framework.includes('React')) {
      return `
REACT COMPONENT TEST PATTERNS:
- Render testing: Does component render without crashing?
- Props testing: Does component handle different props correctly?
- Event testing: Do user interactions work as expected?
- State testing: Does component state change correctly?
- Hook testing: Do custom hooks work as expected?
      `;
    }

    if (framework.includes('Vue')) {
      return `
VUE COMPONENT TEST PATTERNS:
- Mount testing: Does component mount correctly?
- Props and emit testing: Component communication works?
- Reactive data testing: Does reactivity work as expected?
- Computed properties testing: Are computed values correct?
- Method testing: Do component methods work correctly?
      `;
    }

    return `
GENERAL TEST PATTERNS:
- Unit tests: Test individual functions and classes
- Integration tests: Test component interactions
- API tests: Test service layer functionality
- Utility tests: Test helper functions and utilities
- Error handling tests: Test error scenarios
    `;
  }

  private getTestingStrategies(): string {
    return `
- Test-Driven Development (TDD): Write tests before implementation
- Behavior-Driven Development (BDD): Focus on user behavior
- Property-Based Testing: Test with generated inputs
- Mutation Testing: Verify test quality by introducing bugs
- Visual Regression Testing: Detect UI changes
- Contract Testing: Verify API contracts
    `;
  }

  private getFrameworkTestingSetup(): string {
    switch (this.context.framework) {
      case 'Next.js':
        return `
NEXT.JS TESTING SETUP:
- Install: @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom
- Configure next.config.js for testing
- Set up jest.config.js with Next.js preset
- Configure testing for API routes
- Set up E2E testing with Cypress or Playwright
        `;
      case 'React':
        return `
REACT TESTING SETUP:
- Install: @testing-library/react @testing-library/jest-dom
- Configure Jest for React
- Set up testing utilities and custom render
- Configure mock for external dependencies
- Set up component testing patterns
        `;
      case 'Vue.js':
        return `
VUE.JS TESTING SETUP:
- Install: @vue/test-utils vitest
- Configure Vitest for Vue
- Set up Vue Testing Utils
- Configure component testing
- Set up Pinia/Vuex testing if used
        `;
      default:
        return `
GENERAL TESTING SETUP:
- Choose appropriate testing framework
- Install testing dependencies
- Configure test runner
- Set up basic test structure
- Create example tests
        `;
    }
  }

  protected async generateArtifacts(
    command: string,
    result: AgentResult
  ): Promise<Record<string, unknown>> {
    return {
      testingAction: this.determineTestingAction(command),
      testFramework: this.detectTestFramework(),
      projectLanguage: this.context.language,
      projectFramework: this.context.framework,
      existingTests: this.context.structure?.testFiles.length || 0,
      testTimestamp: new Date().toISOString(),
      commandExecuted: command,
    };
  }

  private determineTestingAction(command: string): string {
    const normalizedCommand = command.toLowerCase();

    if (
      normalizedCommand.includes('run') ||
      normalizedCommand.includes('execute')
    )
      return 'test-execution';
    if (
      normalizedCommand.includes('create') ||
      normalizedCommand.includes('generate')
    )
      return 'test-creation';
    if (
      normalizedCommand.includes('fix') ||
      normalizedCommand.includes('debug')
    )
      return 'test-fixing';
    if (
      normalizedCommand.includes('setup') ||
      normalizedCommand.includes('configure')
    )
      return 'test-setup';
    if (
      normalizedCommand.includes('performance') ||
      normalizedCommand.includes('benchmark')
    )
      return 'performance-testing';
    if (normalizedCommand.includes('coverage')) return 'coverage-analysis';

    return 'general-testing';
  }
}

// Register the agent
AgentRegistry.register('test-runner', TestRunnerAgent);
