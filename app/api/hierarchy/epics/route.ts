import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { ModelStatus, Priority, type CreateEpicInput, type EpicFilter } from '@/lib/models/types';

const hierarchyManager = new HierarchyManager(prisma);

/**
 * GET /api/hierarchy/epics - 取得 Epic 列表（使用新的階層化模型）
 * Query parameters:
 * - projectId: 專案 ID（必填）
 * - status: 狀態篩選（可選，逗號分隔）
 * - priority: 優先級篩選（可選，逗號分隔）
 * - phase: 階段篩選（可選）
 * - includeRelations: 是否包含關聯資料（可選，預設 false）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const phase = searchParams.get('phase');
    const createdBy = searchParams.get('createdBy');
    const includeRelations = searchParams.get('includeRelations') === 'true';

    if (!projectId) {
      return NextResponse.json(
        { error: '專案 ID 是必填的' },
        { status: 400 }
      );
    }

    const filter: EpicFilter = { projectId };
    
    if (status) {
      const statusList = status.split(',');
      filter.status = statusList.length === 1 ? statusList[0] as ModelStatus : statusList as ModelStatus[];
    }
    
    if (priority) {
      const priorityList = priority.split(',').map(p => parseInt(p) as Priority);
      filter.priority = priorityList.length === 1 ? priorityList[0] : priorityList;
    }
    
    if (phase) {
      filter.phase = phase;
    }

    if (createdBy) {
      filter.createdBy = createdBy;
    }

    const epics = await hierarchyManager.listEpics(filter);
    
    // 如果需要包含關聯資料，獲取詳細信息
    let epicsWithDetails = epics;
    if (includeRelations) {
      epicsWithDetails = await Promise.all(
        epics.map(async (epic) => {
          const epicWithRelations = await hierarchyManager.getEpic(epic.id, true);
          const statistics = await hierarchyManager.getEpicStatistics(epic.id);
          return {
            ...epicWithRelations,
            statistics
          };
        })
      );
    }
    
    return NextResponse.json({
      success: true,
      data: epicsWithDetails,
      count: epics.length,
      metadata: {
        projectId,
        filters: {
          status: status?.split(','),
          priority: priority?.split(',').map(p => parseInt(p)),
          phase,
          createdBy
        },
        includeRelations
      }
    });
  } catch (error) {
    console.error('取得 Epic 列表失敗:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '無法取得 Epic 列表',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hierarchy/epics - 創建新的 Epic（使用新的階層化模型）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 驗證必填欄位
    if (!body.projectId || !body.title) {
      return NextResponse.json(
        { 
          success: false,
          error: '專案 ID 和標題是必填的',
          required: ['projectId', 'title']
        },
        { status: 400 }
      );
    }

    const epicData: CreateEpicInput = {
      projectId: body.projectId,
      title: body.title,
      description: body.description,
      businessValue: body.businessValue,
      acceptanceCriteria: body.acceptanceCriteria,
      priority: body.priority || Priority.MEDIUM,
      phase: body.phase,
      estimatedEffort: body.estimatedEffort,
      createdBy: body.createdBy || 'API'
    };

    const epic = await hierarchyManager.createEpic(epicData);
    
    // 獲取包含統計資料的完整 Epic 信息
    const epicWithStats = await hierarchyManager.getEpicStatistics(epic.id);
    
    return NextResponse.json({
      success: true,
      data: {
        ...epic,
        statistics: epicWithStats
      },
      message: '史詩創建成功'
    }, { status: 201 });
  } catch (error) {
    console.error('創建 Epic 失敗:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '無法創建 Epic',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}