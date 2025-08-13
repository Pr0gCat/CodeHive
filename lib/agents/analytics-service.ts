/**
 * Project Analytics Service
 * 
 * Provides comprehensive analytics and insights for projects,
 * including progress tracking, productivity metrics, and AI agent performance.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ProjectMetrics {
  overview: {
    totalEpics: number;
    totalStories: number;
    totalTasks: number;
    completionRate: number;
    currentPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
    healthScore: number;
  };
  progress: {
    epicProgress: EpicProgress[];
    storyProgress: StoryProgress[];
    phaseProgress: PhaseProgress[];
    burndownData: BurndownPoint[];
  };
  productivity: {
    dailyStats: DailyStats[];
    weeklyTrends: WeeklyTrend[];
    averageTaskTime: number;
    velocityTrend: number[];
  };
  quality: {
    testCoverage: number;
    codeQualityScore: number;
    bugCount: number;
    technicalDebtScore: number;
  };
  aiPerformance: {
    totalInteractions: number;
    averageResponseTime: number;
    actionSuccessRate: number;
    tokenUsage: TokenUsageStats;
  };
}

export interface EpicProgress {
  id: string;
  title: string;
  status: string;
  progress: number;
  storyCount: number;
  completedStories: number;
  estimatedEffort: number;
  actualEffort: number;
}

export interface StoryProgress {
  id: string;
  title: string;
  epicTitle: string;
  status: string;
  storyPoints: number;
  completedTasks: number;
  totalTasks: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface PhaseProgress {
  phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  startDate: Date;
  completionDate?: Date;
  progress: number;
  milestones: string[];
  blockers: string[];
}

export interface BurndownPoint {
  date: Date;
  remainingWork: number;
  idealProgress: number;
  actualProgress: number;
  scope: number;
}

export interface DailyStats {
  date: Date;
  tasksCompleted: number;
  storyPointsCompleted: number;
  aiInteractions: number;
  codeGenerated: number;
  timeSpent: number;
}

export interface WeeklyTrend {
  weekStart: Date;
  productivity: number;
  quality: number;
  velocity: number;
  satisfaction: number;
}

export interface TokenUsageStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  averageTokensPerRequest: number;
}

export class AnalyticsService {

  /**
   * Get comprehensive project metrics
   */
  async getProjectMetrics(projectId: string, timeRange?: { start: Date; end: Date }): Promise<ProjectMetrics> {
    try {
      const [overview, progress, productivity, quality, aiPerformance] = await Promise.all([
        this.getProjectOverview(projectId),
        this.getProgressMetrics(projectId, timeRange),
        this.getProductivityMetrics(projectId, timeRange),
        this.getQualityMetrics(projectId),
        this.getAIPerformanceMetrics(projectId, timeRange)
      ]);

      return {
        overview,
        progress,
        productivity,
        quality,
        aiPerformance
      };
    } catch (error) {
      console.error('Error getting project metrics:', error);
      throw new Error(`Failed to get project metrics: ${(error as Error).message}`);
    }
  }

  /**
   * Get project overview metrics
   */
  private async getProjectOverview(projectId: string): Promise<ProjectMetrics['overview']> {
    // Get epic statistics
    const epics = await prisma.epic.findMany({
      where: { projectId },
      select: { status: true }
    });

    // Get story statistics
    const stories = await prisma.story.findMany({
      where: { epic: { projectId } },
      select: { status: true, storyPoints: true }
    });

    // Get task statistics
    const tasks = await prisma.task.findMany({
      where: { story: { epic: { projectId } } },
      select: { status: true }
    });

    // Get current phase
    const latestConversation = await prisma.conversation.findFirst({
      where: { projectId },
      orderBy: { lastMessageAt: 'desc' },
      select: { phase: true }
    });

    const currentPhase = (latestConversation?.phase as 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS') || 'REQUIREMENTS';

    // Calculate completion rates
    const completedStories = stories.filter(s => s.status === 'COMPLETED').length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const completionRate = stories.length > 0 ? (completedStories / stories.length) * 100 : 0;

    // Calculate health score based on multiple factors
    const healthScore = this.calculateHealthScore({
      completionRate,
      epicCount: epics.length,
      storyCount: stories.length,
      taskCompletionRate: tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0,
      phase: currentPhase
    });

    return {
      totalEpics: epics.length,
      totalStories: stories.length,
      totalTasks: tasks.length,
      completionRate: Math.round(completionRate),
      currentPhase,
      healthScore
    };
  }

  /**
   * Get progress metrics
   */
  private async getProgressMetrics(projectId: string, timeRange?: { start: Date; end: Date }): Promise<ProjectMetrics['progress']> {
    // Epic progress
    const epics = await prisma.epic.findMany({
      where: { projectId },
      include: {
        stories: {
          select: {
            status: true,
            storyPoints: true,
            tasks: {
              select: { status: true, estimatedTime: true }
            }
          }
        }
      }
    });

    const epicProgress: EpicProgress[] = epics.map(epic => {
      const completedStories = epic.stories.filter(s => s.status === 'COMPLETED').length;
      const totalStoryPoints = epic.stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
      const completedStoryPoints = epic.stories
        .filter(s => s.status === 'COMPLETED')
        .reduce((sum, s) => sum + (s.storyPoints || 0), 0);
      
      const progress = epic.stories.length > 0 ? (completedStories / epic.stories.length) * 100 : 0;
      
      // Calculate actual effort from completed tasks
      const actualEffort = epic.stories.flatMap(s => s.tasks)
        .filter(t => t.status === 'COMPLETED')
        .reduce((sum, t) => sum + (t.estimatedTime || 0), 0);

      return {
        id: epic.id,
        title: epic.title,
        status: epic.status,
        progress: Math.round(progress),
        storyCount: epic.stories.length,
        completedStories,
        estimatedEffort: epic.estimatedEffort || 0,
        actualEffort
      };
    });

    // Story progress
    const stories = await prisma.story.findMany({
      where: { epic: { projectId } },
      include: {
        epic: { select: { title: true } },
        tasks: { select: { status: true } }
      }
    });

    const storyProgress: StoryProgress[] = stories.map(story => {
      const completedTasks = story.tasks.filter(t => t.status === 'COMPLETED').length;
      
      return {
        id: story.id,
        title: story.title,
        epicTitle: story.epic.title,
        status: story.status,
        storyPoints: story.storyPoints || 0,
        completedTasks,
        totalTasks: story.tasks.length,
        startedAt: story.startedAt || undefined,
        completedAt: story.completedAt || undefined
      };
    });

    // Phase progress
    const phaseProgress = await this.getPhaseProgress(projectId);

    // Burndown data
    const burndownData = await this.getBurndownData(projectId, timeRange);

    return {
      epicProgress,
      storyProgress,
      phaseProgress,
      burndownData
    };
  }

  /**
   * Get productivity metrics
   */
  private async getProductivityMetrics(projectId: string, timeRange?: { start: Date; end: Date }): Promise<ProjectMetrics['productivity']> {
    const defaultRange = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    };
    const range = timeRange || defaultRange;

    // Daily stats
    const dailyStats = await this.getDailyStats(projectId, range);

    // Weekly trends
    const weeklyTrends = await this.getWeeklyTrends(projectId, range);

    // Average task time
    const completedTasks = await prisma.task.findMany({
      where: {
        story: { epic: { projectId } },
        status: 'COMPLETED',
        completedAt: {
          gte: range.start,
          lte: range.end
        }
      },
      select: {
        startedAt: true,
        completedAt: true,
        estimatedTime: true
      }
    });

    const actualTaskTimes = completedTasks
      .filter(t => t.startedAt && t.completedAt)
      .map(t => {
        const start = new Date(t.startedAt!).getTime();
        const end = new Date(t.completedAt!).getTime();
        return end - start;
      });

    const averageTaskTime = actualTaskTimes.length > 0 
      ? actualTaskTimes.reduce((sum, time) => sum + time, 0) / actualTaskTimes.length 
      : 0;

    // Velocity trend (story points completed per week)
    const velocityTrend = await this.getVelocityTrend(projectId, range);

    return {
      dailyStats,
      weeklyTrends,
      averageTaskTime: Math.round(averageTaskTime / (1000 * 60)), // Convert to minutes
      velocityTrend
    };
  }

  /**
   * Get quality metrics
   */
  private async getQualityMetrics(projectId: string): Promise<ProjectMetrics['quality']> {
    // Test coverage calculation
    const testTasks = await prisma.task.count({
      where: {
        story: { epic: { projectId } },
        type: 'TEST'
      }
    });

    const completedTestTasks = await prisma.task.count({
      where: {
        story: { epic: { projectId } },
        type: 'TEST',
        status: 'COMPLETED'
      }
    });

    const testCoverage = testTasks > 0 ? (completedTestTasks / testTasks) * 100 : 0;

    // Code quality score (based on review tasks and documentation)
    const reviewTasks = await prisma.task.count({
      where: {
        story: { epic: { projectId } },
        type: 'REVIEW',
        status: 'COMPLETED'
      }
    });

    const docTasks = await prisma.task.count({
      where: {
        story: { epic: { projectId } },
        type: 'DOCUMENT',
        status: 'COMPLETED'
      }
    });

    const totalTasks = await prisma.task.count({
      where: { story: { epic: { projectId } } }
    });

    const codeQualityScore = totalTasks > 0 
      ? ((reviewTasks + docTasks) / totalTasks) * 100 
      : 0;

    // Bug count (tasks marked as BUG type)
    const bugCount = await prisma.task.count({
      where: {
        story: { epic: { projectId } },
        type: 'BUG'
      }
    });

    // Technical debt score (inverse of maintenance tasks completed)
    const maintenanceTasks = await prisma.task.count({
      where: {
        story: { epic: { projectId } },
        type: { in: ['REFACTOR', 'OPTIMIZE', 'DOCUMENT'] }
      }
    });

    const completedMaintenanceTasks = await prisma.task.count({
      where: {
        story: { epic: { projectId } },
        type: { in: ['REFACTOR', 'OPTIMIZE', 'DOCUMENT'] },
        status: 'COMPLETED'
      }
    });

    const technicalDebtScore = maintenanceTasks > 0 
      ? 100 - ((completedMaintenanceTasks / maintenanceTasks) * 100)
      : 0;

    return {
      testCoverage: Math.round(testCoverage),
      codeQualityScore: Math.round(codeQualityScore),
      bugCount,
      technicalDebtScore: Math.round(technicalDebtScore)
    };
  }

  /**
   * Get AI performance metrics
   */
  private async getAIPerformanceMetrics(projectId: string, timeRange?: { start: Date; end: Date }): Promise<ProjectMetrics['aiPerformance']> {
    const defaultRange = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    };
    const range = timeRange || defaultRange;

    // Get AI messages
    const aiMessages = await prisma.message.findMany({
      where: {
        conversation: { projectId },
        role: 'AGENT',
        createdAt: {
          gte: range.start,
          lte: range.end
        }
      },
      select: {
        tokenUsage: true,
        responseTime: true,
        isError: true
      }
    });

    // Get AI actions
    const aiActions = await prisma.messageAction.findMany({
      where: {
        message: {
          conversation: { projectId },
          createdAt: {
            gte: range.start,
            lte: range.end
          }
        }
      },
      select: {
        status: true
      }
    });

    const totalInteractions = aiMessages.length;
    const successfulResponses = aiMessages.filter(m => !m.isError).length;
    const successfulActions = aiActions.filter(a => a.status === 'COMPLETED').length;

    const averageResponseTime = aiMessages.length > 0
      ? aiMessages.reduce((sum, m) => sum + (m.responseTime || 0), 0) / aiMessages.length
      : 0;

    const actionSuccessRate = aiActions.length > 0
      ? (successfulActions / aiActions.length) * 100
      : 100;

    // Token usage statistics
    const totalTokens = aiMessages.reduce((sum, m) => sum + (m.tokenUsage || 0), 0);
    const averageTokensPerRequest = totalInteractions > 0 ? totalTokens / totalInteractions : 0;

    // Estimated cost (rough calculation based on Claude pricing)
    const estimatedCost = (totalTokens / 1000) * 0.01; // $0.01 per 1K tokens (approximate)

    const tokenUsage: TokenUsageStats = {
      totalTokens,
      inputTokens: Math.round(totalTokens * 0.4), // Rough estimation
      outputTokens: Math.round(totalTokens * 0.6), // Rough estimation
      cost: Math.round(estimatedCost * 100) / 100,
      averageTokensPerRequest: Math.round(averageTokensPerRequest)
    };

    return {
      totalInteractions,
      averageResponseTime: Math.round(averageResponseTime),
      actionSuccessRate: Math.round(actionSuccessRate),
      tokenUsage
    };
  }

  /**
   * Calculate project health score
   */
  private calculateHealthScore(factors: {
    completionRate: number;
    epicCount: number;
    storyCount: number;
    taskCompletionRate: number;
    phase: string;
  }): number {
    let score = 0;

    // Completion rate weight: 40%
    score += (factors.completionRate / 100) * 40;

    // Task completion weight: 30%
    score += (factors.taskCompletionRate / 100) * 30;

    // Project structure weight: 20%
    const structureScore = Math.min(100, (factors.epicCount * 20) + (factors.storyCount * 5));
    score += (structureScore / 100) * 20;

    // Phase progression weight: 10%
    const phaseScore = factors.phase === 'CONTINUOUS' ? 100 : factors.phase === 'MVP' ? 70 : 40;
    score += (phaseScore / 100) * 10;

    return Math.round(Math.min(100, score));
  }

  /**
   * Get phase progress information
   */
  private async getPhaseProgress(projectId: string): Promise<PhaseProgress[]> {
    const conversations = await prisma.conversation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: {
        phase: true,
        createdAt: true,
        status: true
      }
    });

    const phaseData = new Map<string, { start: Date; completed?: Date; progress: number }>();
    
    for (const conv of conversations) {
      const phase = conv.phase as 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
      if (!phaseData.has(phase)) {
        phaseData.set(phase, {
          start: conv.createdAt,
          progress: conv.status === 'COMPLETED' ? 100 : 50
        });
      } else if (conv.status === 'COMPLETED') {
        const existing = phaseData.get(phase)!;
        existing.completed = conv.createdAt;
        existing.progress = 100;
      }
    }

    return Array.from(phaseData.entries()).map(([phase, data]) => ({
      phase: phase as 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS',
      startDate: data.start,
      completionDate: data.completed,
      progress: data.progress,
      milestones: this.getPhaseMilestones(phase as any),
      blockers: [] // TODO: Implement blocker detection
    }));
  }

  /**
   * Get phase milestones
   */
  private getPhaseMilestones(phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS'): string[] {
    const milestones = {
      REQUIREMENTS: [
        '專案目標確定',
        '使用者需求收集',
        '技術架構規劃',
        '開發計劃制定'
      ],
      MVP: [
        '核心功能開發',
        '基礎測試完成',
        '初步部署',
        'MVP 驗證'
      ],
      CONTINUOUS: [
        '用戶反饋收集',
        '功能持續迭代',
        '效能優化',
        '維護和監控'
      ]
    };

    return milestones[phase];
  }

  /**
   * Get burndown chart data
   */
  private async getBurndownData(projectId: string, timeRange?: { start: Date; end: Date }): Promise<BurndownPoint[]> {
    // This is a simplified implementation
    // In a real system, you'd track work remaining over time
    const range = timeRange || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    };

    const totalStoryPoints = await prisma.story.aggregate({
      where: { epic: { projectId } },
      _sum: { storyPoints: true }
    });

    const total = totalStoryPoints._sum.storyPoints || 0;
    const days = Math.ceil((range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000));
    
    const burndownData: BurndownPoint[] = [];
    
    for (let i = 0; i <= days; i++) {
      const date = new Date(range.start.getTime() + i * 24 * 60 * 60 * 1000);
      const idealProgress = total - (total * i / days);
      
      // This would need real historical data in production
      const actualProgress = total - (total * Math.min(i / days, 1) * 0.8);
      
      burndownData.push({
        date,
        remainingWork: Math.max(0, actualProgress),
        idealProgress: Math.max(0, idealProgress),
        actualProgress: total - actualProgress,
        scope: total
      });
    }

    return burndownData;
  }

  /**
   * Get daily statistics
   */
  private async getDailyStats(projectId: string, range: { start: Date; end: Date }): Promise<DailyStats[]> {
    // This is a simplified implementation
    // In production, you'd have detailed daily tracking
    const days = Math.ceil((range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000));
    const dailyStats: DailyStats[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(range.start.getTime() + i * 24 * 60 * 60 * 1000);
      
      dailyStats.push({
        date,
        tasksCompleted: Math.floor(Math.random() * 5), // Mock data
        storyPointsCompleted: Math.floor(Math.random() * 10),
        aiInteractions: Math.floor(Math.random() * 15),
        codeGenerated: Math.floor(Math.random() * 3),
        timeSpent: Math.floor(Math.random() * 480) // Minutes
      });
    }

    return dailyStats;
  }

  /**
   * Get weekly trends
   */
  private async getWeeklyTrends(projectId: string, range: { start: Date; end: Date }): Promise<WeeklyTrend[]> {
    // Simplified implementation
    const weeks = Math.ceil((range.end.getTime() - range.start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const trends: WeeklyTrend[] = [];

    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(range.start.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      
      trends.push({
        weekStart,
        productivity: Math.round(70 + Math.random() * 30), // 70-100%
        quality: Math.round(75 + Math.random() * 25), // 75-100%
        velocity: Math.round(5 + Math.random() * 10), // 5-15 story points
        satisfaction: Math.round(80 + Math.random() * 20) // 80-100%
      });
    }

    return trends;
  }

  /**
   * Get velocity trend
   */
  private async getVelocityTrend(projectId: string, range: { start: Date; end: Date }): Promise<number[]> {
    // Simplified implementation - would track actual story points completed per iteration
    const weeks = Math.ceil((range.end.getTime() - range.start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const velocity: number[] = [];

    for (let i = 0; i < weeks; i++) {
      velocity.push(Math.round(5 + Math.random() * 10)); // 5-15 story points per week
    }

    return velocity;
  }

  /**
   * Get real-time dashboard data
   */
  async getDashboardData(projectId: string): Promise<{
    activeUsers: number;
    currentSprint: any;
    recentActivity: any[];
    alerts: any[];
  }> {
    // Get recent AI interactions
    const recentMessages = await prisma.message.findMany({
      where: {
        conversation: { projectId },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        content: true,
        role: true,
        createdAt: true
      }
    });

    const recentActivity = recentMessages.map(msg => ({
      type: msg.role === 'AGENT' ? 'ai_response' : 'user_message',
      content: msg.content.substring(0, 100) + '...',
      timestamp: msg.createdAt
    }));

    // Check for alerts
    const alerts = await this.getProjectAlerts(projectId);

    return {
      activeUsers: 1, // Simplified - would track actual active users
      currentSprint: {
        name: 'Sprint 1',
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        progress: 65
      },
      recentActivity,
      alerts
    };
  }

  /**
   * Get project alerts
   */
  private async getProjectAlerts(projectId: string): Promise<any[]> {
    const alerts = [];

    // Check for blocked tasks
    const blockedTasks = await prisma.task.count({
      where: {
        story: { epic: { projectId } },
        status: 'BLOCKED'
      }
    });

    if (blockedTasks > 0) {
      alerts.push({
        type: 'warning',
        message: `${blockedTasks} 個任務被阻擋`,
        action: 'review_blockers'
      });
    }

    // Check for overdue tasks
    const overdueTasks = await prisma.task.count({
      where: {
        story: { epic: { projectId } },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { lt: new Date() }
      }
    });

    if (overdueTasks > 0) {
      alerts.push({
        type: 'error',
        message: `${overdueTasks} 個任務已逾期`,
        action: 'update_timeline'
      });
    }

    return alerts;
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();