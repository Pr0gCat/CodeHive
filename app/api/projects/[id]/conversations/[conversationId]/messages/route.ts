import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const CreateMessageSchema = z.object({
  role: z.enum(['USER', 'AGENT', 'SYSTEM']),
  content: z.string().min(1),
  contentType: z.enum(['TEXT', 'MARKDOWN', 'JSON']).default('TEXT'),
  metadata: z.string().optional(),
  phase: z.string().optional(),
  tokenUsage: z.number().default(0),
  responseTime: z.number().optional(),
  parentMessageId: z.string().optional(),
  isError: z.boolean().default(false),
  errorDetails: z.string().optional()
});

const MessageQuerySchema = z.object({
  role: z.enum(['USER', 'AGENT', 'SYSTEM']).optional(),
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  offset: z.string().transform(val => parseInt(val) || 0).optional(),
  since: z.string().transform(val => val ? new Date(val) : undefined).optional()
});

// GET /api/projects/[id]/conversations/[conversationId]/messages
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; conversationId: string } }
) {
  try {
    const projectId = params.id;
    const conversationId = params.conversationId;
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    
    const query = MessageQuerySchema.parse(searchParams);

    // First verify the conversation exists and belongs to the project
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return NextResponse.json({
        success: false,
        error: 'Conversation not found'
      }, { status: 404 });
    }

    if (conversation.projectId !== projectId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // Build where clause
    const where: any = { conversationId };
    
    if (query.role) {
      where.role = query.role;
    }

    if (query.since) {
      where.createdAt = {
        gte: query.since
      };
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: query.limit,
      skip: query.offset,
      include: {
        actions: {
          orderBy: { createdAt: 'asc' }
        },
        parentMessage: {
          select: {
            id: true,
            content: true,
            role: true
          }
        },
        _count: {
          select: {
            replies: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: messages,
      meta: {
        conversationId,
        total: await prisma.message.count({ where }),
        limit: query.limit,
        offset: query.offset
      }
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch messages'
    }, { status: 500 });
  }
}

// POST /api/projects/[id]/conversations/[conversationId]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; conversationId: string } }
) {
  try {
    const projectId = params.id;
    const conversationId = params.conversationId;
    const body = await request.json();
    
    const validatedData = CreateMessageSchema.parse(body);

    // First verify the conversation exists and belongs to the project
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return NextResponse.json({
        success: false,
        error: 'Conversation not found'
      }, { status: 404 });
    }

    if (conversation.projectId !== projectId) {
      return NextResponse.json({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    // Verify parent message exists if specified
    if (validatedData.parentMessageId) {
      const parentMessage = await prisma.message.findUnique({
        where: { id: validatedData.parentMessageId }
      });

      if (!parentMessage || parentMessage.conversationId !== conversationId) {
        return NextResponse.json({
          success: false,
          error: 'Parent message not found in this conversation'
        }, { status: 400 });
      }
    }

    // Create message and update conversation in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the message
      const message = await tx.message.create({
        data: {
          conversationId,
          role: validatedData.role,
          content: validatedData.content,
          contentType: validatedData.contentType,
          metadata: validatedData.metadata,
          phase: validatedData.phase,
          tokenUsage: validatedData.tokenUsage,
          responseTime: validatedData.responseTime,
          parentMessageId: validatedData.parentMessageId,
          isError: validatedData.isError,
          errorDetails: validatedData.errorDetails
        },
        include: {
          actions: true,
          parentMessage: {
            select: {
              id: true,
              content: true,
              role: true
            }
          }
        }
      });

      // Update conversation stats
      const updatedConversation = await tx.conversation.update({
        where: { id: conversationId },
        data: {
          messageCount: { increment: 1 },
          tokenUsage: { increment: validatedData.tokenUsage },
          lastMessageAt: new Date()
        }
      });

      return { message, conversation: updatedConversation };
    });

    return NextResponse.json({
      success: true,
      data: result.message
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating message:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to create message'
    }, { status: 500 });
  }
}