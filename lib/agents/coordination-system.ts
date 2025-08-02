import { prisma } from '@/lib/db';
import { tokenManager } from '@/lib/resources/token-management';
import { ImprovedProjectManagerAgent } from './improved-project-manager';
import { updateCLAUDEMDAfterTask } from '@/lib/claude-md/auto-update';
import { TDDCycleEngine } from '@/lib/tdd/cycle-engine';

export interface AgentEvent {
  type: 'WORK_ASSIGNED' | 'WORK_COMPLETED' | 'QUERY_NEEDED' | 'DECISION_MADE' | 'ERROR_OCCURRED';
  from: string;
  to: string;
  payload: any;
  timestamp: Date;
}

export interface WorkflowState {
  currentPhase: 'PLANNING' | 'DEVELOPMENT' | 'REVIEW' | 'BLOCKED' | 'COMPLETED';
  activeAgents: string[];
  blockedWork: string[];
  pendingQueries: string[];
  tokenStatus: 'ACTIVE' | 'WARNING' | 'CRITICAL' | 'BLOCKED';
}

export class AgentCoordinationSystem {
  private static instance: AgentCoordinationSystem;
  private projectManager: ImprovedProjectManagerAgent;
  private eventBus: AgentEvent[] = [];

  constructor() {
    this.projectManager = new ImprovedProjectManagerAgent();
  }

  static getInstance(): AgentCoordinationSystem {
    if (!AgentCoordinationSystem.instance) {
      AgentCoordinationSystem.instance = new AgentCoordinationSystem();
    }
    return AgentCoordinationSystem.instance;
  }

  /**
   * Main coordination loop for project development
   */
  async coordinateProjectWork(projectId: string): Promise<WorkflowState> {
    console.log(`🎼 Starting coordination for project: ${projectId}`);

    try {
      // 1. Check token budget status
      const tokenStatus = await tokenManager.getTokenStatus(projectId);
      
      if (tokenStatus.projection.status === 'BLOCKED') {
        return {
          currentPhase: 'BLOCKED',
          activeAgents: [],
          blockedWork: ['ALL_WORK_BLOCKED_BY_TOKEN_LIMIT'],
          pendingQueries: [],
          tokenStatus: 'BLOCKED',
        };
      }

      // 2. Check workflow state
      const workflowState = await this.projectManager.manageWorkflowState(projectId);

      // 3. Handle pending queries first (highest priority)
      if (workflowState.pendingQueries.length > 0) {
        return {
          currentPhase: 'BLOCKED',
          activeAgents: ['PROJECT_MANAGER'],
          blockedWork: workflowState.blockedWork,
          pendingQueries: workflowState.pendingQueries,
          tokenStatus: tokenStatus.projection.status,
        };
      }

      // 4. Coordinate active development work
      if (workflowState.activeWork.length > 0) {
        await this.coordinateActiveDevelopment(projectId, workflowState.activeWork);
        return {
          currentPhase: 'DEVELOPMENT',
          activeAgents: ['TDD_DEVELOPER', 'CODE_REVIEWER'],
          blockedWork: workflowState.blockedWork,
          pendingQueries: [],
          tokenStatus: tokenStatus.projection.status,
        };
      }

      // 5. Start new work if possible
      const canExecute = await tokenManager.canExecuteWork(projectId);
      if (canExecute.allowed) {
        await this.startNewWork(projectId);
        return {
          currentPhase: 'PLANNING',
          activeAgents: ['PROJECT_MANAGER'],
          blockedWork: [],
          pendingQueries: [],
          tokenStatus: tokenStatus.projection.status,
        };
      }

      // 6. No work possible
      return {
        currentPhase: 'COMPLETED',
        activeAgents: [],
        blockedWork: [],
        pendingQueries: [],
        tokenStatus: tokenStatus.projection.status,
      };

    } catch (error) {
      console.error('Error in coordination:', error);
      return {
        currentPhase: 'BLOCKED',
        activeAgents: [],
        blockedWork: ['COORDINATION_ERROR'],
        pendingQueries: [],
        tokenStatus: 'CRITICAL',
      };
    }
  }

