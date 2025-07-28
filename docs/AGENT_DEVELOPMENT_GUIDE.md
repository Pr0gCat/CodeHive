# CodeHive Agent Development Guide

## Overview

This guide outlines the systematic approach for developing reliable, testable, and efficient agents in the CodeHive system. Each agent represents a specialized role in the software development lifecycle, orchestrated through Claude Code.

## Agent Development Principles

### 1. Specification-First Development

Every agent must begin with a clear specification:

```yaml
# specs/agents/tdd-developer.yaml
name: TDD Developer Agent
purpose: Implement features using Test-Driven Development
inputs:
  - task_description: string
  - project_context: ProjectContext
  - previous_outputs: AgentResult[]
outputs:
  - test_files: string[]
  - implementation_files: string[]
  - test_results: TestResult[]
  - coverage_report: CoverageReport
constraints:
  - must_write_tests_first: true
  - minimum_coverage: 80
  - max_execution_time: 300s
```

### 2. Test-Driven Agent Development (TDAD)

```typescript
// Step 1: Write agent behavior tests
describe('TDD Developer Agent', () => {
  it('should create tests before implementation', async () => {
    const result = await agent.execute(mockTask);
    const testFiles = result.artifacts.files.filter(f => f.includes('.test.'));
    const implFiles = result.artifacts.files.filter(f => !f.includes('.test.'));

    // Tests should be created first (lower timestamps)
    expect(Math.min(...testFiles.map(f => f.timestamp))).toBeLessThan(
      Math.min(...implFiles.map(f => f.timestamp))
    );
  });
});

// Step 2: Implement agent to pass tests
export class TDDDeveloperAgent extends BaseAgent {
  async execute(task: AgentTask): Promise<AgentResult> {
    // Implementation that satisfies the tests
  }
}
```

### 3. Prompt Engineering Methodology

#### Progressive Enhancement

Start simple and add complexity:

```markdown
<!-- Level 1: Basic Prompt -->

Write tests for {{feature}}, then implement it.

<!-- Level 2: Structured Prompt -->

Role: TDD Developer
Task: {{feature}}
Steps:

1. Write comprehensive tests
2. Implement code to pass tests
3. Refactor if needed

<!-- Level 3: Context-Aware Prompt -->

You are a TDD Developer Agent in the CodeHive system.

Project Context:

- Name: {{project.name}}
- Stack: {{project.techStack}}
- Directory: {{project.path}}

Previous Work:
{{previousAgent.summary}}

Task: {{task.description}}

Requirements:

1. Write tests first using {{testFramework}}
2. Achieve >80% code coverage
3. Follow project conventions in {{project.path}}/.codehive/conventions.md
4. Commit with conventional commits

Output JSON structure:
{
"testFiles": [],
"implementationFiles": [],
"testResults": {},
"coverage": {}
}
```

#### Prompt Testing Framework

```typescript
// lib/agents/prompt-tester.ts
export class PromptTester {
  async testPromptVariations(
    basePrompt: string,
    variations: PromptVariation[]
  ) {
    const results = [];

    for (const variation of variations) {
      const prompt = this.applyVariation(basePrompt, variation);
      const outputs = await this.executeMultipleTimes(prompt, 5);

      results.push({
        variation,
        successRate: this.calculateSuccessRate(outputs),
        avgTokens: this.calculateAvgTokens(outputs),
        avgTime: this.calculateAvgTime(outputs),
      });
    }

    return this.rankVariations(results);
  }
}
```

### 4. Agent Communication Protocol

```typescript
// Standardized inter-agent communication
interface AgentMessage {
  from: AgentType;
  to: AgentType;
  timestamp: Date;
  context: {
    projectId: string;
    taskId: string;
    branch: string;
  };
  payload: {
    summary: string;
    artifacts: Artifact[];
    recommendations: string[];
    blockers: string[];
  };
}

// Agent chain example
class AgentOrchestrator {
  async executeTaskChain(task: Task) {
    const context = this.createContext(task);

    // 1. Project Manager analyzes and plans
    const plan = await this.projectManager.analyze(context);

    // 2. Architect designs if needed
    if (plan.requiresArchitecture) {
      const design = await this.architect.design(context, plan);
      context.addArtifact(design);
    }

    // 3. TDD Developer implements
    const implementation = await this.tddDeveloper.implement(context);

    // 4. Code Reviewer validates
    const review = await this.codeReviewer.review(context, implementation);

    // 5. Handle review feedback
    if (review.changesRequested) {
      await this.tddDeveloper.applyFeedback(context, review);
    }

    return this.aggregateResults(context);
  }
}
```

### 5. Error Handling and Recovery

```typescript
class ResilientAgent extends BaseAgent {
  async execute(task: AgentTask): Promise<AgentResult> {
    const maxRetries = 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Attempt execution
        const result = await this.runClaudeCode(task);

        // Validate output
        if (!this.isValidOutput(result)) {
          throw new ValidationError('Invalid output structure');
        }

        return result;
      } catch (error) {
        lastError = error;

        // Analyze error and adjust approach
        if (error instanceof TokenLimitError) {
          task = this.splitTask(task);
        } else if (error instanceof TimeoutError) {
          task = this.simplifyTask(task);
        } else if (error instanceof ParseError) {
          task = this.clarifyOutputFormat(task);
        }

        await this.logRetry(attempt, error);
      }
    }

    // Final fallback
    return this.createFallbackResult(task, lastError);
  }
}
```

