import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { responseGenerator } from '@/lib/agents/response-generator';

const GenerateResponseSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  phase: z.enum(['REQUIREMENTS', 'MVP', 'CONTINUOUS'])
});

// POST /api/projects/[id]/conversations/[conversationId]/generate-response
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; conversationId: string } }
) {
  try {
    const projectId = params.id;
    const conversationId = params.conversationId;
    const body = await request.json();
    
    const validatedData = GenerateResponseSchema.parse(body);

    // Generate intelligent AI response
    const result = await responseGenerator.generateResponse({
      projectId,
      conversationId,
      userMessage: validatedData.message,
      phase: validatedData.phase
    });

    return NextResponse.json({
      success: true,
      data: {
        response: result.response,
        messageId: result.messageId,
        actionsCreated: result.actionsCreated,
        phaseChanged: result.phaseChanged,
        newPhase: result.newPhase,
        metrics: result.metrics
      }
    });

  } catch (error) {
    console.error('Error generating AI response:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to generate response'
    }, { status: 500 });
  }
}