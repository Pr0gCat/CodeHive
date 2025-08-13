/**
 * 批量操作 API
 * 提供批量處理和工作流程自動化的 API 端點
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { BatchOperationsManager } from '@/lib/batch/batch-operations';

// 全局批量操作管理器實例
let batchManagerInstance: BatchOperationsManager | null = null;

function getBatchManager(): BatchOperationsManager {
  if (!batchManagerInstance) {
    const hierarchyManager = new HierarchyManager(prisma);
    batchManagerInstance = new BatchOperationsManager(prisma, hierarchyManager);
  }
  return batchManagerInstance;
}

/**
 * POST /api/batch/operations - 創建批量操作
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...requestData } = body;

    const batchManager = getBatchManager();

    switch (action) {
      case 'create_batch': {
        const { type, targetType, items, options, metadata, createdBy } = requestData;

        if (!type || !targetType || !items || !createdBy) {
          return NextResponse.json(
            {
              success: false,
              error: '缺少必要參數',
              required: ['type', 'targetType', 'items', 'createdBy']
            },
            { status: 400 }
          );
        }

        const operationId = await batchManager.createBatchOperation({
          type,
          targetType,
          items,
          options,
          metadata,
          createdBy
        });

        return NextResponse.json({
          success: true,
          data: {
            action: 'create_batch',
            operationId,
            timestamp: new Date().toISOString()
          }
        }, { status: 201 });
      }

      case 'execute_workflow': {
        const { workflowId, context } = requestData;

        if (!workflowId) {
          return NextResponse.json(
            {
              success: false,
              error: '工作流程 ID 是必填的',
              required: ['workflowId']
            },
            { status: 400 }
          );
        }

        const executionId = await batchManager.executeWorkflow(workflowId, context || {});

        return NextResponse.json({
          success: true,
          data: {
            action: 'execute_workflow',
            executionId,
            timestamp: new Date().toISOString()
          }
        }, { status: 201 });
      }

      case 'cancel_operation': {
        const { operationId } = requestData;

        if (!operationId) {
          return NextResponse.json(
            {
              success: false,
              error: '操作 ID 是必填的',
              required: ['operationId']
            },
            { status: 400 }
          );
        }

        await batchManager.cancelBatchOperation(operationId);

        return NextResponse.json({
          success: true,
          data: {
            action: 'cancel_operation',
            operationId,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'add_workflow': {
        const { workflow } = requestData;

        if (!workflow || !workflow.id || !workflow.name) {
          return NextResponse.json(
            {
              success: false,
              error: '工作流程定義不完整',
              required: ['workflow.id', 'workflow.name']
            },
            { status: 400 }
          );
        }

        batchManager.addWorkflow(workflow);

        return NextResponse.json({
          success: true,
          data: {
            action: 'add_workflow',
            workflowId: workflow.id,
            timestamp: new Date().toISOString()
          }
        }, { status: 201 });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `不支援的操作: ${action}`,
            availableActions: [
              'create_batch',
              'execute_workflow',
              'cancel_operation',
              'add_workflow'
            ]
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('批量操作失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '批量操作失敗',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/batch/operations - 獲取批量操作狀態
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const operationId = searchParams.get('operationId');
    const executionId = searchParams.get('executionId');

    const batchManager = getBatchManager();

    switch (action) {
      case 'get_operation': {
        if (!operationId) {
          return NextResponse.json(
            {
              success: false,
              error: '操作 ID 是必填的',
              required: ['operationId']
            },
            { status: 400 }
          );
        }

        const operation = batchManager.getBatchOperation(operationId);
        if (!operation) {
          return NextResponse.json(
            {
              success: false,
              error: `找不到操作: ${operationId}`
            },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            action: 'get_operation',
            operation,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'list_operations': {
        const operations = batchManager.getAllBatchOperations();

        return NextResponse.json({
          success: true,
          data: {
            action: 'list_operations',
            operations,
            count: operations.length,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'get_execution': {
        if (!executionId) {
          return NextResponse.json(
            {
              success: false,
              error: '執行 ID 是必填的',
              required: ['executionId']
            },
            { status: 400 }
          );
        }

        const execution = batchManager.getWorkflowExecution(executionId);
        if (!execution) {
          return NextResponse.json(
            {
              success: false,
              error: `找不到執行: ${executionId}`
            },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            action: 'get_execution',
            execution,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'list_workflows': {
        const workflows = batchManager.getAllWorkflows();

        return NextResponse.json({
          success: true,
          data: {
            action: 'list_workflows',
            workflows,
            count: workflows.length,
            timestamp: new Date().toISOString()
          }
        });
      }

      case 'get_stats': {
        const stats = batchManager.getBatchStats();

        return NextResponse.json({
          success: true,
          data: {
            action: 'get_stats',
            stats,
            timestamp: new Date().toISOString()
          }
        });
      }

      default:
        // 如果沒有指定 action，返回系統狀態
        const stats = batchManager.getBatchStats();
        const workflows = batchManager.getAllWorkflows();

        return NextResponse.json({
          success: true,
          data: {
            status: 'active',
            stats,
            availableWorkflows: workflows.length,
            timestamp: new Date().toISOString()
          }
        });
    }
  } catch (error) {
    console.error('獲取批量操作資訊失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: '無法獲取批量操作資訊',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}