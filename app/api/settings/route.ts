import { configCache } from '@/lib/config';
import { globalSettingsManager } from '@/lib/portable/global-settings-manager';
import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { ProjectMetadataManager } from '@/lib/portable/metadata-manager';
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
    const settings = await globalSettingsManager.getGlobalSettings();

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

    const settings = await globalSettingsManager.updateGlobalSettings(validatedData);

    // After updating global settings, recalculate project budgets for all portable projects
    await recalculatePortableProjectBudgets(settings);

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

// Helper function to recalculate project budgets when global settings change (portable version)
async function recalculatePortableProjectBudgets(globalSettings: GlobalSettings) {
  try {
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();

    // Update each project budget with new daily token amounts
    for (const project of projects) {
      try {
        const metadataManager = new ProjectMetadataManager(project.path);
        const budget = await metadataManager.getProjectBudget();
        
        if (budget) {
          const newDailyBudget = Math.floor(
            globalSettings.dailyTokenLimit * budget.allocatedPercentage
          );

          const updatedBudget = {
            ...budget,
            dailyTokenBudget: newDailyBudget,
            updatedAt: new Date().toISOString(),
          };

          await metadataManager.saveProjectBudget(updatedBudget);
        }
      } catch (error) {
        console.warn(`Failed to update budget for project ${project.metadata.name}:`, error);
        // Continue with other projects
      }
    }
  } catch (error) {
    console.error('Error recalculating portable project budgets:', error);
    // Don't throw here, as the global settings update was successful
  }
}
