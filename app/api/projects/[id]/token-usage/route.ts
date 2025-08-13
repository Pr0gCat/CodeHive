import { NextRequest, NextResponse } from 'next/server';
import { tokenManager } from '@/lib/resources/token-management';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    // Get token status which includes usage, limits, and remaining
    const status = await tokenManager.getTokenStatus(projectId);

    return NextResponse.json({
      usage: {
        daily: status.currentUsage.today,
        weekly: status.currentUsage.thisWeek,
        monthly: status.currentUsage.thisMonth,
        breakdown: status.breakdown,
      },
      limits: status.limits,
      remaining: status.remaining,
      projection: status.projection,
    });
  } catch (error) {
    console.error('Failed to get token usage:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve token usage' },
      { status: 500 }
    );
  }
}
