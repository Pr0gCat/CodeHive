import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { type UpdateStoryInput } from '@/lib/models/types';

const hierarchyManager = new HierarchyManager(prisma);

/**
 * GET /api/hierarchy/stories/[id] - 取得 Story 詳細資料
 * Query parameters:
 * - includeRelations: 是否包含關聯資料（預設 true）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const storyId = params.id;
    const { searchParams } = new URL(request.url);
    const includeRelations = searchParams.get('includeRelations') !== 'false';

    const story = await hierarchyManager.getStory(storyId, includeRelations);
    
    if (!story) {
      return NextResponse.json(
        {
          success: false,
          error: 'Story 不存在'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: story
    });
  } catch (error) {
    console.error('取得 Story 詳細資料失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法取得 Story 詳細資料',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/hierarchy/stories/[id] - 更新 Story
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const storyId = params.id;
    const body = await request.json();

    // 檢查 Story 是否存在
    const existingStory = await hierarchyManager.getStory(storyId);
    if (!existingStory) {
      return NextResponse.json(
        {
          success: false,
          error: 'Story 不存在'
        },
        { status: 404 }
      );
    }

    const updateData: UpdateStoryInput = {};
    
    // 只更新提供的欄位
    if (body.title !== undefined) updateData.title = body.title;
    if (body.userStory !== undefined) updateData.userStory = body.userStory;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.acceptanceCriteria !== undefined) updateData.acceptanceCriteria = body.acceptanceCriteria;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.storyPoints !== undefined) updateData.storyPoints = body.storyPoints;
    if (body.iteration !== undefined) updateData.iteration = body.iteration;
    if (body.actualTime !== undefined) updateData.actualTime = body.actualTime;

    const updatedStory = await hierarchyManager.updateStory(storyId, updateData);
    
    // 獲取更新後的關聯資料
    const storyWithRelations = await hierarchyManager.getStory(storyId, true);
    
    return NextResponse.json({
      success: true,
      data: storyWithRelations,
      message: 'Story 更新成功'
    });
  } catch (error) {
    console.error('更新 Story 失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法更新 Story',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hierarchy/stories/[id] - 刪除 Story
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const storyId = params.id;

    // 檢查 Story 是否存在
    const existingStory = await hierarchyManager.getStory(storyId);
    if (!existingStory) {
      return NextResponse.json(
        {
          success: false,
          error: 'Story 不存在'
        },
        { status: 404 }
      );
    }

    // 檢查是否有相關的 Tasks
    const tasks = await hierarchyManager.listTasks({ storyId });
    if (tasks.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '無法刪除含有 Tasks 的 Story',
          details: `此 Story 包含 ${tasks.length} 個 Tasks，請先刪除或移動這些 Tasks`
        },
        { status: 409 } // Conflict
      );
    }

    const success = await hierarchyManager.deleteStory(storyId);
    
    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: '刪除 Story 失敗'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Story 刪除成功'
    });
  } catch (error) {
    console.error('刪除 Story 失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法刪除 Story',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}