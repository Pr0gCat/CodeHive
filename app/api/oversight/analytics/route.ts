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
        timestamp: {
          gte: startDate
        }
      },
      include: {
        project: true
      },
      orderBy: {
        timestamp: 'asc'
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
    const dailyUsage: Array<{ date: string; used: number; projects: number }> = [];
    const dateMap = new Map();

    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dateMap.set(dateStr, { date: dateStr, used: 0, projects: new Set() });
    }

    tokenUsage.forEach(usage => {
      const dateStr = usage.timestamp.toISOString().split('T')[0];
      if (dateMap.has(dateStr)) {
        const day = dateMap.get(dateStr);
        day.used += usage.inputTokens + usage.outputTokens;
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
      projectUsageMap.set(projectName, projectUsageMap.get(projectName) + usage.inputTokens + usage.outputTokens);
      totalTokens += usage.inputTokens + usage.outputTokens;
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

    // Calculate real efficiency based on agent task success rates
    const agentTasks = await prisma.agentTask.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      }
    });

    const totalTasks = agentTasks.length;
    const completedTasks = agentTasks.filter(task => task.status === 'COMPLETED').length;
    const realEfficiency = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const trends = {
      weeklyChange: Math.round(weeklyChange),
      monthlyAverage: Math.round(dailyUsage.reduce((sum, day) => sum + day.used, 0) / dailyUsage.length),
      peakUsage: Math.max(...dailyUsage.map(day => day.used)),
      efficiency: realEfficiency
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

    // Calculate real agent performance data
    const agentPerformanceMap = new Map();
    
    agentTasks.forEach(task => {
      const agentType = task.agentType;
      if (!agentPerformanceMap.has(agentType)) {
        agentPerformanceMap.set(agentType, {
          total: 0,
          completed: 0,
          totalHours: 0,
          completedTasks: []
        });
      }
      
      const stats = agentPerformanceMap.get(agentType);
      stats.total += 1;
      
      if (task.status === 'COMPLETED') {
        stats.completed += 1;
        if (task.startedAt && task.completedAt) {
          const hours = (task.completedAt.getTime() - task.startedAt.getTime()) / (1000 * 60 * 60);
          stats.totalHours += hours;
          stats.completedTasks.push(task);
        }
      }
    });

    const successRates = Array.from(agentPerformanceMap.entries()).map(([agent, stats]) => ({
      agent,
      rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      tasks: stats.total
    }));

    const usagePatterns = Array.from(agentPerformanceMap.entries()).map(([agent, stats]) => ({
      agent,
      hours: stats.completedTasks.length > 0 ? Math.round((stats.totalHours / stats.completedTasks.length) * 10) / 10 : 0,
      efficiency: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
    }));

    const agentPerformance = {
      successRates,
      usagePatterns
    };

    // Calculate real peak hours from token usage data
    const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({ hour, activity: 0 }));
    
    tokenUsage.forEach(usage => {
      const hour = usage.timestamp.getHours();
      hourlyActivity[hour].activity += usage.inputTokens + usage.outputTokens;
    });

    const timeMetrics = {
      peakHours: hourlyActivity,
      weeklyPatterns: (() => {
        const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
        const weeklyData = Array.from({ length: 7 }, (_, day) => ({ day: weekdays[day], activity: 0 }));
        
        tokenUsage.forEach(usage => {
          const dayOfWeek = usage.timestamp.getDay(); // 0 = Sunday, 1 = Monday, etc.
          weeklyData[dayOfWeek].activity += usage.inputTokens + usage.outputTokens;
        });
        
        return weeklyData;
      })(),
      responseTime: (() => {
        const completedTasksWithTiming = agentTasks.filter(task => 
          task.status === 'COMPLETED' && task.startedAt && task.completedAt
        );
        
        if (completedTasksWithTiming.length === 0) {
          return { average: 0, p95: 0, p99: 0 };
        }
        
        const responseTimes = completedTasksWithTiming.map(task => 
          (task.completedAt!.getTime() - task.startedAt!.getTime()) / 1000 // Convert to seconds
        ).sort((a, b) => a - b);
        
        const average = Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length);
        const p95Index = Math.floor(responseTimes.length * 0.95);
        const p99Index = Math.floor(responseTimes.length * 0.99);
        
        return {
          average,
          p95: Math.round(responseTimes[p95Index] || 0),
          p99: Math.round(responseTimes[p99Index] || 0)
        };
      })()
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