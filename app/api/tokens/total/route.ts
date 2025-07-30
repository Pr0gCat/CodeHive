import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Get total tokens across all projects
    const tokenStats = await prisma.tokenUsage.aggregate({
      _sum: {
        inputTokens: true,
        outputTokens: true,
      },
      _count: {
        id: true,
      },
    });

    // Get today's token usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStats = await prisma.tokenUsage.aggregate({
      where: {
        timestamp: {
          gte: today,
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

    // Get this week's token usage
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)

    const weekStats = await prisma.tokenUsage.aggregate({
      where: {
        timestamp: {
          gte: weekStart,
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

    // Get token usage by agent type
    const agentStats = await prisma.tokenUsage.groupBy({
      by: ['agentType'],
      _sum: {
        inputTokens: true,
        outputTokens: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          inputTokens: 'desc',
        },
      },
    });

    const totalTokens =
      (tokenStats._sum.inputTokens || 0) + (tokenStats._sum.outputTokens || 0);
    const todayTokens =
      (todayStats._sum.inputTokens || 0) + (todayStats._sum.outputTokens || 0);
    const weekTokens =
      (weekStats._sum.inputTokens || 0) + (weekStats._sum.outputTokens || 0);

    return NextResponse.json({
      success: true,
      data: {
        total: {
          tokens: totalTokens,
          inputTokens: tokenStats._sum.inputTokens || 0,
          outputTokens: tokenStats._sum.outputTokens || 0,
          requests: tokenStats._count.id || 0,
        },
        today: {
          tokens: todayTokens,
          inputTokens: todayStats._sum.inputTokens || 0,
          outputTokens: todayStats._sum.outputTokens || 0,
          requests: todayStats._count.id || 0,
        },
        week: {
          tokens: weekTokens,
          inputTokens: weekStats._sum.inputTokens || 0,
          outputTokens: weekStats._sum.outputTokens || 0,
          requests: weekStats._count.id || 0,
        },
        byAgent: agentStats.map(stat => ({
          agentType: stat.agentType,
          tokens: (stat._sum.inputTokens || 0) + (stat._sum.outputTokens || 0),
          inputTokens: stat._sum.inputTokens || 0,
          outputTokens: stat._sum.outputTokens || 0,
          requests: stat._count.id || 0,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching token statistics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch token statistics',
      },
      { status: 500 }
    );
  }
}
