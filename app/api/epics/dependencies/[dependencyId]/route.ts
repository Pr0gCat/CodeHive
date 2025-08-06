import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/epics/dependencies/[dependencyId] - Remove dependency
// TODO: Epic dependencies not implemented in portable system yet
export async function DELETE(
  request: NextRequest,
  { params }: { params: { dependencyId: string } }
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