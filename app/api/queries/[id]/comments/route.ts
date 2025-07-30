import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { content, author = 'user' } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: '評論內容不能為空' },
        { status: 400 }
      );
    }

    const comment = await prisma.queryComment.create({
      data: {
        queryId: params.id,
        content: content.trim(),
        author,
      },
    });

    return NextResponse.json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { success: false, error: '無法創建評論' },
      { status: 500 }
    );
  }
}
