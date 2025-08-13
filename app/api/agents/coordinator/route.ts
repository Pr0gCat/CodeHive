/**
 * 智能代理協調 API
 * 提供代理管理和任務協調功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { SmartCoordinator } from '@/lib/agents/smart-coordinator';

// 全局協調器實例（在生產環境中應該使用適當的狀態管理）
let coordinatorInstance: SmartCoordinator | null = null;

function getCoordinator(): SmartCoordinator {
  if (!coordinatorInstance) {
    const hierarchyManager = new HierarchyManager(prisma);
    coordinatorInstance = new SmartCoordinator(prisma, hierarchyManager);
  }
  return coordinatorInstance;
}

/**
 * GET /api/agents/coordinator - 獲取協調器狀態和統計
 */
export async function GET(request: NextRequest) {
  try {
    const coordinator = getCoordinator();
    const stats = coordinator.getCoordinationStats();
    
    return NextResponse.json({
      success: true,
      data: {
        status: 'active',
        stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('獲取協調器狀態失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法獲取協調器狀態',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/coordinator - 執行任務協調
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      projectId, 
      action, 
      strategy = 'skill-matched',
      options = {} 
    } = body;

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: '專案 ID 是必填的',
          required: ['projectId']
        },
        { status: 400 }
      );
    }

    const coordinator = getCoordinator();

    switch (action) {
      case 'coordinate': {
        // 執行任務協調
        const result = await coordinator.coordinateExecution(
          projectId,
          strategy,
          options
        );

        return NextResponse.json({
          success: true,
          data: {
            action: 'coordinate',
            result,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'register_agent': {
        // 註冊新代理
        const { capabilityId } = body;
        if (!capabilityId) {
          return NextResponse.json(
            {
              success: false,
              error: '代理能力 ID 是必填的',
              required: ['capabilityId']
            },
            { status: 400 }
          );
        }

        const agentId = await coordinator.registerAgent(capabilityId);

        return NextResponse.json({
          success: true,
          data: {
            action: 'register_agent',
            agentId,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'heartbeat': {
        // 代理心跳
        const { agentId, status } = body;
        if (!agentId) {
          return NextResponse.json(
            {
              success: false,
              error: '代理 ID 是必填的',
              required: ['agentId']
            },
            { status: 400 }
          );
        }

        coordinator.updateAgentHeartbeat(agentId, status);

        return NextResponse.json({
          success: true,
          data: {
            action: 'heartbeat',
            agentId,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'get_capabilities': {
        // 獲取可用能力列表
        const capabilities = Array.from((coordinator as any).capabilities.values());

        return NextResponse.json({
          success: true,
          data: {
            action: 'get_capabilities',
            capabilities,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'get_agents': {
        // 獲取代理列表
        const agents = Array.from((coordinator as any).agents.values());

        return NextResponse.json({
          success: true,
          data: {
            action: 'get_agents',
            agents,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'get_assignments': {
        // 獲取任務分配狀況
        const assignments = Array.from((coordinator as any).assignments.values());

        return NextResponse.json({
          success: true,
          data: {
            action: 'get_assignments',
            assignments,
            timestamp: new Date().toISOString()
          }
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `不支援的操作: ${action}`,
            availableActions: [
              'coordinate',
              'register_agent', 
              'heartbeat',
              'get_capabilities',
              'get_agents',
              'get_assignments'
            ]
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('代理協調失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '代理協調操作失敗',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}