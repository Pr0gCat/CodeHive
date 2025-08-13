import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { TaskType, type UpdateTaskInput } from '@/lib/models/types';

const hierarchyManager = new HierarchyManager(prisma);

/**
 * GET /api/hierarchy/tasks/[id] - 取得 Task 詳細資料
 * Query parameters:
 * - includeRelations: 是否包含關聯資料（預設 true）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const { searchParams } = new URL(request.url);
    const includeRelations = searchParams.get('includeRelations') !== 'false';

    const task = await hierarchyManager.getTask(taskId, includeRelations);
    
    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task 不存在'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('取得 Task 詳細資料失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法取得 Task 詳細資料',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/hierarchy/tasks/[id] - 更新 Task
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const body = await request.json();

    // 檢查 Task 是否存在
    const existingTask = await hierarchyManager.getTask(taskId);
    if (!existingTask) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task 不存在'
        },
        { status: 404 }
      );
    }

    const updateData: UpdateTaskInput = {};
    
    // 只更新提供的欄位
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.type !== undefined) {
      // 驗證 TaskType
      if (!Object.values(TaskType).includes(body.type)) {
        return NextResponse.json(
          { 
            success: false,
            error: '無效的任務類型',
            validTypes: Object.values(TaskType)
          },
          { status: 400 }
        );
      }
      updateData.type = body.type as TaskType;
    }
    if (body.acceptanceCriteria !== undefined) updateData.acceptanceCriteria = body.acceptanceCriteria;
    if (body.expectedOutcome !== undefined) updateData.expectedOutcome = body.expectedOutcome;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.estimatedTime !== undefined) updateData.estimatedTime = body.estimatedTime;
    if (body.actualTime !== undefined) updateData.actualTime = body.actualTime;
    if (body.retryCount !== undefined) updateData.retryCount = body.retryCount;
    if (body.assignedAgent !== undefined) updateData.assignedAgent = body.assignedAgent;

    const updatedTask = await hierarchyManager.updateTask(taskId, updateData);
    
    // 獲取更新後的關聯資料
    const taskWithRelations = await hierarchyManager.getTask(taskId, true);
    
    return NextResponse.json({
      success: true,
      data: taskWithRelations,
      message: 'Task 更新成功'
    });
  } catch (error) {
    console.error('更新 Task 失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法更新 Task',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hierarchy/tasks/[id] - 刪除 Task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;

    // 檢查 Task 是否存在
    const existingTask = await hierarchyManager.getTask(taskId);
    if (!existingTask) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task 不存在'
        },
        { status: 404 }
      );
    }

    // 檢查是否有相關的 Instructions
    const instructions = await hierarchyManager.listInstructions({ taskId });
    if (instructions.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '無法刪除含有 Instructions 的 Task',
          details: `此 Task 包含 ${instructions.length} 個 Instructions，請先刪除這些 Instructions`
        },
        { status: 409 } // Conflict
      );
    }

    const success = await hierarchyManager.deleteTask(taskId);
    
    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: '刪除 Task 失敗'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Task 刪除成功'
    });
  } catch (error) {
    console.error('刪除 Task 失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法刪除 Task',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}