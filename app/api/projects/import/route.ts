import { NextRequest, NextResponse } from 'next/server';
import { prisma, ProjectStatus } from '@/lib/db';
import { gitClient } from '@/lib/git';

interface ImportRequest {
  gitUrl: string;
  projectName: string;
  branch?: string;
  framework?: string;
  language?: string;
  packageManager?: string;
  testFramework?: string;
  lintTool?: string;
  buildTool?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportRequest = await request.json();
    const { 
      gitUrl, 
      projectName,
      branch,
      framework,
      language,
      packageManager,
      testFramework,
      lintTool,
      buildTool,
    } = body;

    // Validate inputs
    if (!gitUrl || !projectName) {
      return NextResponse.json(
        { error: 'Git URL and project name are required' },
        { status: 400 }
      );
    }

    // Validate Git URL
    const urlValidation = await gitClient.validateGitUrl(gitUrl);
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: urlValidation.error },
        { status: 400 }
      );
    }

    // Check if project name already exists
    const existingProject = await prisma.project.findFirst({
      where: { name: projectName },
    });

    if (existingProject) {
      return NextResponse.json(
        { error: 'A project with this name already exists' },
        { status: 409 }
      );
    }

    // Generate local path
    const localPath = gitClient.generateProjectPath(projectName);

    // Check if directory already exists
    const repoExists = await gitClient.isValidRepository(localPath);
    if (repoExists) {
      return NextResponse.json(
        { error: 'Repository already exists at this location' },
        { status: 409 }
      );
    }

    // Clone the repository
    console.log(`Cloning repository from ${gitUrl} to ${localPath}...`);
    const cloneResult = await gitClient.clone({
      url: gitUrl,
      targetPath: localPath,
      branch,
      depth: 1, // Shallow clone for faster imports
    });

    if (!cloneResult.success) {
      return NextResponse.json(
        { 
          error: 'Failed to clone repository',
          details: cloneResult.error,
        },
        { status: 500 }
      );
    }

    // Verify the clone was successful
    const isValid = await gitClient.isValidRepository(localPath);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Repository clone verification failed' },
        { status: 500 }
      );
    }

    // Get repository metadata
    const currentBranch = await gitClient.getCurrentBranch(localPath);
    const remoteUrl = await gitClient.getRemoteUrl(localPath);

    // Create project in database
    const project = await prisma.project.create({
      data: {
        name: projectName,
        description: `Imported from ${gitUrl}`,
        gitUrl: remoteUrl || gitUrl,
        localPath,
        status: ProjectStatus.ACTIVE,
        framework,
        language,
        packageManager,
        testFramework,
        lintTool,
        buildTool,
      },
    });

    // Create initial Kanban cards
    const initialCards = [
      {
        title: 'Project Setup',
        description: 'Initialize project dependencies and configuration',
        status: 'TODO',
        position: 0,
      },
      {
        title: 'Code Analysis',
        description: 'Analyze codebase for quality and potential issues',
        status: 'TODO',
        position: 1,
      },
      {
        title: 'Documentation Review',
        description: 'Review and update project documentation',
        status: 'TODO',
        position: 2,
      },
    ];

    await prisma.kanbanCard.createMany({
      data: initialCards.map(card => ({
        projectId: project.id,
        ...card,
      })),
    });

    // Trigger automatic project review
    try {
      console.log(`🔍 Starting automatic project review for ${project.name}...`);
      
      const reviewResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/agents/project-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          action: 'review',
        }),
      });

      const reviewData = await reviewResponse.json();
      if (reviewData.success) {
        console.log(`✅ Project review completed successfully for ${project.name}`);
      } else {
        console.log(`⚠️ Project review failed for ${project.name}:`, reviewData.error);
      }
    } catch (reviewError) {
      console.error(`❌ Error during automatic project review for ${project.name}:`, reviewError);
      // Continue with import even if review fails
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        gitUrl: project.gitUrl,
        localPath: project.localPath,
        branch: currentBranch,
      },
      message: 'Repository imported successfully and project review initiated',
    });

  } catch (error) {
    console.error('Project import error:', error);
    return NextResponse.json(
      {
        error: 'Failed to import project',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}