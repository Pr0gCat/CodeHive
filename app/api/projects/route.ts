import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { SQLiteMetadataManager } from '@/lib/portable/sqlite-metadata-manager';
import { getProjectIndexService } from '@/lib/db/project-index';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';
    const includeStats = searchParams.get('includeStats') === 'true';
    const useDatabase = searchParams.get('useDatabase') !== 'false'; // Default to true

    if (useDatabase && !refresh) {
      // Fast path: Use system database for quick access
      try {
        const indexService = getProjectIndexService();
        const indexedProjects = await indexService.getAllProjects({
          includeInactive: false,
          orderBy: 'lastAccessedAt',
          orderDirection: 'desc',
        });

      const projectsData = indexedProjects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        gitUrl: project.gitUrl,
        localPath: project.localPath,
        status: project.status,
        framework: project.framework,
        language: project.language,
        packageManager: project.packageManager,
        testFramework: project.testFramework,
        lintTool: project.lintTool,
        buildTool: project.buildTool,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        // Cached stats from database
        epicCount: includeStats ? project.epicCount : undefined,
        storyCount: includeStats ? project.storyCount : undefined,
        tokenUsage: includeStats ? project.tokenUsage : undefined,
        isHealthy: project.isHealthy,
        lastAccessedAt: project.lastAccessedAt.toISOString(),
        importSource: project.importSource,
      }));

        return NextResponse.json({
          success: true,
          data: projectsData,
          total: projectsData.length,
          source: 'database',
        });
      } catch (databaseError) {
        console.warn('Database query failed, falling back to discovery:', databaseError);
        // Fall through to discovery method
      }
    }
    
    // Discovery path: Full filesystem discovery (used for refresh, database errors, or if database disabled)
    const discoveryService = getProjectDiscoveryService();
      
      // Clear cache if refresh is requested
      if (refresh) {
        discoveryService.clearCache();
      }

      // Discover all portable projects (this will also sync with database)
      const projects = await discoveryService.discoverProjects({
        includeInvalid: false,
        validateMetadata: true,
      });

      // Transform to match existing API response format
      const projectsData = await Promise.all(
        projects.map(async (project) => {
        const result: any = {
          id: project.metadata.id,
          name: project.metadata.name,
          description: project.metadata.description,
          gitUrl: project.metadata.gitUrl,
          localPath: project.path,
          status: project.metadata.status,
          framework: project.metadata.framework,
          language: project.metadata.language,
          packageManager: project.metadata.packageManager,
          testFramework: project.metadata.testFramework,
          lintTool: project.metadata.lintTool,
          buildTool: project.metadata.buildTool,
          createdAt: project.metadata.createdAt,
          updatedAt: project.metadata.updatedAt,
        };

        // Add additional stats if requested
        if (includeStats) {
          const metadataManager = new SQLiteMetadataManager(project.path);
          
          try {
            const [epics, stories, sprints, cycles, tokenUsage] = await Promise.all([
              metadataManager.getEpics(),
              metadataManager.getStories(),
              metadataManager.getSprints(),
              metadataManager.getCycles(),
              metadataManager.getTokenUsage(),
            ]);

            result._count = {
              epics: epics.length,
              kanbanCards: stories.length,
              sprints: sprints.length,
              cycles: cycles.length,
              tokenUsage: tokenUsage.length,
            };

            // Include some stories as kanbanCards for compatibility
            result.kanbanCards = stories.slice(0, 10).map(story => ({
              id: story.id,
              title: story.title,
              description: story.description,
              status: story.status,
              position: story.position,
              priority: story.priority,
              storyPoints: story.storyPoints,
              epicId: story.epicId,
              sprintId: story.sprintId,
            }));
          } catch (error) {
            console.warn(`Failed to load stats for project ${project.metadata.name}:`, error);
            result._count = {
              epics: 0,
              kanbanCards: 0,
              sprints: 0,
              cycles: 0,
              tokenUsage: 0,
            };
            result.kanbanCards = [];
          }
        }

        return result;
      })
    );

    // Sort by updated date
    projectsData.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json({
      success: true,
      data: projectsData,
      total: projectsData.length,
      source: 'discovery',
    });

  } catch (error) {
    console.error('Error fetching portable projects:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch projects',
      },
      { status: 500 }
    );
  }
}

// POST endpoint would go here if needed for creating projects
// But since we're using /api/projects/create, this might not be needed