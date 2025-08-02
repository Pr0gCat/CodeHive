import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // For now, return mock maintenance tasks
    // In a real implementation, these would be stored in the database
    const maintenanceTasks = [
      {
        id: '1',
        name: '任務恢復',
        description: '恢復中斷的任務和循環',
        status: 'completed',
        lastRun: new Date(Date.now() - 86400000).toISOString(),
        nextRun: new Date(Date.now() + 86400000).toISOString(),
        duration: '2m 15s'
      },
      {
        id: '2',
        name: '資料庫清理',
        description: '清理過期的日誌和臨時資料',
        status: 'pending',
        lastRun: new Date(Date.now() - 172800000).toISOString(),
        nextRun: new Date(Date.now() + 3600000).toISOString(),
        duration: '5m 30s'
      },
      {
        id: '3',
        name: '效能優化',
        description: '分析和優化系統效能',
        status: 'completed',
        lastRun: new Date(Date.now() - 259200000).toISOString(),
        nextRun: new Date(Date.now() + 604800000).toISOString(),
        duration: '15m 45s'
      },
      {
        id: '4',
        name: 'Token 使用分析',
        description: '分析 Token 使用模式並優化分配',
        status: 'pending',
        lastRun: new Date(Date.now() - 345600000).toISOString(),
        nextRun: new Date(Date.now() + 7200000).toISOString(),
        duration: '8m 12s'
      },
      {
        id: '5',
        name: '備份驗證',
        description: '驗證資料庫備份的完整性',
        status: 'completed',
        lastRun: new Date(Date.now() - 432000000).toISOString(),
        nextRun: new Date(Date.now() + 86400000).toISOString(),
        duration: '3m 45s'
      }
    ];

    return NextResponse.json({
      success: true,
      data: maintenanceTasks
    });
  } catch (error) {
    console.error('Error fetching maintenance tasks:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch maintenance tasks'
      },
      { status: 500 }
    );
  }
}