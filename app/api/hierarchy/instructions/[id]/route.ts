import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { ExecutionManager, ClaudeCodeExecutor } from '@/lib/agents/executor';
import { ModelStatus, type UpdateInstructionInput } from '@/lib/models/types';

const hierarchyManager = new HierarchyManager(prisma);

// 初始化執行管理器（如果需要執行指令）
const executionManager: ExecutionManager | null = null;

/**
 * GET /api/hierarchy/instructions/[id] - 取得 Instruction 詳細資料
 * Query parameters:
 * - includeRelations: 是否包含關聯資料（預設 true）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const instructionId = params.id;
    const { searchParams } = new URL(request.url);
    const includeRelations = searchParams.get('includeRelations') !== 'false';

    const instruction = await hierarchyManager.getInstruction(instructionId, includeRelations);
    
    if (!instruction) {
      return NextResponse.json(
        {
          success: false,
          error: 'Instruction 不存在'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: instruction
    });
  } catch (error) {
    console.error('取得 Instruction 詳細資料失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法取得 Instruction 詳細資料',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/hierarchy/instructions/[id] - 更新 Instruction
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const instructionId = params.id;
    const body = await request.json();

    // 檢查 Instruction 是否存在
    const existingInstruction = await hierarchyManager.getInstruction(instructionId);
    if (!existingInstruction) {
      return NextResponse.json(
        {
          success: false,
          error: 'Instruction 不存在'
        },
        { status: 404 }
      );
    }

    const updateData: UpdateInstructionInput = {};
    
    // 只更新提供的欄位
    if (body.directive !== undefined) updateData.directive = body.directive;
    if (body.expectedOutcome !== undefined) updateData.expectedOutcome = body.expectedOutcome;
    if (body.validationCriteria !== undefined) updateData.validationCriteria = body.validationCriteria;
    if (body.sequence !== undefined) updateData.sequence = body.sequence;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.output !== undefined) updateData.output = body.output;
    if (body.error !== undefined) updateData.error = body.error;
    if (body.tokenUsage !== undefined) updateData.tokenUsage = body.tokenUsage;
    if (body.executionTime !== undefined) updateData.executionTime = body.executionTime;
    if (body.executedBy !== undefined) updateData.executedBy = body.executedBy;

    const updatedInstruction = await hierarchyManager.updateInstruction(instructionId, updateData);
    
    // 獲取更新後的關聯資料
    const instructionWithRelations = await hierarchyManager.getInstruction(instructionId, true);
    
    return NextResponse.json({
      success: true,
      data: instructionWithRelations,
      message: 'Instruction 更新成功'
    });
  } catch (error) {
    console.error('更新 Instruction 失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法更新 Instruction',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hierarchy/instructions/[id] - 刪除 Instruction
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const instructionId = params.id;

    // 檢查 Instruction 是否存在
    const existingInstruction = await hierarchyManager.getInstruction(instructionId);
    if (!existingInstruction) {
      return NextResponse.json(
        {
          success: false,
          error: 'Instruction 不存在'
        },
        { status: 404 }
      );
    }

    const success = await hierarchyManager.deleteInstruction(instructionId);
    
    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: '刪除 Instruction 失敗'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Instruction 刪除成功'
    });
  } catch (error) {
    console.error('刪除 Instruction 失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法刪除 Instruction',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}