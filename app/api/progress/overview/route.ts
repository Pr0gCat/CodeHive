import { NextRequest, NextResponse } from 'next/server';
import { getDefaultProjectId } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    // Lazy load prisma to ensure it's initialized
    const { prisma } = await import('@/lib/db');
    const { searchParams } = new URL(request.url);
    const projectId =
      searchParams.get('projectId') || (await getDefaultProjectId());

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No project available. Please create a project first.',
        },
        { status: 400 }
      );
    }

    // Get project info from ProjectIndex
    const project = await prisma.projectIndex.findUnique({
      where: { id: projectId },
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

    // Get real token usage for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tokenUsageToday = await prisma.tokenUsage.findMany({
      where: {
        projectId,
        timestamp: {
          gte: today,
        },
      },
    });

    // Get project budget for real token limits
    const projectBudget = await prisma.projectBudget.findUnique({
      where: { projectId },
    });

    // Get global settings as fallback
    const globalSettings = await prisma.globalSettings.findUnique({
      where: { id: 'global' },
    });

    // Calculate real token usage with real limits
    const todayTokens = tokenUsageToday.reduce(
      (sum, usage) => sum + usage.inputTokens + usage.outputTokens,
      0
    );
    const dailyLimit =
      projectBudget?.dailyTokenBudget ||
      globalSettings?.dailyTokenLimit ||
      100000;
    const tokensRemaining = Math.max(0, dailyLimit - todayTokens);

    // Calculate burn rate (tokens per hour)
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const hoursSinceStartOfDay =
      (now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60);
    const burnRate =
      hoursSinceStartOfDay > 0
        ? Math.round(todayTokens / hoursSinceStartOfDay)
        : 0;

    // Get real historical token usage
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const weeklyTokens = await prisma.tokenUsage.findMany({
      where: {
        projectId,
        timestamp: { gte: weekAgo },
      },
    });

    const monthlyTokens = await prisma.tokenUsage.findMany({
      where: {
        projectId,
        timestamp: { gte: monthAgo },
      },
    });

    const thisWeekTotal = weeklyTokens.reduce(
      (sum, usage) => sum + usage.inputTokens + usage.outputTokens,
      0
    );
    const thisMonthTotal = monthlyTokens.reduce(
      (sum, usage) => sum + usage.inputTokens + usage.outputTokens,
      0
    );

    // Get current task executions for activity
    const recentTasks = await prisma.taskExecution.findMany({
      where: { projectId },
      orderBy: { lastUpdatedAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      epics: [], // No epics in simplified schema
      queries: [], // No queries in simplified schema  
      resources: {
        tokensUsed: todayTokens,
        tokensRemaining,
        status:
          tokensRemaining > 10000
            ? 'ACTIVE'
            : tokensRemaining > 1000
              ? 'WARNING'
              : 'CRITICAL',
      },
      performance: {
        burnRate,
        dailyCycles: 0, // No cycles in simplified schema
        avgCycleDuration: 0,
        successRate: 100, // Default success rate
      },
      tokenUsage: {
        today: todayTokens,
        thisWeek: thisWeekTotal,
        thisMonth: thisMonthTotal,
      },
      project: {
        id: projectId,
        name: project.name,
        lastActivity: recentTasks[0]?.lastUpdatedAt.toISOString() || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting progress overview:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get progress overview',
      },
      { status: 500 }
    );
  }
}
