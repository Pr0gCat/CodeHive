import { NextRequest, NextResponse } from 'next/server';
import { FeatureRequestProcessor } from '@/lib/feature-request/processor';
import { z } from 'zod';

// Feature request schema
const featureRequestSchema = z.object({
  request: z
    .string()
    .min(5, 'Feature request must be at least 5 characters')
    .max(1000, 'Feature request too long'),
  autoCreateCycles: z.boolean().default(true),
  updateClaudeMd: z.boolean().default(true),
});

// GET /api/projects/[id]/feature-requests - Get project backlog status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const processor = new FeatureRequestProcessor();

    const backlogStatus = await processor.getProjectBacklogStatus(projectId);

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        backlog: backlogStatus,
        message: 'Backlog status retrieved successfully',
      },
    });
  } catch (error) {
    console.error('Error getting backlog status:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get backlog status',
      },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/feature-requests - Process new feature request
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const body = await request.json();

    // Validate input
    const validatedData = featureRequestSchema.parse(body);
    const {
      request: featureRequest,
      autoCreateCycles,
      updateClaudeMd,
    } = validatedData;

    // Validate feature request quality
    const processor = new FeatureRequestProcessor();
    const validation = processor.validateFeatureRequest(featureRequest);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Feature request validation failed',
          details: {
            issues: validation.issues,
            suggestions: validation.suggestions,
          },
        },
        { status: 400 }
      );
    }

    console.log(
      `🎯 Processing feature request for project ${projectId}: "${featureRequest}"`
    );

    // Process the complete feature request
    const result = await processor.processCompleteFeatureRequest(
      featureRequest,
      projectId,
      {
        autoCreateCycles,
        updateClaudeMd,
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

    return NextResponse.json({
      success: true,
      data: {
        message: 'Feature request processed successfully',
        epicId: result.epicId,
        storyCount: result.storyIds?.length || 0,
        cycleCount: result.cycleIds?.length || 0,
        executionTime: result.executionTime,
        analysis: {
          epicTitle: result.analysis?.epicTitle,
          storyTitles: result.analysis?.stories.map(s => s.title) || [],
          estimatedComplexity: result.analysis?.estimatedComplexity,
        },
      },
    });
  } catch (error) {
    console.error('Error processing feature request:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input data',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to process feature request',
      },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id]/feature-requests - Optimize project backlog
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const processor = new FeatureRequestProcessor();

    console.log(`🎯 Optimizing backlog for project: ${projectId}`);

    const result = await processor.optimizeBacklog(projectId);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Backlog optimized successfully',
        reorderedEpics: result.reorderedEpics,
        reorderedStories: result.reorderedStories,
      },
    });
  } catch (error) {
    console.error('Error optimizing backlog:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to optimize backlog',
      },
      { status: 500 }
    );
  }
}
