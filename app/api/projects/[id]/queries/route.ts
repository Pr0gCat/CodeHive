import { checkProjectOperationAccess } from '@/lib/project-access-control';
import { NextRequest, NextResponse } from 'next/server';

interface QueryWhereClause {
  projectId: string;
  status?: string;
  urgency?: string;
  cycleId?: string;
  context?: {
    contains: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Lazy load prisma to ensure it's initialized
    const { prisma } = await import('@/lib/db');
    
    // Verify project exists
    const project = await prisma.projectIndex.findUnique({
      where: { id: params.id },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Return empty queries array since Query model doesn't exist in current schema
    return NextResponse.json({
      success: true,
      data: [],
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
    // Lazy load prisma to ensure it's initialized
    const { prisma } = await import('@/lib/db');
    
    // Check if project can be operated on
    const accessCheck = await checkProjectOperationAccess(params.id);

    if (!accessCheck.allowed) {
      return accessCheck.response;
    }

    // Query model doesn't exist in current schema, return success with empty response
    return NextResponse.json({
      success: true,
      data: { message: 'Query functionality not available in current schema' },
    });
  } catch (error) {
    console.error('Error creating query:', error);
    return NextResponse.json(
      { success: false, error: '無法創建查詢' },
      { status: 500 }
    );
  }
}