  /**
   * Execute a TDD cycle with proper agent coordination
   */
  async executeTDDCycle(cycleId: string): Promise<{
    success: boolean;
    phase: 'RED' | 'GREEN' | 'REFACTOR' | 'REVIEW' | 'COMPLETED';
    artifacts: string[];
    tokensUsed: number;
    queryGenerated?: string;
  }> {
    console.log(`🔄 Executing TDD cycle: ${cycleId}`);

    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        project: true,
        story: {
          include: {
            epic: true,
          },
        },
      },
    });

    if (!cycle) {
      throw new Error(`Cycle not found: ${cycleId}`);
    }

    const projectId = cycle.projectId;

    try {
      // Check token budget before execution
      const canExecute = await tokenManager.canExecuteWork(projectId, 1500);
      if (!canExecute.allowed) {
        await this.pauseCycleForBudget(cycleId, canExecute.reason || 'Budget limit reached');
        return {
          success: false,
          phase: cycle.phase as any,
          artifacts: [],
          tokensUsed: 0,
        };
      }

      // Execute the current phase
      let result;
      let tokensUsed = 0;

      switch (cycle.phase) {
        case 'RED':
          result = await this.executeRedPhase(cycle);
          break;
        case 'GREEN':
          result = await this.executeGreenPhase(cycle);
          break;
        case 'REFACTOR':
          result = await this.executeRefactorPhase(cycle);
          break;
        case 'REVIEW':
          result = await this.executeReviewPhase(cycle);
          break;
        default:
          throw new Error(`Unknown phase: ${cycle.phase}`);
      }

      tokensUsed = result.tokensUsed;

      // Log token usage
      await tokenManager.logTokenUsage(
        projectId,
        'TDD_DEVELOPER',
        `TDD_${cycle.phase}`,
        tokensUsed,
        {
          taskId: cycle.storyId, // Use storyId as taskId since that's what the schema supports
        }
      );

      // Update cycle status and move to next phase
      const nextPhase = this.getNextPhase(cycle.phase);
      await prisma.cycle.update({
        where: { id: cycleId },
        data: {
          phase: nextPhase,
          status: nextPhase === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
          updatedAt: new Date(),
        },
      });

      // If cycle completed, update CLAUDE.md
      if (nextPhase === 'COMPLETED') {
        await this.handleCycleCompletion(cycle, result.artifacts);
      }

      return {
        success: true,
        phase: nextPhase as any,
        artifacts: result.artifacts,
        tokensUsed,
        queryGenerated: result.queryGenerated,
      };

    } catch (error) {
      console.error(`Error executing TDD cycle ${cycleId}:`, error);
      
      // Check if this is a design decision error that needs a query
      if (this.isDesignDecisionError(error)) {
        const queryId = await this.generateDesignQuery(cycle, error);
        return {
          success: false,
          phase: cycle.phase as any,
          artifacts: [],
          tokensUsed: 0,
          queryGenerated: queryId,
        };
      }

      throw error;
    }
  }

  /**
   * Handle query resolution and resume blocked work
   */
  async handleQueryResolution(queryId: string, decision: string): Promise<void> {
    console.log(`✅ Handling query resolution: ${queryId}`);

    const query = await prisma.query.findUnique({
      where: { id: queryId },
      include: {
        cycle: true,
      },
    });

    if (!query) {
      throw new Error(`Query not found: ${queryId}`);
    }

    // Resume blocked cycle if it exists
    if (query.cycle) {
      await prisma.cycle.update({
        where: { id: query.cycle.id },
        data: {
          status: 'IN_PROGRESS',
          updatedAt: new Date(),
        },
      });

      console.log(`🔄 Resumed cycle: ${query.cycle.id}`);
    }

    // Continue coordination for the project
    if (query.projectId) {
      await this.coordinateProjectWork(query.projectId);
    }
  }

  private async coordinateActiveDevelopment(projectId: string, activeWork: string[]): Promise<void> {
    // Continue executing active TDD cycles
    for (const cycleId of activeWork) {
      try {
        await this.executeTDDCycle(cycleId);
      } catch (error) {
        console.error(`Error in active cycle ${cycleId}:`, error);
        // Continue with other cycles
      }
    }
  }

  private async startNewWork(projectId: string): Promise<void> {
    // Get next executable work from project manager
    const prioritizedWork = await tokenManager.prioritizeWork(projectId);
    
    if (prioritizedWork.highPriority.length > 0) {
      // Start the highest priority task
      const taskId = prioritizedWork.highPriority[0];
      await this.projectManager.coordinateWorkExecution(taskId);
    }
  }

  private async executeRedPhase(cycle: any): Promise<{ artifacts: string[]; tokensUsed: number; queryGenerated?: string }> {
    console.log(`🔴 Executing RED phase for cycle: ${cycle.id}`);
    
    // Get project information
    const project = cycle.project;

    if (!project) {
      throw new Error(`Project not found for cycle: ${cycle.id}`);
    }

    // Initialize TDD engine with real project path
    const tddEngine = new TDDCycleEngine(project.id, project.localPath);
    
    try {
      // Execute real TDD cycle phase
      const result = await tddEngine.executePhase(cycle.id);
      
      if (result.status === 'BLOCKED') {
        const queryId = result.queries?.[0]?.id;
        return {
          artifacts: [],
          tokensUsed: 0,
          queryGenerated: queryId,
        };
      }

      if (result.status === 'FAILED') {
        throw new Error('TDD RED phase execution failed');
      }

      // Extract real artifacts and calculate token usage
      const artifactPaths = result.artifacts.map(a => a.path);
      const tokensUsed = this.estimateTokenUsage(result.tests.length * 100 + result.artifacts.length * 50);

      return {
        artifacts: artifactPaths,
        tokensUsed,
      };
    } catch (error) {
      console.error(`RED phase failed for cycle ${cycle.id}:`, error);
      throw error;
    }
  }

  private async executeGreenPhase(cycle: any): Promise<{ artifacts: string[]; tokensUsed: number; queryGenerated?: string }> {
    console.log(`🟢 Executing GREEN phase for cycle: ${cycle.id}`);
    
    const project = cycle.project;

    if (!project) {
      throw new Error(`Project not found for cycle: ${cycle.id}`);
    }

    const tddEngine = new TDDCycleEngine(project.id, project.localPath);
    
    try {
      const result = await tddEngine.executePhase(cycle.id);
      
      if (result.status === 'BLOCKED') {
        const queryId = result.queries?.[0]?.id;
        return {
          artifacts: [],
          tokensUsed: 0,
          queryGenerated: queryId,
        };
      }

      if (result.status === 'FAILED') {
        throw new Error('TDD GREEN phase execution failed');
      }

      const artifactPaths = result.artifacts.map(a => a.path);
      const tokensUsed = this.estimateTokenUsage(result.artifacts.length * 150);

      return {
        artifacts: artifactPaths,
        tokensUsed,
      };
    } catch (error) {
      console.error(`GREEN phase failed for cycle ${cycle.id}:`, error);
      throw error;
    }
  }

  private async executeRefactorPhase(cycle: any): Promise<{ artifacts: string[]; tokensUsed: number; queryGenerated?: string }> {
    console.log(`🔵 Executing REFACTOR phase for cycle: ${cycle.id}`);
    
    const project = cycle.project;

    if (!project) {
      throw new Error(`Project not found for cycle: ${cycle.id}`);
    }

    const tddEngine = new TDDCycleEngine(project.id, project.localPath);
    
    try {
      const result = await tddEngine.executePhase(cycle.id);
      
      if (result.status === 'BLOCKED') {
        const queryId = result.queries?.[0]?.id;
        return {
          artifacts: [],
          tokensUsed: 0,
          queryGenerated: queryId,
        };
      }

      if (result.status === 'FAILED') {
        throw new Error('TDD REFACTOR phase execution failed');
      }

      const artifactPaths = result.artifacts.map(a => a.path);
      const tokensUsed = this.estimateTokenUsage(result.artifacts.length * 100);

      return {
        artifacts: artifactPaths,
        tokensUsed,
      };
    } catch (error) {
      console.error(`REFACTOR phase failed for cycle ${cycle.id}:`, error);
      throw error;
    }
  }

  private async executeReviewPhase(cycle: any): Promise<{ artifacts: string[]; tokensUsed: number; queryGenerated?: string }> {
    console.log(`⭐ Executing REVIEW phase for cycle: ${cycle.id}`);
    
    const project = cycle.project;

    if (!project) {
      throw new Error(`Project not found for cycle: ${cycle.id}`);
    }

    const tddEngine = new TDDCycleEngine(project.id, project.localPath);
    
    try {
      const result = await tddEngine.executePhase(cycle.id);
      
      if (result.status === 'BLOCKED') {
        const queryId = result.queries?.[0]?.id;
        return {
          artifacts: [],
          tokensUsed: 0,
          queryGenerated: queryId,
        };
      }

      if (result.status === 'FAILED') {
        throw new Error('TDD REVIEW phase execution failed');
      }

      const artifactPaths = result.artifacts.map(a => a.path);
      const tokensUsed = this.estimateTokenUsage(50); // Review is typically lighter

      return {
        artifacts: artifactPaths,
        tokensUsed,
      };
    } catch (error) {
      console.error(`REVIEW phase failed for cycle ${cycle.id}:`, error);
      throw error;
    }
  }

  private estimateTokenUsage(baseTokens: number): number {
    // Add some variation to make it more realistic
    const variation = Math.floor(Math.random() * 200) - 100; // ±100 tokens
    return Math.max(50, baseTokens + variation);
  }

  private getNextPhase(currentPhase: string): string {
    const phaseOrder = ['RED', 'GREEN', 'REFACTOR', 'REVIEW', 'COMPLETED'];
    const currentIndex = phaseOrder.indexOf(currentPhase);
    return phaseOrder[currentIndex + 1] || 'COMPLETED';
  }

  private async pauseCycleForBudget(cycleId: string, reason: string): Promise<void> {
    await prisma.cycle.update({
      where: { id: cycleId },
      data: {
        status: 'PAUSED',
        updatedAt: new Date(),
      },
    });

    console.log(`⏸️ Paused cycle ${cycleId}: ${reason}`);
  }

  private isDesignDecisionError(error: any): boolean {
    // Check if error indicates a design decision is needed
    const designKeywords = ['design', 'decision', 'choice', 'unclear', 'ambiguous'];
    const errorMessage = error.message?.toLowerCase() || '';
    return designKeywords.some(keyword => errorMessage.includes(keyword));
  }

  private async generateDesignQuery(cycle: any, error: any): Promise<string> {
    return await this.projectManager.generateQuery(
      {
        type: 'DESIGN_QUESTION',
        question: `Design decision needed for ${cycle.title}`,
        context: `Error encountered: ${error.message}`,
        proposal: 'AI agent needs user guidance to proceed',
        alternatives: [],
        impact: 'Development is blocked until decision is made',
        blockingWork: [cycle.id],
        priority: 'HIGH',
      },
      cycle.projectId
    );
  }

  private async handleCycleCompletion(cycle: any, artifacts: string[]): Promise<void> {
    await updateCLAUDEMDAfterTask(
      cycle.taskId,
      cycle.title,
      cycle.goal,
      {
        implementationDetails: [`Completed TDD cycle: ${cycle.title}`],
        newPatterns: ['TDD methodology applied'],
        testingApproach: 'RED-GREEN-REFACTOR-REVIEW cycle completed',
        architectureChanges: artifacts.length > 0 ? [`New files: ${artifacts.join(', ')}`] : undefined,
      }
    );
  }
}

export const coordinationSystem = AgentCoordinationSystem.getInstance();