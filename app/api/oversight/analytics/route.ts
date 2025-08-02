import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';

    // Calculate date range
    const getDaysFromRange = (range: string) => {
      switch (range) {
        case '7d': return 7;
        case '30d': return 30;
        case '90d': return 90;
        case '1y': return 365;
        default: return 30;
      }
    };

    const days = getDaysFromRange(range);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get token usage data
    const tokenUsage = await prisma.tokenUsage.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      },
      include: {
        project: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Get project performance data
    const projects = await prisma.project.findMany({
      include: {
        epics: {
          include: {
            stories: true
          }
        },
        cycles: {
          where: {
            createdAt: {
              gte: startDate
            }
          }
        }
      }
    });

    // Process daily token usage
    const dailyUsage = [];
    const dateMap = new Map();

    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dateMap.set(dateStr, { date: dateStr, used: 0, projects: new Set() });
    }

    tokenUsage.forEach(usage => {
      const dateStr = usage.createdAt.toISOString().split('T')[0];
      if (dateMap.has(dateStr)) {
        const day = dateMap.get(dateStr);
        day.used += usage.tokensUsed;
        day.projects.add(usage.projectId);
      }
    });

    Array.from(dateMap.values()).forEach(day => {
      day.projects = day.projects.size;
      dailyUsage.push(day);
    });

    // Process token usage by project
    const projectUsageMap = new Map();
    let totalTokens = 0;

    tokenUsage.forEach(usage => {
      const projectName = usage.project.name;
      if (!projectUsageMap.has(projectName)) {
        projectUsageMap.set(projectName, 0);
      }
      projectUsageMap.set(projectName, projectUsageMap.get(projectName) + usage.tokensUsed);
      totalTokens += usage.tokensUsed;
    });

    const byProject = Array.from(projectUsageMap.entries())
      .map(([name, used]) => ({
        name,
        used,
        percentage: totalTokens > 0 ? Math.round((used / totalTokens) * 100) : 0
      }))
      .sort((a, b) => b.used - a.used);

    // Calculate trends
    const recentUsage = dailyUsage.slice(-7);
    const previousUsage = dailyUsage.slice(-14, -7);
    const recentAvg = recentUsage.reduce((sum, day) => sum + day.used, 0) / 7;
    const previousAvg = previousUsage.reduce((sum, day) => sum + day.used, 0) / 7;
    const weeklyChange = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

    const trends = {
      weeklyChange: Math.round(weeklyChange),
      monthlyAverage: Math.round(dailyUsage.reduce((sum, day) => sum + day.used, 0) / dailyUsage.length),
      peakUsage: Math.max(...dailyUsage.map(day => day.used)),
      efficiency: Math.round(Math.random() * 20 + 80) // Mock efficiency calculation
    };

    // Process project performance
    const completionRates = projects.map(project => {
      const totalEpics = project.epics.length;
      const completedEpics = project.epics.filter(epic => epic.status === 'COMPLETED').length;
      const rate = totalEpics > 0 ? Math.round((completedEpics / totalEpics) * 100) : 0;
      
      return {
        project: project.name,
        rate,
        epics: totalEpics
      };
    });

    const cycleTimes = projects.map(project => {
      const completedCycles = project.cycles.filter(cycle => cycle.status === 'COMPLETED');
      const avgTime = completedCycles.length > 0 
        ? completedCycles.reduce((sum, cycle) => {
            const duration = cycle.updatedAt.getTime() - cycle.createdAt.getTime();
            return sum + (duration / (1000 * 60 * 60)); // Convert to hours
          }, 0) / completedCycles.length
        : 0;

      return {
        project: project.name,
        avgTime: Math.round(avgTime * 10) / 10,
        cycles: completedCycles.length
      };
    });

    // Mock bottlenecks (would be calculated from real data)
    const bottlenecks = projects
      .filter(project => {
        const stuckCycles = project.cycles.filter(cycle => 
          cycle.status !== 'COMPLETED' && 
          new Date().getTime() - cycle.createdAt.getTime() > 24 * 60 * 60 * 1000
        );
        return stuckCycles.length > 0;
      })
      .slice(0, 3)
      .map(project => ({
        project: project.name,
        issue: '循環時間過長',
        impact: '高'
      }));

    // Mock agent performance data
    const agentPerformance = {
      successRates: [
        { agent: 'Project Manager', rate: 95, tasks: 142 },
        { agent: 'TDD Developer', rate: 87, tasks: 89 },
        { agent: 'Code Reviewer', rate: 92, tasks: 76 },
        { agent: 'Git Operations', rate: 98, tasks: 234 },
        { agent: 'Documentation', rate: 89, tasks: 45 }
      ],
      usagePatterns: [
        { agent: 'Project Manager', hours: 24.5, efficiency: 94 },
        { agent: 'TDD Developer', hours: 45.2, efficiency: 87 },
        { agent: 'Code Reviewer', hours: 18.7, efficiency: 92 },
        { agent: 'Git Operations', hours: 12.3, efficiency: 98 },
        { agent: 'Documentation', hours: 8.9, efficiency: 89 }
      ]
    };

    // Mock time metrics
    const timeMetrics = {
      peakHours: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        activity: Math.floor(Math.random() * 100)
      })),
      weeklyPatterns: [
        { day: '週一', activity: 85 },
        { day: '週二', activity: 92 },
        { day: '週三', activity: 88 },
        { day: '週四', activity: 95 },
        { day: '週五', activity: 78 },
        { day: '週六', activity: 32 },
        { day: '週日', activity: 28 }
      ],
      responseTime: {
        average: 245,
        p95: 890,
        p99: 1540
      }
    };

    const analyticsData = {
      tokenUsage: {
        daily: dailyUsage.reverse(),
        byProject,
        trends
      },
      projectPerformance: {
        completionRates,
        cycleTimes,
        bottlenecks
      },
      agentPerformance,
      timeMetrics
    };

    return NextResponse.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics data'
      },
      { status: 500 }
    );
  }
}