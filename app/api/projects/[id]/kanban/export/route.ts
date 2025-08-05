import { NextRequest, NextResponse } from 'next/server';
import { KanbanBoardSerializer } from '@/lib/kanban/board-serializer';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    // Serialize the kanban board
    const boardData = await KanbanBoardSerializer.serializeBoard(projectId);

    if (format === 'summary') {
      // Return human-readable summary
      const summary = KanbanBoardSerializer.generateBoardSummary(boardData);

      return new Response(summary, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="kanban-summary-${projectId}.txt"`,
        },
      });
    }

    // Return full JSON data
    return NextResponse.json({
      success: true,
      data: boardData,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    console.error('Error exporting kanban board:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export kanban board',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
