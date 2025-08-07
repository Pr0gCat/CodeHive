import { ProjectManagerAgent } from '@/lib/project-manager';
import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { prisma } from '@/lib/db';
import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/projects/[id]/claude-md - Get current project CLAUDE.md content
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    // Try to find project using discovery service first (for portable projects)
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    let project = projects.find(p => p.metadata.id === projectId);

    // If not found in portable projects, try database
    if (!project) {
      const dbProject = await prisma.projectIndex.findUnique({
        where: { id: projectId },
      });
      
      if (dbProject) {
        // Convert database project to portable project format
        project = {
          path: dbProject.localPath,
          metadata: {
            id: dbProject.id,
            name: dbProject.name,
            description: dbProject.description || undefined,
            localPath: dbProject.localPath,
            status: dbProject.status,
            createdAt: dbProject.createdAt.toISOString(),
            updatedAt: dbProject.updatedAt.toISOString()
          }
        };
      }
    }

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    const claudeMdPath = `${project.path || project.metadata.localPath}/CLAUDE.md`;

    try {
      // Read current CLAUDE.md content
      const content = await fs.readFile(claudeMdPath, 'utf8');

      return NextResponse.json({
        success: true,
        data: {
          path: claudeMdPath,
          content,
          lastModified: (await fs.stat(claudeMdPath)).mtime,
        },
      });
    } catch {
      // File doesn't exist yet
      return NextResponse.json({
        success: true,
        data: {
          path: claudeMdPath,
          content: null,
          message: 'CLAUDE.md does not exist yet',
        },
      });
    }
  } catch (error) {
    console.error('Error getting CLAUDE.md:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get CLAUDE.md',
      },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id]/claude-md - Update/maintain project CLAUDE.md
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    console.log(`Updating CLAUDE.md for project: ${projectId}`);

    const projectManager = new ProjectManagerAgent();
    await projectManager.maintainProjectClaudeMd(projectId);

    // Get the updated content to return
    const project = await prisma.projectIndex.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    const claudeMdPath = `${project.localPath}/CLAUDE.md`;
    const updatedContent = await fs.readFile(claudeMdPath, 'utf8');

    return NextResponse.json({
      success: true,
      data: {
        message: 'CLAUDE.md updated successfully',
        path: claudeMdPath,
        contentLength: updatedContent.length,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating CLAUDE.md:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update CLAUDE.md',
      },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/claude-md - Force regenerate CLAUDE.md from scratch
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    console.log(
      `🔄 Regenerating CLAUDE.md from scratch for project: ${projectId}`
    );

    // Use the project manager's review function which generates CLAUDE.md
    const projectManager = new ProjectManagerAgent();
    const result = await projectManager.reviewProject(projectId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'CLAUDE.md regenerated successfully',
        path: result.artifacts?.claudeMdPath,
        tokensUsed: result.tokensUsed,
        executionTime: result.executionTime,
      },
    });
  } catch (error) {
    console.error('Error regenerating CLAUDE.md:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to regenerate CLAUDE.md',
      },
      { status: 500 }
    );
  }
}
