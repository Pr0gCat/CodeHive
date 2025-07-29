import { prisma, Cycle, Test, Query, Artifact } from '@/lib/db';
import { CyclePhase, CycleStatus, TestStatus, QueryUrgency } from '@/lib/db';

/**
 * Feature request interface for defining what to build
 */
export interface FeatureRequest {
  title: string;
  description?: string;
  acceptanceCriteria: string[];
  constraints?: string[];
  projectId: string;
}

/**
 * TDD cycle result after execution
 */
export interface CycleResult {
  cycle: Cycle;
  tests: Test[];
  artifacts: Artifact[];
  queries?: Query[];
  status: 'COMPLETED' | 'BLOCKED' | 'FAILED';
  nextPhase?: string;
}

/**
 * Core TDD Cycle Engine - manages the RED-GREEN-REFACTOR cycle
 */
export class TDDCycleEngine {
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  /**
   * Start a new TDD cycle for a feature
   */
  async startCycle(featureRequest: FeatureRequest): Promise<Cycle> {
    const cycle = await prisma.cycle.create({
      data: {
        projectId: this.projectId,
        title: featureRequest.title,
        description: featureRequest.description,
        phase: CyclePhase.RED,
        status: CycleStatus.ACTIVE,
        acceptanceCriteria: JSON.stringify(featureRequest.acceptanceCriteria),
        constraints: featureRequest.constraints ? JSON.stringify(featureRequest.constraints) : null,
      },
    });

    return cycle;
  }

