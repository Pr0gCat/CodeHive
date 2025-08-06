import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { globalSettingsManager } from '@/lib/portable/global-settings-manager';
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
    const globalSettings = await globalSettingsManager.getGlobalSettings();

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

async function getGlobalMonitorData(
  globalSettings: GlobalSettings,
  todayStart: Date
) {
  // Get all portable projects
  const discoveryService = getProjectDiscoveryService();
  const projects = await discoveryService.discoverProjects();

  let totalTokensUsed = 0;
  let totalRequestsToday = 0;
  const projectData = [];

  // Process each project to get usage data
  for (const project of projects) {
    try {
      // Find corresponding database project
      const dbProject = await prisma.project.findFirst({
        where: {
          OR: [
            { id: project.metadata.id },
            { localPath: project.path }
          ]
        },
        include: {
          budget: true,
          tokenUsage: true
        }
      });

      // Get project budget from database
      const budget = dbProject?.budget || null;

      // Get token usage for today from database
      const tokenUsage = dbProject?.tokenUsage || [];

      // Filter usage for today
      const todayUsage = tokenUsage.filter(usage => {
        const usageDate = new Date(usage.timestamp);
        return usageDate >= todayStart;
      });

      // Calculate project totals
      const projectTokensUsed = todayUsage.reduce(
        (sum, usage) => sum + usage.inputTokens + usage.outputTokens,
        0
      );
      const projectRequestsToday = todayUsage.length;

      // Add to global totals
      totalTokensUsed += projectTokensUsed;
      totalRequestsToday += projectRequestsToday;

      // Calculate project stats
      const budgetTokens = budget?.dailyTokenBudget || 0;
      const percentage = budgetTokens > 0 ? (projectTokensUsed / budgetTokens) * 100 : 0;

      projectData.push({
        id: project.metadata.id,
        name: project.metadata.name,
        usedTokens: projectTokensUsed,
        budgetTokens,
        allocatedPercentage: budget?.allocatedPercentage || 0,
        usagePercentage: percentage,
        status: getUsageStatus(percentage, globalSettings),
        isOverBudget: projectTokensUsed > budgetTokens,
      });
    } catch (error) {
      console.warn(`Failed to get monitoring data for project ${project.metadata.name}:`, error);
      // Add project with zero usage to maintain visibility
      projectData.push({
        id: project.metadata.id,
        name: project.metadata.name,
        usedTokens: 0,
        budgetTokens: 0,
        allocatedPercentage: 0,
        usagePercentage: 0,
        status: 'safe',
        isOverBudget: false,
      });
    }
  }

  // Calculate global stats
  const usagePercentage = (totalTokensUsed / globalSettings.dailyTokenLimit) * 100;

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
        requestsToday: totalRequestsToday,
      },
      projects: projectData,
      summary: {
        totalProjects: projectData.length,
        projectsOverBudget: projectData.filter(p => p.isOverBudget).length,
        projectsNearLimit: projectData.filter(p => p.usagePercentage > 80).length,
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
  // Find project in database first
  const dbProject = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      budget: true,
      tokenUsage: true
    }
  });

  if (!dbProject) {
    return NextResponse.json(
      {
        success: false,
        error: 'Project not found',
      },
      { status: 404 }
    );
  }

  // Get project budget from database
  const budget = dbProject.budget || null;

  // Get token usage from database
  const allTokenUsage = dbProject.tokenUsage || [];

  // Filter for today's usage
  const todayUsage = allTokenUsage.filter(usage => {
    const usageDate = new Date(usage.timestamp);
    return usageDate >= todayStart;
  });

  // Sort by timestamp descending
  todayUsage.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const totalUsage = todayUsage.reduce(
    (sum, usage) => sum + usage.inputTokens + usage.outputTokens,
    0
  );

  const budgetTokens = budget?.dailyTokenBudget || 0;
  const usagePercentage = budgetTokens > 0 ? (totalUsage / budgetTokens) * 100 : 0;

  // Get hourly usage for the chart
  const hourlyUsage = await getPortableHourlyUsage(allTokenUsage, todayStart);

  return NextResponse.json({
    success: true,
    data: {
      project: {
        id: dbProject.id,
        name: dbProject.name,
        usedTokens: totalUsage,
        budgetTokens,
        allocatedPercentage: budget?.allocatedPercentage || 0,
        usagePercentage,
        status: getUsageStatus(usagePercentage, globalSettings),
        isOverBudget: totalUsage > budgetTokens,
        remainingBudget: Math.max(0, budgetTokens - totalUsage),
        lastResetAt: budget?.lastResetAt || new Date(),
      },
      usage: {
        hourly: hourlyUsage,
        recent: todayUsage.slice(0, 10).map(usage => ({
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

async function getPortableHourlyUsage(tokenUsage: any[], todayStart: Date) {
  const hourlyData = [];
  const now = new Date();

  for (let hour = 0; hour < 24; hour++) {
    const hourStart = new Date(todayStart);
    hourStart.setHours(hour);
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hour + 1);

    if (hourStart > now) break; // Don't include future hours

    // Filter usage for this hour
    const hourUsage = tokenUsage.filter(usage => {
      const usageDate = new Date(usage.timestamp);
      return usageDate >= hourStart && usageDate < hourEnd;
    });

    // Calculate totals for this hour
    const tokens = hourUsage.reduce(
      (sum, usage) => sum + usage.inputTokens + usage.outputTokens,
      0
    );
    const requests = hourUsage.length;

    hourlyData.push({
      hour,
      tokens,
      requests,
    });
  }

  return hourlyData;
}

function getUsageStatus(
  usagePercentage: number,
  globalSettings: GlobalSettings
): string {
  if (usagePercentage >= globalSettings.criticalThreshold * 100) {
    return 'critical';
  } else if (usagePercentage >= globalSettings.warningThreshold * 100) {
    return 'warning';
  }
  return 'safe';
}
