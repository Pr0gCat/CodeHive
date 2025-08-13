import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { HierarchyIntegration } from '@/lib/agents/hierarchy-integration';
import { ProjectAgent } from '@/lib/agents/project-agent';
import { ModelStatus } from '@/lib/models/types';

const hierarchyManager = new HierarchyManager(prisma);

/**
 * POST /api/hierarchy/instructions/[id]/execute - 執行 Instruction
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const instructionId = params.id;
    
    // 檢查 Instruction 是否存在
    const instruction = await hierarchyManager.getInstruction(instructionId);
    if (!instruction) {
      return NextResponse.json(
        {
          success: false,
          error: 'Instruction 不存在'
        },
        { status: 404 }
      );
    }

    // 檢查 Instruction 是否已經在執行中或已完成
    if (instruction.status === ModelStatus.IN_PROGRESS) {
      return NextResponse.json(
        {
          success: false,
          error: 'Instruction 正在執行中'
        },
        { status: 409 }
      );
    }

    if (instruction.status === ModelStatus.COMPLETED) {
      return NextResponse.json(
        {
          success: false,
          error: 'Instruction 已經完成',
          data: instruction
        },
        { status: 409 }
      );
    }

    // 獲取相關的 Task 資訊以取得 projectId
    const task = await hierarchyManager.getTask(instruction.taskId, true);
    if (!task || !task.story) {
      return NextResponse.json(
        {
          success: false,
          error: '找不到相關的 Task 或 Story 資訊'
        },
        { status: 404 }
      );
    }

    // 創建 ProjectAgent 來執行指令
    const projectAgent = new ProjectAgent({
      projectId: task.story.epic.projectId,
      projectPath: `/tmp/project-${task.story.epic.projectId}`,
      maxTokens: 4000
    }, prisma);

    try {
      // 初始化 ProjectAgent
      await projectAgent.initialize();
      
      // 創建 HierarchyIntegration
      const hierarchyIntegration = new HierarchyIntegration(projectAgent, hierarchyManager);
      
      // 執行指令
      const result = await hierarchyIntegration.executeInstruction(instructionId);
      
      // 清理資源
      await hierarchyIntegration.cleanup();
      await projectAgent.cleanup();
      
      return NextResponse.json({
        success: true,
        data: {
          instructionId,
          result,
          executionSummary: {
            success: result.success,
            executionTime: result.executionTime,
            tokenUsage: result.tokenUsage,
            output: result.output?.substring(0, 500) + (result.output?.length > 500 ? '...' : ''),
            error: result.error
          }
        },
        message: result.success ? 'Instruction 執行成功' : 'Instruction 執行失敗'
      });
    } catch (executionError) {
      // 確保更新 instruction 狀態為失敗
      await hierarchyManager.updateInstruction(instructionId, {
        status: ModelStatus.FAILED,
        error: executionError instanceof Error ? executionError.message : String(executionError),
        executionTime: 0,
        executedBy: 'API'
      });
      
      throw executionError;
    }
  } catch (error) {
    console.error('執行 Instruction 失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法執行 Instruction',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}