import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { claudeCodeTaskExecutor } from '@/lib/tasks/claude-code-tasks';

// POST /api/cards/[id]/execute-claude - Execute Claude Code task for a story
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const storyId = params.id;

    // Get the story details
    const story = await prisma.kanbanCard.findUnique({
      where: { id: storyId },
      select: {
        id: true,
        title: true,
        description: true,
        projectId: true,
        status: true,
      },
    });

    if (!story) {
      return NextResponse.json(
        {
          success: false,
          error: 'Story not found',
        },
        { status: 404 }
      );
    }

    // Check if this is a Claude Code /init task
    if (!claudeCodeTaskExecutor.isClaudeInitTask(story)) {
      return NextResponse.json(
        {
          success: false,
          error: 'This story is not a Claude Code /init task',
        },
        { status: 400 }
      );
    }

    // Check if story is in a valid state for execution
    if (story.status === 'DONE') {
      return NextResponse.json(
        {
          success: false,
          error: 'Story is already completed',
        },
        { status: 400 }
      );
    }

    if (story.status === 'IN_PROGRESS') {
      return NextResponse.json(
        {
          success: false,
          error: 'Story is already in progress',
        },
        { status: 400 }
      );
    }

    // Execute the Claude Code /init command
    const result = await claudeCodeTaskExecutor.executeInitCommand(
      story.projectId,
      storyId
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Claude Code /init executed successfully',
        data: {
          storyId,
          tokensUsed: result.tokensUsed,
          output: result.output,
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Claude Code /init execution failed',
          data: {
            storyId,
            tokensUsed: result.tokensUsed,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error executing Claude Code task:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to execute Claude Code task',
      },
      { status: 500 }
    );
  }
}
