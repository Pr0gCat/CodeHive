/**
 * Project Phase Transition Manager
 * 
 * Manages transitions between project phases (REQUIREMENTS → MVP → CONTINUOUS)
 * with intelligent validation and automated workflow coordination.
 */

import { PrismaClient } from '@prisma/client';
import { epicManager } from './epic-manager';
import { storyManager } from './story-manager';
import { taskExecutor } from './task-executor';

const prisma = new PrismaClient();

export interface PhaseTransitionCriteria {
  phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  requiredConditions: {
    condition: string;
    description: string;
    validator: () => Promise<boolean>;
    weight: number; // 1-10, importance of this condition
  }[];
  recommendedActions: string[];
  blockers: string[];
}

export interface PhaseTransitionResult {
  fromPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  toPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  success: boolean;
  readinessScore: number; // 0-100%
  metConditions: string[];
  failedConditions: string[];
  recommendations: string[];
  blockers: string[];
  transitionActions: {
    action: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    result?: string;
  }[];
}

export interface ProjectPhaseStatus {
  currentPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  readinessForNext: {
    nextPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS' | null;
    readinessScore: number;
    canTransition: boolean;
    blockers: string[];
  };
  phaseMetrics: {
    [key: string]: {
      completion: number; // 0-100%
      quality: number; // 0-100%
      coverage: number; // 0-100%
    };
  };
}

export class PhaseManager {

