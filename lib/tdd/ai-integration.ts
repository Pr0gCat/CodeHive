import { AgentExecutor } from '@/lib/agents/executor';
import { ProjectContext } from '@/lib/agents/project-manager';
import { prisma, Test, Artifact, Query } from '@/lib/db';
import { QueryType, QueryUrgency } from '@/lib/db';

export interface TestGenerationRequest {
  cycleId: string;
  acceptanceCriterion: string;
  projectContext: ProjectContext;
}

export interface CodeGenerationRequest {
  cycleId: string;
  test: Test;
  projectContext: ProjectContext;
}

export interface RefactoringRequest {
  cycleId: string;
  artifact: Artifact;
  projectContext: ProjectContext;
}

export interface AIDecisionPoint {
  type: QueryType;
  title: string;
  question: string;
  context: any;
  urgency: QueryUrgency;
}

/**
 * AI Integration for TDD Cycle - connects Claude Code with TDD phases
 */
export class AITDDIntegration {
  private executor: AgentExecutor;

  constructor() {
    this.executor = new AgentExecutor();
  }

  /**
   * Generate real test code using Claude Code
   */
  async generateTestCode(request: TestGenerationRequest): Promise<{ test: Test; decision?: Query }> {
    const { cycleId, acceptanceCriterion, projectContext } = request;

    // Build AI prompt for test generation
    const prompt = this.buildTestGenerationPrompt(acceptanceCriterion, projectContext);

    try {
      // Execute with Claude Code
      const result = await this.executor.execute(prompt, {
        workingDirectory: projectContext.localPath,
        timeout: 120000, // 2 minutes
        projectId: projectContext.id,
        agentType: 'tdd-test-generator',
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate test');
      }

      // Parse generated test from result
      const generatedTest = this.parseGeneratedTest(result.output || '', acceptanceCriterion);

      // Check if AI needs architectural decision
      const decision = await this.checkForDecisionPoint(result.output || '', cycleId, 'test-generation');

      // Create test record
      const test = await prisma.test.create({
        data: {
          cycleId,
          name: generatedTest.name,
          description: `Test for: ${acceptanceCriterion}`,
          code: generatedTest.code,
          status: 'FAILING',
          filePath: generatedTest.filePath,
        },
      });

      return { test, decision };
    } catch (error) {
      console.error('Test generation failed:', error);
      
      // Check if this is a system error that should not create a query
      const errorMessage = String(error);
      const isSystemError = errorMessage.includes('Rate limit exceeded') || 
                           errorMessage.includes('token limit') ||
                           errorMessage.includes('API error') ||
                           errorMessage.includes('Network error') ||
                           errorMessage.includes('timeout');
      
      // Only create decision queries for actual AI/content issues, not system errors
      if (!isSystemError) {
        const decision = await this.createDecisionQuery(
          cycleId,
          projectContext.id,
          'TEST_GENERATION_FAILED',
          'Unable to generate test automatically',
          `Failed to generate test for criterion: "${acceptanceCriterion}". Error: ${error}`,
          { criterion: acceptanceCriterion, error: String(error) },
          'BLOCKING'
        );
      }

      throw error;
    }
  }

  /**
   * Generate implementation code to make tests pass
   */
  async generateImplementationCode(request: CodeGenerationRequest): Promise<{ artifact: Artifact; decision?: Query }> {
    const { cycleId, test, projectContext } = request;

    // Build AI prompt for implementation
    const prompt = this.buildImplementationPrompt(test, projectContext);

    try {
      const result = await this.executor.execute(prompt, {
        workingDirectory: projectContext.localPath,
        timeout: 180000, // 3 minutes
        projectId: projectContext.id,
        agentType: 'tdd-implementation',
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate implementation');
      }

      // Parse generated implementation
      const implementation = this.parseGeneratedCode(result.output || '', test.name);

      // Check for architectural decisions
      const decision = await this.checkForDecisionPoint(result.output || '', cycleId, 'implementation');

      // Create artifact record
      const artifact = await prisma.artifact.create({
        data: {
          cycleId,
          type: 'CODE',
          name: implementation.name,
          path: implementation.path,
          content: implementation.code,
          purpose: `Implementation for test: ${test.name}`,
          phase: 'GREEN',
        },
      });

      return { artifact, decision };
    } catch (error) {
      console.error('Implementation generation failed:', error);
      
      // Check if this is a system error that should not create a query
      const errorMessage = String(error);
      const isSystemError = errorMessage.includes('Rate limit exceeded') || 
                           errorMessage.includes('token limit') ||
                           errorMessage.includes('API error') ||
                           errorMessage.includes('Network error') ||
                           errorMessage.includes('timeout');
      
      // Only create decision queries for actual AI/content issues, not system errors
      if (!isSystemError) {
        const decision = await this.createDecisionQuery(
          cycleId,
          projectContext.id,
          'IMPLEMENTATION_FAILED',
          'Unable to generate implementation',
          `Failed to implement code for test: "${test.name}". Should we try a different approach?`,
          { test: test.name, error: String(error) },
          'BLOCKING'
        );
      }

      throw error;
    }
  }

  /**
   * Refactor code while maintaining test passing status
   */
  async refactorCode(request: RefactoringRequest): Promise<{ artifact: Artifact; decision?: Query }> {
    const { cycleId, artifact, projectContext } = request;

    // Build AI prompt for refactoring
    const prompt = this.buildRefactoringPrompt(artifact, projectContext);

    try {
      const result = await this.executor.execute(prompt, {
        workingDirectory: projectContext.localPath,
        timeout: 120000, // 2 minutes
        projectId: projectContext.id,
        agentType: 'tdd-refactoring',
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to refactor code');
      }

      // Parse refactored code
      const refactored = this.parseRefactoredCode(result.output || '', artifact.name);

      // Check for design decisions
      const decision = await this.checkForDecisionPoint(result.output || '', cycleId, 'refactoring');

      // Create new artifact for refactored code
      const newArtifact = await prisma.artifact.create({
        data: {
          cycleId,
          type: 'CODE',
          name: `${artifact.name}.refactored`,
          path: artifact.path,
          content: refactored.code,
          purpose: `Refactored version of: ${artifact.name}`,
          phase: 'REFACTOR',
        },
      });

      return { artifact: newArtifact, decision };
    } catch (error) {
      console.error('Refactoring failed:', error);
      
      // Check if this is a system error that should not create a query
      const errorMessage = String(error);
      const isSystemError = errorMessage.includes('Rate limit exceeded') || 
                           errorMessage.includes('token limit') ||
                           errorMessage.includes('API error') ||
                           errorMessage.includes('Network error') ||
                           errorMessage.includes('timeout');
      
      // Only create decision queries for actual AI/content issues, not system errors
      if (!isSystemError) {
        // Refactoring failures are usually non-blocking
        const decision = await this.createDecisionQuery(
          cycleId,
          projectContext.id,
          'REFACTORING_SUGGESTION',
          'Refactoring encountered issues',
          `Unable to automatically refactor ${artifact.name}. The current code works but could be improved manually.`,
          { artifact: artifact.name, error: String(error) },
          'ADVISORY'
        );
        
        // Return original artifact if refactoring fails
        return { artifact, decision };
      }

      // Return original artifact if system error
      return { artifact };
    }
  }

  /**
   * Analyze code quality and suggest improvements
   */
  async analyzeCodeQuality(cycleId: string, artifacts: Artifact[]): Promise<Query[]> {
    const queries: Query[] = [];

    for (const artifact of artifacts) {
      if (artifact.type === 'CODE') {
        // Simple code quality checks (in real implementation, use more sophisticated analysis)
        const issues = this.performCodeQualityChecks(artifact.content);
        
        if (issues.length > 0) {
          const query = await this.createDecisionQuery(
            cycleId,
            artifact.cycleId,
            'CODE_QUALITY_ISSUE',
            `Code quality concerns in ${artifact.name}`,
            `The following code quality issues were detected:\n${issues.join('\n')}`,
            { artifact: artifact.name, issues },
            'ADVISORY'
          );
          
          queries.push(query);
        }
      }
    }

    return queries;
  }

  // Helper methods

  private buildTestGenerationPrompt(criterion: string, context: ProjectContext): string {
    return `
Generate a comprehensive test for the following acceptance criterion:
"${criterion}"

Project context:
- Framework: ${context.techStack?.framework || 'Not specified'}
- Language: ${context.techStack?.language || 'TypeScript'}
- Test Framework: ${context.techStack?.testFramework || 'Jest'}

Requirements:
1. The test should initially FAIL (red phase of TDD)
2. Use appropriate testing patterns for the framework
3. Include clear test descriptions
4. Follow the project's existing test structure
5. Generate the complete test file content

Output the test code with clear markers for parsing.
    `.trim();
  }

  private buildImplementationPrompt(test: Test, context: ProjectContext): string {
    return `
Generate the MINIMAL implementation code to make this test pass:

Test code:
${test.code}

Project context:
- Framework: ${context.techStack?.framework || 'Not specified'}
- Language: ${context.techStack?.language || 'TypeScript'}

Requirements:
1. Write the minimum code necessary to make the test pass
2. Don't add extra features or optimizations
3. Follow the project's code structure
4. Use existing project patterns and utilities

Output the implementation code with clear markers for parsing.
    `.trim();
  }

  private buildRefactoringPrompt(artifact: Artifact, context: ProjectContext): string {
    return `
Refactor the following code to improve quality while maintaining functionality:

Current code:
${artifact.content}

Project context:
- Framework: ${context.techStack?.framework || 'Not specified'}
- Language: ${context.techStack?.language || 'TypeScript'}

Refactoring goals:
1. Improve code readability and maintainability
2. Apply SOLID principles where appropriate
3. Optimize performance if possible
4. Add proper error handling
5. Ensure all tests still pass

Output the refactored code with explanations of improvements made.
    `.trim();
  }

  private parseGeneratedTest(output: string, criterion: string): { name: string; code: string; filePath: string } {
    // Simple parsing - in real implementation, use more sophisticated parsing
    const name = `should ${criterion.toLowerCase().replace(/\s+/g, ' ')}`;
    const fileName = name.replace(/\s+/g, '-').toLowerCase();
    
    return {
      name,
      code: output,
      filePath: `tests/${fileName}.test.ts`,
    };
  }

  private parseGeneratedCode(output: string, testName: string): { name: string; code: string; path: string } {
    const name = testName.replace('should ', '').replace(/\s+/g, '');
    const fileName = name.toLowerCase();
    
    return {
      name,
      code: output,
      path: `src/${fileName}.ts`,
    };
  }

  private parseRefactoredCode(output: string, originalName: string): { code: string } {
    return {
      code: output,
    };
  }

  private async checkForDecisionPoint(
    aiOutput: string,
    cycleId: string,
    phase: string
  ): Promise<Query | undefined> {
    // Look for decision indicators in AI output
    const decisionIndicators = [
      'architectural decision',
      'design choice',
      'multiple approaches',
      'recommendation',
      'trade-off',
    ];

    const needsDecision = decisionIndicators.some(indicator => 
      aiOutput.toLowerCase().includes(indicator)
    );

    if (needsDecision) {
      // Extract decision context from AI output
      const decisionContext = this.extractDecisionContext(aiOutput);
      
      if (decisionContext) {
        return await this.createDecisionQuery(
          cycleId,
          cycleId, // Using cycleId as projectId for now
          'ARCHITECTURAL_DECISION',
          decisionContext.title,
          decisionContext.question,
          decisionContext.context,
          'ADVISORY'
        );
      }
    }

    return undefined;
  }

  private extractDecisionContext(output: string): AIDecisionPoint | null {
    // Simple extraction - in real implementation, use NLP or structured output
    if (output.includes('architectural decision')) {
      return {
        type: 'ARCHITECTURE' as QueryType,
        title: 'Architectural Decision Required',
        question: 'The AI identified multiple architectural approaches. Please review and choose.',
        context: { aiOutput: output },
        urgency: 'ADVISORY' as QueryUrgency,
      };
    }
    
    return null;
  }

  private async createDecisionQuery(
    cycleId: string,
    projectId: string,
    type: string,
    title: string,
    question: string,
    context: any,
    urgency: 'BLOCKING' | 'ADVISORY'
  ): Promise<Query> {
    return await prisma.query.create({
      data: {
        projectId,
        cycleId,
        type: this.mapToQueryType(type),
        title,
        question,
        context: JSON.stringify(context),
        urgency,
        priority: urgency === 'BLOCKING' ? 'HIGH' : 'MEDIUM',
        status: 'PENDING',
      },
    });
  }

  private mapToQueryType(type: string): QueryType {
    const mapping: Record<string, QueryType> = {
      'TEST_GENERATION_FAILED': 'CLARIFICATION',
      'IMPLEMENTATION_FAILED': 'BUSINESS_LOGIC',
      'REFACTORING_SUGGESTION': 'ARCHITECTURE',
      'CODE_QUALITY_ISSUE': 'ARCHITECTURE',
      'ARCHITECTURAL_DECISION': 'ARCHITECTURE',
    };
    
    return mapping[type] || 'CLARIFICATION';
  }

  private performCodeQualityChecks(code: string): string[] {
    const issues: string[] = [];
    
    // Simple checks - in real implementation, use proper static analysis
    if (code.length > 1000) {
      issues.push('File is too large, consider splitting into smaller modules');
    }
    
    if (!code.includes('try') && !code.includes('catch')) {
      issues.push('No error handling found');
    }
    
    if (code.split('\n').some(line => line.length > 120)) {
      issues.push('Some lines exceed 120 characters');
    }
    
    return issues;
  }
}