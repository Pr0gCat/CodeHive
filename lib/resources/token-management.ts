import { prisma } from '@/lib/db';
import { getConfig } from '@/lib/config';

export interface TokenBudget {
  dailyLimit: number;
  weeklyGuideline: number;
  monthlyBudget: number;
  emergencyReserve: number;
}

export interface TokenUsageBreakdown {
  byAgent: Record<string, number>;
  byEpic: Record<string, number>;
  byTask: Record<string, number>;
  byCycle: Array<{ cycleId: string; tokens: number; timestamp: Date }>;
}

export interface TokenProjection {
  burnRate: number; // tokens per hour
  estimatedCyclesRemaining: number;
  estimatedTimeToLimit: string;
  status: 'ACTIVE' | 'WARNING' | 'CRITICAL' | 'BLOCKED';
}

export interface TokenStatus {
  currentUsage: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  limits: TokenBudget;
  remaining: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  breakdown: TokenUsageBreakdown;
  projection: TokenProjection;
}

export class TokenBasedResourceManager {
  private static instance: TokenBasedResourceManager;
  private config: any;

  constructor() {
    this.initializeConfig();
  }

  static getInstance(): TokenBasedResourceManager {
    if (!TokenBasedResourceManager.instance) {
      TokenBasedResourceManager.instance = new TokenBasedResourceManager();
    }
    return TokenBasedResourceManager.instance;
  }

  private async initializeConfig(): Promise<void> {
    this.config = await getConfig();
  }

  /**
   * Get current token status for a project
   */
  async getTokenStatus(projectId: string): Promise<TokenStatus> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get usage data
    const [todayUsage, weekUsage, monthUsage] = await Promise.all([
      this.getUsageForPeriod(projectId, startOfDay, now),
      this.getUsageForPeriod(projectId, startOfWeek, now),
      this.getUsageForPeriod(projectId, startOfMonth, now),
    ]);

    // Get token limits
    const limits = await this.getTokenLimits(projectId);

    // Calculate remaining tokens
    const remaining = {
      today: Math.max(0, limits.dailyLimit - todayUsage.total),
      thisWeek: Math.max(0, limits.weeklyGuideline - weekUsage.total),
      thisMonth: Math.max(0, limits.monthlyBudget - monthUsage.total),
    };

    // Calculate projection
    const projection = await this.calculateProjection(projectId, todayUsage.total, limits);

