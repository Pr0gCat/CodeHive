import { NextRequest, NextResponse } from 'next/server';
import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { SQLiteManager } from '@/lib/portable/sqlite-manager';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Lazy load prisma to ensure it's initialized
    const { prisma } = await import('@/lib/db');
    
    // Get all portable projects
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();

    // Calculate today's start time for token usage
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Initialize portfolio statistics
    let totalTokensUsed = 0;
    let totalTokensRemaining = 0;
    let dailyBurnRate = 0;
    let totalProgress = 0;
    let projectsWithProgress = 0;
    
    const statusCounts = {
      active: 0,
      paused: 0,
      completed: 0,
      archived: 0,
    };

    // Process each project to gather statistics
    for (const project of projects) {
      let sqliteManager: SQLiteManager | null = null;
      
      try {
        // Count project status
        const status = (project.metadata.status || 'ACTIVE').toLowerCase();
        if (status in statusCounts) {
          statusCounts[status as keyof typeof statusCounts]++;
        }

        // Get token usage from central database
        const tokenUsage = await prisma.tokenUsage.findMany({
          where: {
            projectId: project.metadata.id,
            timestamp: {
              gte: todayStart
            }
          }
        });

        const projectDailyUsage = tokenUsage.reduce(
          (sum, usage) => sum + usage.inputTokens + usage.outputTokens,
          0
        );
        
        dailyBurnRate += projectDailyUsage;
        totalTokensUsed += projectDailyUsage;

        // Get budget from project settings
        const projectSettings = project.settings || {};
        const budgetTokens = projectSettings.dailyTokenBudget || 0;
        const remainingTokens = Math.max(0, budgetTokens - projectDailyUsage);
        totalTokensRemaining += remainingTokens;

        // Get progress from project's SQLite database (stories/kanban cards)
        try {
          sqliteManager = new SQLiteManager(project.path, { readonly: true });
          await sqliteManager.initialize();

          // Get stories to calculate progress
          const stories = await sqliteManager.getStories();
          
          if (stories && stories.length > 0) {
            const completedStories = stories.filter(
              story => story.status === 'DONE' || story.status === 'COMPLETED'
            ).length;
            const progress = (completedStories / stories.length) * 100;
            totalProgress += progress;
            projectsWithProgress++;
          }

          // Also check for epics if stories are empty
          if (!stories || stories.length === 0) {
            const epics = await sqliteManager.getEpics();
            if (epics && epics.length > 0) {
              const completedEpics = epics.filter(
                epic => epic.status === 'COMPLETED' || epic.phase === 'DONE'
              ).length;
              const progress = (completedEpics / epics.length) * 100;
              totalProgress += progress;
              projectsWithProgress++;
            }
          }
        } catch (error) {
          console.warn(`Failed to read progress data for project ${project.metadata.name}:`, error);
          // Continue without progress data for this project
        } finally {
          if (sqliteManager) {
            sqliteManager.close();
          }
        }
      } catch (error) {
        console.warn(`Failed to process project ${project.metadata.name}:`, error);
      } finally {
        if (sqliteManager) {
          sqliteManager.close();
        }
      }
    }

    // Calculate average progress
    const averageProgress = projectsWithProgress > 0 
      ? totalProgress / projectsWithProgress 
      : 0;

    // Get global token usage statistics for all time
    const allTimeTokenUsage = await prisma.tokenUsage.aggregate({
      _sum: {
        inputTokens: true,
        outputTokens: true,
      },
    });

    const allTimeTokensUsed = 
      (allTimeTokenUsage._sum.inputTokens || 0) + 
      (allTimeTokenUsage._sum.outputTokens || 0);

    // Calculate portfolio statistics
    const portfolioStats = {
      totalProjects: projects.length,
      activeProjects: statusCounts.active,
      pausedProjects: statusCounts.paused,
      completedProjects: statusCounts.completed,
      archivedProjects: statusCounts.archived,
      totalTokensUsed: allTimeTokensUsed,
      totalTokensRemaining,
      dailyBurnRate,
      averageProgress,
      todayTokensUsed: totalTokensUsed,
      projectsWithData: projectsWithProgress,
    };

    return NextResponse.json({
      success: true,
      data: portfolioStats,
    });
  } catch (error) {
    console.error('Error fetching portfolio data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch portfolio data',
      },
      { status: 500 }
    );
  }
}