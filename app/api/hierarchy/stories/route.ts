import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { ModelStatus, Priority, type CreateStoryInput, type StoryFilter } from '@/lib/models/types';

const hierarchyManager = new HierarchyManager(prisma);

/**
 * GET /api/hierarchy/stories - 取得 Story 列表
 * Query parameters:
 * - epicId: Epic ID（可選）
 * - status: 狀態篩選（可選，逗號分隔）
 * - priority: 優先級篩選（可選，逗號分隔）
 * - iteration: 迭代篩選（可選）
 * - includeRelations: 是否包含關聯資料（可選，預設 false）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const epicId = searchParams.get('epicId');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const iteration = searchParams.get('iteration');
    const includeRelations = searchParams.get('includeRelations') === 'true';

    const filter: StoryFilter = {};
    
    if (epicId) filter.epicId = epicId;
    
    if (status) {
      const statusList = status.split(',');
      filter.status = statusList.length === 1 ? statusList[0] as ModelStatus : statusList as ModelStatus[];
    }
    
    if (priority) {
      const priorityList = priority.split(',').map(p => parseInt(p) as Priority);
      filter.priority = priorityList.length === 1 ? priorityList[0] : priorityList;
    }
    
    if (iteration) {
      filter.iteration = parseInt(iteration);
    }

    const stories = await hierarchyManager.listStories(filter);
    
    // 如果需要包含關聯資料，獲取詳細信息
    let storiesWithDetails = stories;
    if (includeRelations) {
      storiesWithDetails = await Promise.all(
        stories.map(async (story) => {
          const storyWithRelations = await hierarchyManager.getStory(story.id, true);
          return storyWithRelations;
        })
      );
    }
    
    return NextResponse.json({
      success: true,
      data: storiesWithDetails,
      count: stories.length,
      metadata: {
        filters: {
          epicId,
          status: status?.split(','),
          priority: priority?.split(',').map(p => parseInt(p)),
          iteration: iteration ? parseInt(iteration) : undefined
        },
        includeRelations
      }
    });
  } catch (error) {
    console.error('取得 Story 列表失敗:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '無法取得 Story 列表',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hierarchy/stories - 創建新的 Story
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 驗證必填欄位
    if (!body.epicId || !body.title) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Epic ID 和標題是必填的',
          required: ['epicId', 'title']
        },
        { status: 400 }
      );
    }

    // 驗證 Epic 是否存在
    const epic = await hierarchyManager.getEpic(body.epicId);
    if (!epic) {
      return NextResponse.json(
        { 
          success: false,
          error: '指定的 Epic 不存在'
        },
        { status: 404 }
      );
    }

    const storyData: CreateStoryInput = {
      epicId: body.epicId,
      title: body.title,
      userStory: body.userStory,
      description: body.description,
      acceptanceCriteria: body.acceptanceCriteria,
      priority: body.priority || Priority.MEDIUM,
      storyPoints: body.storyPoints,
      iteration: body.iteration
    };

    const story = await hierarchyManager.createStory(storyData);
    
    // 獲取包含關聯資料的完整 Story 信息
    const storyWithRelations = await hierarchyManager.getStory(story.id, true);
    
    return NextResponse.json({
      success: true,
      data: storyWithRelations,
      message: '故事創建成功'
    }, { status: 201 });
  } catch (error) {
    console.error('創建 Story 失敗:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '無法創建 Story',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}