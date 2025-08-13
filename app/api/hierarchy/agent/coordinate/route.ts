import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { HierarchyIntegration } from '@/lib/agents/hierarchy-integration';
import { ProjectAgent, ProjectPhase } from '@/lib/agents/project-agent';

const hierarchyManager = new HierarchyManager(prisma);

/**
 * POST /api/hierarchy/agent/coordinate - 協調 ProjectAgent 與階層系統
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, action, data } = body;

    if (!projectId || !action) {
      return NextResponse.json(
        {
          success: false,
          error: '專案 ID 和操作類型是必填的',
          required: ['projectId', 'action']
        },
        { status: 400 }
      );
    }

    // 創建 ProjectAgent
    const projectAgent = new ProjectAgent({
      projectId,
      projectPath: data?.projectPath || `/tmp/project-${projectId}`,
      maxTokens: data?.maxTokens || 4000
    }, prisma);

    try {
      await projectAgent.initialize();
      const hierarchyIntegration = new HierarchyIntegration(projectAgent, hierarchyManager);

      let result: any;

      switch (action) {
        case 'create_epic':
          // 創建專案 Epic
          if (!data?.phase) {
            throw new Error('階段 (phase) 是必填的');
          }
          result = await hierarchyIntegration.createProjectEpic(
            projectId,
            data.phase as ProjectPhase,
            data.requirements
          );
          break;

        case 'generate_stories':
          // 基於對話生成 Stories
          if (!data?.epicId) {
            throw new Error('Epic ID 是必填的');
          }
          result = await hierarchyIntegration.generateStoriesFromConversation(
            data.epicId,
            data.conversationHistory || []
          );
          break;

        case 'generate_tasks':
          // 為 Story 生成 Tasks
          if (!data?.storyId) {
            throw new Error('Story ID 是必填的');
          }
          result = await hierarchyIntegration.generateTasksForStory(data.storyId);
          break;

        case 'generate_instructions':
          // 為 Task 生成 Instructions
          if (!data?.taskId) {
            throw new Error('Task ID 是必填的');
          }
          result = await hierarchyIntegration.generateInstructionsForTask(data.taskId);
          break;

        case 'execute_instruction':
          // 執行指令
          if (!data?.instructionId) {
            throw new Error('Instruction ID 是必填的');
          }
          result = await hierarchyIntegration.executeInstruction(data.instructionId);
          break;

        case 'handle_conversation':
          // 處理對話
          if (!data?.message) {
            throw new Error('對話訊息是必填的');
          }
          result = await projectAgent.handleConversation(data.message);
          break;

        case 'transition_phase':
          // 轉換階段
          if (!data?.newPhase) {
            throw new Error('新階段是必填的');
          }
          await projectAgent.transitionPhase(data.newPhase as ProjectPhase, data.reason);
          result = { phase: data.newPhase, reason: data.reason };
          break;

        case 'get_status':
          // 獲取當前狀態
          const state = hierarchyIntegration.getCurrentState();
          const agentPhase = projectAgent.getPhase();
          const agentState = projectAgent.getState();
          const contextData = projectAgent.getProjectContextData();
          
          result = {
            agent: {
              state: agentState,
              phase: agentPhase
            },
            hierarchy: state,
            context: contextData
          };
          break;

        case 'health_check':
          // 健康檢查
          result = await projectAgent.healthCheck();
          break;

        default:
          throw new Error(`不支援的操作類型: ${action}`);
      }

      await hierarchyIntegration.cleanup();
      await projectAgent.cleanup();

      return NextResponse.json({
        success: true,
        action,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (actionError) {
      // 確保清理資源
      try {
        await projectAgent.cleanup();
      } catch (cleanupError) {
        console.warn('清理 ProjectAgent 失敗:', cleanupError);
      }
      
      throw actionError;
    }

  } catch (error) {
    console.error('協調 ProjectAgent 失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法協調 ProjectAgent',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}