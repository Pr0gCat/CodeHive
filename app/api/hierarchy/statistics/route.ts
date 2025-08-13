import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';

const hierarchyManager = new HierarchyManager(prisma);

/**
 * GET /api/hierarchy/statistics - 取得階層統計資料
 * Query parameters:
 * - projectId: 專案 ID（必填）
 * - epicId: Epic ID（可選，獲取特定 Epic 的統計）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const epicId = searchParams.get('epicId');

    if (!projectId) {
      return NextResponse.json(
        { error: '專案 ID 是必填的' },
        { status: 400 }
      );
    }

    if (epicId) {
      // 獲取特定 Epic 的詳細統計
      const epicExists = await hierarchyManager.getEpic(epicId);
      if (!epicExists) {
        return NextResponse.json(
          { error: 'Epic 不存在' },
          { status: 404 }
        );
      }

      const [epicStats, progress] = await Promise.all([
        hierarchyManager.getEpicStatistics(epicId),
        hierarchyManager.getHierarchyProgress(epicId)
      ]);

      return NextResponse.json({
        success: true,
        data: {
          type: 'epic',
          epicId,
          statistics: epicStats,
          progress
        }
      });
    } else {
      // 獲取整個專案的統計
      const hierarchyStats = await hierarchyManager.getHierarchyStatistics(projectId);
      
      // 獲取所有 Epic 的簡要統計
      const epics = await hierarchyManager.listEpics({ projectId });
      const epicSummaries = await Promise.all(
        epics.map(async (epic) => {
          const stats = await hierarchyManager.getEpicStatistics(epic.id);
          return {
            epicId: epic.id,
            title: epic.title,
            phase: epic.phase,
            status: epic.status,
            priority: epic.priority,
            totalStories: stats.totalStories,
            completedStories: stats.completedStories,
            progress: stats.progress
          };
        })
      );

      return NextResponse.json({
        success: true,
        data: {
          type: 'project',
          projectId,
          hierarchyStatistics: hierarchyStats,
          epics: epicSummaries,
          summary: {
            totalEpics: hierarchyStats.totalEpics,
            completedEpics: hierarchyStats.completedEpics,
            totalStories: hierarchyStats.totalStories,
            completedStories: hierarchyStats.completedStories,
            totalTasks: hierarchyStats.totalTasks,
            completedTasks: hierarchyStats.completedTasks,
            totalInstructions: hierarchyStats.totalInstructions,
            completedInstructions: hierarchyStats.completedInstructions,
            totalTokenUsage: hierarchyStats.totalTokenUsage,
            overallProgress: {
              epics: hierarchyStats.totalEpics > 0 ? 
                Math.round((hierarchyStats.completedEpics / hierarchyStats.totalEpics) * 100) : 0,
              stories: hierarchyStats.totalStories > 0 ? 
                Math.round((hierarchyStats.completedStories / hierarchyStats.totalStories) * 100) : 0,
              tasks: hierarchyStats.totalTasks > 0 ? 
                Math.round((hierarchyStats.completedTasks / hierarchyStats.totalTasks) * 100) : 0,
              instructions: hierarchyStats.totalInstructions > 0 ? 
                Math.round((hierarchyStats.completedInstructions / hierarchyStats.totalInstructions) * 100) : 0
            }
          }
        }
      });
    }
  } catch (error) {
    console.error('取得統計資料失敗:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '無法取得統計資料',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}