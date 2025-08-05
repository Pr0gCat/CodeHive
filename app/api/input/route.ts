import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FeatureRequestProcessor } from '@/lib/feature-request/processor';
import { getDefaultProjectId } from '@/lib/config';

// Input schema based on improved architecture
const inputSchema = z.object({
  message: z
    .string()
    .min(5, 'Message must be at least 5 characters')
    .max(2000, 'Message too long'),
  conversationId: z.string().optional(),
  projectId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = inputSchema.parse(body);
    const { message, conversationId, projectId } = validatedData;

    // Use provided project ID or get default project
    const targetProjectId = projectId || (await getDefaultProjectId());

    if (!targetProjectId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No project available. Please create a project first.',
        },
        { status: 400 }
      );
    }

    console.log(`🎯 Processing user input: "${message}"`);
    console.log(`📁 Target project: ${targetProjectId}`);
    if (conversationId) {
      console.log(`💬 Conversation: ${conversationId}`);
    }

    // Process the input through the feature request system
    const processor = new FeatureRequestProcessor();

    // Validate the input quality
    const validation = processor.validateFeatureRequest(message);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Input validation failed',
          details: {
            issues: validation.issues,
            suggestions: validation.suggestions,
          },
        },
        { status: 400 }
      );
    }

    // Process the complete feature request
    const result = await processor.processCompleteFeatureRequest(
      message,
      targetProjectId,
      {
        autoCreateCycles: true,
        updateClaudeMd: true,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    // Return response in improved architecture format
    return NextResponse.json({
      acknowledged: true,
      epic: {
        id: result.epicId,
        title: result.analysis?.epicTitle || 'New Feature',
        estimatedCycles: result.cycleIds?.length || 0,
        estimatedCompletion: new Date(
          Date.now() + (result.cycleIds?.length || 1) * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split('T')[0], // Rough estimate
      },
      conversation: {
        id: conversationId || `conv-${Date.now()}`,
        threadId: result.epicId,
      },
      project: {
        id: targetProjectId,
      },
      analysis: {
        storyCount: result.storyIds?.length || 0,
        cycleCount: result.cycleIds?.length || 0,
        complexity: result.analysis?.estimatedComplexity || 'MEDIUM',
      },
    });
  } catch (error) {
    console.error('Error processing user input:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input format',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to process input',
      },
      { status: 500 }
    );
  }
}