  /**
   * Execute the current phase of a TDD cycle
   */
  async executePhase(cycleId: string): Promise<CycleResult> {
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        tests: true,
        artifacts: true,
        queries: {
          where: { status: 'PENDING' }
        }
      }
    });

    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    // Check for blocking queries first
    const blockingQueries = cycle.queries?.filter(q => q.urgency === QueryUrgency.BLOCKING) || [];
    if (blockingQueries.length > 0) {
      return {
        cycle,
        tests: cycle.tests,
        artifacts: cycle.artifacts,
        queries: blockingQueries,
        status: 'BLOCKED',
      };
    }

    switch (cycle.phase) {
      case CyclePhase.RED:
        return await this.executeRedPhase(cycle);
      case CyclePhase.GREEN:
        return await this.executeGreenPhase(cycle);
      case CyclePhase.REFACTOR:
        return await this.executeRefactorPhase(cycle);
      case CyclePhase.REVIEW:
        return await this.executeReviewPhase(cycle);
      default:
        throw new Error(`Unknown cycle phase: ${cycle.phase}`);
    }
  }

  /**
   * RED Phase: Generate failing tests from acceptance criteria
   */
  private async executeRedPhase(cycle: Cycle): Promise<CycleResult> {
    console.log(`🔴 RED Phase: Generating tests for "${cycle.title}"`);

    const criteria = JSON.parse(cycle.acceptanceCriteria) as string[];
    const tests: Test[] = [];

    // Generate tests for each acceptance criterion
    for (const criterion of criteria) {
      const test = await this.generateTest(cycle.id, criterion);
      tests.push(test);
    }

    // Update cycle to GREEN phase
    const updatedCycle = await prisma.cycle.update({
      where: { id: cycle.id },
      data: { 
        phase: CyclePhase.GREEN,
        updatedAt: new Date()
      }
    });

    return {
      cycle: updatedCycle,
      tests,
      artifacts: cycle.artifacts,
      status: 'COMPLETED',
      nextPhase: CyclePhase.GREEN,
    };
  }

  /**
   * GREEN Phase: Implement minimal code to make tests pass
   */
  private async executeGreenPhase(cycle: Cycle): Promise<CycleResult> {
    console.log(`🟢 GREEN Phase: Implementing code for "${cycle.title}"`);

    const failingTests = cycle.tests.filter(t => t.status === TestStatus.FAILING);
    const artifacts: Artifact[] = [];

    // Generate minimal implementation for each failing test
    for (const test of failingTests) {
      const artifact = await this.generateImplementation(cycle.id, test);
      artifacts.push(artifact);
    }

    // Update test statuses (simulated - in real implementation, would run tests)
    await this.updateTestStatuses(cycle.tests, TestStatus.PASSING);

    // Update cycle to REFACTOR phase
    const updatedCycle = await prisma.cycle.update({
      where: { id: cycle.id },
      data: { 
        phase: CyclePhase.REFACTOR,
        updatedAt: new Date()
      }
    });

    return {
      cycle: updatedCycle,
      tests: cycle.tests,
      artifacts: [...cycle.artifacts, ...artifacts],
      status: 'COMPLETED',
      nextPhase: CyclePhase.REFACTOR,
    };
  }

  /**
   * REFACTOR Phase: Improve code quality while keeping tests green
   */
  private async executeRefactorPhase(cycle: Cycle): Promise<CycleResult> {
    console.log(`🔵 REFACTOR Phase: Improving code quality for "${cycle.title}"`);

    const refactoredArtifacts: Artifact[] = [];

    // Refactor existing code artifacts
    const codeArtifacts = cycle.artifacts.filter(a => a.type === 'CODE');
    for (const artifact of codeArtifacts) {
      const refactored = await this.refactorCode(cycle.id, artifact);
      refactoredArtifacts.push(refactored);
    }

    // Update cycle to REVIEW phase
    const updatedCycle = await prisma.cycle.update({
      where: { id: cycle.id },
      data: { 
        phase: CyclePhase.REVIEW,
        updatedAt: new Date()
      }
    });

    return {
      cycle: updatedCycle,
      tests: cycle.tests,
      artifacts: [...cycle.artifacts, ...refactoredArtifacts],
      status: 'COMPLETED',
      nextPhase: CyclePhase.REVIEW,
    };
  }

  /**
   * REVIEW Phase: Final validation and completion
   */
  private async executeReviewPhase(cycle: Cycle): Promise<CycleResult> {
    console.log(`👁️ REVIEW Phase: Validating "${cycle.title}"`);

    // Check if all tests are passing
    const allTestsPassing = cycle.tests.every(t => t.status === TestStatus.PASSING);
    
    if (!allTestsPassing) {
      // Go back to GREEN phase if tests are failing
      const updatedCycle = await prisma.cycle.update({
        where: { id: cycle.id },
        data: { 
          phase: CyclePhase.GREEN,
          updatedAt: new Date()
        }
      });

      return {
        cycle: updatedCycle,
        tests: cycle.tests,
        artifacts: cycle.artifacts,
        status: 'FAILED',
        nextPhase: CyclePhase.GREEN,
      };
    }

    // Mark cycle as completed
    const completedCycle = await prisma.cycle.update({
      where: { id: cycle.id },
      data: { 
        status: CycleStatus.COMPLETED,
        completedAt: new Date(),
        updatedAt: new Date()
      }
    });

    return {
      cycle: completedCycle,
      tests: cycle.tests,
      artifacts: cycle.artifacts,
      status: 'COMPLETED',
    };
  }

  /**
   * Generate a test from an acceptance criterion
   */
  private async generateTest(cycleId: string, criterion: string): Promise<Test> {
    // This is a simplified version - in reality, this would use AI to generate actual test code
    const testName = `should ${criterion.toLowerCase()}`;
    const testCode = this.generateTestCode(criterion);

    return await prisma.test.create({
      data: {
        cycleId,
        name: testName,
        description: `Test for: ${criterion}`,
        code: testCode,
        status: TestStatus.FAILING,
        filePath: this.generateTestFilePath(testName),
      }
    });
  }

  /**
   * Generate implementation code for a test
   */
  private async generateImplementation(cycleId: string, test: Test): Promise<Artifact> {
    // This is a simplified version - in reality, this would use AI to generate actual implementation
    const implementationCode = this.generateImplementationCode(test);

    return await prisma.artifact.create({
      data: {
        cycleId,
        type: 'CODE',
        name: `${test.name.replace(/\s+/g, '')}.implementation`,
        path: this.generateImplementationPath(test.name),
        content: implementationCode,
        purpose: `Implementation for test: ${test.name}`,
        phase: CyclePhase.GREEN,
      }
    });
  }

  /**
   * Refactor existing code
   */
  private async refactorCode(cycleId: string, artifact: Artifact): Promise<Artifact> {
    // This is a simplified version - in reality, this would use AI to refactor code
    const refactoredCode = this.improveCodeQuality(artifact.content);

    return await prisma.artifact.create({
      data: {
        cycleId,
        type: 'CODE',
        name: `${artifact.name}.refactored`,
        path: artifact.path,
        content: refactoredCode,
        purpose: `Refactored version of: ${artifact.name}`,
        phase: CyclePhase.REFACTOR,
      }
    });
  }

  /**
   * Update test statuses (helper method)
   */
  private async updateTestStatuses(tests: Test[], status: string): Promise<void> {
    for (const test of tests) {
      await prisma.test.update({
        where: { id: test.id },
        data: { 
          status,
          lastRun: new Date()
        }
      });
    }
  }

  // Helper methods for code generation (simplified for demo)
  private generateTestCode(criterion: string): string {
    return `
describe('Feature Test', () => {
  it('${criterion.toLowerCase()}', () => {
    // Test implementation for: ${criterion}
    expect(true).toBe(false); // This should initially fail
  });
});
    `.trim();
  }

  private generateImplementationCode(test: Test): string {
    return `
// Implementation for: ${test.name}
// This is minimal code to make the test pass
export function implementation() {
  // TODO: Implement actual functionality
  return true;
}
    `.trim();
  }

  private improveCodeQuality(code: string): string {
    // Simplified refactoring - in reality, this would use AI
    return `
// Refactored and improved version
${code}
// Added proper error handling, documentation, and optimizations
    `.trim();
  }

  private generateTestFilePath(testName: string): string {
    const fileName = testName.replace(/\s+/g, '-').toLowerCase();
    return `tests/${fileName}.test.ts`;
  }

  private generateImplementationPath(testName: string): string {
    const fileName = testName.replace(/\s+/g, '-').toLowerCase();
    return `src/${fileName}.ts`;
  }
}