  /**
   * Check if project is ready for phase transition
   */
  async checkPhaseReadiness(
    projectId: string,
    targetPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS'
  ): Promise<{ canTransition: boolean; readinessScore: number; details: any }> {
    try {
      const criteria = await this.getPhaseTransitionCriteria(projectId, targetPhase);
      
      let totalScore = 0;
      let maxScore = 0;
      const metConditions: string[] = [];
      const failedConditions: string[] = [];

      for (const condition of criteria.requiredConditions) {
        const passed = await condition.validator();
        maxScore += condition.weight;
        
        if (passed) {
          totalScore += condition.weight;
          metConditions.push(condition.condition);
        } else {
          failedConditions.push(condition.condition);
        }
      }

      const readinessScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      const canTransition = readinessScore >= 80; // Require 80% readiness

      return {
        canTransition,
        readinessScore,
        details: {
          criteria,
          metConditions,
          failedConditions,
          totalScore,
          maxScore
        }
      };
    } catch (error) {
      console.error('Error checking phase readiness:', error);
      return {
        canTransition: false,
        readinessScore: 0,
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Execute phase transition
   */
  async transitionPhase(
    projectId: string,
    fromPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS',
    toPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS',
    force: boolean = false
  ): Promise<PhaseTransitionResult> {
    try {
      // Check readiness unless forced
      if (!force) {
        const readiness = await this.checkPhaseReadiness(projectId, toPhase);
        if (!readiness.canTransition) {
          return {
            fromPhase,
            toPhase,
            success: false,
            readinessScore: readiness.readinessScore,
            metConditions: readiness.details.metConditions || [],
            failedConditions: readiness.details.failedConditions || [],
            recommendations: [`Increase readiness score to at least 80% (current: ${readiness.readinessScore}%)`],
            blockers: readiness.details.failedConditions || [],
            transitionActions: []
          };
        }
      }

      // Execute transition actions
      const transitionActions = await this.executeTransitionActions(projectId, fromPhase, toPhase);
      
      // Update project phase in conversations
      await this.updateProjectPhaseInConversations(projectId, toPhase);
      
      // Update epics phase if transitioning to MVP or CONTINUOUS
      if (toPhase === 'MVP' || toPhase === 'CONTINUOUS') {
        await this.updateEpicsPhase(projectId, toPhase);
      }

      const readiness = await this.checkPhaseReadiness(projectId, toPhase);

      return {
        fromPhase,
        toPhase,
        success: true,
        readinessScore: readiness.readinessScore,
        metConditions: readiness.details.metConditions || [],
        failedConditions: [],
        recommendations: await this.getPhaseRecommendations(projectId, toPhase),
        blockers: [],
        transitionActions
      };

    } catch (error) {
      console.error('Error executing phase transition:', error);
      
      return {
        fromPhase,
        toPhase,
        success: false,
        readinessScore: 0,
        metConditions: [],
        failedConditions: [`Transition error: ${(error as Error).message}`],
        recommendations: ['Review error logs and fix issues before retrying'],
        blockers: [(error as Error).message],
        transitionActions: []
      };
    }
  }

  /**
   * Get current project phase status
   */
  async getProjectPhaseStatus(projectId: string): Promise<ProjectPhaseStatus> {
    try {
      // Determine current phase from most recent conversation
      const recentConversation = await prisma.conversation.findFirst({
        where: { projectId },
        orderBy: { lastMessageAt: 'desc' },
        select: { phase: true }
      });

      const currentPhase = (recentConversation?.phase as 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS') || 'REQUIREMENTS';
      
      // Determine next phase
      let nextPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS' | null = null;
      if (currentPhase === 'REQUIREMENTS') nextPhase = 'MVP';
      else if (currentPhase === 'MVP') nextPhase = 'CONTINUOUS';

      // Check readiness for next phase
      let readinessForNext = {
        nextPhase,
        readinessScore: 0,
        canTransition: false,
        blockers: [] as string[]
      };

      if (nextPhase) {
        const readiness = await this.checkPhaseReadiness(projectId, nextPhase);
        readinessForNext = {
          nextPhase,
          readinessScore: readiness.readinessScore,
          canTransition: readiness.canTransition,
          blockers: readiness.details.failedConditions || []
        };
      }

      // Calculate phase metrics
      const phaseMetrics = await this.calculatePhaseMetrics(projectId);

      return {
        currentPhase,
        readinessForNext,
        phaseMetrics
      };

    } catch (error) {
      console.error('Error getting project phase status:', error);
      return {
        currentPhase: 'REQUIREMENTS',
        readinessForNext: {
          nextPhase: null,
          readinessScore: 0,
          canTransition: false,
          blockers: [(error as Error).message]
        },
        phaseMetrics: {}
      };
    }
  }

  /**
   * Get phase transition criteria
   */
  private async getPhaseTransitionCriteria(
    projectId: string,
    targetPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS'
  ): Promise<PhaseTransitionCriteria> {
    switch (targetPhase) {
      case 'MVP':
        return {
          phase: 'MVP',
          requiredConditions: [
            {
              condition: 'At least 1 Epic defined',
              description: 'Project must have clear epics outlining major features',
              validator: async () => {
                const epics = await epicManager.getProjectEpics(projectId);
                return epics.length > 0;
              },
              weight: 10
            },
            {
              condition: 'Epic has stories with acceptance criteria',
              description: 'Epics must be broken down into actionable stories',
              validator: async () => {
                const epics = await epicManager.getProjectEpics(projectId, { includeStories: true });
                return epics.some(epic => 
                  epic.stories && epic.stories.length > 0 && 
                  epic.stories.some((story: any) => story.acceptanceCriteria)
                );
              },
              weight: 8
            },
            {
              condition: 'Clear business value defined',
              description: 'Epics must have clear business value statements',
              validator: async () => {
                const epics = await epicManager.getProjectEpics(projectId);
                return epics.some(epic => epic.businessValue && epic.businessValue.length > 0);
              },
              weight: 6
            },
            {
              condition: 'Requirements conversation completed',
              description: 'Requirements phase conversations should be marked complete',
              validator: async () => {
                const conversations = await prisma.conversation.findMany({
                  where: { projectId, phase: 'REQUIREMENTS' },
                  select: { status: true }
                });
                return conversations.some(conv => conv.status === 'COMPLETED');
              },
              weight: 7
            }
          ],
          recommendedActions: [
            'Create detailed epics with business value',
            'Break down epics into user stories',
            'Define clear acceptance criteria',
            'Prioritize features for MVP'
          ],
          blockers: []
        };

      case 'CONTINUOUS':
        return {
          phase: 'CONTINUOUS',
          requiredConditions: [
            {
              condition: 'At least 50% of stories completed',
              description: 'Significant portion of MVP stories must be completed',
              validator: async () => {
                const epics = await epicManager.getProjectEpics(projectId, { includeStories: true });
                const allStories = epics.flatMap(epic => epic.stories || []);
                const completedStories = allStories.filter((story: any) => story.status === 'COMPLETED');
                return allStories.length > 0 && (completedStories.length / allStories.length) >= 0.5;
              },
              weight: 10
            },
            {
              condition: 'Core functionality tested',
              description: 'Essential features must have passing tests',
              validator: async () => {
                const tasks = await prisma.task.findMany({
                  where: {
                    story: { epic: { projectId } },
                    type: 'TEST'
                  },
                  select: { status: true }
                });
                const completedTests = tasks.filter(task => task.status === 'COMPLETED');
                return tasks.length > 0 && (completedTests.length / tasks.length) >= 0.7;
              },
              weight: 9
            },
            {
              condition: 'MVP epic completed',
              description: 'At least one epic marked as completed',
              validator: async () => {
                const epics = await epicManager.getProjectEpics(projectId, { phase: 'MVP' });
                return epics.some(epic => epic.status === 'COMPLETED');
              },
              weight: 8
            },
            {
              condition: 'Documentation exists',
              description: 'Basic project documentation should be available',
              validator: async () => {
                const docTasks = await prisma.task.findMany({
                  where: {
                    story: { epic: { projectId } },
                    type: 'DOCUMENT'
                  },
                  select: { status: true }
                });
                return docTasks.some(task => task.status === 'COMPLETED');
              },
              weight: 5
            }
          ],
          recommendedActions: [
            'Complete remaining MVP stories',
            'Ensure comprehensive testing',
            'Create user documentation',
            'Set up monitoring and feedback systems'
          ],
          blockers: []
        };

      default: // REQUIREMENTS
        return {
          phase: 'REQUIREMENTS',
          requiredConditions: [
            {
              condition: 'Project context established',
              description: 'Basic project information and goals defined',
              validator: async () => {
                const conversations = await prisma.conversation.findMany({
                  where: { projectId },
                  select: { messageCount: true }
                });
                return conversations.some(conv => conv.messageCount > 0);
              },
              weight: 5
            }
          ],
          recommendedActions: [
            'Engage with project agent to define requirements',
            'Clarify project goals and scope',
            'Identify key stakeholders and users'
          ],
          blockers: []
        };
    }
  }

  /**
   * Execute transition actions
   */
  private async executeTransitionActions(
    projectId: string,
    fromPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS',
    toPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS'
  ) {
    const actions: any[] = [];

    try {
      if (fromPhase === 'REQUIREMENTS' && toPhase === 'MVP') {
        // Transition to MVP
        actions.push({
          action: 'Initialize MVP development workflow',
          status: 'PENDING'
        });

        // Start high-priority epics
        const epics = await epicManager.getProjectEpics(projectId, { 
          status: 'PENDING', 
          orderBy: 'priority' 
        });

        for (const epic of epics.slice(0, 3)) { // Start top 3 epics
          try {
            await epicManager.startEpic(epic.id);
            actions.push({
              action: `Started Epic: ${epic.title}`,
              status: 'COMPLETED',
              result: `Epic ${epic.id} transitioned to IN_PROGRESS`
            });
          } catch (error) {
            actions.push({
              action: `Failed to start Epic: ${epic.title}`,
              status: 'FAILED',
              result: (error as Error).message
            });
          }
        }
      }

      if (fromPhase === 'MVP' && toPhase === 'CONTINUOUS') {
        // Transition to CONTINUOUS
        actions.push({
          action: 'Initialize continuous integration workflow',
          status: 'PENDING'
        });

        // Mark completed epics
        const epics = await epicManager.getProjectEpics(projectId, { status: 'IN_PROGRESS' });
        
        for (const epic of epics) {
          try {
            const summary = await epicManager.getEpicSummary(epic.id);
            if (summary.progressPercentage >= 80) {
              await epicManager.completeEpic(epic.id);
              actions.push({
                action: `Completed Epic: ${epic.title}`,
                status: 'COMPLETED',
                result: `Epic ${epic.id} marked as completed`
              });
            }
          } catch (error) {
            actions.push({
              action: `Failed to complete Epic: ${epic.title}`,
              status: 'FAILED',
              result: (error as Error).message
            });
          }
        }
      }

      // Mark all actions as completed if no failures
      actions.forEach(action => {
        if (action.status === 'PENDING') {
          action.status = 'COMPLETED';
        }
      });

    } catch (error) {
      actions.push({
        action: 'Execute transition actions',
        status: 'FAILED',
        result: (error as Error).message
      });
    }

    return actions;
  }

  /**
   * Update project phase in conversations
   */
  private async updateProjectPhaseInConversations(
    projectId: string,
    newPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS'
  ) {
    // Update active conversations to new phase
    await prisma.conversation.updateMany({
      where: {
        projectId,
        status: 'ACTIVE'
      },
      data: {
        phase: newPhase
      }
    });
  }

  /**
   * Update epics phase
   */
  private async updateEpicsPhase(
    projectId: string,
    newPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS'
  ) {
    await prisma.epic.updateMany({
      where: { projectId },
      data: { phase: newPhase }
    });
  }

  /**
   * Get recommendations for current phase
   */
  private async getPhaseRecommendations(
    projectId: string,
    phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS'
  ): Promise<string[]> {
    const recommendations: string[] = [];

    try {
      const epics = await epicManager.getProjectEpics(projectId, { includeStories: true });
      const metrics = await epicManager.getProjectEpicMetrics(projectId);

      switch (phase) {
        case 'REQUIREMENTS':
          recommendations.push(
            'Engage in detailed requirement discussions with the project agent',
            'Define clear project goals and success criteria',
            'Identify key user personas and use cases'
          );
          break;

        case 'MVP':
          if (metrics.inProgressEpics === 0) {
            recommendations.push('Start development on highest priority epics');
          }
          if (metrics.totalStoryPoints > 0 && metrics.progressPercentage < 30) {
            recommendations.push('Focus on completing core user stories');
          }
          recommendations.push(
            'Implement ATDD cycles for quality assurance',
            'Regular progress reviews and iterations',
            'Focus on delivering working software incrementally'
          );
          break;

        case 'CONTINUOUS':
          recommendations.push(
            'Monitor user feedback and iterate on features',
            'Maintain high test coverage and code quality',
            'Plan for scalability and performance improvements',
            'Implement continuous deployment and monitoring'
          );
          break;
      }

      return recommendations;
    } catch (error) {
      console.error('Error getting phase recommendations:', error);
      return ['Review current phase status and address any blockers'];
    }
  }

  /**
   * Calculate phase metrics
   */
  private async calculatePhaseMetrics(projectId: string): Promise<Record<string, any>> {
    try {
      const metrics: Record<string, any> = {};

      // Requirements phase metrics
      const requirementsConversations = await prisma.conversation.findMany({
        where: { projectId, phase: 'REQUIREMENTS' },
        select: { messageCount: true, status: true }
      });

      const totalRequirementMessages = requirementsConversations.reduce((sum, conv) => sum + conv.messageCount, 0);
      const completedRequirementConversations = requirementsConversations.filter(conv => conv.status === 'COMPLETED');

      metrics.REQUIREMENTS = {
        completion: requirementsConversations.length > 0 
          ? Math.round((completedRequirementConversations.length / requirementsConversations.length) * 100)
          : 0,
        quality: totalRequirementMessages > 10 ? 90 : Math.min(totalRequirementMessages * 9, 90),
        coverage: Math.min(totalRequirementMessages * 2, 100)
      };

      // MVP phase metrics
      const epicMetrics = await epicManager.getProjectEpicMetrics(projectId);
      
      metrics.MVP = {
        completion: epicMetrics.progressPercentage,
        quality: epicMetrics.totalStoryPoints > 0 ? Math.min(epicMetrics.completedStoryPoints * 2, 100) : 0,
        coverage: epicMetrics.totalEpics > 0 ? Math.round((epicMetrics.completedEpics / epicMetrics.totalEpics) * 100) : 0
      };

      // Continuous phase metrics (based on maintenance activities)
      const maintenanceTasks = await prisma.task.count({
        where: {
          story: { epic: { projectId } },
          type: { in: ['REVIEW', 'DEPLOY', 'DOCUMENT'] },
          status: 'COMPLETED'
        }
      });

      metrics.CONTINUOUS = {
        completion: Math.min(maintenanceTasks * 10, 100),
        quality: Math.min(maintenanceTasks * 15, 100),
        coverage: Math.min(maintenanceTasks * 12, 100)
      };

      return metrics;
    } catch (error) {
      console.error('Error calculating phase metrics:', error);
      return {
        REQUIREMENTS: { completion: 0, quality: 0, coverage: 0 },
        MVP: { completion: 0, quality: 0, coverage: 0 },
        CONTINUOUS: { completion: 0, quality: 0, coverage: 0 }
      };
    }
  }
}

// Export singleton instance
export const phaseManager = new PhaseManager();