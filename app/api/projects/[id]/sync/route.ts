import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { gitClient } from '@/lib/git';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    // Get project details
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.gitUrl) {
      return NextResponse.json(
        { error: 'Project does not have a Git URL' },
        { status: 400 }
      );
    }

    // Verify repository exists
    const isValid = await gitClient.isValidRepository(project.localPath);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Local repository not found or invalid' },
        { status: 400 }
      );
    }

    // Get current status
    const statusResult = await gitClient.status(project.localPath);
    const hasChanges =
      statusResult.success &&
      statusResult.output &&
      statusResult.output.trim().length > 0;

    if (hasChanges) {
      return NextResponse.json(
        {
          error: 'Local repository has uncommitted changes',
          details: 'Please commit or stash changes before syncing',
          status: statusResult.output,
        },
        { status: 400 }
      );
    }

    // Pull latest changes
    console.log(`Syncing repository for project: ${project.name}...`);
    const pullResult = await gitClient.pull(project.localPath);

    if (!pullResult.success) {
      return NextResponse.json(
        {
          error: 'Failed to sync repository',
          details: pullResult.error,
        },
        { status: 500 }
      );
    }

    // Get updated branch info
    const currentBranch = await gitClient.getCurrentBranch(project.localPath);

    // Update project timestamp
    await prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Repository synced successfully',
      branch: currentBranch,
      output: pullResult.output,
    });
  } catch (error) {
    console.error('Project sync error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync project',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
