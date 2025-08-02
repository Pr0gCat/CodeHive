import { configCache } from '@/lib/config';
import { prisma } from '@/lib/db';
import { globalSettingsSchema } from '@/lib/validations/settings';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

interface GlobalSettings {
  id: string;
  dailyTokenLimit: number;
  warningThreshold: number;
  criticalThreshold: number;
  allocationStrategy: number;
  autoResumeEnabled: boolean;
  pauseOnWarning: boolean;
  claudeCodePath: string;
  rateLimitPerMinute: number;
}

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
async function recalculateProjectBudgets(globalSettings: GlobalSettings) {
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
