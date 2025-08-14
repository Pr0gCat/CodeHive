/**
 * ATDD (Acceptance Test-Driven Development) Cycle Implementation
 * 
 * Provides a complete ATDD cycle for task execution, following the pattern:
 * 1. DEFINE: Define expectations and acceptance criteria
 * 2. TEST: Create tests/validation criteria  
 * 3. DEVELOP: Execute development instructions
 * 4. VALIDATE: Verify results against acceptance criteria
 */

import { PrismaClient } from '@prisma/client';
import { taskExecutor, TaskExecution } from './task-executor';
import { realtimeService } from './realtime-service';

const prisma = new PrismaClient();

export interface ATDDPhase {
  name: 'DEFINE' | 'TEST' | 'DEVELOP' | 'VALIDATE';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  startedAt?: Date;
  completedAt?: Date;
  artifacts: string[]; // Generated artifacts (tests, code, docs)
  validationResults?: ValidationResult[];
}

export interface ValidationResult {
  criterion: string;
  expected: string;
  actual?: string;
  passed: boolean;
  error?: string;
}

export interface ATDDCycleData {
  taskId: string;
  title: string;
  acceptanceCriteria: string[];
  currentPhase: ATDDPhase['name'];
  phases: ATDDPhase[];
  overallStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  cycleMetrics: {
    totalTime: number; // milliseconds
    phaseBreakdown: Record<string, number>;
    iterationCount: number;
    validationPasses: number;
    validationFailures: number;
  };
}

export interface ATDDExecution {
  cycleId: string;
  taskId: string;
  phase: ATDDPhase['name'];
  result: {
    success: boolean;
    artifacts: string[];
    validationResults: ValidationResult[];
    nextPhase?: ATDDPhase['name'];
    shouldRetry?: boolean;
  };
}

export class ATDDCycleManager {

