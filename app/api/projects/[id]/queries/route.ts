import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { checkProjectOperationAccess } from '@/lib/project-access-control';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const urgency = searchParams.get('urgency');
    const cycleId = searchParams.get('cycleId');
    const cardId = searchParams.get('cardId');

    const where: any = {
      projectId: params.id,
    };

    if (status) {
      where.status = status;
    }

    if (urgency) {
      where.urgency = urgency;
    }

    if (cycleId) {
      where.cycleId = cycleId;
    }

    if (cardId) {
      where.context = {
        contains: `"cardId":"${cardId}"`,
      };
    }

    let queries = await prisma.query.findMany({
      where,
      include: {
        comments: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        cycle: {
          select: {
            id: true,
            title: true,
            phase: true,
          },
        },
      },
      orderBy: [
        { urgency: 'desc' }, // BLOCKING first
        { priority: 'desc' }, // HIGH priority first
        { createdAt: 'desc' }, // Newest first
      ],
    });

    // Filter by cardId if specified (more precise than SQLite contains)
    if (cardId) {
      queries = queries.filter(query => {
        try {
          const context = JSON.parse(query.context);
          return context.cardId === cardId;
        } catch {
          return false;
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: queries,
    });
  } catch (error) {
    console.error('Error fetching queries:', error);
    return NextResponse.json(
      { success: false, error: '無法獲取查詢列表' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if project can be operated on
    const accessCheck = await checkProjectOperationAccess(params.id);

    if (!accessCheck.allowed) {
      return accessCheck.response;
    }

    const body = await request.json();
    const { type, title, question, context, urgency, priority, cycleId } = body;

    const query = await prisma.query.create({
      data: {
        projectId: params.id,
        cycleId: cycleId || null,
        type,
        title,
        question,
        context: JSON.stringify(context || {}),
        urgency: urgency || 'ADVISORY',
        priority: priority || 'MEDIUM',
        status: 'PENDING',
      },
      include: {
        cycle: {
          select: {
            id: true,
            title: true,
            phase: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: query,
    });
  } catch (error) {
    console.error('Error creating query:', error);
    return NextResponse.json(
      { success: false, error: '無法創建查詢' },
      { status: 500 }
    );
  }
}
