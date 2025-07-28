import { prisma } from '@/lib/db';
import { AgentResult } from './types';

export interface PerformanceMetrics {
  agentId: string;
  agentType: string;
  averageExecutionTime: number;
  successRate: number;
  totalExecutions: number;
  tokenEfficiency: number;
  lastExecution: Date;
  commonErrors: string[];
  improvementTrends: {
    period: string;
    executionTime: number;
    successRate: number;
  }[];
}

export class PerformanceTracker {
  async recordExecution(
    agentId: string,
    agentType: string,
    result: AgentResult,
    taskComplexity?: string
  ): Promise<void> {
    try {
      await prisma.agentPerformance.create({
        data: {
          agentId,
          executionTime: result.executionTime || 0,
          tokensUsed: result.tokensUsed || 0,
          success: result.success,
          errorMessage: result.error || null,
          taskComplexity,
        },
      });

      // Update agent specification with performance data
      await this.updateAgentMetrics(agentId, agentType);
    } catch (error) {
      console.error('Error recording agent performance:', error);
    }
  }

  async getAgentMetrics(agentId: string): Promise<PerformanceMetrics | null> {
    try {
      const agent = await prisma.agentSpecification.findUnique({
        where: { id: agentId },
        include: {
          performance: {
            orderBy: { timestamp: 'desc' },
            take: 100, // Last 100 executions
          },
        },
      });

      if (!agent || agent.performance.length === 0) {
        return null;
      }

      const performances = agent.performance;
      const totalExecutions = performances.length;
      const successfulExecutions = performances.filter(p => p.success).length;
      const successRate = (successfulExecutions / totalExecutions) * 100;

      const averageExecutionTime = performances.reduce((sum, p) => sum + p.executionTime, 0) / totalExecutions;
      const totalTokens = performances.reduce((sum, p) => sum + p.tokensUsed, 0);
      const tokenEfficiency = totalTokens > 0 ? (successfulExecutions / totalTokens) * 1000 : 0; // Success per 1000 tokens

      // Get common errors
      const errorCounts = performances
        .filter(p => !p.success && p.errorMessage)
        .reduce((acc, p) => {
          const error = p.errorMessage!;
          acc[error] = (acc[error] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const commonErrors = Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([error]) => error);

      // Calculate improvement trends (weekly)
      const improvementTrends = this.calculateTrends(performances);

      return {
        agentId,
        agentType: agent.type,
        averageExecutionTime,
        successRate,
        totalExecutions,
        tokenEfficiency,
        lastExecution: performances[0].timestamp,
        commonErrors,
        improvementTrends,
      };
    } catch (error) {
      console.error('Error getting agent metrics:', error);
      return null;
    }
  }

  async getProjectAgentMetrics(projectId: string): Promise<PerformanceMetrics[]> {
    try {
      const agents = await prisma.agentSpecification.findMany({
        where: { projectId },
        include: {
          performance: {
            orderBy: { timestamp: 'desc' },
            take: 50,
          },
        },
      });

      const metrics: PerformanceMetrics[] = [];

      for (const agent of agents) {
        const agentMetrics = await this.getAgentMetrics(agent.id);
        if (agentMetrics) {
          metrics.push(agentMetrics);
        }
      }

      return metrics.sort((a, b) => b.successRate - a.successRate);
    } catch (error) {
      console.error('Error getting project agent metrics:', error);
      return [];
    }
  }

  async identifyUnderperformingAgents(projectId: string): Promise<{
    agentId: string;
    agentType: string;
    issues: string[];
    suggestions: string[];
  }[]> {
    try {
      const metrics = await this.getProjectAgentMetrics(projectId);
      const underperforming: {
        agentId: string;
        agentType: string;
        issues: string[];
        suggestions: string[];
      }[] = [];

      for (const metric of metrics) {
        const issues: string[] = [];
        const suggestions: string[] = [];

        // Check success rate
        if (metric.successRate < 70) {
          issues.push(`Low success rate: ${metric.successRate.toFixed(1)}%`);
          suggestions.push('Review common error patterns and improve error handling');
        }

        // Check execution time
        if (metric.averageExecutionTime > 300000) { // 5 minutes
          issues.push(`High execution time: ${(metric.averageExecutionTime / 1000).toFixed(1)}s average`);
          suggestions.push('Optimize command complexity and add timeout handling');
        }

        // Check token efficiency
        if (metric.tokenEfficiency < 1) { // Less than 1 success per 1000 tokens
          issues.push(`Poor token efficiency: ${metric.tokenEfficiency.toFixed(2)} successes per 1000 tokens`);
          suggestions.push('Optimize prompts and reduce unnecessary token usage');
        }

        // Check for common errors
        if (metric.commonErrors.length > 2) {
          issues.push(`Multiple recurring errors: ${metric.commonErrors.length} types`);
          suggestions.push('Address root causes of common failures');
        }

        if (issues.length > 0) {
          underperforming.push({
            agentId: metric.agentId,
            agentType: metric.agentType,
            issues,
            suggestions,
          });
        }
      }

      return underperforming;
    } catch (error) {
      console.error('Error identifying underperforming agents:', error);
      return [];
    }
  }

  async suggestAgentImprovements(agentId: string): Promise<{
    currentPerformance: PerformanceMetrics;
    improvements: {
      type: string;
      description: string;
      expectedImpact: string;
      priority: number;
    }[];
  } | null> {
    try {
      const metrics = await this.getAgentMetrics(agentId);
      if (!metrics) return null;

      const improvements: {
        type: string;
        description: string;
        expectedImpact: string;
        priority: number;
      }[] = [];

      // Analyze performance patterns
      if (metrics.successRate < 80) {
        improvements.push({
          type: 'Error Handling',
          description: 'Improve error handling and validation logic',
          expectedImpact: `Increase success rate from ${metrics.successRate.toFixed(1)}% to 85%+`,
          priority: 9,
        });
      }

      if (metrics.averageExecutionTime > 180000) { // 3 minutes
        improvements.push({
          type: 'Performance',
          description: 'Optimize command execution and reduce complexity',
          expectedImpact: `Reduce execution time by 30-50%`,
          priority: 7,
        });
      }

      if (metrics.tokenEfficiency < 2) {
        improvements.push({
          type: 'Prompt Optimization',
          description: 'Refine prompts to be more focused and efficient',
          expectedImpact: `Improve token efficiency by 40%+`,
          priority: 6,
        });
      }

      // Check trends
      const recentTrend = metrics.improvementTrends[metrics.improvementTrends.length - 1];
      if (recentTrend && recentTrend.successRate < metrics.successRate - 10) {
        improvements.push({
          type: 'Trend Analysis',
          description: 'Recent performance decline detected - investigate recent changes',
          expectedImpact: 'Prevent further performance degradation',
          priority: 8,
        });
      }

      return {
        currentPerformance: metrics,
        improvements: improvements.sort((a, b) => b.priority - a.priority),
      };
    } catch (error) {
      console.error('Error suggesting agent improvements:', error);
      return null;
    }
  }

  private async updateAgentMetrics(agentId: string, agentType: string): Promise<void> {
    // This could update a cached metrics table for faster queries
    // For now, we'll rely on real-time calculations
  }

  private calculateTrends(performances: any[]): {
    period: string;
    executionTime: number;
    successRate: number;
  }[] {
    const trends: {
      period: string;
      executionTime: number;
      successRate: number;
    }[] = [];

    // Group by week for the last 4 weeks
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
      const weekEnd = new Date(weekStart.getTime() + (7 * 24 * 60 * 60 * 1000));
      
      const weekPerformances = performances.filter(p => {
        const timestamp = new Date(p.timestamp);
        return timestamp >= weekStart && timestamp < weekEnd;
      });

      if (weekPerformances.length > 0) {
        const avgExecutionTime = weekPerformances.reduce((sum, p) => sum + p.executionTime, 0) / weekPerformances.length;
        const successRate = (weekPerformances.filter(p => p.success).length / weekPerformances.length) * 100;

        trends.push({
          period: `Week of ${weekStart.toLocaleDateString()}`,
          executionTime: avgExecutionTime,
          successRate,
        });
      }
    }

    return trends;
  }

  async getGlobalMetrics(): Promise<{
    totalAgents: number;
    totalExecutions: number;
    averageSuccessRate: number;
    topPerformingAgents: { agentType: string; successRate: number }[];
    systemHealth: number;
  }> {
    try {
      const [totalAgents, allPerformances] = await Promise.all([
        prisma.agentSpecification.count(),
        prisma.agentPerformance.findMany({
          include: {
            agent: {
              select: { type: true },
            },
          },
          orderBy: { timestamp: 'desc' },
          take: 1000,
        }),
      ]);

      const totalExecutions = allPerformances.length;
      const successfulExecutions = allPerformances.filter(p => p.success).length;
      const averageSuccessRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

      // Group by agent type
      const agentTypePerformance = allPerformances.reduce((acc, p) => {
        const type = p.agent?.type || 'unknown';
        if (!acc[type]) {
          acc[type] = { total: 0, successful: 0 };
        }
        acc[type].total++;
        if (p.success) acc[type].successful++;
        return acc;
      }, {} as Record<string, { total: number; successful: number }>);

      const topPerformingAgents = Object.entries(agentTypePerformance)
        .map(([type, stats]) => ({
          agentType: type,
          successRate: (stats.successful / stats.total) * 100,
        }))
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 5);

      // Calculate system health (0-100)
      let systemHealth = 50; // Base score
      if (averageSuccessRate > 80) systemHealth += 30;
      else if (averageSuccessRate > 60) systemHealth += 20;
      else if (averageSuccessRate > 40) systemHealth += 10;

      if (totalExecutions > 100) systemHealth += 10;
      if (totalAgents > 5) systemHealth += 10;

      systemHealth = Math.min(100, systemHealth);

      return {
        totalAgents,
        totalExecutions,
        averageSuccessRate,
        topPerformingAgents,
        systemHealth,
      };
    } catch (error) {
      console.error('Error getting global metrics:', error);
      return {
        totalAgents: 0,
        totalExecutions: 0,
        averageSuccessRate: 0,
        topPerformingAgents: [],
        systemHealth: 0,
      };
    }
  }
}