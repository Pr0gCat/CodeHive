import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const CreateConversationSchema = z.object({
  phase: z.enum(['REQUIREMENTS', 'MVP', 'CONTINUOUS']),
  title: z.string().optional(),
  context: z.string().optional(),
  summary: z.string().optional()
});

const ConversationQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'ARCHIVED', 'COMPLETED']).optional(),
  phase: z.enum(['REQUIREMENTS', 'MVP', 'CONTINUOUS']).optional(),
  limit: z.string().transform(val => parseInt(val) || 50).optional(),
  offset: z.string().transform(val => parseInt(val) || 0).optional()
});

// GET /api/projects/[id]/conversations
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    
    const query = ConversationQuerySchema.parse(searchParams);

    // Build where clause
    const where: any = { projectId };
    
    if (query.status) {
      where.status = query.status;
    }
    
    if (query.phase) {
      where.phase = query.phase;
    }

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: [
        { lastMessageAt: 'desc' },
        { updatedAt: 'desc' }
      ],
      take: query.limit,
      skip: query.offset,
      include: {
        _count: {
          select: {
            messages: true
          }
        }
      }
    });

    // Check if project exists by seeing if we have any data or if this is a valid project
    if (conversations.length === 0) {
      // Try to verify the project exists - in a real app you'd check a projects table
      // For now, we'll assume the project exists if no conversations found
    }

    return NextResponse.json({
      success: true,
      data: conversations
    });

  } catch (error) {
    console.error('Error fetching conversations:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch conversations'
    }, { status: 500 });
  }
}

// POST /api/projects/[id]/conversations
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const body = await request.json();
    
    const validatedData = CreateConversationSchema.parse(body);

    const conversation = await prisma.conversation.create({
      data: {
        projectId,
        phase: validatedData.phase,
        title: validatedData.title,
        context: validatedData.context,
        summary: validatedData.summary,
        status: 'ACTIVE',
        messageCount: 0,
        tokenUsage: 0
      }
    });

    return NextResponse.json({
      success: true,
      data: conversation
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating conversation:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to create conversation'
    }, { status: 500 });
  }
}