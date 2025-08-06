/**
 * Project creation API - Creates CodeHive projects with .codehive/ metadata structure
 * All projects are now portable by default
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { gitClient } from '@/lib/git';
import { taskManager } from '@/lib/tasks/task-manager';
import { SQLiteMetadataManager } from '@/lib/portable/sqlite-metadata-manager';
import { WorkspaceManager } from '@/lib/workspace/workspace-manager';
import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { getProjectIndexService } from '@/lib/db/project-index';
import { 
  ProjectMetadata, 
  ProjectSettings,
  ProjectBudget
} from '@/lib/portable/schemas';

const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters')
    .regex(
      /^[a-zA-Z0-9\s\-_\.]+$/,
      'Project name can only contain letters, numbers, spaces, hyphens, underscores, and dots'
    )
    .refine(
      val => val.trim().length > 0,
      'Project name cannot be empty or only whitespace'
    ),
  description: z.string().optional(),
  gitUrl: z
    .string()
    .optional()
    .refine(val => {
      if (!val || val.trim() === '') return true;
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    }, 'Invalid URL format'),
  localPath: z.string().optional(),
  initializeGit: z.boolean().default(true),
  
  // Tech stack fields
  framework: z.string().optional(),
  language: z.string().optional(),
  packageManager: z.string().optional(),
  testFramework: z.string().optional(),
  lintTool: z.string().optional(),
  buildTool: z.string().optional(),
  
  // Project settings
  settings: z.object({
    maxTokensPerDay: z.number().default(10000),
    maxTokensPerRequest: z.number().default(4000),
    maxRequestsPerMinute: z.number().default(20),
    maxRequestsPerHour: z.number().default(100),
    agentTimeout: z.number().default(300000),
    maxRetries: z.number().default(3),
    parallelAgentLimit: z.number().default(2),
    autoReviewOnImport: z.boolean().default(true),
    claudeModel: z.string().default('claude-3-5-sonnet-20241022'),
    customInstructions: z.string().optional(),
  }).optional(),
  
  // Budget allocation
  budget: z.object({
    allocatedPercentage: z.number().min(0).max(100).default(10),
    dailyTokenBudget: z.number().default(1000),
  }).optional(),
});

export async function POST(request: NextRequest) {
  const taskId = `create-project-${Date.now()}`;
  
  try {
    const body = await request.json();
    const validatedData = createProjectSchema.parse(body);
    const {
      name,
      description,
      gitUrl,
      initializeGit,
      framework,
      language,
      packageManager,
      testFramework,
      lintTool,
      buildTool,
      settings,
      budget,
    } = validatedData;

    // Always generate localPath for new projects in repos/ directory
    // Custom paths should use the import endpoint instead
    const localPath = gitClient.generateProjectPath(name);
    
    // Warn if user provided a custom localPath
    if (validatedData.localPath?.trim()) {
      console.warn(`Create endpoint received custom localPath: ${validatedData.localPath}. This will be ignored. Use import endpoint for existing directories.`);
    }

    // Create task for progress tracking
    const phases = [
      { phaseId: 'validate', title: 'Validate Project', description: 'Validating project requirements', order: 0 },
      { phaseId: 'create-dir', title: 'Create Directory', description: 'Creating project directory', order: 1 },
      { phaseId: 'init-git', title: 'Initialize Git', description: 'Setting up Git repository', order: 2 },
      { phaseId: 'setup-metadata', title: 'Setup Metadata', description: 'Creating .codehive/ structure', order: 3 },
      { phaseId: 'create-files', title: 'Create Files', description: 'Generating initial project files', order: 4 },
      { phaseId: 'finalize', title: 'Finalize', description: 'Finalizing project setup', order: 5 },
    ];

    await taskManager.createTask(taskId, 'PROJECT_CREATE', phases, {
      projectName: name,
    });

    await taskManager.startTask(taskId);

    // Phase 1: Validation
    await taskManager.updatePhaseProgress(taskId, 'validate', 0, {
      type: 'INFO',
      message: 'Starting project validation...',
    });

    // Check if directory already exists
    // The create endpoint should only be used for new projects in the repos/ directory
    try {
      await fs.access(localPath);
      await taskManager.updatePhaseProgress(taskId, 'validate', 100, {
        type: 'ERROR',
        message: `Directory already exists: ${localPath}`,
      });
      
      return NextResponse.json({
        success: false,
        error: `A project with the name "${name}" already exists. Please choose a different name or use the import feature for existing projects.`,
      }, { status: 409 });
    } catch {
      // Directory doesn't exist, which is good for new projects
    }

    // Check if another portable project with the same name exists
    const reposDir = path.dirname(localPath);
    try {
      const entries = await fs.readdir(reposDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectPath = path.join(reposDir, entry.name);
          const metadataManager = new SQLiteMetadataManager(projectPath);
          if (await metadataManager.isPortableProject()) {
            const metadata = await metadataManager.getProjectMetadata();
            if (metadata && metadata.name === name) {
              await taskManager.updatePhaseProgress(taskId, 'validate', 100, {
                type: 'ERROR',
                message: `Project with name "${name}" already exists`,
              });
              
              return NextResponse.json({
                success: false,
                error: `A project with the name "${name}" already exists in ${projectPath}`,
              }, { status: 409 });
            }
          }
        }
      }
    } catch {
      // Repos directory might not exist yet, that's okay
    }

    await taskManager.updatePhaseProgress(taskId, 'validate', 100, {
      type: 'PHASE_COMPLETE',
      message: 'Project validation completed',
    });

    // Phase 2: Create Directory
    await taskManager.updatePhaseProgress(taskId, 'create-dir', 0, {
      type: 'INFO',
      message: `Creating project directory at ${localPath}...`,
    });

    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.mkdir(localPath, { recursive: true });

    await taskManager.updatePhaseProgress(taskId, 'create-dir', 100, {
      type: 'PHASE_COMPLETE',
      message: 'Project directory created',
    });

    // Phase 3: Initialize Git
    await taskManager.updatePhaseProgress(taskId, 'init-git', 0, {
      type: 'INFO',
      message: 'Initializing Git repository...',
    });

    if (initializeGit) {
      const isExistingRepo = await gitClient.isValidRepository(localPath);
      
      if (!isExistingRepo) {
        const initResult = await gitClient.init(localPath);
        if (!initResult.success) {
          throw new Error(`Git initialization failed: ${initResult.error}`);
        }
      }
    }

    await taskManager.updatePhaseProgress(taskId, 'init-git', 100, {
      type: 'PHASE_COMPLETE',
      message: 'Git repository initialized',
    });

    // Phase 4: Setup Metadata
    await taskManager.updatePhaseProgress(taskId, 'setup-metadata', 0, {
      type: 'INFO',
      message: 'Setting up .codehive/ metadata structure...',
    });

    const metadataManager = new SQLiteMetadataManager(localPath);
    const workspaceManager = new WorkspaceManager(localPath);

    // Initialize directory structures
    await metadataManager.initialize();
    await workspaceManager.initialize();

    // Create project metadata
    const now = new Date().toISOString();
    const projectId = `proj-${Date.now()}`;
    
    const projectMetadata: ProjectMetadata = {
      version: '1.0.0',
      id: projectId,
      name,
      description,
      gitUrl: gitUrl?.trim() || undefined,
      localPath,
      status: 'ACTIVE',
      framework,
      language,
      packageManager,
      testFramework,
      lintTool,
      buildTool,
      createdAt: now,
      updatedAt: now,
    };

    await metadataManager.saveProjectMetadata(projectMetadata, { validateData: true });

    // Create project settings
    const projectSettings: ProjectSettings = {
      maxTokensPerDay: settings?.maxTokensPerDay || 10000,
      maxTokensPerRequest: settings?.maxTokensPerRequest || 4000,
      maxRequestsPerMinute: settings?.maxRequestsPerMinute || 20,
      maxRequestsPerHour: settings?.maxRequestsPerHour || 100,
      agentTimeout: settings?.agentTimeout || 300000,
      maxRetries: settings?.maxRetries || 3,
      parallelAgentLimit: settings?.parallelAgentLimit || 2,
      autoReviewOnImport: settings?.autoReviewOnImport ?? true,
      maxQueueSize: 50,
      taskPriority: 'NORMAL',
      autoExecuteTasks: true,
      emailNotifications: false,
      notifyOnTaskComplete: true,
      notifyOnTaskFail: true,
      codeAnalysisDepth: 'STANDARD',
      testCoverageThreshold: 80.0,
      enforceTypeChecking: true,
      autoFixLintErrors: false,
      claudeModel: settings?.claudeModel || 'claude-3-5-sonnet-20241022',
      customInstructions: settings?.customInstructions,
      excludePatterns: undefined,
      includeDependencies: true,
    };

    await metadataManager.saveProjectSettings(projectSettings, { validateData: true });

    // Create project budget if specified
    if (budget) {
      const projectBudget: ProjectBudget = {
        allocatedPercentage: budget.allocatedPercentage,
        dailyTokenBudget: budget.dailyTokenBudget,
        usedTokens: 0,
        lastResetAt: now,
        warningNotified: false,
        criticalNotified: false,
        createdAt: now,
        updatedAt: now,
      };

      await metadataManager.saveProjectBudget(projectBudget);
    }

    await taskManager.updatePhaseProgress(taskId, 'setup-metadata', 100, {
      type: 'PHASE_COMPLETE',
      message: '.codehive/ metadata structure created',
    });

    // Phase 5: Create Files
    await taskManager.updatePhaseProgress(taskId, 'create-files', 0, {
      type: 'INFO',
      message: 'Creating initial project files...',
    });

    // Create a basic README.md
    const readmeContent = `# ${name}

${description || 'A CodeHive managed project'}

## About

This is a portable CodeHive project. All project metadata is stored in the \`.codehive/\` directory, making this project fully portable between different CodeHive installations.

## Project Structure

- \`.codehive/\` - CodeHive metadata and configuration
  - \`project.json\` - Project metadata
  - \`settings.json\` - Project settings
  - \`epics/\` - Epic definitions
  - \`stories/\` - User story definitions
  - \`sprints/\` - Sprint planning data
  - \`cycles/\` - TDD cycle data
  - \`agents/\` - Agent specifications
  - \`usage/\` - Token usage tracking
  - \`workspaces/\` - Workspace snapshots
  - \`logs/\` - Project logs

## Getting Started

This project is ready to be managed by CodeHive. The project structure and metadata are fully self-contained.

---

*Generated by CodeHive - Portable Project System*
`;

    await fs.writeFile(path.join(localPath, 'README.md'), readmeContent);

    // Create initial .gitignore if it doesn't exist
    try {
      await fs.access(path.join(localPath, '.gitignore'));
    } catch {
      const gitignoreContent = `# Dependencies
node_modules/
*.log

# Build outputs
dist/
build/
.next/

# Environment
.env*

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# CodeHive (already handled by metadata manager)
# .codehive/
`;
      await fs.writeFile(path.join(localPath, '.gitignore'), gitignoreContent);
    }

    await taskManager.updatePhaseProgress(taskId, 'create-files', 100, {
      type: 'PHASE_COMPLETE',
      message: 'Initial project files created',
    });

    // Phase 6: Finalize
    await taskManager.updatePhaseProgress(taskId, 'finalize', 0, {
      type: 'INFO',
      message: 'Finalizing project setup...',
    });

    // Create initial Git commit if Git was initialized
    if (initializeGit) {
      try {
        await gitClient.initialCommit(localPath, 'Initial commit - Portable CodeHive project setup');
      } catch (error) {
        console.warn('Failed to create initial commit:', error);
      }
    }

    await taskManager.updatePhaseProgress(taskId, 'finalize', 100, {
      type: 'PHASE_COMPLETE',
      message: 'Project setup completed successfully',
    });

    // Complete the task
    const result = {
      projectId,
      name,
      localPath,
      metadata: projectMetadata,
      settings: projectSettings,
      budget: budget ? {
        allocatedPercentage: budget.allocatedPercentage,
        dailyTokenBudget: budget.dailyTokenBudget,
      } : undefined,
    };

    await taskManager.completeTask(taskId, result);

    // Register project in system database
    const indexService = getProjectIndexService();
    try {
      await indexService.registerProject(projectMetadata, 'GIT_URL'); // Default for new projects
      console.log(`Project ${projectId} registered in system database`);
    } catch (indexError) {
      console.warn(`Failed to register project in system database:`, indexError);
    }

    // Clear discovery cache so the new project is immediately discoverable
    const discoveryService = getProjectDiscoveryService();
    discoveryService.clearCache();

    return NextResponse.json({
      success: true,
      taskId,
      data: result,
    });

  } catch (error) {
    console.error('Project creation failed:', error);
    
    // Update task with error
    try {
      // TODO: Implement proper error handling for tasks
      console.error('Task failed:', taskId, error instanceof Error ? error.message : 'Unknown error');
    } catch {
      // Task might not exist yet
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        taskId,
      },
      { status: 500 }
    );
  }
}