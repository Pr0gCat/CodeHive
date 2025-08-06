import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { ProjectMetadataManager } from '@/lib/portable/metadata-manager';

const projectSettingsSchema = z.object({
  // AI Model Settings
  claudeModel: z.string().optional(),
  maxTokensPerRequest: z.number().min(100).max(10000).optional(),
  
  // Rate Limiting
  maxRequestsPerMinute: z.number().min(1).max(100).optional(),
  
  // Execution Settings
  agentTimeout: z.number().min(30000).max(1800000).optional(), // 30s to 30min
  maxRetries: z.number().min(0).max(10).optional(),
  autoExecuteTasks: z.boolean().optional(),
  
  // Code Quality
  testCoverageThreshold: z.number().min(0).max(100).optional(),
  enforceTypeChecking: z.boolean().optional(),
  
  // Optional Advanced Settings
  customInstructions: z.string().nullable().optional(),
  excludePatterns: z.string().nullable().optional(),
});

interface RouteParams {
  params: { id: string };
}

// GET /api/projects/[id]/settings - Get project settings
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const projectId = params.id;

    // Find project in portable format
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    const project = projects.find(p => p.metadata.id === projectId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get settings from portable format
    const metadataManager = new ProjectMetadataManager(project.path);
    let settings = await metadataManager.getProjectSettings();

    // If no settings exist, use defaults
    if (!settings) {
      settings = {
        projectId,
        claudeModel: 'claude-3-5-sonnet-20241022',
        maxTokensPerRequest: 4000,
        maxRequestsPerMinute: 20,
        agentTimeout: 300000, // 5 minutes
        maxRetries: 3,
        autoExecuteTasks: true,
        testCoverageThreshold: 80,
        enforceTypeChecking: true,
        customInstructions: null,
        excludePatterns: null,
      };

      // Save default settings to portable format
      await metadataManager.updateProjectSettings(settings);
    }

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching project settings:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id]/settings - Update project settings
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const projectId = params.id;
    const body = await request.json();

    // Validate input
    const validatedData = projectSettingsSchema.parse(body);

    // Find project in portable format
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    const project = projects.find(p => p.metadata.id === projectId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get current settings and merge with updates
    const metadataManager = new ProjectMetadataManager(project.path);
    const currentSettings = await metadataManager.getProjectSettings() || {};
    
    const updatedSettings = {
      ...currentSettings,
      ...validatedData,
      projectId,
    };

    // Save updated settings to portable format
    await metadataManager.updateProjectSettings(updatedSettings);

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: 'Project settings updated successfully',
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

    console.error('Error updating project settings:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id]/settings - Reset project settings to defaults
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const projectId = params.id;

    // Find project in portable format
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();
    const project = projects.find(p => p.metadata.id === projectId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Reset to default settings
    const defaultSettings = {
      projectId,
      claudeModel: 'claude-3-5-sonnet-20241022',
      maxTokensPerRequest: 4000,
      maxRequestsPerMinute: 20,
      agentTimeout: 300000, // 5 minutes
      maxRetries: 3,
      autoExecuteTasks: true,
      testCoverageThreshold: 80,
      enforceTypeChecking: true,
      customInstructions: null,
      excludePatterns: null,
    };

    // Save default settings to portable format
    const metadataManager = new ProjectMetadataManager(project.path);
    await metadataManager.updateProjectSettings(defaultSettings);

    return NextResponse.json({
      success: true,
      data: defaultSettings,
      message: 'Project settings reset to defaults',
    });
  } catch (error) {
    console.error('Error resetting project settings:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
