/**
 * Project import API - Imports existing projects as CodeHive projects
 * All projects now use .codehive/ metadata structure for portability
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

const importProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').refine(
    (val) => val.trim().length > 0,
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
    }, 'Invalid Git URL format'),
  localPath: z.string().optional(),
  branch: z.string().optional(),
  
  // Auto-detection options
  autoDetectTechStack: z.boolean().default(true),
  
  // Tech stack overrides
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
  const taskId = `import-project-${Date.now()}`;
  
  try {
    const body = await request.json();
    const validatedData = importProjectSchema.parse(body);
    const {
      name,
      description,
      gitUrl,
      localPath,
      branch,
      autoDetectTechStack,
      framework,
      language,
      packageManager,
      testFramework,
      lintTool,
      buildTool,
      settings,
      budget,
    } = validatedData;

    if (!gitUrl && !localPath) {
      return NextResponse.json({
        success: false,
        error: 'Either gitUrl or localPath must be provided',
      }, { status: 400 });
    }

    // Separate flows for local folder vs Git URL imports
    if (localPath) {
      // LOCAL FOLDER IMPORT FLOW
      return await handleLocalFolderImport(taskId, name, localPath, validatedData, request);
    } else if (gitUrl) {
      // GIT URL IMPORT FLOW  
      return await handleGitUrlImport(taskId, name, gitUrl, branch, validatedData, request);
    }

    // Should never reach here due to separate handlers above
    return NextResponse.json({
      success: false,
      error: 'Invalid import configuration',
    }, { status: 400 });

  } catch (error) {
    console.error('Project import failed:', error);
    
    // Handle validation errors specifically
    if (error instanceof z.ZodError) {
      console.error('Validation error details:', {
        issues: error.issues,
        receivedData: 'Check request body in browser dev tools'
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input data',
          details: error.issues,
        },
        { status: 400 }
      );
    }
    
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

// Helper functions
async function analyzeProjectStructure(projectPath: string): Promise<{
    totalFiles: number;
    directories: number;
    hasPackageJson: boolean;
    hasDockerfile: boolean;
    hasTests: boolean;
  }> {
    let totalFiles = 0;
    let directories = 0;
    let hasPackageJson = false;
    let hasDockerfile = false;
    let hasTests = false;

    const analyzeDir = async (dirPath: string) => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
          if (entry.name === 'node_modules') continue;
          
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            directories++;
            await analyzeDir(fullPath);
          } else {
            totalFiles++;
            
            // Check for key files
            if (entry.name === 'package.json') hasPackageJson = true;
            if (entry.name === 'Dockerfile') hasDockerfile = true;
            if (entry.name.includes('test') || entry.name.includes('spec')) hasTests = true;
          }
        }
      } catch (error) {
        // Ignore errors for individual directories
      }
    };

    await analyzeDir(projectPath);

    return {
      totalFiles,
      directories,
      hasPackageJson,
      hasDockerfile,
      hasTests,
    };
  }

async function detectTechStack(projectPath: string): Promise<{
    framework?: string;
    language?: string;
    packageManager?: string;
    testFramework?: string;
    lintTool?: string;
    buildTool?: string;
  }> {
    const result: Record<string, string | undefined> = {};

    try {
      // Detect from package.json
      const packageJsonPath = path.join(projectPath, 'package.json');
      try {
        const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);
        
        // Detect framework
        if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
          result.framework = 'Next.js';
        } else if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
          result.framework = 'React';
        } else if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
          result.framework = 'Vue.js';
        } else if (packageJson.dependencies?.express || packageJson.devDependencies?.express) {
          result.framework = 'Express.js';
        }

        // Detect test framework
        if (packageJson.dependencies?.jest || packageJson.devDependencies?.jest) {
          result.testFramework = 'Jest';
        } else if (packageJson.dependencies?.vitest || packageJson.devDependencies?.vitest) {
          result.testFramework = 'Vitest';
        } else if (packageJson.dependencies?.mocha || packageJson.devDependencies?.mocha) {
          result.testFramework = 'Mocha';
        }

        // Detect linting
        if (packageJson.dependencies?.eslint || packageJson.devDependencies?.eslint) {
          result.lintTool = 'ESLint';
        }

        // Detect build tool
        if (packageJson.dependencies?.webpack || packageJson.devDependencies?.webpack) {
          result.buildTool = 'Webpack';
        } else if (packageJson.dependencies?.vite || packageJson.devDependencies?.vite) {
          result.buildTool = 'Vite';
        }
      } catch {
        // package.json not found or invalid
      }

      // Detect from file extensions
      const extensions = await findFileExtensions(projectPath);
      
      if (extensions.includes('.ts') || extensions.includes('.tsx')) {
        result.language = 'TypeScript';
      } else if (extensions.includes('.js') || extensions.includes('.jsx')) {
        result.language = 'JavaScript';
      } else if (extensions.includes('.py')) {
        result.language = 'Python';
      } else if (extensions.includes('.go')) {
        result.language = 'Go';
      } else if (extensions.includes('.rs')) {
        result.language = 'Rust';
      }

      // Detect package manager
      if (await fileExists(path.join(projectPath, 'bun.lockb'))) {
        result.packageManager = 'bun';
      } else if (await fileExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
        result.packageManager = 'pnpm';
      } else if (await fileExists(path.join(projectPath, 'yarn.lock'))) {
        result.packageManager = 'yarn';
      } else if (await fileExists(path.join(projectPath, 'package-lock.json'))) {
        result.packageManager = 'npm';
      }

    } catch (error) {
      console.warn('Tech stack detection failed:', error);
    }

    return result;
  }

async function findFileExtensions(dirPath: string, maxFiles = 100): Promise<string[]> {
    const extensions = new Set<string>();
    let fileCount = 0;

    const scanDir = async (currentPath: string) => {
      if (fileCount >= maxFiles) return;
      
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (fileCount >= maxFiles) break;
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else {
            const ext = path.extname(entry.name);
            if (ext) {
              extensions.add(ext);
              fileCount++;
            }
          }
        }
      } catch {
        // Ignore errors
      }
    };

    await scanDir(dirPath);
    return Array.from(extensions);
  }

async function fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }


// Helper function to generate unique project path
async function generateUniqueProjectPath(gitClient: any, projectName: string): Promise<string> {
  const basePath = gitClient.generateProjectPath(projectName);
  let finalPath = basePath;
  let counter = 1;
  
  // Check if path exists and generate unique one if needed
  while (true) {
    try {
      await fs.access(finalPath);
      // Path exists, try with counter suffix
      finalPath = `${basePath}-${counter}`;
      counter++;
    } catch {
      // Path doesn't exist, we can use it
      break;
    }
  }
  
  return finalPath;
}

// Separate handler for local folder imports
async function handleLocalFolderImport(
  taskId: string,
  name: string, 
  localPath: string,
  validatedData: any,
  request: NextRequest
) {
  const {
    description,
    autoDetectTechStack,
    framework,
    language,
    packageManager,
    testFramework,
    lintTool,
    buildTool,
    settings,
    budget,
  } = validatedData;

  // Create task phases specific to local folder import
  const phases = [
    { phaseId: 'validate', title: 'Validate Folder', description: 'Validating local folder and Git repository', order: 0 },
    { phaseId: 'analyze', title: 'Analyze Project', description: 'Analyzing project structure and dependencies', order: 1 },
    { phaseId: 'setup-metadata', title: 'Setup Metadata', description: 'Creating .codehive/ structure', order: 2 },
    { phaseId: 'detect-stack', title: 'Detect Tech Stack', description: 'Auto-detecting technology stack', order: 3 },
    { phaseId: 'finalize', title: 'Finalize', description: 'Finalizing project import', order: 4 },
  ];

  await taskManager.createTask(taskId, 'PROJECT_IMPORT', phases, {
    projectName: name,
  });

  await taskManager.startTask(taskId);

  try {
    // Phase 1: Validation
    await taskManager.updatePhaseProgress(taskId, 'validate', 0, {
      type: 'INFO',
      message: 'Validating local folder...',
    });

    // Check if folder exists
    try {
      await fs.access(localPath);
    } catch {
      await taskManager.updatePhaseProgress(taskId, 'validate', 100, {
        type: 'ERROR',
        message: `Local directory does not exist: ${localPath}`,
      });
      
      return NextResponse.json({
        success: false,
        error: `Local directory does not exist: ${localPath}`,
      }, { status: 400 });
    }

    // Check if it's already a portable project
    const metadataManager = new SQLiteMetadataManager(localPath);
    if (await metadataManager.isPortableProject()) {
      const existingMetadata = await metadataManager.getProjectMetadata();
      
      await taskManager.updatePhaseProgress(taskId, 'validate', 100, {
        type: 'PHASE_COMPLETE',
        message: 'Project is already portable, loading existing metadata',
      });

      await taskManager.completeTask(taskId, {
        projectId: existingMetadata?.id,
        name: existingMetadata?.name,
        localPath,
        alreadyPortable: true,
      });

      return NextResponse.json({
        success: true,
        taskId,
        data: {
          projectId: existingMetadata?.id,
          name: existingMetadata?.name,
          localPath,
          alreadyPortable: true,
        },
      });
    }

    // Check if directory is a Git repository
    if (!(await gitClient.isValidExternalRepository(localPath))) {
      await taskManager.updatePhaseProgress(taskId, 'validate', 100, {
        type: 'ERROR',
        message: 'Local directory is not a Git repository',
      });
      
      return NextResponse.json({
        success: false,
        error: `Local directory ${localPath} is not a Git repository`,
      }, { status: 400 });
    }

    // Check for conflicts
    const discoveryService = getProjectDiscoveryService();
    const existingProjects = await discoveryService.discoverProjects();
    const existingByPath = existingProjects.find(p => path.resolve(p.path) === path.resolve(localPath));
    
    if (existingByPath) {
      await taskManager.updatePhaseProgress(taskId, 'validate', 100, {
        type: 'ERROR',
        message: `Project at path "${localPath}" is already imported`,
      });
      
      return NextResponse.json({
        success: false,
        error: `The project at "${localPath}" is already imported as "${existingByPath.metadata.name}"`,
      }, { status: 409 });
    }

    await taskManager.updatePhaseProgress(taskId, 'validate', 100, {
      type: 'PHASE_COMPLETE',
      message: 'Local folder validation completed',
    });

    // Phase 2: Analyze Project
    await taskManager.updatePhaseProgress(taskId, 'analyze', 0, {
      type: 'INFO',
      message: 'Analyzing project structure...',
    });

    const projectStats = await analyzeProjectStructure(localPath);
    
    await taskManager.updatePhaseProgress(taskId, 'analyze', 100, {
      type: 'PHASE_COMPLETE',
      message: `Analyzed ${projectStats.totalFiles} files in ${projectStats.directories} directories`,
    });

    // Phase 3: Setup Metadata
    await taskManager.updatePhaseProgress(taskId, 'setup-metadata', 0, {
      type: 'INFO',
      message: 'Setting up .codehive/ metadata structure...',
    });

    const workspaceManager = new WorkspaceManager(localPath);

    // Initialize directory structures
    await metadataManager.initialize();
    await workspaceManager.initialize();

    await taskManager.updatePhaseProgress(taskId, 'setup-metadata', 100, {
      type: 'PHASE_COMPLETE',
      message: '.codehive/ metadata structure created',
    });

    // Phase 4: Detect Tech Stack
    await taskManager.updatePhaseProgress(taskId, 'detect-stack', 0, {
      type: 'INFO',
      message: 'Detecting technology stack...',
    });

    let detectedTechStack = {
      framework,
      language,
      packageManager,
      testFramework,
      lintTool,
      buildTool,
    };

    if (autoDetectTechStack) {
      const detected = await detectTechStack(localPath);
      detectedTechStack = {
        framework: framework || detected.framework,
        language: language || detected.language,
        packageManager: packageManager || detected.packageManager,
        testFramework: testFramework || detected.testFramework,
        lintTool: lintTool || detected.lintTool,
        buildTool: buildTool || detected.buildTool,
      };
    }

    await taskManager.updatePhaseProgress(taskId, 'detect-stack', 100, {
      type: 'PHASE_COMPLETE',
      message: 'Technology stack detection completed',
    });

    // Phase 5: Finalize
    await taskManager.updatePhaseProgress(taskId, 'finalize', 0, {
      type: 'INFO',
      message: 'Creating project metadata...',
    });

    // Create project metadata
    const now = new Date().toISOString();
    const projectId = `proj-${Date.now()}`;
    
    const projectMetadata: ProjectMetadata = {
      version: '1.0.0',
      id: projectId,
      name,
      description,
      localPath,
      status: 'ACTIVE',
      ...detectedTechStack,
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

    await taskManager.updatePhaseProgress(taskId, 'finalize', 100, {
      type: 'PHASE_COMPLETE',
      message: 'Local folder import completed successfully',
    });

    // Complete the task
    const result = {
      projectId,
      name,
      localPath,
      metadata: projectMetadata,
      settings: projectSettings,
      techStack: detectedTechStack,
      budget: budget ? {
        allocatedPercentage: budget.allocatedPercentage,
        dailyTokenBudget: budget.dailyTokenBudget,
      } : undefined,
      stats: projectStats,
    };

    await taskManager.completeTask(taskId, result);

    // Register project in system database
    const indexService = getProjectIndexService();
    try {
      await indexService.registerProject(projectMetadata, 'LOCAL_FOLDER');
      console.log(`Project ${projectId} registered in system database`);
    } catch (indexError) {
      console.warn(`Failed to register project in system database:`, indexError);
    }

    // Clear discovery cache so the new project is immediately discoverable
    discoveryService.clearCache();

    return NextResponse.json({
      success: true,
      taskId,
      data: result,
    });

  } catch (error) {
    console.error('Local folder import failed:', error);
    
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

// Separate handler for Git URL imports  
async function handleGitUrlImport(
  taskId: string,
  name: string,
  gitUrl: string,
  branch: string | undefined,
  validatedData: any,
  request: NextRequest
) {
  const {
    description,
    autoDetectTechStack,
    framework,
    language,
    packageManager,
    testFramework,
    lintTool,
    buildTool,
    settings,
    budget,
  } = validatedData;

  const projectName = name || path.basename(gitUrl);
  const finalLocalPath = await generateUniqueProjectPath(gitClient, projectName);

  // Create task phases specific to Git URL import
  const phases = [
    { phaseId: 'validate', title: 'Validate Git URL', description: 'Validating Git repository URL', order: 0 },
    { phaseId: 'clone', title: 'Clone Repository', description: 'Cloning repository from remote', order: 1 },
    { phaseId: 'analyze', title: 'Analyze Project', description: 'Analyzing project structure and dependencies', order: 2 },
    { phaseId: 'setup-metadata', title: 'Setup Metadata', description: 'Creating .codehive/ structure', order: 3 },
    { phaseId: 'detect-stack', title: 'Detect Tech Stack', description: 'Auto-detecting technology stack', order: 4 },
    { phaseId: 'finalize', title: 'Finalize', description: 'Finalizing project import', order: 5 },
  ];

  await taskManager.createTask(taskId, 'PROJECT_IMPORT', phases, {
    projectName,
  });

  await taskManager.startTask(taskId);

  try {
    // Phase 1: Validation
    await taskManager.updatePhaseProgress(taskId, 'validate', 0, {
      type: 'INFO',
      message: 'Validating Git URL...',
    });

    // Check for naming conflicts
    const discoveryService = getProjectDiscoveryService();
    const existingProjects = await discoveryService.discoverProjects();
    const existingByName = existingProjects.find(p => p.metadata.name === name);
    
    if (existingByName) {
      await taskManager.updatePhaseProgress(taskId, 'validate', 100, {
        type: 'ERROR',
        message: `Project with name "${name}" already exists`,
      });
      
      return NextResponse.json({
        success: false,
        error: `A project with the name "${name}" already exists at ${existingByName.path}`,
      }, { status: 409 });
    }

    await taskManager.updatePhaseProgress(taskId, 'validate', 100, {
      type: 'PHASE_COMPLETE',
      message: 'Git URL validation completed',
    });

    // Phase 2: Clone Repository
    await taskManager.updatePhaseProgress(taskId, 'clone', 0, {
      type: 'INFO',
      message: `Cloning repository from ${gitUrl}...`,
    });

    const cloneResult = await gitClient.clone({
      url: gitUrl,
      targetPath: finalLocalPath,
      branch,
      taskId,
      phaseId: 'clone',
    });

    if (!cloneResult.success) {
      await taskManager.updatePhaseProgress(taskId, 'clone', 100, {
        type: 'ERROR',
        message: `Clone failed: ${cloneResult.error}`,
      });
      
      return NextResponse.json({
        success: false,
        error: `Failed to clone repository: ${cloneResult.error}`,
      }, { status: 500 });
    }

    await taskManager.updatePhaseProgress(taskId, 'clone', 100, {
      type: 'PHASE_COMPLETE',
      message: 'Repository cloned successfully',
    });

    // Phase 3: Analyze Project
    await taskManager.updatePhaseProgress(taskId, 'analyze', 0, {
      type: 'INFO',
      message: 'Analyzing project structure...',
    });

    const projectStats = await analyzeProjectStructure(finalLocalPath);
    
    await taskManager.updatePhaseProgress(taskId, 'analyze', 100, {
      type: 'PHASE_COMPLETE',
      message: `Analyzed ${projectStats.totalFiles} files in ${projectStats.directories} directories`,
    });

    // Phase 4: Setup Metadata
    await taskManager.updatePhaseProgress(taskId, 'setup-metadata', 0, {
      type: 'INFO',
      message: 'Setting up .codehive/ metadata structure...',
    });

    const metadataManager = new SQLiteMetadataManager(finalLocalPath);
    const workspaceManager = new WorkspaceManager(finalLocalPath);

    // Initialize directory structures
    await metadataManager.initialize();
    await workspaceManager.initialize();

    await taskManager.updatePhaseProgress(taskId, 'setup-metadata', 100, {
      type: 'PHASE_COMPLETE',
      message: '.codehive/ metadata structure created',
    });

    // Phase 5: Detect Tech Stack
    await taskManager.updatePhaseProgress(taskId, 'detect-stack', 0, {
      type: 'INFO',
      message: 'Detecting technology stack...',
    });

    let detectedTechStack = {
      framework,
      language,
      packageManager,
      testFramework,
      lintTool,
      buildTool,
    };

    if (autoDetectTechStack) {
      const detected = await detectTechStack(finalLocalPath);
      detectedTechStack = {
        framework: framework || detected.framework,
        language: language || detected.language,
        packageManager: packageManager || detected.packageManager,
        testFramework: testFramework || detected.testFramework,
        lintTool: lintTool || detected.lintTool,
        buildTool: buildTool || detected.buildTool,
      };
    }

    await taskManager.updatePhaseProgress(taskId, 'detect-stack', 100, {
      type: 'PHASE_COMPLETE',
      message: 'Technology stack detection completed',
    });

    // Phase 6: Finalize
    await taskManager.updatePhaseProgress(taskId, 'finalize', 0, {
      type: 'INFO',
      message: 'Creating project metadata...',
    });

    // Create project metadata
    const now = new Date().toISOString();
    const projectId = `proj-${Date.now()}`;
    
    const projectMetadata: ProjectMetadata = {
      version: '1.0.0',
      id: projectId,
      name,
      description,
      gitUrl: gitUrl?.trim() || undefined,
      localPath: finalLocalPath,
      status: 'ACTIVE',
      ...detectedTechStack,
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

    await taskManager.updatePhaseProgress(taskId, 'finalize', 100, {
      type: 'PHASE_COMPLETE',
      message: 'Git repository import completed successfully',
    });

    // Complete the task
    const result = {
      projectId,
      name,
      localPath: finalLocalPath,
      metadata: projectMetadata,
      settings: projectSettings,
      techStack: detectedTechStack,
      budget: budget ? {
        allocatedPercentage: budget.allocatedPercentage,
        dailyTokenBudget: budget.dailyTokenBudget,
      } : undefined,
      stats: projectStats,
    };

    await taskManager.completeTask(taskId, result);

    // Register project in system database
    const indexService = getProjectIndexService();
    try {
      await indexService.registerProject(projectMetadata, 'GIT_URL');
      console.log(`Project ${projectId} registered in system database`);
    } catch (indexError) {
      console.warn(`Failed to register project in system database:`, indexError);
    }

    // Clear discovery cache so the new project is immediately discoverable
    discoveryService.clearCache();

    return NextResponse.json({
      success: true,
      taskId,
      data: result,
    });

  } catch (error) {
    console.error('Git URL import failed:', error);
    
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