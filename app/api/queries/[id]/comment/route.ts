import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const commentSchema = z.object({
  comment: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(1000, 'Comment too long'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { comment } = commentSchema.parse(body);
    const queryId = params.id;

    // Get the existing query
    const existingQuery = await prisma.query.findUnique({
      where: { id: queryId },
      include: { comments: true },
    });

    if (!existingQuery) {
      return NextResponse.json(
        { success: false, error: 'Query not found' },
        { status: 404 }
      );
    }

    // Add the comment
    await prisma.queryComment.create({
      data: {
        queryId,
        content: comment,
        author: 'USER', // In a real app, this would be the authenticated user
      },
    });

    // Update query status to indicate user feedback
    await prisma.query.update({
      where: { id: queryId },
      data: {
        status: 'FEEDBACK_PROVIDED',
        updatedAt: new Date(),
      },
    });

    // In the improved architecture, this would trigger AI to revise the proposal
    // For now, we'll simulate this by creating a new proposal
    const newProposal = `Updated proposal based on your feedback: "${comment}". The AI agent will revise the approach accordingly.`;

    // Get updated query with comments
    const updatedQuery = await prisma.query.findUnique({
      where: { id: queryId },
      include: {
        comments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json({
      updated: true,
      newProposal,
      query: updatedQuery,
      message: 'Comment added successfully. AI agent will revise the proposal.',
    });
  } catch (error) {
    console.error('Error adding comment to query:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid comment data',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add comment',
      },
      { status: 500 }
    );
  }
}
