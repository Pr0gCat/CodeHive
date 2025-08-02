import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getDefaultProjectId } from '@/lib/config';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || await getDefaultProjectId();
    
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
            tasks: {
              include: {
                cycles: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get pending queries
    const queries = await prisma.query.findMany({
      where: { 
        projectId,
        status: 'PENDING'
      },
      orderBy: { priority: 'desc' }
    });

    // Get token usage
    const tokenUsage = await prisma.tokenUsage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    // Calculate epic progress
    const epicsWithProgress = epics.map(epic => {
      const totalCycles = epic.stories.reduce((acc, story) => 
        acc + story.tasks.reduce((taskAcc, task) => 
          taskAcc + task.cycles.length, 0), 0);
      
      const completedCycles = epic.stories.reduce((acc, story) => 
        acc + story.tasks.reduce((taskAcc, task) => 
          taskAcc + task.cycles.filter(cycle => cycle.status === 'COMPLETED').length, 0), 0);
      
      const progress = totalCycles > 0 ? completedCycles / totalCycles : 0;
      
      // Find current work
      const activeCycle = epic.stories
        .flatMap(story => story.tasks)
        .flatMap(task => task.cycles)
        .find(cycle => cycle.status === 'IN_PROGRESS');
      
      return {
        id: epic.id,
        title: epic.title,
        progress,
        status: epic.status,
        currentWork: activeCycle ? `Working on: ${activeCycle.goal}` : 'Planning next work'
      };
    });

    // Format queries according to improved architecture
    const formattedQueries = queries.map(query => ({
      id: query.id,
      question: query.question,
      priority: query.priority,
      blockedCycles: 0, // TODO: Calculate actual blocked cycles
      context: query.context,
      createdAt: query.createdAt
    }));

    // Calculate resource status
    const currentUsage = tokenUsage[0];
    const tokensUsed = currentUsage?.tokensUsed || 0;
    const tokensRemaining = Math.max(0, 100000 - tokensUsed); // TODO: Get from config
    
    return NextResponse.json({
      epics: epicsWithProgress,
      queries: formattedQueries,
      resources: {
        tokensUsed,
        tokensRemaining,
        status: tokensRemaining > 10000 ? 'ACTIVE' : tokensRemaining > 1000 ? 'WARNING' : 'CRITICAL'
      },
      project: {
        id: projectId,
        lastActivity: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting progress overview:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get progress overview',
      },
      { status: 500 }
    );
  }
}