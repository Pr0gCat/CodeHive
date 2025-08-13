import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/projects/[id]/conversations/[conversationId]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; conversationId: string } }
) {
  try {
    const projectId = params.id;
    const conversationId = params.conversationId;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            actions: {
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      }
    });

    if (!conversation) {
      return NextResponse.json({
        success: false,
        error: 'Conversation not found'
      }, { status: 404 });
    }

    // Check if conversation belongs to the specified project
    if (conversation.projectId !== projectId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied: Conversation does not belong to this project'
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: conversation
    });

  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch conversation'
    }, { status: 500 });
  }
}

// PUT /api/projects/[id]/conversations/[conversationId]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; conversationId: string } }
) {
  try {
    const projectId = params.id;
    const conversationId = params.conversationId;
    const body = await request.json();

    // First check if conversation exists and belongs to project
    const existingConversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!existingConversation) {
      return NextResponse.json({
        success: false,
        error: 'Conversation not found'
      }, { status: 404 });
    }

    if (existingConversation.projectId !== projectId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        title: body.title,
        status: body.status,
        phase: body.phase,
        summary: body.summary,
        context: body.context
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedConversation
    });

  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update conversation'
    }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/conversations/[conversationId] - Partial update
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; conversationId: string } }
) {
  try {
    const projectId = params.id;
    const conversationId = params.conversationId;
    const body = await request.json();

    // First check if conversation exists and belongs to project
    const existingConversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!existingConversation) {
      return NextResponse.json({
        success: false,
        error: 'Conversation not found'
      }, { status: 404 });
    }

    if (existingConversation.projectId !== projectId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // Update only provided fields
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.phase !== undefined) updateData.phase = body.phase;
    if (body.summary !== undefined) updateData.summary = body.summary;
    if (body.context !== undefined) updateData.context = body.context;

    // Update conversation
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      data: updatedConversation
    });

  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update conversation'
    }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/conversations/[conversationId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; conversationId: string } }
) {
  try {
    const projectId = params.id;
    const conversationId = params.conversationId;

    // First check if conversation exists and belongs to project
    const existingConversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!existingConversation) {
      return NextResponse.json({
        success: false,
        error: 'Conversation not found'
      }, { status: 404 });
    }

    if (existingConversation.projectId !== projectId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // Delete conversation (cascade will delete messages and actions)
    await prisma.conversation.delete({
      where: { id: conversationId }
    });

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete conversation'
    }, { status: 500 });
  }
}