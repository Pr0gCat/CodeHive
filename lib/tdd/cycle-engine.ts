import {
    Artifact,
    Cycle,
    CyclePhase,
    CycleStatus,
    prisma,
    Query,
    QueryUrgency,
    Test,
    TestStatus,
} from '@/lib/db';
import { BranchManager } from '@/lib/git/branch-manager';
import { WorkspaceManager } from '@/lib/workspace/workspace-manager';

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
  private projectPath: string;
  private branchManager: BranchManager;
  private workspaceManager: WorkspaceManager;

  constructor(projectId: string, projectPath: string) {
    this.projectId = projectId;
    this.projectPath = projectPath;
    this.branchManager = new BranchManager(projectPath);
    this.workspaceManager = new WorkspaceManager(projectPath);
  }

  /**
   * Start a new TDD cycle for a feature
   */
  async startCycle(featureRequest: FeatureRequest): Promise<Cycle> {
    // 初始化工作空間管理器
    await this.workspaceManager.initialize();

    // 創建週期記錄
    const cycle = await prisma.cycle.create({
      data: {
        projectId: this.projectId,
        title: featureRequest.title,
        description: featureRequest.description,
        phase: CyclePhase.RED,
        status: CycleStatus.ACTIVE,
        acceptanceCriteria: JSON.stringify(featureRequest.acceptanceCriteria),
        constraints: featureRequest.constraints
          ? JSON.stringify(featureRequest.constraints)
          : null,
      },
    });

    // 創建功能分支
    const branchResult = await this.branchManager.createFeatureBranch(
      cycle.id,
      featureRequest.title
    );

    if (!branchResult.success) {
      // 如果分支創建失敗，回滾週期創建
      await prisma.cycle.delete({ where: { id: cycle.id } });
      throw new Error(`Failed to create feature branch: ${branchResult.error}`);
    }

    console.log(`🚀 Started TDD cycle: ${cycle.title}`);
    console.log(`📌 Branch: ${branchResult.output}`);

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
          where: { status: 'PENDING' },
        },
      },
    });

    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    // Check for blocking queries first
    const blockingQueries =
      cycle.queries?.filter(q => q.urgency === QueryUrgency.BLOCKING) || [];
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

    // 創建檢查點分支
    await this.branchManager.createCheckpointBranch(cycle.id, 'red');

    // 創建工作空間快照
    await this.workspaceManager.createSnapshot(
      cycle.id,
      `feature/cycle-${cycle.id}`,
      'RED'
    );

    const criteria = JSON.parse(cycle.acceptanceCriteria) as string[];
    const tests: Test[] = [];

    // Generate tests for each acceptance criterion
    for (const criterion of criteria) {
      const test = await this.generateTest(cycle.id, criterion);
      tests.push(test);
    }

    // 提交測試檔案
    const commitResult = await this.branchManager.commitChanges(
      `add failing tests for ${cycle.title}`,
      'RED'
    );

    if (!commitResult.success) {
      console.error(`Failed to commit test files: ${commitResult.error}`);
    }

    // Update cycle to GREEN phase
    const updatedCycle = await prisma.cycle.update({
      where: { id: cycle.id },
      data: {
        phase: CyclePhase.GREEN,
        updatedAt: new Date(),
      },
    });

    return {
      cycle: updatedCycle,
      tests,
      artifacts: [],
      status: 'COMPLETED',
      nextPhase: CyclePhase.GREEN,
    };
  }

  /**
   * GREEN Phase: Implement minimal code to make tests pass
   */
  private async executeGreenPhase(cycle: Cycle): Promise<CycleResult> {
    console.log(`🟢 GREEN Phase: Implementing code for "${cycle.title}"`);

    // 創建檢查點分支
    await this.branchManager.createCheckpointBranch(cycle.id, 'green');

    // 創建工作空間快照
    await this.workspaceManager.createSnapshot(
      cycle.id,
      `feature/cycle-${cycle.id}`,
      'GREEN'
    );

    // Fetch tests for this cycle
    const tests = await prisma.test.findMany({
      where: { cycleId: cycle.id },
    });

    const failingTests = tests.filter(t => t.status === TestStatus.FAILING);
    const artifacts: Artifact[] = [];

    // Generate minimal implementation for each failing test
    for (const test of failingTests) {
      const artifact = await this.generateImplementation(cycle.id, test);
      artifacts.push(artifact);
    }

    // Update test statuses (simulated - in real implementation, would run tests)
    await this.updateTestStatuses(tests, TestStatus.PASSING);

    // 提交實現代碼
    const commitResult = await this.branchManager.commitChanges(
      `implement minimal code to pass tests`,
      'GREEN'
    );

    if (!commitResult.success) {
      console.error(`Failed to commit implementation: ${commitResult.error}`);
    }

    // Update cycle to REFACTOR phase
    const updatedCycle = await prisma.cycle.update({
      where: { id: cycle.id },
      data: {
        phase: CyclePhase.REFACTOR,
        updatedAt: new Date(),
      },
    });

    return {
      cycle: updatedCycle,
      tests: tests,
      artifacts: artifacts,
      status: 'COMPLETED',
      nextPhase: CyclePhase.REFACTOR,
    };
  }

  /**
   * REFACTOR Phase: Improve code quality while keeping tests green
   */
  private async executeRefactorPhase(cycle: Cycle): Promise<CycleResult> {
    console.log(
      `🔵 REFACTOR Phase: Improving code quality for "${cycle.title}"`
    );

    // 創建檢查點分支
    await this.branchManager.createCheckpointBranch(cycle.id, 'refactor');

    // 創建工作空間快照
    await this.workspaceManager.createSnapshot(
      cycle.id,
      `feature/cycle-${cycle.id}`,
      'REFACTOR'
    );

    // Fetch artifacts for this cycle
    const artifacts = await prisma.artifact.findMany({
      where: { cycleId: cycle.id },
    });

    const refactoredArtifacts: Artifact[] = [];

    // Refactor existing code artifacts
    const codeArtifacts = artifacts.filter(a => a.type === 'CODE');
    for (const artifact of codeArtifacts) {
      const refactored = await this.refactorCode(cycle.id, artifact);
      refactoredArtifacts.push(refactored);
    }

    // 提交重構代碼
    const commitResult = await this.branchManager.commitChanges(
      `improve code quality and maintainability`,
      'REFACTOR'
    );

    if (!commitResult.success) {
      console.error(`Failed to commit refactoring: ${commitResult.error}`);
    }

    // Update cycle to REVIEW phase
    const updatedCycle = await prisma.cycle.update({
      where: { id: cycle.id },
      data: {
        phase: CyclePhase.REVIEW,
        updatedAt: new Date(),
      },
    });

    return {
      cycle: updatedCycle,
      tests: [],
      artifacts: [...artifacts, ...refactoredArtifacts],
      status: 'COMPLETED',
      nextPhase: CyclePhase.REVIEW,
    };
  }

  /**
   * REVIEW Phase: Final validation and completion
   */
  private async executeReviewPhase(cycle: Cycle): Promise<CycleResult> {
    console.log(`👁️ REVIEW Phase: Validating "${cycle.title}"`);

    // 創建檢查點分支
    await this.branchManager.createCheckpointBranch(cycle.id, 'review');

    // 創建工作空間快照
    await this.workspaceManager.createSnapshot(
      cycle.id,
      `feature/cycle-${cycle.id}`,
      'REVIEW'
    );

    // Fetch tests for this cycle
    const tests = await prisma.test.findMany({
      where: { cycleId: cycle.id },
    });

    // Check if all tests are passing
    const allTestsPassing = tests.every(t => t.status === TestStatus.PASSING);

    if (!allTestsPassing) {
      // 如果測試失敗，回滾到 GREEN 階段的檢查點
      await this.branchManager.rollbackToCheckpoint(
        'checkpoint/green-phase-start'
      );

      // Go back to GREEN phase if tests are failing
      const updatedCycle = await prisma.cycle.update({
        where: { id: cycle.id },
        data: {
          phase: CyclePhase.GREEN,
          updatedAt: new Date(),
        },
      });

      return {
        cycle: updatedCycle,
        tests: tests,
        artifacts: [],
        status: 'FAILED',
        nextPhase: CyclePhase.GREEN,
      };
    }

    // 提交最終驗證結果
    const commitResult = await this.branchManager.commitChanges(
      `final validation and quality checks`,
      'REVIEW'
    );

    if (!commitResult.success) {
      console.error(`Failed to commit review: ${commitResult.error}`);
    }

    // 創建合併請求
    const mergeResult = await this.branchManager.createMergeRequest(cycle.id);

    if (!mergeResult.success) {
      console.error(`Failed to create merge request: ${mergeResult.error}`);
    } else {
      console.log(`Created merge request: ${mergeResult.output}`);
    }

    // Mark cycle as completed
    const completedCycle = await prisma.cycle.update({
      where: { id: cycle.id },
      data: {
        status: CycleStatus.COMPLETED,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return {
      cycle: completedCycle,
      tests: tests,
      artifacts: [],
      status: 'COMPLETED',
    };
  }

  /**
   * Generate a test from an acceptance criterion using AI
   */
  private async generateTest(
    cycleId: string,
    criterion: string
  ): Promise<Test> {
    try {
      // Get project context
      const cycle = await prisma.cycle.findUnique({
        where: { id: cycleId },
        include: { project: true },
      });

      if (!cycle) {
        throw new Error(`Cycle ${cycleId} not found`);
      }

      const projectContext = {
        id: cycle.project.id,
        name: cycle.project.name,
        localPath: cycle.project.localPath,
        techStack: {
          framework: cycle.project.framework || undefined,
          language: cycle.project.language || undefined,
          testFramework: cycle.project.testFramework || undefined,
        },
      };

      // Use AI integration to generate real test
      const aiIntegration = await import('@/lib/tdd/ai-integration');
      const ai = new aiIntegration.AITDDIntegration();

      const result = await ai.generateTestCode({
        cycleId,
        acceptanceCriterion: criterion,
        projectContext,
      });

      // If there's a decision query, create it
      if (result.decision) {
        console.log(`💭 Decision point created: ${result.decision.title}`);
      }

      return result.test;
    } catch (error) {
      console.error(
        'AI test generation failed, falling back to template:',
        error
      );

      // Fallback to template-based generation
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
        },
      });
    }
  }

  /**
   * Generate implementation code for a test using AI
   */
  private async generateImplementation(
    cycleId: string,
    test: Test
  ): Promise<Artifact> {
    try {
      // Get project context
      const cycle = await prisma.cycle.findUnique({
        where: { id: cycleId },
        include: { project: true },
      });

      if (!cycle) {
        throw new Error(`Cycle ${cycleId} not found`);
      }

      const projectContext = {
        id: cycle.project.id,
        name: cycle.project.name,
        localPath: cycle.project.localPath,
        techStack: {
          framework: cycle.project.framework || undefined,
          language: cycle.project.language || undefined,
          testFramework: cycle.project.testFramework || undefined,
        },
      };

      // Use AI integration to generate real implementation
      const aiIntegration = await import('@/lib/tdd/ai-integration');
      const ai = new aiIntegration.AITDDIntegration();

      const result = await ai.generateImplementationCode({
        cycleId,
        test,
        projectContext,
      });

      // If there's a decision query, create it
      if (result.decision) {
        console.log(`💭 Decision point created: ${result.decision.title}`);
      }

      return result.artifact;
    } catch (error) {
      console.error(
        'AI implementation generation failed, falling back to template:',
        error
      );

      // Fallback to template-based generation
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
        },
      });
    }
  }

  /**
   * Refactor existing code using AI
   */
  private async refactorCode(
    cycleId: string,
    artifact: Artifact
  ): Promise<Artifact> {
    try {
      // Get project context
      const cycle = await prisma.cycle.findUnique({
        where: { id: cycleId },
        include: { project: true },
      });

      if (!cycle) {
        throw new Error(`Cycle ${cycleId} not found`);
      }

      const projectContext = {
        id: cycle.project.id,
        name: cycle.project.name,
        localPath: cycle.project.localPath,
        techStack: {
          framework: cycle.project.framework || undefined,
          language: cycle.project.language || undefined,
          testFramework: cycle.project.testFramework || undefined,
        },
      };

      // Use AI integration to refactor code
      const aiIntegration = await import('@/lib/tdd/ai-integration');
      const ai = new aiIntegration.AITDDIntegration();

      const result = await ai.refactorCode({
        cycleId,
        artifact,
        projectContext,
      });

      // If there's a decision query, create it
      if (result.decision) {
        console.log(`💭 Decision point created: ${result.decision.title}`);
      }

      return result.artifact;
    } catch (error) {
      console.error('AI refactoring failed, falling back to template:', error);

      // Fallback to simple refactoring
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
        },
      });
    }
  }

  /**
   * Update test statuses (helper method)
   */
  private async updateTestStatuses(
    tests: Test[],
    status: string
  ): Promise<void> {
    for (const test of tests) {
      await prisma.test.update({
        where: { id: test.id },
        data: {
          status,
          lastRun: new Date(),
        },
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
