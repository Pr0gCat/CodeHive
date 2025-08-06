import { NextRequest, NextResponse } from 'next/server';

// GET /api/epics/[id]/dependencies - Get epic dependencies
// TODO: Epic dependencies not implemented in portable system yet
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({
    success: true,
    data: {
      dependencies: [],
      dependents: [],
    },
    note: 'Epic dependencies not implemented in portable system yet',
  });
}

// POST /api/epics/[id]/dependencies - Add dependency
// TODO: Epic dependencies not implemented in portable system yet
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    {
      success: false,
      error: 'Epic dependencies not implemented in portable system',
      details: 'This feature will be available in a future release',
    },
    { status: 501 }
  );
}