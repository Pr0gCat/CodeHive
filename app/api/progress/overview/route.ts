import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getDefaultProjectId } from '@/lib/config';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
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

    // Get all epics with their progress
    const epics = await prisma.epic.findMany({
      where: { projectId },
      include: {
        stories: {
          include: {
            cycles: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get pending queries
    const queries = await prisma.query.findMany({
      where: {
        projectId,
        status: 'PENDING',
      },
      orderBy: { priority: 'desc' },
    });

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

    // Calculate epic progress
    const epicsWithProgress = epics.map(epic => {
      const totalStories = epic.stories.length;
      const completedStories = epic.stories.filter(
        story => story.status === 'DONE'
      ).length;
      const progress = totalStories > 0 ? completedStories / totalStories : 0;

      // Find current work
      const activeStory = epic.stories.find(
        story => story.status === 'IN_PROGRESS'
      );

      return {
        id: epic.id,
        title: epic.title,
        progress,
        status: epic.status,
        currentWork: activeStory
          ? `Working on: ${activeStory.title}`
          : 'Planning next work',
      };
    });

    // Format queries
    const formattedQueries = queries.map(query => ({
      id: query.id,
      question: query.question,
      priority: query.priority as 'HIGH' | 'MEDIUM' | 'LOW',
      blockedCycles: 0, // TODO: Calculate actual blocked cycles
      context: query.context,
      createdAt: query.createdAt.toISOString(),
    }));

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

    // Calculate real performance metrics
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // Get cycles completed today
    const cyclesCompletedToday = await prisma.cycle.count({
      where: {
        projectId,
        status: 'COMPLETED',
        completedAt: {
          gte: startOfDay,
        },
      },
    });

    // Get average cycle duration (in minutes)
    const completedCycles = await prisma.cycle.findMany({
      where: {
        projectId,
        status: 'COMPLETED',
        completedAt: { not: null },
      },
      select: {
        createdAt: true,
        completedAt: true,
      },
    });

    const avgCycleDuration =
      completedCycles.length > 0
        ? completedCycles.reduce((acc, cycle) => {
            const duration =
              cycle.completedAt!.getTime() - cycle.createdAt.getTime();
            return acc + duration;
          }, 0) /
          completedCycles.length /
          (1000 * 60) // Convert to minutes
        : 0;

    // Calculate burn rate (tokens per hour)
    const hoursSinceStartOfDay =
      (now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60);
    const burnRate =
      hoursSinceStartOfDay > 0
        ? Math.round(todayTokens / hoursSinceStartOfDay)
        : 0;

    // Calculate success rate (cycles completed vs failed)
    const totalCycles = await prisma.cycle.count({ where: { projectId } });
    const completedCyclesTotal = await prisma.cycle.count({
      where: { projectId, status: 'COMPLETED' },
    });
    const successRate =
      totalCycles > 0
        ? Math.round((completedCyclesTotal / totalCycles) * 100)
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

    return NextResponse.json({
      epics: epicsWithProgress,
      queries: formattedQueries,
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
        dailyCycles: cyclesCompletedToday,
        avgCycleDuration: Math.round(avgCycleDuration),
        successRate,
      },
      tokenUsage: {
        today: todayTokens,
        thisWeek: thisWeekTotal,
        thisMonth: thisMonthTotal,
      },
      project: {
        id: projectId,
        lastActivity: new Date().toISOString(),
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