    return {
      currentUsage: {
        today: todayUsage.total,
        thisWeek: weekUsage.total,
        thisMonth: monthUsage.total,
      },
      limits,
      remaining,
      breakdown: {
        byAgent: todayUsage.byAgent,
        byEpic: todayUsage.byEpic,
        byTask: todayUsage.byTask,
        byCycle: todayUsage.byCycle,
      },
      projection,
    };
  }

  /**
   * Check if a project can execute work within token constraints
   */
  async canExecuteWork(projectId: string, estimatedTokens: number = 1000): Promise<{
    allowed: boolean;
    reason?: string;
    alternativeAction?: string;
  }> {
    const status = await this.getTokenStatus(projectId);

    // Check daily limit
    if (status.remaining.today < estimatedTokens) {
      return {
        allowed: false,
        reason: 'Daily token limit would be exceeded',
        alternativeAction: 'Work will resume tomorrow when token budget resets',
      };
    }

    // Check if we're in warning territory
    if (status.remaining.today < status.limits.dailyLimit * 0.2) {
      return {
        allowed: true,
        reason: 'WARNING: Low token budget remaining',
        alternativeAction: 'Consider prioritizing simple tasks to conserve tokens',
      };
    }

    return { allowed: true };
  }

  /**
   * Log token usage for an operation
   */
  async logTokenUsage(
    projectId: string,
    agentType: string,
    operation: string,
    tokensUsed: number,
    context: {
      taskId?: string;
      inputTokens?: number;
      outputTokens?: number;
    } = {}
  ): Promise<void> {
    // Split total tokens into input/output if not provided
    const inputTokens = context.inputTokens || Math.floor(tokensUsed * 0.7);
    const outputTokens = context.outputTokens || Math.floor(tokensUsed * 0.3);
    
    await prisma.tokenUsage.create({
      data: {
        projectId,
        agentType,
        taskId: context.taskId,
        inputTokens,
        outputTokens,
        timestamp: new Date(),
      },
    });

    // Check if we've hit any limits after logging
    const status = await this.getTokenStatus(projectId);
    await this.handleLimitChecks(projectId, status);
  }

  /**
   * Prioritize work based on token constraints
   */
  async prioritizeWork(projectId: string): Promise<{
    highPriority: string[];
    mediumPriority: string[];
    lowPriority: string[];
    blocked: string[];
  }> {
    const status = await this.getTokenStatus(projectId);
    
    // Get all pending stories/cards
    const stories = await prisma.kanbanCard.findMany({
      where: {
        projectId,
        status: {
          in: ['BACKLOG', 'TODO'],
        },
      },
      include: {
        epic: true,
        cycles: true,
      },
    });

    const categorized = {
      highPriority: [] as string[],
      mediumPriority: [] as string[],
      lowPriority: [] as string[],
      blocked: [] as string[],
    };

    for (const story of stories) {
      const estimatedTokens = this.estimateStoryTokenUsage(story);
      
      if (status.remaining.today < estimatedTokens) {
        categorized.blocked.push(story.id);
      } else if (estimatedTokens < 500) {
        categorized.highPriority.push(story.id);
      } else if (estimatedTokens < 2000) {
        categorized.mediumPriority.push(story.id);
      } else {
        categorized.lowPriority.push(story.id);
      }
    }

    return categorized;
  }

  /**
   * Pause work when limits are reached
   */
  async pauseWorkForLimits(projectId: string, reason: string): Promise<void> {
    console.log(`⏸️ Pausing work for project ${projectId}: ${reason}`);

    // Update all in-progress cycles to paused state
    await prisma.cycle.updateMany({
      where: {
        projectId,
        status: 'IN_PROGRESS',
      },
      data: {
        status: 'PAUSED',
      },
    });

    // Create a system event log
    await prisma.projectLog.create({
      data: {
        projectId,
        level: 'WARN',
        category: 'RESOURCE_MANAGEMENT',
        message: `Work paused: ${reason}`,
        metadata: {
          pauseReason: reason,
          pausedAt: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Resume work when budget becomes available
   */
  async resumeWorkAfterReset(projectId: string): Promise<void> {
    console.log(`▶️ Resuming work for project ${projectId} after budget reset`);

    // Update paused cycles back to in-progress
    await prisma.cycle.updateMany({
      where: {
        projectId,
        status: 'PAUSED',
      },
      data: {
        status: 'IN_PROGRESS',
      },
    });

    // Log resumption
    await prisma.projectLog.create({
      data: {
        projectId,
        level: 'INFO',
        category: 'RESOURCE_MANAGEMENT',
        message: 'Work resumed after token budget reset',
        metadata: {
          resumedAt: new Date().toISOString(),
        },
      },
    });
  }

  private async getUsageForPeriod(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    byAgent: Record<string, number>;
    byEpic: Record<string, number>;
    byTask: Record<string, number>;
    byCycle: Array<{ cycleId: string; tokens: number; timestamp: Date }>;
  }> {
    const usage = await prisma.tokenUsage.findMany({
      where: {
        projectId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    const breakdown = {
      total: 0,
      byAgent: {} as Record<string, number>,
      byEpic: {} as Record<string, number>,
      byTask: {} as Record<string, number>,
      byCycle: [] as Array<{ cycleId: string; tokens: number; timestamp: Date }>,
    };

    for (const record of usage) {
      const totalTokens = record.inputTokens + record.outputTokens;
      breakdown.total += totalTokens;
      
      breakdown.byAgent[record.agentType] = (breakdown.byAgent[record.agentType] || 0) + totalTokens;
      
      if (record.taskId) {
        breakdown.byTask[record.taskId] = (breakdown.byTask[record.taskId] || 0) + totalTokens;
      }
      
      breakdown.byCycle.push({
        cycleId: record.id, // Use record id as identifier
        tokens: totalTokens,
        timestamp: record.timestamp,
      });
    }

    return breakdown;
  }

  private async getTokenLimits(projectId: string): Promise<TokenBudget> {
    // Get project-specific limits or use defaults from config
    const projectSettings = await prisma.projectSettings.findUnique({
      where: { projectId },
    });

    const defaultDailyLimit = this.config?.claudeDailyTokenLimit || 100000;

    return {
      dailyLimit: projectSettings?.tokenLimits?.daily || defaultDailyLimit,
      weeklyGuideline: projectSettings?.tokenLimits?.weekly || defaultDailyLimit * 5,
      monthlyBudget: projectSettings?.tokenLimits?.monthly || defaultDailyLimit * 20,
      emergencyReserve: projectSettings?.tokenLimits?.emergency || defaultDailyLimit * 0.1,
    };
  }

  private async calculateProjection(
    projectId: string,
    todayUsage: number,
    limits: TokenBudget
  ): Promise<TokenProjection> {
    const now = new Date();
    const hoursPassedToday = now.getHours() + now.getMinutes() / 60;
    const burnRate = hoursPassedToday > 0 ? todayUsage / hoursPassedToday : 0;

    // Get pending cycles to estimate remaining work
    const pendingCycles = await prisma.cycle.count({
      where: {
        projectId,
        status: {
          in: ['PENDING', 'IN_PROGRESS'],
        },
      },
    });

    const averageTokensPerCycle = 1500; // Rough estimate
    const estimatedCyclesRemaining = Math.floor((limits.dailyLimit - todayUsage) / averageTokensPerCycle);

    const hoursToLimit = burnRate > 0 ? (limits.dailyLimit - todayUsage) / burnRate : Infinity;
    const timeToLimit = hoursToLimit === Infinity ? 'No limit expected' : `${Math.round(hoursToLimit)} hours`;

    let status: 'ACTIVE' | 'WARNING' | 'CRITICAL' | 'BLOCKED' = 'ACTIVE';
    const usagePercentage = todayUsage / limits.dailyLimit;

    if (usagePercentage >= 1) {
      status = 'BLOCKED';
    } else if (usagePercentage >= 0.95) {
      status = 'CRITICAL';
    } else if (usagePercentage >= 0.8) {
      status = 'WARNING';
    }

    return {
      burnRate,
      estimatedCyclesRemaining,
      estimatedTimeToLimit: timeToLimit,
      status,
    };
  }

  private estimateStoryTokenUsage(story: any): number {
    // Rough estimation based on story priority and complexity
    const baseTokens = {
      HIGH: 1500,
      MEDIUM: 1000,
      LOW: 500,
    };

    const storyTokens = baseTokens[story.priority as keyof typeof baseTokens] || 1000;
    
    // Add tokens for TDD cycles if enabled
    if (story.tddEnabled) {
      return storyTokens * 1.5; // TDD adds ~50% more tokens
    }
    
    return storyTokens;
  }

  private async handleLimitChecks(projectId: string, status: TokenStatus): Promise<void> {
    if (status.projection.status === 'BLOCKED') {
      await this.pauseWorkForLimits(projectId, 'Daily token limit reached');
    } else if (status.projection.status === 'CRITICAL') {
      // Log warning but don't pause yet
      await prisma.projectLog.create({
        data: {
          projectId,
          level: 'WARN',
          category: 'RESOURCE_MANAGEMENT',
          message: 'Critical token usage: 95% of daily limit reached',
          metadata: {
            remainingTokens: status.remaining.today,
            usagePercentage: (status.currentUsage.today / status.limits.dailyLimit) * 100,
          },
        },
      });
    }
  }
}

// Singleton instance
export const tokenManager = TokenBasedResourceManager.getInstance();