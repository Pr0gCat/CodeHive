import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { configCache } from '@/lib/config';
import { z } from 'zod';

const globalSettingsSchema = z
  .object({
    dailyTokenLimit: z.number().min(1000000).max(500000000), // 1M to 500M
    warningThreshold: z.number().min(0.1).max(0.95), // 10% to 95%
    criticalThreshold: z.number().min(0.1).max(0.99), // 10% to 99%
    allocationStrategy: z.number().min(0.0).max(1.0), // 0% to 100%
    autoResumeEnabled: z.boolean(),
    pauseOnWarning: z.boolean(),
    // Claude API Configuration
    claudeCodePath: z.string().min(1),
    rateLimitPerMinute: z.number().min(1).max(1000),
  })
  .refine(data => data.warningThreshold < data.criticalThreshold, {
    message: 'Warning threshold must be less than critical threshold',
    path: ['warningThreshold'],
  });

export async function GET() {
  try {
    // Use upsert to ensure the record exists
    const settings = await prisma.globalSettings.upsert({
      where: { id: 'global' },
      create: {
        id: 'global',
        dailyTokenLimit: 100000000, // 100M tokens
        warningThreshold: 0.75, // 75%
        criticalThreshold: 0.9, // 90%
        allocationStrategy: 0.5, // 50% mix
        autoResumeEnabled: true,
        pauseOnWarning: false,
        claudeCodePath: 'claude',
        rateLimitPerMinute: 50,
      },
      update: {}, // Don't change existing settings
    });

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

    // Invalidate configuration cache so new settings take effect immediately
    configCache.invalidate();

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
