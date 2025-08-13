import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { ModelStatus, type UpdateEpicInput } from '@/lib/models/types';

const hierarchyManager = new HierarchyManager(prisma);

/**
 * GET /api/hierarchy/epics/[id] - 取得 Epic 詳細資料
 * Query parameters:
 * - includeRelations: 是否包含關聯資料（預設 true）
 * - includeProgress: 是否包含進度資料（預設 true）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const epicId = params.id;
    const { searchParams } = new URL(request.url);
    const includeRelations = searchParams.get('includeRelations') !== 'false';
    const includeProgress = searchParams.get('includeProgress') !== 'false';

    const epic = await hierarchyManager.getEpic(epicId, includeRelations);
    
    if (!epic) {
      return NextResponse.json(
        {
          success: false,
          error: 'Epic 不存在'
        },
        { status: 404 }
      );
    }

    let response: any = epic;

    // 包含統計和進度資料
    if (includeProgress) {
      const statistics = await hierarchyManager.getEpicStatistics(epicId);
      const progress = await hierarchyManager.getHierarchyProgress(epicId);
      
      response = {
        ...epic,
        statistics,
        progress
      };
    }

    return NextResponse.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('取得 Epic 詳細資料失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法取得 Epic 詳細資料',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/hierarchy/epics/[id] - 更新 Epic
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const epicId = params.id;
    const body = await request.json();

    // 檢查 Epic 是否存在
    const existingEpic = await hierarchyManager.getEpic(epicId);
    if (!existingEpic) {
      return NextResponse.json(
        {
          success: false,
          error: 'Epic 不存在'
        },
        { status: 404 }
      );
    }

    const updateData: UpdateEpicInput = {};
    
    // 只更新提供的欄位
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.businessValue !== undefined) updateData.businessValue = body.businessValue;
    if (body.acceptanceCriteria !== undefined) updateData.acceptanceCriteria = body.acceptanceCriteria;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.phase !== undefined) updateData.phase = body.phase;
    if (body.estimatedEffort !== undefined) updateData.estimatedEffort = body.estimatedEffort;
    if (body.actualEffort !== undefined) updateData.actualEffort = body.actualEffort;

    const updatedEpic = await hierarchyManager.updateEpic(epicId, updateData);
    
    // 獲取更新後的統計資料
    const statistics = await hierarchyManager.getEpicStatistics(epicId);
    
    return NextResponse.json({
      success: true,
      data: {
        ...updatedEpic,
        statistics
      },
      message: 'Epic 更新成功'
    });
  } catch (error) {
    console.error('更新 Epic 失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法更新 Epic',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hierarchy/epics/[id] - 刪除 Epic
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const epicId = params.id;

    // 檢查 Epic 是否存在
    const existingEpic = await hierarchyManager.getEpic(epicId);
    if (!existingEpic) {
      return NextResponse.json(
        {
          success: false,
          error: 'Epic 不存在'
        },
        { status: 404 }
      );
    }

    // 檢查是否有相關的 Stories
    const stories = await hierarchyManager.listStories({ epicId });
    if (stories.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '無法刪除含有 Stories 的 Epic',
          details: `此 Epic 包含 ${stories.length} 個 Stories，請先刪除或移動這些 Stories`
        },
        { status: 409 } // Conflict
      );
    }

    const success = await hierarchyManager.deleteEpic(epicId);
    
    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: '刪除 Epic 失敗'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Epic 刪除成功'
    });
  } catch (error) {
    console.error('刪除 Epic 失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法刪除 Epic',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}