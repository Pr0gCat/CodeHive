import { NextRequest, NextResponse } from 'next/server';
import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { SQLiteMetadataManager } from '@/lib/portable/sqlite-metadata-manager';
import { getProjectIndexService } from '@/lib/db/project-index';
import { logProjectEvent } from '@/lib/logging/project-logger';
import { addInitialProjectLogs } from '@/lib/logging/init-logs';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').optional(),
  description: z.string().optional(),
  gitUrl: z.string().url().optional(),
  localPath: z.string().min(1, 'Local path is required').optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Try fast path: lookup in system database first
    const indexService = getProjectIndexService();
    let projectPath: string | null = null;
    let projectMetadata: any = null;

    try {
      const indexedProject = await indexService.getProjectById(params.id);
      if (indexedProject) {
        projectPath = indexedProject.localPath;
        // Mark as accessed (updates lastAccessedAt)
        await indexService.markProjectAccessed(params.id);
        
        // Get full metadata from project's SQLite database
        const metadataManager = new SQLiteMetadataManager(projectPath);
        projectMetadata = await metadataManager.getProjectMetadata();
      }
    } catch (indexError) {
      console.warn('Database lookup failed, falling back to discovery:', indexError);
    }

    // Fallback: use discovery service if database lookup failed
    if (!projectPath || !projectMetadata) {
      const discoveryService = getProjectDiscoveryService();
      const projects = await discoveryService.discoverProjects();
      
      const discoveredProject = projects.find(p => p.metadata.id === params.id);
      if (discoveredProject) {
        projectPath = discoveredProject.path;
        projectMetadata = discoveredProject.metadata;
        
        // Sync discovered project with index for future fast lookups
        try {
          await indexService.syncWithProject(discoveredProject.metadata);
          console.log(`Synced project ${params.id} with system database`);
        } catch (syncError) {
          console.warn('Failed to sync project with index:', syncError);
        }
      }
    }

    if (!projectPath || !projectMetadata) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    // Add initial project logs when accessed (server-side only)
    addInitialProjectLogs(projectMetadata.id, projectMetadata.name);

    // Get additional project data from portable format
    const metadataManager = new SQLiteMetadataManager(projectPath);
    
    // Load actual data
    const stories = await metadataManager.getStories();
    const tokenUsage = await metadataManager.getTokenUsage();
    const epics = await metadataManager.getEpics();
    const agents = await metadataManager.getAgents();
    
    // Get project phase from system database
    let projectPhase = 'REQUIREMENTS'; // Default phase
    try {
      const indexedProject = await indexService.getProjectById(params.id);
      if (indexedProject && indexedProject.phase) {
        projectPhase = indexedProject.phase;
      }
    } catch (error) {
      console.warn('Failed to get project phase, using default:', error);
    }

    // Get additional project info from system database if available
    let systemProjectInfo = null;
    try {
      const indexedProject = await indexService.getProjectById(params.id);
      if (indexedProject) {
        systemProjectInfo = indexedProject;
      }
    } catch (error) {
      console.warn('Failed to get system project info:', error);
    }

    // Use system database info to fill in missing portable metadata
    // Try to infer project name from git URL or path if not set
    let effectiveName = projectMetadata.name || systemProjectInfo?.name;
    if (!effectiveName || effectiveName === '未命名專案') {
      // Try to extract name from git URL
      if (projectMetadata.gitUrl) {
        const gitMatch = projectMetadata.gitUrl.match(/\/([^\/]+)\.git$/);
        if (gitMatch) {
          effectiveName = gitMatch[1];
        }
      }
      // Fallback to local path directory name
      if (!effectiveName && projectMetadata.localPath) {
        const pathParts = projectMetadata.localPath.split('/');
        effectiveName = pathParts[pathParts.length - 1];
      }
      // Final fallback
      if (!effectiveName) {
        effectiveName = '未命名專案';
      }
    }

    const effectiveDescription = projectMetadata.description || systemProjectInfo?.description || '';

    // Transform portable project data to match expected format
    const projectData = {
      id: projectMetadata.id,
      name: effectiveName,
      description: effectiveDescription,
      status: projectMetadata.status,
      phase: projectPhase,
      gitUrl: projectMetadata.gitUrl,
      localPath: projectMetadata.localPath,
      framework: projectMetadata.framework || systemProjectInfo?.framework,
      language: projectMetadata.language || systemProjectInfo?.language,
      packageManager: projectMetadata.packageManager || systemProjectInfo?.packageManager,
      testFramework: projectMetadata.testFramework || systemProjectInfo?.testFramework,
      lintTool: projectMetadata.lintTool || systemProjectInfo?.lintTool,
      buildTool: projectMetadata.buildTool || systemProjectInfo?.buildTool,
      createdAt: new Date(projectMetadata.createdAt),
      updatedAt: new Date(projectMetadata.updatedAt),
      // Actual data from portable format
      kanbanCards: stories,
      tokenUsage: tokenUsage,
      epics: epics,
      queuedTasks: [], // TODO: Implement queued tasks in portable format
      milestones: [], // TODO: Implement milestones in portable format
      agentSpecs: agents,
      _count: {
        kanbanCards: stories.length,
        tokenUsage: tokenUsage.length,
        queuedTasks: 0, // TODO: Count queued tasks when implemented
      },
    };

    return NextResponse.json({
      success: true,
      data: projectData,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch project',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validatedData = updateProjectSchema.parse(body);

    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    
    // Find project by ID
    const project = projects.find(p => p.metadata.id === params.id);

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    // Update project metadata
    const metadataManager = new SQLiteMetadataManager(project.path);
    const currentMetadata = project.metadata;
    
    const updatedMetadata = {
      ...currentMetadata,
      ...validatedData,
      updatedAt: new Date().toISOString(),
    };

    await metadataManager.saveProjectMetadata(updatedMetadata, { validateData: true });

    // Transform updated data to match expected format
    const projectData = {
      id: updatedMetadata.id,
      name: updatedMetadata.name,
      description: updatedMetadata.description,
      status: updatedMetadata.status,
      gitUrl: updatedMetadata.gitUrl,
      localPath: updatedMetadata.localPath,
      framework: updatedMetadata.framework,
      language: updatedMetadata.language,
      packageManager: updatedMetadata.packageManager,
      testFramework: updatedMetadata.testFramework,
      lintTool: updatedMetadata.lintTool,
      buildTool: updatedMetadata.buildTool,
      createdAt: new Date(updatedMetadata.createdAt),
      updatedAt: new Date(updatedMetadata.updatedAt),
      kanbanCards: [],
      _count: {
        kanbanCards: 0,
        tokenUsage: 0,
      },
    };

    return NextResponse.json({
      success: true,
      data: projectData,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Error updating project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update project',
      },
      { status: 500 }
    );
  }
}

// DELETE functionality removed - projects cannot be deleted, only archived
