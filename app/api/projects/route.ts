import { NextRequest, NextResponse } from 'next/server';
import { prisma, ProjectStatus } from '@/lib/db';
import { logProjectEvent } from '@/lib/logging/project-logger';
import { gitClient } from '@/lib/git';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  gitUrl: z.string().url().optional(), // Optional remote URL
  localPath: z.string().optional(), // Will be generated if empty
  initializeGit: z.boolean().default(true), // Always initialize as Git repo
});

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        kanbanCards: {
          orderBy: { position: 'asc' },
        },
        _count: {
          select: {
            kanbanCards: true,
            tokenUsage: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch projects',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createProjectSchema.parse(body);
    const { name, description, gitUrl, initializeGit } = validatedData;

    // Generate localPath if not provided
    const localPath =
      validatedData.localPath?.trim() || gitClient.generateProjectPath(name);

    // Check if project name already exists
    const existingProject = await prisma.project.findFirst({
      where: { name },
    });

    if (existingProject) {
      return NextResponse.json(
        {
          success: false,
          error: 'A project with this name already exists',
        },
        { status: 409 }
      );
    }

    // Ensure the local path exists
    try {
      await fs.mkdir(path.dirname(localPath), { recursive: true });
    } catch (error) {
      console.error('Failed to create directory:', error);
    }

    // Check if the directory is already a Git repository
    const isExistingRepo = await gitClient.isValidRepository(localPath);

    if (!isExistingRepo && initializeGit) {
      // Initialize as Git repository if not already one
      console.log(`Initializing Git repository at ${localPath}...`);
      const initResult = await gitClient.init(localPath);

      if (!initResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to initialize Git repository',
            details: initResult.error,
          },
          { status: 500 }
        );
      }

      // Create initial commit
      try {
        // Create initial README if it doesn't exist
        const readmePath = path.join(localPath, 'README.md');
        try {
          await fs.access(readmePath);
        } catch {
          // README doesn't exist, create it
          const readmeContent = `# ${name}\n\n${description || 'A CodeHive managed project'}\n\n## Getting Started\n\nThis project is managed by CodeHive using AI-Native TDD development.\n`;
          await fs.writeFile(readmePath, readmeContent, 'utf8');
        }

        // Create initial commit
        const commitResult = await gitClient.initialCommit(
          localPath,
          'Initial commit - CodeHive project setup'
        );
        if (!commitResult.success) {
          console.warn('Failed to create initial commit:', commitResult.error);
        }
      } catch (error) {
        console.warn('Failed to create initial commit:', error);
        // Continue with project creation even if commit fails
      }
    }

    // Verify Git repository status
    const finalRepoCheck = await gitClient.isValidRepository(localPath);
    if (!finalRepoCheck) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to ensure project is a Git repository',
        },
        { status: 500 }
      );
    }

    // Get current Git info
    const currentBranch = await gitClient.getCurrentBranch(localPath);
    const actualRemoteUrl = gitUrl || (await gitClient.getRemoteUrl(localPath));

    const project = await prisma.project.create({
      data: {
        name,
        description,
        gitUrl: actualRemoteUrl,
        localPath,
        status: ProjectStatus.ACTIVE,
      },
      include: {
        kanbanCards: true,
        _count: {
          select: {
            kanbanCards: true,
            tokenUsage: true,
          },
        },
      },
    });

    // Log the project creation
    logProjectEvent.projectCreated(project.id, project.name);

    // Trigger automatic project review for Git-managed projects
    try {
      console.log(
        `🔍 Starting automatic project review for ${project.name}...`
      );

      const reviewResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/agents/project-manager`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: project.id,
            action: 'review',
          }),
        }
      );

      const reviewData = await reviewResponse.json();
      if (reviewData.success) {
        console.log(
          `✅ Project review completed successfully for ${project.name}`
        );
      } else {
        console.log(
          `⚠️ Project review failed for ${project.name}:`,
          reviewData.error
        );
      }
    } catch (reviewError) {
      console.error(
        `❌ Error during automatic project review for ${project.name}:`,
        reviewError
      );
      // Continue with project creation even if review fails
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...project,
          gitBranch: currentBranch,
          isGitManaged: true,
        },
        message: 'Project created successfully as Git repository',
      },
      { status: 201 }
    );
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

    console.error('Error creating project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create project',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