### 6. Performance Optimization

```typescript
// Caching frequently used contexts
class CachedAgent extends BaseAgent {
  private cache = new LRUCache<string, AgentResult>();

  async execute(task: AgentTask): Promise<AgentResult> {
    const cacheKey = this.generateCacheKey(task);

    // Check cache for similar tasks
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return this.adaptCachedResult(cached, task);
    }

    // Execute and cache
    const result = await super.execute(task);
    this.cache.set(cacheKey, result);

    return result;
  }
}

// Parallel execution for independent subtasks
class ParallelAgent extends BaseAgent {
  async execute(task: AgentTask): Promise<AgentResult> {
    const subtasks = this.decomposeTask(task);

    // Execute independent subtasks in parallel
    const results = await Promise.all(
      subtasks.map(subtask => this.executeSubtask(subtask))
    );

    return this.mergeResults(results);
  }
}
```

### 7. Monitoring and Observability

```typescript
// Agent metrics collection
interface AgentMetrics {
  executionTime: number;
  tokenUsage: {
    input: number;
    output: number;
  };
  successRate: number;
  errorRate: number;
  retryCount: number;
}

class ObservableAgent extends BaseAgent {
  async execute(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    const traceId = generateTraceId();

    try {
      // Log start
      await this.logger.info('Agent execution started', {
        traceId,
        agent: this.type,
        task: task.id,
      });

      // Execute with instrumentation
      const result = await this.instrumentedExecute(task, traceId);

      // Collect metrics
      await this.metrics.record({
        executionTime: Date.now() - startTime,
        tokenUsage: result.tokenUsage,
        success: true,
      });

      return result;
    } catch (error) {
      await this.handleError(error, traceId);
      throw error;
    }
  }
}
```

### 8. Testing Strategies

#### Unit Testing

````typescript
// Test individual agent methods
describe('Agent Unit Tests', () => {
  it('should parse output correctly', () => {
    const output = '```json\n{"files": ["test.js"]}\n```';
    const parsed = agent.parseOutput(output);
    expect(parsed).toEqual({ files: ['test.js'] });
  });
});
````

#### Integration Testing

```typescript
// Test with mock Claude Code
describe('Agent Integration Tests', () => {
  it('should handle complete workflow', async () => {
    const mockClaudeCode = createMockClaudeCode();
    const agent = new TDDDeveloperAgent(mockClaudeCode);

    const result = await agent.execute(testTask);
    expect(result.success).toBe(true);
    expect(mockClaudeCode.calls).toHaveLength(1);
  });
});
```

#### End-to-End Testing

```typescript
// Test with real Claude Code
describe('Agent E2E Tests', () => {
  it('should create working code', async () => {
    const agent = new TDDDeveloperAgent();
    const task = createRealTask('Create a fibonacci function');

    const result = await agent.execute(task);

    // Verify generated code actually works
    const testResult = await runGeneratedTests(result.artifacts);
    expect(testResult.passed).toBe(true);
  });
});
```

### 9. Continuous Improvement Process

```typescript
class LearningAgent extends BaseAgent {
  async execute(task: AgentTask): Promise<AgentResult> {
    // Execute task
    const result = await super.execute(task);

    // Collect feedback
    const feedback = await this.collectFeedback(result);

    // Store for analysis
    await this.database.saveFeedback({
      task,
      result,
      feedback,
      timestamp: new Date(),
    });

    // Periodically analyze and improve
    if (this.shouldAnalyze()) {
      await this.analyzeAndImprove();
    }

    return result;
  }

  async analyzeAndImprove() {
    const recentResults = await this.database.getRecentResults();

    // Identify patterns
    const patterns = this.identifyPatterns(recentResults);

    // Generate improved prompts
    const improvements = this.generateImprovements(patterns);

    // A/B test improvements
    await this.scheduleABTest(improvements);
  }
}
```

### 10. Best Practices Checklist

#### For Every Agent:

- [ ] Clear specification document
- [ ] Comprehensive test suite
- [ ] Error handling and retry logic
- [ ] Performance benchmarks
- [ ] Monitoring and logging
- [ ] Documentation and examples
- [ ] Version control for prompts
- [ ] Integration tests with other agents
- [ ] Fallback strategies
- [ ] Token usage optimization

#### For Production:

- [ ] Load testing completed
- [ ] Security review passed
- [ ] Rate limiting implemented
- [ ] Graceful degradation
- [ ] Rollback procedures
- [ ] Monitoring dashboards
- [ ] Runbook created
- [ ] Team training completed

## Conclusion

Successful agent development in CodeHive requires a systematic approach combining software engineering best practices with prompt engineering expertise. By following this guide, developers can create reliable, efficient, and maintainable agents that work together to automate complex software development workflows.
