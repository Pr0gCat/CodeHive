import { prisma } from '@/lib/db';
import { gitClient } from '@/lib/git';
import { taskManager } from '@/lib/tasks/task-manager';
import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  gitUrl: z
    .string()
    .optional()
    .refine(val => {
      // 允許空字符串或未定義
      if (!val || val.trim() === '') return true;
      // 如果有值，驗證 URL 格式
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
});

export async function POST(request: NextRequest) {
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
    } = validatedData;

    // Generate localPath if not provided
    const localPath =
      validatedData.localPath?.trim() || gitClient.generateProjectPath(name);

    // Check if project already exists
    const existingProject = await prisma.project.findFirst({
      where: { name },
    });

    if (existingProject) {
      return NextResponse.json(
        {
          success: false,
          error: 'A project with this name already exists',
        },
        { status: 409 }
      );
    }

    // IMMEDIATELY CREATE PROJECT RECORD IN DATABASE
    const project = await prisma.project.create({
      data: {
        name,
        description: description || '專案正在初始化中...',
        gitUrl: gitUrl && gitUrl.trim() ? gitUrl.trim() : null,
        localPath,
        status: 'INITIALIZING', // Start with INITIALIZING status
        // Tech stack will be updated during initialization if provided
        framework: framework || null,
        language: language || null,
        packageManager: packageManager || null,
        testFramework: testFramework || null,
        lintTool: lintTool || null,
        buildTool: buildTool || null,
      },
    });

    // Define phases for project creation
    const phases = [
      {
        phaseId: 'validation',
        title: '驗證專案資訊',
        description: '檢查專案名稱和路徑',
        order: 0,
      },
      {
        phaseId: 'setup',
        title: '建立專案目錄',
        description: 'mkdir 建立專案目錄和 git init',
        order: 1,
      },
      {
        phaseId: 'sprint_setup',
        title: 'Setup Default Sprint',
        description: 'Create default first sprint and tasks',
        order: 2,
      },
      {
        phaseId: 'description_generation',
        title: '生成專案描述',
        description: '使用代碼分析器生成專案描述',
        order: 3,
      },
      {
        phaseId: 'completion',
        title: '完成初始化',
        description: '更新專案狀態為已完成',
        order: 4,
      },
    ];

    // Create task for project creation
    const taskId = `create-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await taskManager.createTask(taskId, 'PROJECT_CREATE', phases, {
      projectName: name,
      projectId: project.id, // Now we have the project ID
    });

    // Start the task
    await taskManager.startTask(taskId);

    // Start async project creation
    createProjectAsync(taskId, project.id, {
      name,
      description,
      gitUrl,
      localPath,
      initializeGit,
      framework,
      language,
      packageManager,
      testFramework,
      lintTool,
      buildTool,
    }).catch(async error => {
      console.error('Project creation failed:', error);
      // Update project status to failed
      await prisma.project.update({
        where: { id: project.id },
        data: {
          status: 'ARCHIVED',
          description: `初始化失敗: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });
      await taskManager.updatePhaseProgress(taskId, 'complete', 100, {
        type: 'ERROR',
        message: `Project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        projectId: project.id,
        taskId: taskId,
        message: 'Project created and initialization started',
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          localPath: project.localPath,
        },
      },
    });
  } catch (error) {
    console.error('Error creating project:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid project data',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create project',
      },
      { status: 500 }
    );
  }
}

async function createProjectAsync(
  taskId: string,
  projectId: string,
  data: {
    name: string;
    description?: string;
    gitUrl?: string;
    localPath: string;
    initializeGit: boolean;
    framework?: string;
    language?: string;
    packageManager?: string;
    testFramework?: string;
    lintTool?: string;
    buildTool?: string;
  }
) {
  const {
    name,
    description,
    gitUrl,
    localPath,
    initializeGit,
  } = data;

  try {
    // Phase 1: Validation
    const validationPhaseId = 'validation';
    await taskManager.startPhase(taskId, validationPhaseId);

    // Check project name availability
    await taskManager.updatePhaseProgress(taskId, validationPhaseId, 30, {
      type: 'PHASE_PROGRESS',
      message: 'Checking project name availability',
    });

    // Ensure directory exists
    await fs.mkdir(path.dirname(localPath), { recursive: true });

    await taskManager.updatePhaseProgress(taskId, validationPhaseId, 70, {
      type: 'PHASE_PROGRESS',
      message: 'Validating project path',
    });

    await taskManager.updatePhaseProgress(taskId, validationPhaseId, 100, {
      type: 'PHASE_COMPLETE',
      message: 'Validation completed',
    });
    await taskManager.completePhase(taskId, validationPhaseId);

    // Phase 2: Setup (mkdir + git init)
    const setupPhaseId = 'setup';
    await taskManager.startPhase(taskId, setupPhaseId);

    await taskManager.updatePhaseProgress(taskId, setupPhaseId, 30, {
      type: 'PHASE_PROGRESS',
      message: 'Creating project directory',
    });

    // Create project directory
    await fs.mkdir(localPath, { recursive: true });

    await taskManager.updatePhaseProgress(taskId, setupPhaseId, 70, {
      type: 'PHASE_PROGRESS',
      message: 'Initializing Git repository',
    });

    // Git initialization
    if (initializeGit) {
      const isExistingRepo = await gitClient.isValidRepository(localPath);

      if (!isExistingRepo) {
        const initResult = await gitClient.init(localPath);

        if (!initResult.success) {
          throw new Error(`Failed to initialize Git: ${initResult.error}`);
        }
      }
    }

    await taskManager.updatePhaseProgress(taskId, setupPhaseId, 100, {
      type: 'PHASE_COMPLETE',
      message: 'Project directory and Git initialized',
    });
    await taskManager.completePhase(taskId, setupPhaseId);

    // Phase 3: Create default first sprint with README task
    const sprintSetupPhaseId = 'sprint_setup';
    await taskManager.startPhase(taskId, sprintSetupPhaseId);

    await taskManager.updatePhaseProgress(taskId, sprintSetupPhaseId, 30, {
      type: 'PHASE_PROGRESS',
      message: 'Creating default first sprint...',
    });

    try {
      const { createDefaultFirstSprint } = await import('@/lib/sprints/default-sprint');
      const sprintResult = await createDefaultFirstSprint(projectId, name);

      await taskManager.updatePhaseProgress(taskId, sprintSetupPhaseId, 100, {
        type: 'PHASE_COMPLETE',
        message: `Created first sprint with README creation task`,
      });
      await taskManager.completePhase(taskId, sprintSetupPhaseId);
    } catch (sprintError) {
      console.error('Failed to create default sprint:', sprintError);
      await taskManager.updatePhaseProgress(taskId, sprintSetupPhaseId, 100, {
        type: 'PHASE_COMPLETE',
        message: 'Sprint creation skipped due to error',
      });
      await taskManager.completePhase(taskId, sprintSetupPhaseId);
    }

    // Phase 4: Generate project description with code analyzer
    const descriptionGenerationPhaseId = 'description_generation';
    await taskManager.startPhase(taskId, descriptionGenerationPhaseId);

    await taskManager.updatePhaseProgress(taskId, descriptionGenerationPhaseId, 20, {
      type: 'PHASE_PROGRESS',
      message: 'Analyzing project for description generation...',
    });

    // Use code analyzer for description generation
    let finalDescription = description || 'Software project';
    try {
      console.log(
        `🔍 Analyzing project structure for description: ${name}...`
      );

      const { projectAnalyzer } = await import('@/lib/analysis/project-analyzer');
      const finalAnalysisResult = await projectAnalyzer.analyzeProject(localPath);

      await taskManager.updatePhaseProgress(taskId, descriptionGenerationPhaseId, 60, {
        type: 'PHASE_PROGRESS',
        message: 'Generating intelligent project description...',
      });

      // Generate description based on analysis results
      const techStack = [];
      if (finalAnalysisResult.detectedLanguage) techStack.push(finalAnalysisResult.detectedLanguage);
      if (finalAnalysisResult.detectedFramework) techStack.push(finalAnalysisResult.detectedFramework);
      if (finalAnalysisResult.detectedPackageManager) techStack.push(finalAnalysisResult.detectedPackageManager);
      
      const techStackText = techStack.length > 0 ? ` using ${techStack.join(', ')}` : '';
      const fileCountText = finalAnalysisResult.totalFiles > 0 ? ` with ${finalAnalysisResult.totalFiles} files` : '';
      
      finalDescription = description || `${finalAnalysisResult.detectedLanguage || 'Software'} project${techStackText}${fileCountText}. Managed by CodeHive with AI-Native TDD development.`;
      
      console.log(
        `Generated description from analysis: "${finalDescription}"`
      );
    } catch (descriptionError) {
      console.error(
        `⚠️ Failed to analyze project for description ${name}:`,
        descriptionError
      );
      // Continue with default description
    }

    await taskManager.updatePhaseProgress(taskId, descriptionGenerationPhaseId, 100, {
      type: 'PHASE_COMPLETE',
      message: 'Project description generated with code analyzer',
    });
    await taskManager.completePhase(taskId, descriptionGenerationPhaseId);

    // Phase 5: Complete initialization 
    const completionPhaseId = 'completion';
    await taskManager.startPhase(taskId, completionPhaseId);

    await taskManager.updatePhaseProgress(taskId, completionPhaseId, 50, {
      type: 'PHASE_PROGRESS',
      message: 'Updating project status...',
    });

    // Update project with generated description and ACTIVE status
    await prisma.project.update({
      where: { id: projectId },
      data: {
        description: finalDescription,
        status: 'ACTIVE', // Change status to ACTIVE
      },
    });

    // Create initial commit with all generated files
    if (initializeGit) {
      try {
        const commitResult = await gitClient.initialCommit(
          localPath,
          'Initial commit - CodeHive project setup\n\n- Created README.md with project analysis\n- Set up project structure'
        );

        if (!commitResult.success) {
          console.warn('Failed to create initial commit:', commitResult.error);
        }
      } catch (commitError) {
        console.warn('Failed to create initial commit:', commitError);
      }
    }

    await taskManager.updatePhaseProgress(taskId, completionPhaseId, 100, {
      type: 'PHASE_COMPLETE',
      message: 'Project initialization completed',
    });
    await taskManager.completePhase(taskId, completionPhaseId);

    // Complete the task
    await taskManager.completeTask(taskId, {
      project: {
        id: projectId,
        name: name,
        localPath: localPath,
      },
    });
  } catch (error) {
    console.error('Error in createProjectAsync:', error);
    await taskManager.updatePhaseProgress(taskId, 'complete', 100, {
      type: 'ERROR',
      message: `Project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    throw error;
  }
}
