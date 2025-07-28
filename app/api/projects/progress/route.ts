import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Fetch projects with their related data
    const projects = await prisma.project.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'PAUSED'] // Only show active and paused projects
        }
      },
      include: {
        kanbanCards: true,
        tokenUsage: {
          where: {
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        },
        queuedTasks: {
          where: {
            status: {
              in: ['PENDING', 'RUNNING']
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Transform data for the progress dashboard
    const projectProgress = await Promise.all(
      projects.map(async (project) => {
        // Calculate task progress
        const tasks = {
          backlog: project.kanbanCards.filter(card => card.status === 'BACKLOG').length,
          todo: project.kanbanCards.filter(card => card.status === 'TODO').length,
          inProgress: project.kanbanCards.filter(card => card.status === 'IN_PROGRESS').length,
          review: project.kanbanCards.filter(card => card.status === 'REVIEW').length,
          done: project.kanbanCards.filter(card => card.status === 'DONE').length,
        };

        const totalTasks = Object.values(tasks).reduce((sum, count) => sum + count, 0);
        const completedTasks = tasks.done;
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Calculate token usage for today
        const todayTokenUsage = project.tokenUsage.reduce((sum, usage) => sum + usage.inputTokens + usage.outputTokens, 0);
        
        // Get token usage trend (compare with yesterday)
        const yesterdayStart = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const yesterdayEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const yesterdayUsage = await prisma.tokenUsage.aggregate({
          where: {
            projectId: project.id,
            timestamp: {
              gte: yesterdayStart,
              lt: yesterdayEnd
            }
          },
          _sum: {
            inputTokens: true,
            outputTokens: true
          }
        });

        const yesterdayTotal = (yesterdayUsage._sum.inputTokens || 0) + (yesterdayUsage._sum.outputTokens || 0);
        let trend: 'up' | 'down' | 'stable' = 'stable';
        
        if (todayTokenUsage > yesterdayTotal * 1.1) {
          trend = 'up';
        } else if (todayTokenUsage < yesterdayTotal * 0.9) {
          trend = 'down';
        }

        // Get recent activity
        const recentActivity = await getRecentActivity(project.id);

        return {
          id: project.id,
          name: project.name,
          status: project.status,
          progress: {
            completed: completedTasks,
            total: totalTasks,
            percentage: progressPercentage
          },
          tasks,
          activeAgents: project.queuedTasks.length,
          recentActivity,
          tokenUsage: {
            used: todayTokenUsage,
            trend
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: projectProgress
    });

  } catch (error) {
    console.error('Error fetching project progress:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch project progress'
      },
      { status: 500 }
    );
  }
}

async function getRecentActivity(projectId: string): Promise<string> {
  try {
    // Check for recent agent tasks
    const recentAgentTask = await prisma.agentTask.findFirst({
      where: {
        card: {
          projectId: projectId
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (recentAgentTask && recentAgentTask.createdAt > new Date(Date.now() - 60 * 60 * 1000)) {
      return `Agent ${recentAgentTask.agentType} ${recentAgentTask.status.toLowerCase()} - ${formatTimeAgo(recentAgentTask.createdAt)}`;
    }

    // Check for recent card updates
    const recentCard = await prisma.kanbanCard.findFirst({
      where: {
        projectId: projectId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    if (recentCard && recentCard.updatedAt > new Date(Date.now() - 60 * 60 * 1000)) {
      return `Card "${recentCard.title}" updated - ${formatTimeAgo(recentCard.updatedAt)}`;
    }

    // Check for queued tasks
    const queuedTask = await prisma.queuedTask.findFirst({
      where: {
        projectId: projectId,
        status: 'PENDING'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (queuedTask) {
      return `${queuedTask.agentType} task queued - ${formatTimeAgo(queuedTask.createdAt)}`;
    }

    return `Last updated ${formatTimeAgo(new Date())}`;
  } catch (error) {
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