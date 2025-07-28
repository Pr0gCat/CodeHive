import { NextRequest, NextResponse } from 'next/server';
import { tokenTracker } from '@/lib/claude-code/token-tracker';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;

    // Get usage summary
    const summary = await tokenTracker.getProjectUsageSummary(projectId);
    
    // Get current limits
    const dailyLimit = tokenTracker.getDailyLimit();
    const rateLimit = tokenTracker.getRateLimit();
    
    // Calculate remaining tokens
    const remainingDaily = tokenTracker.getRemainingDailyTokens(summary.daily);

    return NextResponse.json({
      usage: summary,
      limits: {
        daily: dailyLimit,
        ratePerMinute: rateLimit,
      },
      remaining: {
        daily: remainingDaily,
        percentUsed: Math.round((summary.daily / dailyLimit) * 100),
      },
    });
  } catch (error) {
    console.error('Failed to get token usage:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve token usage' },
      { status: 500 }
    );
  }
}