  /**
   * Start ATDD cycle for a task
   */
  async startATDDCycle(taskId: string): Promise<ATDDCycleData> {
    try {
      const task = await taskExecutor.getTaskById(taskId);
      
      if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') {
        throw new Error(`Cannot start ATDD cycle: task status is ${task.status}`);
      }

      // Extract acceptance criteria
      const acceptanceCriteria = this.parseAcceptanceCriteria(
        task.acceptanceCriteria || `Task "${task.title}" should be completed successfully`
      );

      // Initialize ATDD phases
      const phases: ATDDPhase[] = [
        {
          name: 'DEFINE',
          status: 'PENDING',
          artifacts: []
        },
        {
          name: 'TEST',
          status: 'PENDING',
          artifacts: []
        },
        {
          name: 'DEVELOP',
          status: 'PENDING',
          artifacts: []
        },
        {
          name: 'VALIDATE',
          status: 'PENDING',
          artifacts: []
        }
      ];

      const cycleData: ATDDCycleData = {
        taskId,
        title: task.title,
        acceptanceCriteria,
        currentPhase: 'DEFINE',
        phases,
        overallStatus: 'PENDING',
        cycleMetrics: {
          totalTime: 0,
          phaseBreakdown: {},
          iterationCount: 1,
          validationPasses: 0,
          validationFailures: 0
        }
      };

      // Store cycle data (in practice, you might store this in database)
      await this.storeCycleData(cycleData);

      return cycleData;
    } catch (error) {
      console.error('Error starting ATDD cycle:', error);
      throw new Error(`Failed to start ATDD cycle: ${(error as Error).message}`);
    }
  }

  /**
   * Execute ATDD cycle phase
   */
  async executePhase(
    taskId: string, 
    phase: ATDDPhase['name'],
    conversationId?: string
  ): Promise<ATDDExecution> {
    const startTime = Date.now();
    
    try {
      const cycleData = await this.getCycleData(taskId);
      if (!cycleData) {
        throw new Error('ATDD cycle not found. Start cycle first.');
      }

      // Update current phase
      const currentPhaseIndex = cycleData.phases.findIndex(p => p.name === phase);
      if (currentPhaseIndex === -1) {
        throw new Error(`Invalid phase: ${phase}`);
      }

      cycleData.phases[currentPhaseIndex].status = 'IN_PROGRESS';
      cycleData.phases[currentPhaseIndex].startedAt = new Date();
      cycleData.currentPhase = phase;

      // Emit real-time updates
      if (conversationId) {
        realtimeService.emitProgress(conversationId, {
          conversationId,
          stage: 'ai_processing',
          progress: this.calculatePhaseProgress(phase),
          message: `執行 ATDD 階段: ${this.getPhaseDisplayName(phase)}`
        });
      }

      let result: ATDDExecution['result'];

      switch (phase) {
        case 'DEFINE':
          result = await this.executeDefinePhase(cycleData);
          break;
        case 'TEST':
          result = await this.executeTestPhase(cycleData);
          break;
        case 'DEVELOP':
          result = await this.executeDevelopPhase(cycleData);
          break;
        case 'VALIDATE':
          result = await this.executeValidatePhase(cycleData);
          break;
        default:
          throw new Error(`Unknown phase: ${phase}`);
      }

      const executionTime = Date.now() - startTime;

      // Update phase status
      cycleData.phases[currentPhaseIndex].status = result.success ? 'COMPLETED' : 'FAILED';
      cycleData.phases[currentPhaseIndex].completedAt = new Date();
      cycleData.phases[currentPhaseIndex].artifacts = result.artifacts;
      cycleData.phases[currentPhaseIndex].validationResults = result.validationResults;

      // Update metrics
      cycleData.cycleMetrics.phaseBreakdown[phase] = executionTime;
      cycleData.cycleMetrics.totalTime += executionTime;
      
      if (result.validationResults) {
        cycleData.cycleMetrics.validationPasses += result.validationResults.filter(v => v.passed).length;
        cycleData.cycleMetrics.validationFailures += result.validationResults.filter(v => !v.passed).length;
      }

      // Determine next phase or completion
      if (result.success && result.nextPhase) {
        cycleData.currentPhase = result.nextPhase;
      } else if (result.success && phase === 'VALIDATE') {
        cycleData.overallStatus = 'COMPLETED';
      } else if (!result.success) {
        if (result.shouldRetry) {
          cycleData.cycleMetrics.iterationCount++;
          // Stay in current phase for retry
        } else {
          cycleData.overallStatus = 'FAILED';
        }
      }

      // Store updated cycle data
      await this.storeCycleData(cycleData);

      return {
        cycleId: `atdd-${taskId}`,
        taskId,
        phase,
        result
      };

    } catch (error) {
      console.error(`Error executing ATDD phase ${phase}:`, error);
      throw new Error(`Failed to execute ATDD phase: ${(error as Error).message}`);
    }
  }

  /**
   * Execute complete ATDD cycle
   */
  async executeFullCycle(taskId: string, conversationId?: string): Promise<ATDDCycleData> {
    try {
      const cycleData = await this.startATDDCycle(taskId);
      const phases: ATDDPhase['name'][] = ['DEFINE', 'TEST', 'DEVELOP', 'VALIDATE'];

      for (const phase of phases) {
        const execution = await this.executePhase(taskId, phase, conversationId);
        
        if (!execution.result.success && !execution.result.shouldRetry) {
          break; // Stop cycle on critical failure
        }

        // Allow for retries in development phase
        if (phase === 'DEVELOP' && !execution.result.success && execution.result.shouldRetry) {
          // Retry develop phase once
          await this.executePhase(taskId, phase, conversationId);
        }
      }

      return await this.getCycleData(taskId) || cycleData;
    } catch (error) {
      console.error('Error executing full ATDD cycle:', error);
      throw new Error(`Failed to execute ATDD cycle: ${(error as Error).message}`);
    }
  }

  /**
   * DEFINE phase: Clarify expectations and acceptance criteria
   */
  private async executeDefinePhase(cycleData: ATDDCycleData): Promise<ATDDExecution['result']> {
    try {
      // Generate detailed expectations from acceptance criteria
      const expectations = cycleData.acceptanceCriteria.map(criteria => ({
        original: criteria,
        detailed: `Verify that: ${criteria}`,
        measurable: this.makeExpectationMeasurable(criteria)
      }));

      // Create definition artifacts
      const definitionDocument = {
        taskTitle: cycleData.title,
        acceptanceCriteria: cycleData.acceptanceCriteria,
        detailedExpectations: expectations,
        successCriteria: expectations.map(e => e.measurable)
      };

      const artifacts = [
        `Definition Document: ${JSON.stringify(definitionDocument, null, 2)}`
      ];

      const validationResults: ValidationResult[] = [
        {
          criterion: 'All acceptance criteria defined',
          expected: 'At least 1 acceptance criterion',
          actual: `${cycleData.acceptanceCriteria.length} criteria defined`,
          passed: cycleData.acceptanceCriteria.length > 0
        },
        {
          criterion: 'Expectations are measurable',
          expected: 'All expectations have clear success criteria',
          actual: `${expectations.length} measurable expectations created`,
          passed: expectations.length === cycleData.acceptanceCriteria.length
        }
      ];

      return {
        success: validationResults.every(v => v.passed),
        artifacts,
        validationResults,
        nextPhase: 'TEST'
      };
    } catch (error) {
      return {
        success: false,
        artifacts: [],
        validationResults: [{
          criterion: 'Define phase execution',
          expected: 'Successful completion',
          actual: `Error: ${(error as Error).message}`,
          passed: false,
          error: (error as Error).message
        }]
      };
    }
  }

  /**
   * TEST phase: Create validation tests
   */
  private async executeTestPhase(cycleData: ATDDCycleData): Promise<ATDDExecution['result']> {
    try {
      const testCases = cycleData.acceptanceCriteria.map((criteria, index) => ({
        id: `test-${index + 1}`,
        name: `Test: ${criteria}`,
        steps: this.generateTestSteps(criteria),
        expectedResult: criteria,
        priority: 'HIGH'
      }));

      const testSuite = {
        taskId: cycleData.taskId,
        title: `Test Suite: ${cycleData.title}`,
        testCases,
        executionOrder: testCases.map(t => t.id)
      };

      const artifacts = [
        `Test Suite: ${JSON.stringify(testSuite, null, 2)}`
      ];

      const validationResults: ValidationResult[] = [
        {
          criterion: 'Test cases created for all acceptance criteria',
          expected: `${cycleData.acceptanceCriteria.length} test cases`,
          actual: `${testCases.length} test cases created`,
          passed: testCases.length === cycleData.acceptanceCriteria.length
        },
        {
          criterion: 'All test cases have clear steps',
          expected: 'Each test case has at least 1 step',
          actual: `${testCases.filter(t => t.steps.length > 0).length}/${testCases.length} have steps`,
          passed: testCases.every(t => t.steps.length > 0)
        }
      ];

      return {
        success: validationResults.every(v => v.passed),
        artifacts,
        validationResults,
        nextPhase: 'DEVELOP'
      };
    } catch (error) {
      return {
        success: false,
        artifacts: [],
        validationResults: [{
          criterion: 'Test phase execution',
          expected: 'Successful completion',
          actual: `Error: ${(error as Error).message}`,
          passed: false,
          error: (error as Error).message
        }]
      };
    }
  }

  /**
   * DEVELOP phase: Execute task instructions
   */
  private async executeDevelopPhase(cycleData: ATDDCycleData): Promise<ATDDExecution['result']> {
    try {
      // Start task execution
      await taskExecutor.startTask(cycleData.taskId);
      
      // Execute all task instructions
      const executionResults = await taskExecutor.executeTask(cycleData.taskId);
      
      const successfulExecutions = executionResults.filter(r => r.result.success);
      const failedExecutions = executionResults.filter(r => !r.result.success);

      const artifacts = [
        `Execution Results: ${executionResults.length} instructions executed`,
        ...executionResults.map(r => 
          `Instruction: ${r.instruction.directive} - ${r.result.success ? 'SUCCESS' : 'FAILED'}`
        )
      ];

      const validationResults: ValidationResult[] = [
        {
          criterion: 'All instructions executed successfully',
          expected: `${executionResults.length} successful executions`,
          actual: `${successfulExecutions.length} successful, ${failedExecutions.length} failed`,
          passed: failedExecutions.length === 0
        }
      ];

      if (failedExecutions.length > 0) {
        validationResults.push({
          criterion: 'Handle execution failures',
          expected: 'No critical failures',
          actual: `${failedExecutions.length} failed executions`,
          passed: false,
          error: failedExecutions.map(f => f.result.error).join('; ')
        });
      }

      const shouldRetry = failedExecutions.length > 0 && failedExecutions.length < executionResults.length;

      return {
        success: failedExecutions.length === 0,
        artifacts,
        validationResults,
        nextPhase: failedExecutions.length === 0 ? 'VALIDATE' : undefined,
        shouldRetry
      };
    } catch (error) {
      return {
        success: false,
        artifacts: [],
        validationResults: [{
          criterion: 'Develop phase execution',
          expected: 'Successful completion',
          actual: `Error: ${(error as Error).message}`,
          passed: false,
          error: (error as Error).message
        }],
        shouldRetry: true
      };
    }
  }

  /**
   * VALIDATE phase: Verify results against acceptance criteria
   */
  private async executeValidatePhase(cycleData: ATDDCycleData): Promise<ATDDExecution['result']> {
    try {
      // Get task details with results
      const task = await taskExecutor.getTaskById(cycleData.taskId);
      
      // Validate against each acceptance criterion
      const validationResults: ValidationResult[] = [];
      
      for (let i = 0; i < cycleData.acceptanceCriteria.length; i++) {
        const criterion = cycleData.acceptanceCriteria[i];
        const validation = await this.validateCriterion(task, criterion);
        validationResults.push(validation);
      }

      // Overall validation
      const overallPassed = validationResults.every(v => v.passed);
      
      if (overallPassed) {
        validationResults.push({
          criterion: 'Overall task completion',
          expected: 'All acceptance criteria met',
          actual: `${validationResults.filter(v => v.passed).length}/${validationResults.length} criteria passed`,
          passed: true
        });
      }

      const artifacts = [
        `Validation Report: ${validationResults.length} criteria validated`,
        `Overall Result: ${overallPassed ? 'PASSED' : 'FAILED'}`,
        ...validationResults.map(v => 
          `${v.criterion}: ${v.passed ? 'PASS' : 'FAIL'} - ${v.actual}`
        )
      ];

      return {
        success: overallPassed,
        artifacts,
        validationResults,
        shouldRetry: !overallPassed && cycleData.cycleMetrics.iterationCount < 3
      };
    } catch (error) {
      return {
        success: false,
        artifacts: [],
        validationResults: [{
          criterion: 'Validate phase execution',
          expected: 'Successful completion',
          actual: `Error: ${(error as Error).message}`,
          passed: false,
          error: (error as Error).message
        }]
      };
    }
  }

  /**
   * Parse acceptance criteria into structured format
   */
  private parseAcceptanceCriteria(criteria: string): string[] {
    return criteria
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^[-*•]\s*/, '')); // Remove bullet points
  }

  /**
   * Make expectation measurable
   */
  private makeExpectationMeasurable(expectation: string): string {
    // Add specific success criteria to make expectations testable
    if (expectation.toLowerCase().includes('should')) {
      return expectation + ' (verifiable through output/behavior)';
    }
    return `Verify that: ${expectation}`;
  }

  /**
   * Generate test steps for a criterion
   */
  private generateTestSteps(criterion: string): string[] {
    return [
      `Prepare test environment for: ${criterion}`,
      `Execute test scenario`,
      `Verify expected outcome: ${criterion}`,
      `Record test results`
    ];
  }

  /**
   * Validate a criterion against task results
   */
  private async validateCriterion(task: any, criterion: string): Promise<ValidationResult> {
    try {
      // Simple validation logic - in practice, this would be more sophisticated
      const taskCompleted = task.status === 'COMPLETED';
      const hasSuccessfulInstructions = task.instructions.some((i: any) => i.status === 'COMPLETED');
      
      const passed = taskCompleted && hasSuccessfulInstructions;
      
      return {
        criterion,
        expected: 'Task completion with successful execution',
        actual: `Task status: ${task.status}, Instructions completed: ${task.instructions.filter((i: any) => i.status === 'COMPLETED').length}`,
        passed
      };
    } catch (error) {
      return {
        criterion,
        expected: 'Valid criterion validation',
        actual: `Validation error: ${(error as Error).message}`,
        passed: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Calculate phase progress percentage
   */
  private calculatePhaseProgress(phase: ATDDPhase['name']): number {
    const phaseMap = {
      'DEFINE': 25,
      'TEST': 50,
      'DEVELOP': 75,
      'VALIDATE': 100
    };
    return phaseMap[phase];
  }

  /**
   * Get display name for phase
   */
  private getPhaseDisplayName(phase: ATDDPhase['name']): string {
    const nameMap = {
      'DEFINE': '定義期望',
      'TEST': '建立測試',
      'DEVELOP': '執行開發',
      'VALIDATE': '驗證結果'
    };
    return nameMap[phase];
  }

  /**
   * Store cycle data (placeholder for database storage)
   */
  private async storeCycleData(cycleData: ATDDCycleData): Promise<void> {
    // In a real implementation, this would store to database
    // For now, we'll use in-memory storage
    const key = `atdd-cycle-${cycleData.taskId}`;
    (global as any).atddCycles = (global as any).atddCycles || new Map();
    (global as any).atddCycles.set(key, cycleData);
  }

  /**
   * Get cycle data (placeholder for database retrieval)
   */
  private async getCycleData(taskId: string): Promise<ATDDCycleData | null> {
    const key = `atdd-cycle-${taskId}`;
    (global as any).atddCycles = (global as any).atddCycles || new Map();
    return (global as any).atddCycles.get(key) || null;
  }
}

// Export singleton instance
export const atddCycleManager = new ATDDCycleManager();