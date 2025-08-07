import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { SQLiteManager } from '@/lib/portable/sqlite-manager';
import { NextResponse } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Lazy load prisma to ensure it's initialized
    const { prisma } = await import('@/lib/db');
    
    // Get all portable projects
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();

    // Transform data for the progress dashboard
    const projectProgress = await Promise.all(
      projects.map(async project => {
        let sqliteManager: SQLiteManager | null = null;
        
        try {
          // Get token usage for today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          
          const tokenUsage = await prisma.tokenUsage.findMany({
            where: {
              projectId: project.metadata.id,
              timestamp: {
                gte: todayStart
              }
            }
          });

          const todayTokenUsage = tokenUsage.reduce(
            (sum, usage) => sum + usage.inputTokens + usage.outputTokens,
            0
          );

          // Get token usage trend (compare with yesterday)
          const yesterdayStart = new Date(Date.now() - 48 * 60 * 60 * 1000);
          const yesterdayEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);

          const yesterdayUsage = await prisma.tokenUsage.aggregate({
            where: {
              projectId: project.metadata.id,
              timestamp: {
                gte: yesterdayStart,
                lt: yesterdayEnd,
              },
            },
            _sum: {
              inputTokens: true,
              outputTokens: true,
            },
          });

          const yesterdayTotal =
            (yesterdayUsage._sum.inputTokens || 0) +
            (yesterdayUsage._sum.outputTokens || 0);
          let trend: 'up' | 'down' | 'stable' = 'stable';

          if (todayTokenUsage > yesterdayTotal * 1.1) {
            trend = 'up';
          } else if (todayTokenUsage < yesterdayTotal * 0.9) {
            trend = 'down';
          }

          // Get task execution status
          const recentExecutions = await prisma.taskExecution.findMany({
            where: {
              projectId: project.metadata.id,
              createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
              }
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 5
          });

          const activeExecutions = recentExecutions.filter(
            exec => exec.status === 'RUNNING'
          ).length;

          const completedExecutions = recentExecutions.filter(
            exec => exec.status === 'COMPLETED'
          ).length;

          const failedExecutions = recentExecutions.filter(
            exec => exec.status === 'FAILED'
          ).length;

          // Get recent activity
          const recentActivity = await getRecentActivity(project.metadata.id, prisma);

          // Read kanban data from project's SQLite database
          let tasks = {
            backlog: 0,
            todo: 0,
            inProgress: 0,
            review: 0,
            done: 0,
          };

          let progressPercentage = 0;

          try {
            // Initialize SQLite manager for this project
            sqliteManager = new SQLiteManager(project.path, { readonly: true });
            await sqliteManager.initialize();

            // Get stories (kanban cards) from the project's SQLite database
            const stories = await sqliteManager.getStories();

            if (stories && stories.length > 0) {
              tasks = {
                backlog: stories.filter(story => story.status === 'BACKLOG').length,
                todo: stories.filter(story => story.status === 'TODO').length,
                inProgress: stories.filter(story => story.status === 'IN_PROGRESS').length,
                review: stories.filter(story => story.status === 'REVIEW').length,
                done: stories.filter(story => story.status === 'DONE').length,
              };

              const totalTasks = Object.values(tasks).reduce(
                (sum, count) => sum + count,
                0
              );
              const completedTasks = tasks.done;
              progressPercentage =
                totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            }
          } catch (error) {
            console.warn(`Failed to read kanban data for project ${project.metadata.name}:`, error);
            // Continue with zero values if kanban data cannot be read
          } finally {
            // Always close the SQLite connection
            if (sqliteManager) {
              sqliteManager.close();
            }
          }

          return {
            id: project.metadata.id,
            name: project.metadata.name,
            status: project.metadata.status || 'ACTIVE',
            progress: {
              completed: tasks.done,
              total: Object.values(tasks).reduce((sum, count) => sum + count, 0),
              percentage: progressPercentage,
            },
            tasks,
            activeAgents: activeExecutions,
            recentActivity,
            tokenUsage: {
              used: todayTokenUsage,
              trend,
            },
            executions: {
              active: activeExecutions,
              completed: completedExecutions,
              failed: failedExecutions,
            }
          };
        } catch (error) {
          console.warn(`Failed to get progress for project ${project.metadata.name}:`, error);
          // Return minimal progress data on error
          return {
            id: project.metadata.id,
            name: project.metadata.name,
            status: project.metadata.status || 'ACTIVE',
            progress: {
              completed: 0,
              total: 0,
              percentage: 0,
            },
            tasks: {
              backlog: 0,
              todo: 0,
              inProgress: 0,
              review: 0,
              done: 0,
            },
            activeAgents: 0,
            recentActivity: 'Unable to fetch activity',
            tokenUsage: {
              used: 0,
              trend: 'stable' as const,
            },
            executions: {
              active: 0,
              completed: 0,
              failed: 0,
            }
          };
        } finally {
          // Ensure SQLite connection is closed even on error
          if (sqliteManager) {
            sqliteManager.close();
          }
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: projectProgress,
    });
  } catch (error) {
    console.error('Error fetching project progress:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch project progress',
      },
      { status: 500 }
    );
  }
}

async function getRecentActivity(projectId: string, prisma: any): Promise<string> {
  try {
    // Check for recent task executions
    const recentExecution = await prisma.taskExecution.findFirst({
      where: {
        projectId: projectId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (
      recentExecution &&
      recentExecution.updatedAt > new Date(Date.now() - 60 * 60 * 1000)
    ) {
      return `Task "${recentExecution.name}" ${recentExecution.status.toLowerCase()} - ${formatTimeAgo(recentExecution.updatedAt)}`;
    }

    // Check for recent token usage
    const recentTokenUsage = await prisma.tokenUsage.findFirst({
      where: {
        projectId: projectId,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    if (
      recentTokenUsage &&
      recentTokenUsage.timestamp > new Date(Date.now() - 60 * 60 * 1000)
    ) {
      return `${recentTokenUsage.agentType || 'Agent'} activity - ${formatTimeAgo(recentTokenUsage.timestamp)}`;
    }

    return `No recent activity`;
  } catch {
    return 'No recent activity';
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}