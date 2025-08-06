/**
 * Project Index API - Direct access to system database project index
 * Provides fast queries without scanning filesystem
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProjectIndexService } from '@/lib/db/project-index';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const orderBy = (searchParams.get('orderBy') as 'name' | 'createdAt' | 'lastAccessedAt') || 'lastAccessedAt';
    const orderDirection = (searchParams.get('orderDirection') as 'asc' | 'desc') || 'desc';
    const search = searchParams.get('search');

    const indexService = getProjectIndexService();
    
    let projects;
    
    if (search) {
      projects = await indexService.searchProjects(search, {
        includeInactive,
        orderBy,
        orderDirection,
      });
    } else {
      projects = await indexService.getAllProjects({
        includeInactive,
        orderBy,
        orderDirection,
      });
    }

    // Get project summary stats
    const summary = await indexService.getProjectSummary();

    return NextResponse.json({
      success: true,
      data: {
        projects,
        summary,
        total: projects.length,
      },
    });
  } catch (error) {
    console.error('Failed to get project index:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const indexService = getProjectIndexService();

    switch (action) {
      case 'cleanup': {
        const result = await indexService.cleanupOrphanedEntries();
        return NextResponse.json({
          success: true,
          data: result,
          message: `Cleanup completed: ${result.archived} archived, ${result.removed} removed`,
        });
      }

      case 'health-check': {
        const projects = await indexService.getProjectsNeedingHealthCheck();
        const results = [];

        for (const project of projects) {
          try {
            const { promises: fs } = await import('fs');
            const path = await import('path');
            
            // Check if project directory exists
            await fs.access(project.localPath);
            
            // Check if .codehive directory exists
            const codehivePath = path.join(project.localPath, '.codehive');
            await fs.access(codehivePath);
            
            // Update health status to healthy
            await indexService.updateProjectHealth(project.id, true);
            results.push({ id: project.id, healthy: true });
          } catch (error) {
            // Update health status to unhealthy
            await indexService.updateProjectHealth(project.id, false);
            results.push({ id: project.id, healthy: false, error: error instanceof Error ? error.message : 'Unknown error' });
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            checked: results.length,
            results,
          },
          message: `Health check completed for ${results.length} projects`,
        });
      }

      case 'update-stats': {
        const { projectId } = body;
        
        if (!projectId) {
          return NextResponse.json(
            { success: false, error: 'Project ID is required for stats update' },
            { status: 400 }
          );
        }

        // Get project from index
        const project = await indexService.getProjectById(projectId);
        if (!project) {
          return NextResponse.json(
            { success: false, error: 'Project not found' },
            { status: 404 }
          );
        }

        try {
          // Load actual stats from project SQLite database
          const { SQLiteMetadataManager } = await import('@/lib/portable/sqlite-metadata-manager');
          const metadataManager = new SQLiteMetadataManager(project.localPath);
          
          const [epics, stories, tokenUsage] = await Promise.all([
            metadataManager.getEpics(),
            metadataManager.getStories(),
            metadataManager.getTokenUsage(),
          ]);

          const stats = {
            epicCount: epics.length,
            storyCount: stories.length,
            tokenUsage: tokenUsage.reduce((sum, usage) => sum + usage.inputTokens + usage.outputTokens, 0),
          };

          await indexService.updateProjectStats(projectId, stats);

          return NextResponse.json({
            success: true,
            data: stats,
            message: `Stats updated for project ${projectId}`,
          });
        } catch (error) {
          return NextResponse.json(
            { success: false, error: `Failed to update stats: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
          );
        }
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Failed to process project index action:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}