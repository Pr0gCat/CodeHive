import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { ModelStatus, type CreateInstructionInput, type InstructionFilter } from '@/lib/models/types';

const hierarchyManager = new HierarchyManager(prisma);

/**
 * GET /api/hierarchy/instructions - 取得 Instruction 列表
 * Query parameters:
 * - taskId: Task ID（可選）
 * - status: 狀態篩選（可選，逗號分隔）
 * - executedBy: 執行者篩選（可選）
 * - includeRelations: 是否包含關聯資料（可選，預設 false）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const status = searchParams.get('status');
    const executedBy = searchParams.get('executedBy');
    const includeRelations = searchParams.get('includeRelations') === 'true';

    const filter: InstructionFilter = {};
    
    if (taskId) filter.taskId = taskId;
    
    if (status) {
      const statusList = status.split(',');
      filter.status = statusList.length === 1 ? statusList[0] as ModelStatus : statusList as ModelStatus[];
    }
    
    if (executedBy) {
      filter.executedBy = executedBy;
    }

    const instructions = await hierarchyManager.listInstructions(filter);
    
    // 如果需要包含關聯資料，獲取詳細信息
    let instructionsWithDetails = instructions;
    if (includeRelations) {
      instructionsWithDetails = await Promise.all(
        instructions.map(async (instruction) => {
          const instructionWithRelations = await hierarchyManager.getInstruction(instruction.id, true);
          return instructionWithRelations;
        })
      );
    }
    
    return NextResponse.json({
      success: true,
      data: instructionsWithDetails,
      count: instructions.length,
      metadata: {
        filters: {
          taskId,
          status: status?.split(','),
          executedBy
        },
        includeRelations
      }
    });
  } catch (error) {
    console.error('取得 Instruction 列表失敗:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '無法取得 Instruction 列表',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hierarchy/instructions - 創建新的 Instruction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 驗證必填欄位
    if (!body.taskId || !body.directive || !body.expectedOutcome) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Task ID、指令和預期結果是必填的',
          required: ['taskId', 'directive', 'expectedOutcome']
        },
        { status: 400 }
      );
    }

    // 驗證 Task 是否存在
    const task = await hierarchyManager.getTask(body.taskId);
    if (!task) {
      return NextResponse.json(
        { 
          success: false,
          error: '指定的 Task 不存在'
        },
        { status: 404 }
      );
    }

    // 如果沒有提供 sequence，自動計算下一個序號
    let sequence = body.sequence;
    if (!sequence) {
      const existingInstructions = await hierarchyManager.listInstructions({ taskId: body.taskId });
      sequence = Math.max(0, ...existingInstructions.map(i => i.sequence)) + 1;
    }

    const instructionData: CreateInstructionInput = {
      taskId: body.taskId,
      directive: body.directive,
      expectedOutcome: body.expectedOutcome,
      validationCriteria: body.validationCriteria,
      sequence
    };

    const instruction = await hierarchyManager.createInstruction(instructionData);
    
    // 獲取包含關聯資料的完整 Instruction 信息
    const instructionWithRelations = await hierarchyManager.getInstruction(instruction.id, true);
    
    return NextResponse.json({
      success: true,
      data: instructionWithRelations,
      message: '指令創建成功'
    }, { status: 201 });
  } catch (error) {
    console.error('創建 Instruction 失敗:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '無法創建 Instruction',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}