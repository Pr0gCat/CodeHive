import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const budgetAllocationSchema = z.array(
  z.object({
    projectId: z.string(),
    allocatedPercentage: z.number().min(0).max(1),
  })
).refine((budgets) => {
  // Ensure total allocation doesn't exceed 100%
  const totalAllocation = budgets.reduce((sum, b) => sum + b.allocatedPercentage, 0);
  return totalAllocation <= 1.01; // Allow 1% tolerance for floating point
}, {
  message: "Total budget allocation cannot exceed 100%",
});

export async function GET() {
  try {
    // Get all projects with their budget allocations
    const projects = await prisma.project.findMany({
      include: {
        budget: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Get global settings for context
    const globalSettings = await prisma.globalSettings.findUnique({
      where: { id: 'global' },
    });

    const budgetData = projects.map(project => {
      const budget = project.budget;
      return {
        projectId: project.id,
        projectName: project.name,
        allocatedPercentage: budget?.allocatedPercentage || 0,
        dailyTokenBudget: budget?.dailyTokenBudget || 0,
        usedTokens: budget?.usedTokens || 0,
        usagePercentage: budget?.dailyTokenBudget 
          ? (budget.usedTokens / budget.dailyTokenBudget) * 100 
          : 0,
        lastResetAt: budget?.lastResetAt || new Date(),
        warningNotified: budget?.warningNotified || false,
        criticalNotified: budget?.criticalNotified || false,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        globalDailyLimit: globalSettings?.dailyTokenLimit || 10000000,
        projects: budgetData,
        totalAllocated: budgetData.reduce((sum, p) => sum + p.allocatedPercentage, 0),
      },
    });
  } catch (error) {
    console.error('Error fetching project budgets:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch project budgets',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const budgetAllocations = budgetAllocationSchema.parse(body);

    // Get global settings to calculate actual token amounts
    const globalSettings = await prisma.globalSettings.findUnique({
      where: { id: 'global' },
    });

    if (!globalSettings) {
      return NextResponse.json(
        {
          success: false,
          error: 'Global settings not found',
        },
        { status: 404 }
      );
    }

    // Update or create budget allocations
    const results = [];
    for (const allocation of budgetAllocations) {
      const dailyTokenBudget = Math.floor(
        globalSettings.dailyTokenLimit * allocation.allocatedPercentage
      );

      const budgetRecord = await prisma.projectBudget.upsert({
        where: { projectId: allocation.projectId },
        update: {
          allocatedPercentage: allocation.allocatedPercentage,
          dailyTokenBudget,
        },
        create: {
          projectId: allocation.projectId,
          allocatedPercentage: allocation.allocatedPercentage,
          dailyTokenBudget,
          usedTokens: 0,
          lastResetAt: new Date(),
        },
        include: {
          project: {
            select: {
              name: true,
            },
          },
        },
      });

      results.push({
        projectId: allocation.projectId,
        projectName: budgetRecord.project.name,
        allocatedPercentage: budgetRecord.allocatedPercentage,
        dailyTokenBudget: budgetRecord.dailyTokenBudget,
      });
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Error updating project budgets:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update project budgets',
      },
      { status: 500 }
    );
  }
}

// Endpoint to reset daily usage (typically called by a cron job)
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'reset_daily_usage') {
      // Reset all project daily usage
      await prisma.projectBudget.updateMany({
        data: {
          usedTokens: 0,
          lastResetAt: new Date(),
          warningNotified: false,
          criticalNotified: false,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Daily usage reset for all projects',
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error resetting daily usage:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reset daily usage',
      },
      { status: 500 }
    );
  }
}