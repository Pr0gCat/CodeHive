import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { ModelStatus, Priority, TaskType, type CreateTaskInput, type TaskFilter } from '@/lib/models/types';

const hierarchyManager = new HierarchyManager(prisma);

/**
 * GET /api/hierarchy/tasks - 取得 Task 列表
 * Query parameters:
 * - storyId: Story ID（可選）
 * - type: 任務類型篩選（可選，逗號分隔）
 * - status: 狀態篩選（可選，逗號分隔）
 * - priority: 優先級篩選（可選，逗號分隔）
 * - assignedAgent: 指派的代理篩選（可選）
 * - includeRelations: 是否包含關聯資料（可選，預設 false）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storyId = searchParams.get('storyId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assignedAgent = searchParams.get('assignedAgent');
    const includeRelations = searchParams.get('includeRelations') === 'true';

    const filter: TaskFilter = {};
    
    if (storyId) filter.storyId = storyId;
    
    if (type) {
      const typeList = type.split(',');
      filter.type = typeList.length === 1 ? typeList[0] as TaskType : typeList as TaskType[];
    }
    
    if (status) {
      const statusList = status.split(',');
      filter.status = statusList.length === 1 ? statusList[0] as ModelStatus : statusList as ModelStatus[];
    }
    
    if (priority) {
      const priorityList = priority.split(',').map(p => parseInt(p) as Priority);
      filter.priority = priorityList.length === 1 ? priorityList[0] : priorityList;
    }
    
    if (assignedAgent) {
      filter.assignedAgent = assignedAgent;
    }

    const tasks = await hierarchyManager.listTasks(filter);
    
    // 如果需要包含關聯資料，獲取詳細信息
    let tasksWithDetails = tasks;
    if (includeRelations) {
      tasksWithDetails = await Promise.all(
        tasks.map(async (task) => {
          const taskWithRelations = await hierarchyManager.getTask(task.id, true);
          return taskWithRelations;
        })
      );
    }
    
    return NextResponse.json({
      success: true,
      data: tasksWithDetails,
      count: tasks.length,
      metadata: {
        filters: {
          storyId,
          type: type?.split(','),
          status: status?.split(','),
          priority: priority?.split(',').map(p => parseInt(p)),
          assignedAgent
        },
        includeRelations
      }
    });
  } catch (error) {
    console.error('取得 Task 列表失敗:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '無法取得 Task 列表',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hierarchy/tasks - 創建新的 Task
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 驗證必填欄位
    if (!body.storyId || !body.title || !body.type) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Story ID、標題和任務類型是必填的',
          required: ['storyId', 'title', 'type']
        },
        { status: 400 }
      );
    }

    // 驗證 Story 是否存在
    const story = await hierarchyManager.getStory(body.storyId);
    if (!story) {
      return NextResponse.json(
        { 
          success: false,
          error: '指定的 Story 不存在'
        },
        { status: 404 }
      );
    }

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

    const taskData: CreateTaskInput = {
      storyId: body.storyId,
      title: body.title,
      description: body.description,
      type: body.type as TaskType,
      acceptanceCriteria: body.acceptanceCriteria,
      expectedOutcome: body.expectedOutcome,
      priority: body.priority || Priority.MEDIUM,
      estimatedTime: body.estimatedTime,
      assignedAgent: body.assignedAgent
    };

    const task = await hierarchyManager.createTask(taskData);
    
    // 獲取包含關聯資料的完整 Task 信息
    const taskWithRelations = await hierarchyManager.getTask(task.id, true);
    
    return NextResponse.json({
      success: true,
      data: taskWithRelations,
      message: '任務創建成功'
    }, { status: 201 });
  } catch (error) {
    console.error('創建 Task 失敗:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '無法創建 Task',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}