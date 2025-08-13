/**
 * Task Execution Framework
 * 
 * Provides comprehensive task creation, execution, and management capabilities
 * following ATDD (Acceptance Test-Driven Development) methodology.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateTaskData {
  title: string;
  description?: string;
  type: 'DEV' | 'TEST' | 'REVIEW' | 'DEPLOY' | 'DOCUMENT' | 'RESEARCH' | 'DESIGN';
  acceptanceCriteria?: string;
  expectedOutcome?: string;
  priority?: number; // 0=低, 1=中, 2=高, 3=緊急
  estimatedTime?: number; // minutes
  assignedAgent?: string; // Agent type to handle this task
  maxRetries?: number;
  metadata?: Record<string, any>;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  acceptanceCriteria?: string;
  expectedOutcome?: string;
  priority?: number;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'FAILED';
  estimatedTime?: number;
  actualTime?: number;
  assignedAgent?: string;
  retryCount?: number;
  validationResult?: string;
  metadata?: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
}

export interface CreateInstructionData {
  directive: string; // Specific instruction/command
  expectedOutcome: string; // What should happen
  validationCriteria?: string; // How to verify success
  sequence: number; // Execution order
  metadata?: Record<string, any>;
}

export interface TaskWithInstructions {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: number;
  estimatedTime?: number;
  actualTime?: number;
  instructions: {
    id: string;
    directive: string;
    expectedOutcome: string;
    validationCriteria?: string;
    sequence: number;
    status: string;
    output?: string;
    error?: string;
    executionTime?: number;
  }[];
  dependencies: {
    id: string;
    requiredTask: {
      id: string;
      title: string;
      status: string;
    };
  }[];
}

export interface TaskExecution {
  taskId: string;
  instruction: {
    id: string;
    directive: string;
    expectedOutcome: string;
    validationCriteria?: string;
  };
  result: {
    success: boolean;
    output?: string;
    error?: string;
    executionTime: number;
    validationPassed: boolean;
    retryCount: number;
  };
}

export interface ATDDCycle {
  phase: 'DEFINE' | 'TEST' | 'DEVELOP' | 'VALIDATE';
  taskId: string;
  expectations: string[];
  tests: {
    id: string;
    description: string;
    criteria: string;
    status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED';
  }[];
  development: {
    instructions: string[];
    progress: number; // 0-100%
  };
  validation: {
    results: string[];
    passed: boolean;
  };
}

export class TaskExecutor {

  /**
   * Create a new task within a story
   */
  async createTask(storyId: string, data: CreateTaskData) {
    try {
      // Validate story exists
      const story = await prisma.story.findUnique({
        where: { id: storyId },
        include: {
          epic: { select: { projectId: true } }
        }
      });

      if (!story) {
        throw new Error(`Story with ID ${storyId} not found`);
      }

      if (story.status === 'COMPLETED') {
        throw new Error('Cannot add tasks to completed story');
      }

      const task = await prisma.task.create({
        data: {
          storyId,
          title: data.title,
          description: data.description,
          type: data.type,
          acceptanceCriteria: data.acceptanceCriteria,
          expectedOutcome: data.expectedOutcome,
          priority: data.priority ?? 1,
          estimatedTime: data.estimatedTime,
          assignedAgent: data.assignedAgent,
          maxRetries: data.maxRetries ?? 3,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          status: 'PENDING'
        },
        include: {
          story: {
            include: {
              epic: { select: { projectId: true } }
            }
          },
          instructions: { orderBy: { sequence: 'asc' } },
          dependencies: {
            include: {
              requiredTask: { select: { id: true, title: true, status: true } }
            }
          }
        }
      });

      return task;
    } catch (error) {
      console.error('Error creating task:', error);
      throw new Error(`Failed to create task: ${(error as Error).message}`);
    }
  }

  /**
   * Add instructions to a task
   */
  async addInstructions(taskId: string, instructions: CreateInstructionData[]) {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, status: true }
      });

      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }

      if (task.status !== 'PENDING') {
        throw new Error('Cannot add instructions to task that is not pending');
      }

      const instructionRecords = await Promise.all(
        instructions.map(instruction => 
          prisma.instruction.create({
            data: {
              taskId,
              directive: instruction.directive,
              expectedOutcome: instruction.expectedOutcome,
              validationCriteria: instruction.validationCriteria,
              sequence: instruction.sequence,
              metadata: instruction.metadata ? JSON.stringify(instruction.metadata) : null,
              status: 'PENDING'
            }
          })
        )
      );

      return instructionRecords;
    } catch (error) {
      console.error('Error adding instructions:', error);
      throw new Error(`Failed to add instructions: ${(error as Error).message}`);
    }
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, data: UpdateTaskData) {
    try {
      const task = await prisma.task.update({
        where: { id: taskId },
        data: {
          ...data,
          metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
          updatedAt: new Date()
        },
        include: {
          instructions: { orderBy: { sequence: 'asc' } },
          dependencies: {
            include: {
              requiredTask: { select: { id: true, title: true, status: true } }
            }
          }
        }
      });

      return task;
    } catch (error) {
      console.error('Error updating task:', error);
      throw new Error(`Failed to update task: ${(error as Error).message}`);
    }
  }

  /**
   * Get task with full details
   */
  async getTaskById(taskId: string): Promise<TaskWithInstructions> {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          instructions: {
            select: {
              id: true,
              directive: true,
              expectedOutcome: true,
              validationCriteria: true,
              sequence: true,
              status: true,
              output: true,
              error: true,
              executionTime: true
            },
            orderBy: { sequence: 'asc' }
          },
          dependencies: {
            include: {
              requiredTask: {
                select: { id: true, title: true, status: true }
              }
            }
          },
          story: {
            select: { title: true }
          }
        }
      });

      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }

      return {
        id: task.id,
        title: task.title,
        description: task.description || undefined,
        type: task.type,
        status: task.status,
        priority: task.priority,
        estimatedTime: task.estimatedTime || undefined,
        actualTime: task.actualTime || undefined,
        instructions: task.instructions,
        dependencies: task.dependencies
      };
    } catch (error) {
      console.error('Error getting task:', error);
      throw new Error(`Failed to get task: ${(error as Error).message}`);
    }
  }

  /**
   * Start task execution
   */
  async startTask(taskId: string) {
    try {
      // Check dependencies
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          dependencies: {
            include: {
              requiredTask: { select: { status: true, title: true } }
            }
          }
        }
      });

      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }

      // Verify all dependencies are completed
      const incompleteDependencies = task.dependencies.filter(
        dep => dep.requiredTask.status !== 'COMPLETED'
      );

      if (incompleteDependencies.length > 0) {
        const depTitles = incompleteDependencies.map(dep => dep.requiredTask.title).join(', ');
        throw new Error(`Cannot start task: dependencies not completed: ${depTitles}`);
      }

      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date()
        }
      });

      return updatedTask;
    } catch (error) {
      console.error('Error starting task:', error);
      throw new Error(`Failed to start task: ${(error as Error).message}`);
    }
  }

  /**
   * Execute a single instruction within a task
   */
  async executeInstruction(instructionId: string): Promise<TaskExecution> {
    const startTime = Date.now();
    
    try {
      const instruction = await prisma.instruction.findUnique({
        where: { id: instructionId },
        include: {
          task: { select: { id: true, assignedAgent: true } }
        }
      });

      if (!instruction) {
        throw new Error(`Instruction with ID ${instructionId} not found`);
      }

      if (instruction.status !== 'PENDING') {
        throw new Error('Instruction is not in pending status');
      }

      // Mark instruction as running
      await prisma.instruction.update({
        where: { id: instructionId },
        data: { 
          status: 'RUNNING',
          startedAt: new Date()
        }
      });

      // Simulate instruction execution
      // In a real implementation, this would call the appropriate agent
      const executionResult = await this.simulateInstructionExecution(instruction);
      
      const executionTime = Date.now() - startTime;

      // Update instruction with results
      await prisma.instruction.update({
        where: { id: instructionId },
        data: {
          status: executionResult.success ? 'COMPLETED' : 'FAILED',
          output: executionResult.output,
          error: executionResult.error,
          executionTime,
          completedAt: new Date(),
          retryCount: instruction.retryCount + (executionResult.success ? 0 : 1)
        }
      });

      return {
        taskId: instruction.taskId,
        instruction: {
          id: instruction.id,
          directive: instruction.directive,
          expectedOutcome: instruction.expectedOutcome,
          validationCriteria: instruction.validationCriteria || undefined
        },
        result: {
          success: executionResult.success,
          output: executionResult.output,
          error: executionResult.error,
          executionTime,
          validationPassed: executionResult.validationPassed,
          retryCount: instruction.retryCount
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Update instruction with error
      await prisma.instruction.update({
        where: { id: instructionId },
        data: {
          status: 'FAILED',
          error: (error as Error).message,
          executionTime,
          completedAt: new Date(),
          retryCount: { increment: 1 }
        }
      });

      console.error('Error executing instruction:', error);
      throw new Error(`Failed to execute instruction: ${(error as Error).message}`);
    }
  }

  /**
   * Execute all instructions in a task sequentially
   */
  async executeTask(taskId: string): Promise<TaskExecution[]> {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          instructions: {
            where: { status: 'PENDING' },
            orderBy: { sequence: 'asc' }
          }
        }
      });

      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }

      if (task.status !== 'IN_PROGRESS') {
        throw new Error('Task must be in progress to execute instructions');
      }

      const results: TaskExecution[] = [];

      for (const instruction of task.instructions) {
        try {
          const result = await this.executeInstruction(instruction.id);
          results.push(result);

          // Stop execution if instruction failed and no retries left
          if (!result.result.success && instruction.retryCount >= (task.maxRetries - 1)) {
            await prisma.task.update({
              where: { id: taskId },
              data: { status: 'FAILED' }
            });
            break;
          }
        } catch (error) {
          console.error(`Error executing instruction ${instruction.id}:`, error);
          // Continue with next instruction unless it's a blocking error
        }
      }

      // Check if all instructions completed successfully
      const allInstructions = await prisma.instruction.findMany({
        where: { taskId },
        select: { status: true }
      });

      const allCompleted = allInstructions.every(i => i.status === 'COMPLETED');
      
      if (allCompleted) {
        await prisma.task.update({
          where: { id: taskId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            actualTime: results.reduce((sum, r) => sum + r.result.executionTime, 0)
          }
        });
      }

      return results;
    } catch (error) {
      console.error('Error executing task:', error);
      throw new Error(`Failed to execute task: ${(error as Error).message}`);
    }
  }

  /**
   * Create task dependency
   */
  async createTaskDependency(
    dependentTaskId: string,
    requiredTaskId: string,
    dependencyType: 'BLOCKS' | 'RELATES_TO' = 'BLOCKS'
  ) {
    try {
      // Check for circular dependencies
      const wouldCreateCycle = await this.checkCircularTaskDependency(dependentTaskId, requiredTaskId);
      if (wouldCreateCycle) {
        throw new Error('Cannot create dependency: would create circular dependency');
      }

      const dependency = await prisma.taskDependency.create({
        data: {
          dependentTaskId,
          requiredTaskId,
          dependencyType
        },
        include: {
          dependentTask: { select: { id: true, title: true } },
          requiredTask: { select: { id: true, title: true } }
        }
      });

      return dependency;
    } catch (error) {
      console.error('Error creating task dependency:', error);
      throw new Error(`Failed to create task dependency: ${(error as Error).message}`);
    }
  }

  /**
   * Generate ATDD cycle for a task
   */
  async generateATDDCycle(taskId: string): Promise<ATDDCycle> {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          instructions: { orderBy: { sequence: 'asc' } }
        }
      });

      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }

      // DEFINE phase - extract expectations from acceptance criteria
      const expectations = task.acceptanceCriteria 
        ? task.acceptanceCriteria.split('\n').filter(line => line.trim())
        : [`Task "${task.title}" should be completed successfully`];

      // TEST phase - generate tests from expectations
      const tests = expectations.map((expectation, index) => ({
        id: `test-${index}`,
        description: `Verify: ${expectation}`,
        criteria: expectation,
        status: 'PENDING' as const
      }));

      // DEVELOP phase - use instructions as development steps
      const instructions = task.instructions.map(inst => inst.directive);
      const completedInstructions = task.instructions.filter(i => i.status === 'COMPLETED').length;
      const progress = task.instructions.length > 0 
        ? Math.round((completedInstructions / task.instructions.length) * 100)
        : 0;

      // VALIDATE phase - check if expected outcomes match
      const validation = {
        results: task.instructions
          .filter(i => i.status === 'COMPLETED')
          .map(i => i.output || 'Completed successfully'),
        passed: task.status === 'COMPLETED'
      };

      // Determine current phase based on task status
      let phase: ATDDCycle['phase'] = 'DEFINE';
      if (task.instructions.length > 0) {
        if (task.status === 'COMPLETED') {
          phase = 'VALIDATE';
        } else if (task.status === 'IN_PROGRESS') {
          phase = 'DEVELOP';
        } else {
          phase = 'TEST';
        }
      }

      return {
        phase,
        taskId: task.id,
        expectations,
        tests,
        development: {
          instructions,
          progress
        },
        validation
      };
    } catch (error) {
      console.error('Error generating ATDD cycle:', error);
      throw new Error(`Failed to generate ATDD cycle: ${(error as Error).message}`);
    }
  }

  /**
   * Get tasks by story
   */
  async getStoryTasks(
    storyId: string,
    options: {
      status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'FAILED';
      type?: 'DEV' | 'TEST' | 'REVIEW' | 'DEPLOY' | 'DOCUMENT' | 'RESEARCH' | 'DESIGN';
      includeInstructions?: boolean;
    } = {}
  ) {
    try {
      const where: any = { storyId };
      
      if (options.status) {
        where.status = options.status;
      }
      
      if (options.type) {
        where.type = options.type;
      }

      const tasks = await prisma.task.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ],
        include: {
          instructions: options.includeInstructions ? {
            orderBy: { sequence: 'asc' }
          } : false,
          dependencies: {
            include: {
              requiredTask: { select: { id: true, title: true, status: true } }
            }
          },
          _count: {
            select: { instructions: true }
          }
        }
      });

      return tasks;
    } catch (error) {
      console.error('Error getting story tasks:', error);
      throw new Error(`Failed to get story tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Delete task and all instructions
   */
  async deleteTask(taskId: string) {
    try {
      // Check if task has dependencies
      const dependencies = await prisma.taskDependency.findMany({
        where: {
          OR: [
            { dependentTaskId: taskId },
            { requiredTaskId: taskId }
          ]
        }
      });

      if (dependencies.length > 0) {
        throw new Error('Cannot delete task: has dependencies. Remove dependencies first.');
      }

      await prisma.task.delete({
        where: { id: taskId }
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting task:', error);
      throw new Error(`Failed to delete task: ${(error as Error).message}`);
    }
  }

  /**
   * Simulate instruction execution (placeholder for real agent integration)
   */
  private async simulateInstructionExecution(instruction: any): Promise<{
    success: boolean;
    output?: string;
    error?: string;
    validationPassed: boolean;
  }> {
    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));

    // Simulate 90% success rate
    const success = Math.random() > 0.1;

    if (success) {
      return {
        success: true,
        output: `Successfully executed: ${instruction.directive}. ${instruction.expectedOutcome}`,
        validationPassed: true
      };
    } else {
      return {
        success: false,
        error: `Failed to execute: ${instruction.directive}. Simulated error.`,
        validationPassed: false
      };
    }
  }

  /**
   * Check for circular task dependencies
   */
  private async checkCircularTaskDependency(taskId: string, requiredTaskId: string): Promise<boolean> {
    const visited = new Set<string>();
    const stack = [requiredTaskId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      
      if (currentId === taskId) {
        return true; // Circular dependency found
      }

      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);

      // Get dependencies of current task
      const dependencies = await prisma.taskDependency.findMany({
        where: { dependentTaskId: currentId },
        select: { requiredTaskId: true }
      });

      for (const dep of dependencies) {
        stack.push(dep.requiredTaskId);
      }
    }

    return false;
  }
}

// Export singleton instance
export const taskExecutor = new TaskExecutor();