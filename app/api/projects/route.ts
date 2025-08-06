import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { ProjectMetadataManager } from '@/lib/portable/metadata-manager';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';
    const includeStats = searchParams.get('includeStats') === 'true';

    const discoveryService = getProjectDiscoveryService();
    
    // Clear cache if refresh is requested
    if (refresh) {
      discoveryService.clearCache();
    }

    // Discover all portable projects
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
          const metadataManager = new ProjectMetadataManager(project.path);
          
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