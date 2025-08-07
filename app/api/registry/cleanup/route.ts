import { NextRequest, NextResponse } from 'next/server';
import { getCleanupScheduler } from '@/lib/registry/cleanup-scheduler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const scheduler = getCleanupScheduler();

    switch (action) {
      case 'run': {
        // Run cleanup immediately
        const result = await scheduler.runCleanup();
        return NextResponse.json({
          success: true,
          data: result,
          message: `Cleanup completed: ${result.archived} archived, ${result.removed} removed, ${result.healthChecked} health-checked`,
        });
      }

      case 'status': {
        // Get scheduler status
        const status = scheduler.getStatus();
        return NextResponse.json({
          success: true,
          data: status,
        });
      }

      case 'start': {
        // Start the scheduler
        await scheduler.start();
        return NextResponse.json({
          success: true,
          message: 'Cleanup scheduler started',
        });
      }

      case 'stop': {
        // Stop the scheduler
        scheduler.stop();
        return NextResponse.json({
          success: true,
          message: 'Cleanup scheduler stopped',
        });
      }

      case 'update-interval': {
        // Update cleanup interval
        const { intervalMinutes } = body;
        if (!intervalMinutes || intervalMinutes < 1) {
          return NextResponse.json(
            { success: false, error: 'Invalid interval. Must be at least 1 minute.' },
            { status: 400 }
          );
        }

        scheduler.updateInterval(intervalMinutes);
        return NextResponse.json({
          success: true,
          message: `Cleanup interval updated to ${intervalMinutes} minutes`,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Registry cleanup API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const scheduler = getCleanupScheduler();
    const status = scheduler.getStatus();

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Failed to get cleanup scheduler status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}