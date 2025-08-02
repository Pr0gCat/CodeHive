import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get all projects with their current stats
    const projects = await prisma.project.findMany({
      include: {
        budget: true,
        tokenUsage: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        },
        epics: {
          include: {
            stories: true
          }
        }
      }
    });

    // Calculate portfolio statistics
    const portfolioStats = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'ACTIVE').length,
      pausedProjects: projects.filter(p => p.status === 'PAUSED').length,
      completedProjects: projects.filter(p => p.status === 'COMPLETED').length,
      archivedProjects: projects.filter(p => p.status === 'ARCHIVED').length,
      totalTokensUsed: projects.reduce((sum, p) => sum + (p.budget?.usedTokens || 0), 0),
      totalTokensRemaining: projects.reduce((sum, p) => sum + (p.budget?.dailyTokenBudget || 0) - (p.budget?.usedTokens || 0), 0),
      dailyBurnRate: projects.reduce((sum, p) => {
        const dailyUsage = p.tokenUsage.reduce((usage, tu) => usage + tu.tokensUsed, 0);
        return sum + dailyUsage;
      }, 0),
      averageProgress: projects.length > 0 ? projects.reduce((sum, p) => {
        const totalStories = p.epics.reduce((count, epic) => count + epic.stories.length, 0);
        const completedStories = p.epics.reduce((count, epic) => 
          count + epic.stories.filter(story => story.status === 'COMPLETED').length, 0
        );
        const progress = totalStories > 0 ? (completedStories / totalStories) * 100 : 0;
        return sum + progress;
      }, 0) / projects.length : 0
    };

    return NextResponse.json({
      success: true,
      data: portfolioStats
    });
  } catch (error) {
    console.error('Error fetching portfolio data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch portfolio data'
      },
      { status: 500 }
    );
  }
}