import { NextRequest, NextResponse } from 'next/server';
import { globalSettingsManager } from '@/lib/portable/global-settings-manager';
import { z } from 'zod';

const budgetAllocationSchema = z
  .array(
    z.object({
      projectId: z.string(),
      allocatedPercentage: z.number().min(0).max(1),
    })
  )
  .refine(
    budgets => {
      // Ensure total allocation doesn't exceed 100%
      const totalAllocation = budgets.reduce(
        (sum, b) => sum + b.allocatedPercentage,
        0
      );
      return totalAllocation <= 1.01; // Allow 1% tolerance for floating point
    },
    {
      message: 'Total budget allocation cannot exceed 100%',
    }
  );

export async function GET() {
  try {
    // Lazy load prisma to ensure it's initialized
    const { prisma } = await import('@/lib/db');
    
    // Get all projects from system database (project index)
    const projects = await prisma.projectIndex.findMany({
      where: { status: 'ACTIVE' }
    });

    // Get global settings for context
    const globalSettings = await globalSettingsManager.getGlobalSettings();

    const budgetData = await Promise.all(
      projects.map(async (project) => {
        try {
          // Get budget from system database
          const budget = await prisma.projectBudget.findUnique({
            where: { projectId: project.id }
          });
          
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
        } catch (error) {
          console.warn(`Failed to get budget for project ${project.name}:`, error);
          // Return default budget data for projects without budgets
          return {
            projectId: project.id,
            projectName: project.name,
            allocatedPercentage: 0,
            dailyTokenBudget: 0,
            usedTokens: 0,
            usagePercentage: 0,
            lastResetAt: new Date(),
            warningNotified: false,
            criticalNotified: false,
          };
        }
      })
    );

    // Sort by project name
    budgetData.sort((a, b) => a.projectName.localeCompare(b.projectName));

    return NextResponse.json({
      success: true,
      data: {
        globalDailyLimit: globalSettings.dailyTokenLimit,
        projects: budgetData,
        totalAllocated: budgetData.reduce(
          (sum, p) => sum + p.allocatedPercentage,
          0
        ),
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
    // Lazy load prisma to ensure it's initialized
    const { prisma } = await import('@/lib/db');
    
    const body = await request.json();
    const budgetAllocations = budgetAllocationSchema.parse(body);

    // Get global settings to calculate actual token amounts
    const globalSettings = await globalSettingsManager.getGlobalSettings();

    // Get all projects from system database to validate project IDs
    const projects = await prisma.projectIndex.findMany({
      where: { status: 'ACTIVE' }
    });
    const projectMap = new Map(projects.map(p => [p.id, p]));

    // Update or create budget allocations
    const results = [];
    for (const allocation of budgetAllocations) {
      const project = projectMap.get(allocation.projectId);
      
      if (!project) {
        console.warn(`Project not found: ${allocation.projectId}`);
        continue;
      }

      const dailyTokenBudget = Math.floor(
        globalSettings.dailyTokenLimit * allocation.allocatedPercentage
      );

      // Update budget in system database
      try {
        const updatedBudget = await prisma.projectBudget.upsert({
          where: { projectId: allocation.projectId },
          update: {
            allocatedPercentage: allocation.allocatedPercentage,
            dailyTokenBudget,
            warningNotified: false,
            criticalNotified: false,
            updatedAt: new Date(),
          },
          create: {
            projectId: allocation.projectId,
            allocatedPercentage: allocation.allocatedPercentage,
            dailyTokenBudget,
            usedTokens: 0,
            lastResetAt: new Date(),
            warningNotified: false,
            criticalNotified: false,
          },
        });
        
        results.push({
          projectId: allocation.projectId,
          projectName: project.name,
          allocatedPercentage: updatedBudget.allocatedPercentage,
          dailyTokenBudget: updatedBudget.dailyTokenBudget,
        });
      } catch (error) {
        console.error(`Failed to update budget for project ${allocation.projectId}:`, error);
        continue;
      }
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
    // Lazy load prisma to ensure it's initialized
    const { prisma } = await import('@/lib/db');
    
    const { action } = await request.json();

    if (action === 'reset_daily_usage') {
      const now = new Date().toISOString();
      let resetCount = 0;

      // Reset daily usage for all projects in system database
      const result = await prisma.projectBudget.updateMany({
        data: {
          usedTokens: 0,
          lastResetAt: new Date(),
          warningNotified: false,
          criticalNotified: false,
          updatedAt: new Date(),
        },
      });
      
      resetCount = result.count;

      return NextResponse.json({
        success: true,
        message: `Daily usage reset for ${resetCount} projects`,
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
