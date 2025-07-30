import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const query = await prisma.query.findUnique({
      where: { id: params.id },
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
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!query) {
      return NextResponse.json(
        { success: false, error: '查詢不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: query,
    });
  } catch (error) {
    console.error('Error fetching query:', error);
    return NextResponse.json(
      { success: false, error: '無法獲取查詢' },
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
    const { answer, status } = body;

    const updateData: any = {};

    if (answer !== undefined) {
      updateData.answer = answer;
      updateData.answeredAt = new Date();
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    const query = await prisma.query.update({
      where: { id: params.id },
      data: updateData,
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
    });

    return NextResponse.json({
      success: true,
      data: query,
    });
  } catch (error) {
    console.error('Error updating query:', error);
    return NextResponse.json(
      { success: false, error: '無法更新查詢' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.query.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: '查詢已刪除',
    });
  } catch (error) {
    console.error('Error deleting query:', error);
    return NextResponse.json(
      { success: false, error: '無法刪除查詢' },
      { status: 500 }
    );
  }
}
