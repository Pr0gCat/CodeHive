import { prisma } from '@/lib/db';
import { AgentExecutor } from './executor';
import { updateCLAUDEMDAfterTask, updateCLAUDEMDAfterEpic } from '@/lib/claude-md/auto-update';

export interface AutonomousEpicBreakdown {
  epic: {
    id: string;
    title: string;
    description: string;
    estimatedCycles: number;
  };
  stories: Array<{
    id: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
    estimatedCycles: number;
  }>;
  tasks: Array<{
    id: string;
    storyId: string;
    title: string;
    description: string;
    type: 'FRONTEND' | 'BACKEND' | 'DATABASE' | 'API' | 'INTEGRATION';
    estimatedCycles: number;
  }>;
  dependencies: Array<{
    fromTaskId: string;
    toTaskId: string;
    type: 'SEQUENTIAL' | 'PARALLEL' | 'CONDITIONAL';
  }>;
}

export interface QueryGenerationContext {
  type: 'DESIGN_QUESTION' | 'BUSINESS_LOGIC' | 'TECHNICAL_APPROVAL' | 'INTEGRATION_CHOICE';
  question: string;
  context: string;
  proposal: string;
  alternatives: string[];
  impact: string;
  blockingWork: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class ImprovedProjectManagerAgent {
  private executor: AgentExecutor;

  constructor() {
    this.executor = new AgentExecutor();
  }

  /**
   * Autonomously break down user requirements into Epic/Story/Task hierarchy
   */
  async processUserRequest(
    message: string,
    projectId: string
  ): Promise<AutonomousEpicBreakdown> {
    console.log(`🧠 Project Manager analyzing request: "${message}"`);

    // Use Claude Code to analyze the request and create breakdown
    const analysisPrompt = `
Analyze this user request and break it down into a complete Epic/Story/Task hierarchy:

User Request: "${message}"

Please provide a structured breakdown with:

1. Epic (high-level business feature)
2. Stories (user-facing functionality within the epic)
3. Tasks (technical components for each story)
4. Dependencies (relationships between tasks)

For each level, estimate the number of TDD cycles needed (be realistic):
- Simple tasks: 1-3 cycles
- Medium tasks: 4-8 cycles  
- Complex tasks: 9-15 cycles

Format your response as JSON with this structure:
{
  "epic": {
    "title": "Epic title",
    "description": "Detailed epic description",
    "estimatedCycles": 15
  },
  "stories": [
    {
      "title": "Story title",
      "description": "Story description",
      "acceptanceCriteria": ["Criteria 1", "Criteria 2"],
      "estimatedCycles": 5
    }
  ],
  "tasks": [
    {
      "storyIndex": 0,
      "title": "Task title",
      "description": "Task description", 
      "type": "FRONTEND|BACKEND|DATABASE|API|INTEGRATION",
      "estimatedCycles": 2
    }
  ],
  "dependencies": [
    {
      "fromTaskIndex": 0,
      "toTaskIndex": 1,
      "type": "SEQUENTIAL|PARALLEL|CONDITIONAL"
    }
  ]
}
`;

    try {
      const result = await this.executor.executeCommand(analysisPrompt, {
        expectedResponse: 'JSON_BREAKDOWN',
        timeout: 120000, // 2 minutes for complex analysis
      });

      if (!result.success) {
        throw new Error(`Analysis failed: ${result.error}`);
      }

      // Parse the JSON response
      const breakdown = JSON.parse(result.output);
      
      // Create database records
      const createdBreakdown = await this.createDatabaseRecords(breakdown, projectId);
      
      // Update CLAUDE.md with the new epic
      await updateCLAUDEMDAfterEpic(
        createdBreakdown.epic.id,
        createdBreakdown.epic.title,
        createdBreakdown.epic.description,
        {
          implementationDetails: createdBreakdown.stories.map(s => s.title),
          newPatterns: ['Epic breakdown from user natural language request'],
          userDecisions: [`User requested: "${message}"`],
        }
      );

      return createdBreakdown;
    } catch (error) {
      console.error('Error in autonomous breakdown:', error);
      throw new Error(`Failed to process user request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate queries when decisions are needed
   */
  async generateQuery(
    context: QueryGenerationContext,
    projectId: string
  ): Promise<string> {
    console.log(`❓ Generating query: ${context.type}`);

    // Create query in database
    const query = await prisma.query.create({
      data: {
        projectId,
        type: context.type,
        question: context.question,
        context: context.context,
        priority: context.priority,
        status: 'PENDING',
      },
    });

    // Store the initial AI proposal
    await prisma.queryComment.create({
      data: {
        queryId: query.id,
        content: `AI Proposal: ${context.proposal}

Reasoning: ${context.impact}

Alternatives considered:
${context.alternatives.map(alt => `- ${alt}`).join('\n')}`,
        author: 'AI_AGENT',
      },
    });

    console.log(`✅ Query created: ${query.id}`);
    return query.id;
  }

  /**
   * Coordinate work execution across agents
   */
  async coordinateWorkExecution(epicId: string): Promise<void> {
    console.log(`🎼 Coordinating work execution for epic: ${epicId}`);

    // Get all tasks for the epic, ordered by dependencies
    const epic = await prisma.epic.findUnique({
      where: { id: epicId },
      include: {
        stories: {
          include: {
            tasks: {
              include: {
                cycles: true,
              },
            },
          },
        },
      },
    });

    if (!epic) {
      throw new Error(`Epic not found: ${epicId}`);
    }

    // Find the next task that can be executed (no unmet dependencies)
    const executableTasks = this.findExecutableTasks(epic);
    
    if (executableTasks.length === 0) {
      console.log('No executable tasks found - work may be blocked by queries');
      return;
    }

    // Execute the highest priority task
    const nextTask = executableTasks[0];
    await this.executeTask(nextTask.id);
  }

  /**
   * Check if queries are blocking work and manage workflow
   */
  async manageWorkflowState(projectId: string): Promise<{
    blockedWork: string[];
    activeWork: string[];
    pendingQueries: string[];
  }> {
    // Get pending queries
    const pendingQueries = await prisma.query.findMany({
      where: { 
        projectId,
        status: 'PENDING'
      },
    });

    // Get blocked cycles (waiting for query answers)
    const blockedCycles = await prisma.cycle.findMany({
      where: {
        task: {
          story: {
            epic: {
              projectId
            }
          }
        },
        status: 'BLOCKED'
      },
    });

    // Get active work
    const activeCycles = await prisma.cycle.findMany({
      where: {
        task: {
          story: {
            epic: {
              projectId
            }
          }
        },
        status: 'IN_PROGRESS'
      },
    });

    return {
      blockedWork: blockedCycles.map(c => c.id),
      activeWork: activeCycles.map(c => c.id),
      pendingQueries: pendingQueries.map(q => q.id),
    };
  }

  private async createDatabaseRecords(
    breakdown: any,
    projectId: string
  ): Promise<AutonomousEpicBreakdown> {
    // Create Epic
    const epic = await prisma.epic.create({
      data: {
        projectId,
        title: breakdown.epic.title,
        description: breakdown.epic.description,
        status: 'PLANNING',
      },
    });

    // Create Stories
    const stories = await Promise.all(
      breakdown.stories.map(async (story: any) => {
        return await prisma.story.create({
          data: {
            epicId: epic.id,
            title: story.title,
            description: story.description,
            acceptanceCriteria: story.acceptanceCriteria,
            status: 'PENDING',
          },
        });
      })
    );

    // Create Tasks
    const tasks = await Promise.all(
      breakdown.tasks.map(async (task: any) => {
        const story = stories[task.storyIndex];
        return await prisma.task.create({
          data: {
            storyId: story.id,
            title: task.title,
            description: task.description,
            type: task.type,
            status: 'PENDING',
          },
        });
      })
    );

    // Create dependency relationships (stored as metadata for now)
    const dependencies = breakdown.dependencies.map((dep: any) => ({
      fromTaskId: tasks[dep.fromTaskIndex].id,
      toTaskId: tasks[dep.toTaskIndex].id,
      type: dep.type,
    }));

    return {
      epic: {
        id: epic.id,
        title: epic.title,
        description: epic.description,
        estimatedCycles: breakdown.epic.estimatedCycles,
      },
      stories: stories.map((story, index) => ({
        id: story.id,
        title: story.title,
        description: story.description,
        acceptanceCriteria: story.acceptanceCriteria,
        estimatedCycles: breakdown.stories[index].estimatedCycles,
      })),
      tasks: tasks.map((task, index) => ({
        id: task.id,
        storyId: task.storyId,
        title: task.title,
        description: task.description,
        type: task.type as any,
        estimatedCycles: breakdown.tasks[index].estimatedCycles,
      })),
      dependencies,
    };
  }

  private findExecutableTasks(epic: any): any[] {
    // For now, return tasks that don't have cycles yet
    const executableTasks: any[] = [];
    
    for (const story of epic.stories) {
      for (const task of story.tasks) {
        if (task.cycles.length === 0 && task.status === 'PENDING') {
          executableTasks.push(task);
        }
      }
    }

    return executableTasks;
  }

  private async executeTask(taskId: string): Promise<void> {
    console.log(`🚀 Starting execution of task: ${taskId}`);
    
    // Update task status
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'IN_PROGRESS' },
    });

    // TODO: Integrate with TDD Developer Agent to create and execute cycles
    // For now, we'll create a placeholder cycle
    const cycle = await prisma.cycle.create({
      data: {
        taskId,
        title: `Implementation cycle for task ${taskId}`,
        goal: 'Implement task requirements using TDD methodology',
        phase: 'RED',
        status: 'IN_PROGRESS',
      },
    });

    console.log(`✅ Created cycle: ${cycle.id}`);
  }
}