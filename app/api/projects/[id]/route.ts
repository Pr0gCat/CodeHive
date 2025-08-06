import { NextRequest, NextResponse } from 'next/server';
import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { ProjectMetadataManager } from '@/lib/portable/metadata-manager';
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

    // Add initial project logs when accessed (server-side only)
    addInitialProjectLogs(project.metadata.id, project.metadata.name);

    // Get additional project data from portable format
    const metadataManager = new ProjectMetadataManager(project.path);
    
    // Load actual data
    const stories = await metadataManager.getStories();
    const tokenUsage = await metadataManager.getTokenUsage();
    const epics = await metadataManager.getEpics();
    const agents = await metadataManager.getAgents();
    
    // Transform portable project data to match expected format
    const projectData = {
      id: project.metadata.id,
      name: project.metadata.name,
      description: project.metadata.description,
      status: project.metadata.status,
      gitUrl: project.metadata.gitUrl,
      localPath: project.metadata.localPath,
      framework: project.metadata.framework,
      language: project.metadata.language,
      packageManager: project.metadata.packageManager,
      testFramework: project.metadata.testFramework,
      lintTool: project.metadata.lintTool,
      buildTool: project.metadata.buildTool,
      createdAt: new Date(project.metadata.createdAt),
      updatedAt: new Date(project.metadata.updatedAt),
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
    const metadataManager = new ProjectMetadataManager(project.path);
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    
    // Find project by ID
    const project = projects.find(p => p.metadata.id === params.id);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Delete project directory
    const fs = await import('fs/promises');
    await fs.rm(project.path, { recursive: true, force: true });

    // Log the project deletion
    logProjectEvent.projectDeleted(params.id, project.metadata.name);

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete project',
      },
      { status: 500 }
    );
  }
}
