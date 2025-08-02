import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface GlobalSettings {
  dailyTokenLimit: number;
  warningThreshold: number;
  criticalThreshold: number;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId');

    // Get global settings
    const globalSettings = await prisma.globalSettings.findUnique({
      where: { id: 'global' },
    });

    if (!globalSettings) {
      return NextResponse.json(
        {
          success: false,
          error: 'Global settings not found',
        },
        { status: 404 }
      );
    }

    // Calculate today's start time
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (projectId) {
      // Get specific project monitoring data
      return await getProjectMonitorData(projectId, globalSettings, todayStart);
    } else {
      // Get global monitoring data
      return await getGlobalMonitorData(globalSettings, todayStart);
    }
  } catch (error) {
    console.error('Error fetching token monitor data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch monitor data',
      },
      { status: 500 }
    );
  }
}

async function getGlobalMonitorData(globalSettings: GlobalSettings, todayStart: Date) {
  // Get today's total usage across all projects
  const todayUsage = await prisma.tokenUsage.aggregate({
    where: {
      timestamp: {
        gte: todayStart,
      },
    },
    _sum: {
      inputTokens: true,
      outputTokens: true,
    },
    _count: {
      id: true,
    },
  });

  const totalTokensUsed =
    (todayUsage._sum.inputTokens || 0) + (todayUsage._sum.outputTokens || 0);
  const usagePercentage =
    (totalTokensUsed / globalSettings.dailyTokenLimit) * 100;

  // Get project-wise usage
  const projectUsage = await prisma.project.findMany({
    include: {
      budget: true,
      tokenUsage: {
        where: {
          timestamp: {
            gte: todayStart,
          },
        },
        select: {
          inputTokens: true,
          outputTokens: true,
        },
      },
    },
  });

  const projectData = projectUsage.map(project => {
    const usage = project.tokenUsage.reduce(
      (sum, token) => sum + token.inputTokens + token.outputTokens,
      0
    );
    const budget = project.budget?.dailyTokenBudget || 0;
    const percentage = budget > 0 ? (usage / budget) * 100 : 0;

    return {
      id: project.id,
      name: project.name,
      usedTokens: usage,
      budgetTokens: budget,
      allocatedPercentage: project.budget?.allocatedPercentage || 0,
      usagePercentage: percentage,
      status: getUsageStatus(percentage, globalSettings),
      isOverBudget: usage > budget,
    };
  });

  // Determine global status
  let globalStatus = 'safe';
  if (usagePercentage >= globalSettings.criticalThreshold * 100) {
    globalStatus = 'critical';
  } else if (usagePercentage >= globalSettings.warningThreshold * 100) {
    globalStatus = 'warning';
  }

  return NextResponse.json({
    success: true,
    data: {
      global: {
        totalTokensUsed,
        dailyLimit: globalSettings.dailyTokenLimit,
        usagePercentage,
        status: globalStatus,
        warningThreshold: globalSettings.warningThreshold * 100,
        criticalThreshold: globalSettings.criticalThreshold * 100,
        remainingTokens: globalSettings.dailyTokenLimit - totalTokensUsed,
        requestsToday: todayUsage._count.id || 0,
      },
      projects: projectData,
      summary: {
        totalProjects: projectData.length,
        projectsOverBudget: projectData.filter(p => p.isOverBudget).length,
        projectsNearLimit: projectData.filter(p => p.usagePercentage > 80)
          .length,
        averageUsage:
          projectData.length > 0
            ? projectData.reduce((sum, p) => sum + p.usagePercentage, 0) /
              projectData.length
            : 0,
      },
    },
  });
}

async function getProjectMonitorData(
  projectId: string,
  globalSettings: GlobalSettings,
  todayStart: Date
) {
  // Get project with budget and usage
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      budget: true,
      tokenUsage: {
        where: {
          timestamp: {
            gte: todayStart,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 100, // Last 100 usage records
      },
    },
  });

  if (!project) {
    return NextResponse.json(
      {
        success: false,
        error: 'Project not found',
      },
      { status: 404 }
    );
  }

  const totalUsage = project.tokenUsage.reduce(
    (sum, token) => sum + token.inputTokens + token.outputTokens,
    0
  );

  const budget = project.budget?.dailyTokenBudget || 0;
  const usagePercentage = budget > 0 ? (totalUsage / budget) * 100 : 0;

  // Get hourly usage for the chart
  const hourlyUsage = await getHourlyUsage(projectId, todayStart);

  return NextResponse.json({
    success: true,
    data: {
      project: {
        id: project.id,
        name: project.name,
        usedTokens: totalUsage,
        budgetTokens: budget,
        allocatedPercentage: project.budget?.allocatedPercentage || 0,
        usagePercentage,
        status: getUsageStatus(usagePercentage, globalSettings),
        isOverBudget: totalUsage > budget,
        remainingBudget: Math.max(0, budget - totalUsage),
        lastResetAt: project.budget?.lastResetAt || new Date(),
      },
      usage: {
        hourly: hourlyUsage,
        recent: project.tokenUsage.slice(0, 10).map(usage => ({
          timestamp: usage.timestamp,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.inputTokens + usage.outputTokens,
          agentType: usage.agentType,
        })),
      },
    },
  });
}

async function getHourlyUsage(projectId: string, todayStart: Date) {
  const hourlyData = [];
  const now = new Date();

  for (let hour = 0; hour < 24; hour++) {
    const hourStart = new Date(todayStart);
    hourStart.setHours(hour);
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hour + 1);

    if (hourStart > now) break; // Don't include future hours

    const usage = await prisma.tokenUsage.aggregate({
      where: {
        projectId,
        timestamp: {
          gte: hourStart,
          lt: hourEnd,
        },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
      },
      _count: {
        id: true,
      },
    });

    hourlyData.push({
      hour,
      tokens: (usage._sum.inputTokens || 0) + (usage._sum.outputTokens || 0),
      requests: usage._count.id || 0,
    });
  }

  return hourlyData;
}

function getUsageStatus(usagePercentage: number, globalSettings: GlobalSettings): string {
  if (usagePercentage >= globalSettings.criticalThreshold * 100) {
    return 'critical';
  } else if (usagePercentage >= globalSettings.warningThreshold * 100) {
    return 'warning';
  }
  return 'safe';
}
