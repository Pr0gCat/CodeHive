import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get all projects with enhanced data for monitoring
    const projects = await prisma.project.findMany({
      include: {
        budget: true,
        tokenUsage: {
          orderBy: {
            timestamp: 'desc',
          },
          take: 10,
        },
        epics: {
          include: {
            stories: true,
          },
        },
        cycles: {
          where: {
            status: {
              in: ['RED', 'GREEN', 'REFACTOR', 'REVIEW'],
            },
          },
        },
        queries: {
          where: {
            status: 'PENDING',
          },
        },
      },
    });

    // Transform projects with enhanced monitoring data
    const enhancedProjects = projects.map(project => {
      const totalEpics = project.epics.length;
      const completedEpics = project.epics.filter(
        epic => epic.status === 'COMPLETED'
      ).length;
      const progressPercentage =
        totalEpics > 0 ? (completedEpics / totalEpics) * 100 : 0;

      const usedTokens = project.budget?.usedTokens || 0;
      const totalBudget = project.budget?.dailyTokenBudget || 1;
      const tokenUsagePercentage = (usedTokens / totalBudget) * 100;

      const lastActivity =
        project.tokenUsage[0]?.timestamp || project.updatedAt;
      const activeCycles = project.cycles.length;

      // Generate alerts based on project status
      const alerts = [];

      if (tokenUsagePercentage >= 90) {
        alerts.push({
          type: 'error' as const,
          message: 'Token 使用量接近限制',
        });
      } else if (tokenUsagePercentage >= 75) {
        alerts.push({
          type: 'warning' as const,
          message: 'Token 使用量較高',
        });
      }

      if (project.queries.length > 0) {
        alerts.push({
          type: 'warning' as const,
          message: `${project.queries.length} 個查詢待處理`,
        });
      }

      if (
        new Date().getTime() - new Date(lastActivity).getTime() >
        7 * 24 * 60 * 60 * 1000
      ) {
        alerts.push({
          type: 'info' as const,
          message: '超過 7 天無活動',
        });
      }

      return {
        ...project,
        tokenUsage: {
          used: usedTokens,
          remaining: Math.max(0, totalBudget - usedTokens),
          percentage: Math.min(100, tokenUsagePercentage),
        },
        progress: {
          epicsCompleted: completedEpics,
          totalEpics: totalEpics,
          percentage: Math.round(progressPercentage),
        },
        activity: {
          lastActivity: lastActivity.toISOString(),
          recentCommits: project.tokenUsage.length, // Use token usage as proxy for activity
          activeCycles: activeCycles,
        },
        alerts: alerts,
      };
    });

    return NextResponse.json({
      success: true,
      data: enhancedProjects,
    });
  } catch (error) {
    console.error('Error fetching enhanced projects:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch project monitoring data',
      },
      { status: 500 }
    );
  }
}
