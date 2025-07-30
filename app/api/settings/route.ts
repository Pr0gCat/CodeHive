import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const globalSettingsSchema = z.object({
  dailyTokenLimit: z.number().min(1000000).max(100000000), // 1M to 100M
  warningThreshold: z.number().min(0.1).max(0.95), // 10% to 95%
  criticalThreshold: z.number().min(0.1).max(0.99), // 10% to 99%
  allocationStrategy: z.number().min(0.0).max(1.0), // 0% to 100%
  autoResumeEnabled: z.boolean(),
  pauseOnWarning: z.boolean(),
}).refine((data) => data.warningThreshold < data.criticalThreshold, {
  message: "Warning threshold must be less than critical threshold",
  path: ["warningThreshold"],
});

export async function GET() {
  try {
    let settings = await prisma.globalSettings.findUnique({
      where: { id: 'global' },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.globalSettings.create({
        data: {
          id: 'global',
          dailyTokenLimit: 10000000, // 10M tokens
          warningThreshold: 0.75,     // 75%
          criticalThreshold: 0.90,    // 90%
          allocationStrategy: 0.5,    // 50% mix
          autoResumeEnabled: true,
          pauseOnWarning: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching global settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch global settings',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = globalSettingsSchema.parse(body);

    const settings = await prisma.globalSettings.upsert({
      where: { id: 'global' },
      update: validatedData,
      create: {
        id: 'global',
        ...validatedData,
      },
    });

    // After updating global settings, recalculate project budgets
    await recalculateProjectBudgets(settings);

    return NextResponse.json({
      success: true,
      data: settings,
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

    console.error('Error updating global settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update global settings',
      },
      { status: 500 }
    );
  }
}

// Helper function to recalculate project budgets when global settings change
async function recalculateProjectBudgets(globalSettings: any) {
  try {
    const projectBudgets = await prisma.projectBudget.findMany();
    
    // Update each project budget with new daily token amounts
    for (const budget of projectBudgets) {
      const newDailyBudget = Math.floor(
        globalSettings.dailyTokenLimit * budget.allocatedPercentage
      );

      await prisma.projectBudget.update({
        where: { id: budget.id },
        data: {
          dailyTokenBudget: newDailyBudget,
        },
      });
    }
  } catch (error) {
    console.error('Error recalculating project budgets:', error);
    // Don't throw here, as the global settings update was successful
  }
}