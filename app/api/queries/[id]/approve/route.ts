import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { updateCLAUDEMDAfterQuery } from '@/lib/claude-md/auto-update';

const approveSchema = z.object({
  proposal: z
    .string()
    .min(1, 'Proposal cannot be empty')
    .max(2000, 'Proposal too long'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { proposal } = approveSchema.parse(body);
    const queryId = params.id;

    // Get the existing query
    const existingQuery = await prisma.query.findUnique({
      where: { id: queryId },
      include: {
        cycle: {
          include: {
            story: {
              include: {
                epic: true,
              },
            },
          },
        },
      },
    });

    if (!existingQuery) {
      return NextResponse.json(
        { success: false, error: 'Query not found' },
        { status: 404 }
      );
    }

    // Update query with approved proposal
    await prisma.query.update({
      where: { id: queryId },
      data: {
        answer: proposal,
        status: 'APPROVED',
        answeredAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Add approval comment
    await prisma.queryComment.create({
      data: {
        queryId,
        content: `Approved proposal: ${proposal}`,
        author: 'USER',
      },
    });

    // Find blocked cycles that can now resume
    const resumedWork: string[] = [];

    if (existingQuery.cycle) {
      // Resume the blocked cycle
      await prisma.cycle.update({
        where: { id: existingQuery.cycle.id },
        data: {
          status: 'IN_PROGRESS',
          updatedAt: new Date(),
        },
      });
      resumedWork.push(existingQuery.cycle.id);
    }

    // Update CLAUDE.md with the query resolution
    try {
      await updateCLAUDEMDAfterQuery(
        queryId,
        existingQuery.question,
        proposal,
        {
          userDecisions: [`User approved: ${proposal}`],
          implementationDetails: [
            `Resolution for query: ${existingQuery.question}`,
          ],
        }
      );
    } catch (error) {
      console.warn('Failed to update CLAUDE.md after query approval:', error);
      // Don't fail the request if documentation update fails
    }

    return NextResponse.json({
      approved: true,
      resumedWork,
      query: {
        id: queryId,
        status: 'APPROVED',
        answer: proposal,
      },
      message: 'Query approved successfully. Development work will resume.',
    });
  } catch (error) {
    console.error('Error approving query:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid approval data',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to approve query',
      },
      { status: 500 }
    );
  }
}
