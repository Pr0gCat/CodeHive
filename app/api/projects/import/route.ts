import { projectAnalyzer } from '@/lib/analysis/project-analyzer';
import { prisma } from '@/lib/db';
import { gitClient } from '@/lib/git';
import { taskManager, TaskPhase } from '@/lib/tasks/task-manager';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const importProjectSchema = z.object({
  gitUrl: z
    .string()
    .optional()
    .refine(val => {
      // Allow empty string or undefined
      if (!val || val.trim() === '') return true;
      // If has value, validate URL format
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    }, 'Invalid URL format'),
  localPath: z.string().optional(),
  projectName: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_\.]+$/, 'Project name can only contain letters, numbers, spaces, hyphens, underscores, and dots')
    .refine(val => val.trim().length > 0, 'Project name cannot be empty or only whitespace'),
  branch: z.string().optional(),
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
    const validatedData = importProjectSchema.parse(body);
    const {
      gitUrl,
      localPath,
      projectName,
      branch,
      framework,
      language,
      packageManager,
      testFramework,
      lintTool,
      buildTool,
    } = validatedData;

    // Validate inputs first
    if (!gitUrl && !localPath) {
      return NextResponse.json(
        { success: false, error: 'Either Git URL or local path is required' },
        { status: 400 }
      );
    }

    // Check if project name already exists
    const existingProject = await prisma.project.findFirst({
      where: { name: projectName },
    });

    if (existingProject) {
      return NextResponse.json(
        { success: false, error: 'A project with this name already exists' },
        { status: 409 }
      );
    }

    // Generate the final local path
    const finalLocalPath =
      localPath || gitClient.generateProjectPath(projectName);

    // Check if local path already exists in database
    const existingPath = await prisma.project.findFirst({
      where: { localPath: finalLocalPath },
    });

    if (existingPath) {
      return NextResponse.json(
        { 
          success: false, 
          error: `A project already exists at this location: ${finalLocalPath}` 
        },
        { status: 409 }
      );
    }

    // For local path imports, verify the directory exists
    if (localPath) {
      try {
        const { promises: fs } = await import('fs');
        await fs.access(localPath);
      } catch {
        return NextResponse.json(
          { 
            success: false, 
            error: `Local directory does not exist: ${localPath}` 
          },
          { status: 400 }
        );
      }
    }

    // IMMEDIATELY CREATE PROJECT RECORD IN DATABASE
    const project = await prisma.project.create({
      data: {
        name: projectName,
        description: '專案正在導入中...',
        gitUrl: gitUrl || null,
        localPath: finalLocalPath,
        status: 'INITIALIZING', // Start with INITIALIZING status
        framework: framework || null,
        language: language || null,
        packageManager: packageManager || null,
        testFramework: testFramework || null,
        lintTool: lintTool || null,
        buildTool: buildTool || null,
      },
    });

    // Generate task ID for background import
    const taskId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Run asynchronously with real progress tracking
    runImportAsync(project.id, taskId);

    return NextResponse.json({
      success: true,
      data: {
        projectId: project.id,
        taskId,
        message: 'Project created and import started',
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          localPath: project.localPath,
        },
      },
    });
  } catch (error) {
    console.error('Error in import setup:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start import' },
      { status: 500 }
    );
  }

  async function runImportAsync(projectId: string, taskId: string) {
    try {
      console.log(`🚀 Starting real import task: ${taskId}`);

      // Define real task phases
      const phases: TaskPhase[] = [
        {
          phaseId: 'git_clone',
          title: gitUrl ? '克隆儲存庫' : '驗證本地儲存庫',
          description: gitUrl
            ? `從 ${gitUrl} 克隆儲存庫`
            : '驗證本地 Git 儲存庫',
          order: 1,
        },
        {
          phaseId: 'analysis',
          title: '分析專案結構',
          description: '掃描檔案並檢測技術棧',
          order: 2,
        },
        {
          phaseId: 'sprint_setup',
          title: 'Setup Default Sprint',
          description: 'Create first sprint and initial work items',
          order: 3,
        },
        {
          phaseId: 'completion',
          title: '完成導入',
          description: '更新專案狀態為已完成',
          order: 4,
        },
      ];

      // Create task in database
      await taskManager.createTask(taskId, 'PROJECT_IMPORT', phases, {
        projectName,
        projectId: projectId,
        initiatedBy: 'user',
      });

      // Start task
      await taskManager.startTask(taskId);

      // Get the final local path
      const finalLocalPath =
        localPath || gitClient.generateProjectPath(projectName);

      // Phase 1: Git Repository
      await taskManager.startPhase(taskId, 'git_clone');

      let needsClone = false;

      if (localPath) {
        // Importing existing local repository

        await taskManager.updatePhaseProgress(taskId, 'git_clone', 30, {
          type: 'PHASE_PROGRESS',
          message: '檢查本地儲存庫',
        });

        // Verify it's a valid Git repository
        const isValid = await gitClient.isValidRepository(finalLocalPath);
        if (!isValid) {
          await taskManager.failPhase(
            taskId,
            'git_clone',
            'Path is not a valid Git repository'
          );
          return;
        }

        await taskManager.completePhase(taskId, 'git_clone', {
          repositoryPath: finalLocalPath,
          repositoryType: 'local',
        });
      } else {
        // Clone from remote URL
        needsClone = true;

        // Check if directory already exists
        const repoExists = await gitClient.isValidRepository(finalLocalPath);
        if (repoExists) {
          await taskManager.failPhase(
            taskId,
            'git_clone',
            'Repository already exists at this location'
          );
          return;
        }

        // Clone the repository with real progress tracking
        console.log(
          `Cloning repository from ${gitUrl} to ${finalLocalPath}...`
        );
        const cloneResult = await gitClient.clone({
          url: gitUrl!,
          targetPath: finalLocalPath,
          branch,
          depth: 1,
          taskId: taskId,
          phaseId: 'git_clone',
        });

        if (!cloneResult.success) {
          await taskManager.failPhase(
            taskId,
            'git_clone',
            'Failed to clone repository: ' + cloneResult.error
          );
          return;
        }

        // Verify the clone was successful
        const isValid = await gitClient.isValidRepository(finalLocalPath);
        if (!isValid) {
          await taskManager.failPhase(
            taskId,
            'git_clone',
            'Repository clone verification failed'
          );
          return;
        }

        await taskManager.completePhase(taskId, 'git_clone', {
          repositoryPath: finalLocalPath,
          repositoryType: 'remote',
          clonedFrom: gitUrl,
          cloneSize: cloneResult.output?.length || 0,
        });
      }

      // Phase 3: Project Analysis - WITH REAL PROGRESS
      await taskManager.startPhase(taskId, 'analysis');

      // Run real project analysis with progress tracking
      const analysisResult = await projectAnalyzer.analyzeProject(
        finalLocalPath,
        taskId,
        'analysis'
      );

      // Get additional repository metadata
      const currentBranch = await gitClient.getCurrentBranch(finalLocalPath);
      const actualRemoteUrl =
        gitUrl || (await gitClient.getRemoteUrl(finalLocalPath));

      await taskManager.completePhase(taskId, 'analysis', {
        filesAnalyzed: analysisResult.totalFiles,
        totalSize: analysisResult.totalSize,
        detectedFramework: analysisResult.detectedFramework,
        detectedLanguage: analysisResult.detectedLanguage,
        detectedPackageManager: analysisResult.detectedPackageManager,
        filesByType: analysisResult.filesByType,
        currentBranch,
        remoteUrl: actualRemoteUrl,
      });

      // Phase 3: Completion - Update project status first
      await taskManager.startPhase(taskId, 'completion');

      await taskManager.updatePhaseProgress(taskId, 'completion', 20, {
        type: 'PHASE_PROGRESS',
        message: 'Updating project information',
      });

      // Update project in database with analysis results and set status to ACTIVE
      await prisma.project.update({
        where: { id: projectId },
        data: {
          description: gitUrl
            ? `Imported from ${gitUrl}`
            : `Imported from local repository at ${finalLocalPath}`,
          gitUrl: actualRemoteUrl,
          localPath: finalLocalPath,
          status: 'ACTIVE', // Change status to ACTIVE before sprint creation
          framework: framework || analysisResult.detectedFramework,
          language: language || analysisResult.detectedLanguage,
          packageManager:
            packageManager || analysisResult.detectedPackageManager,
          testFramework: testFramework || analysisResult.detectedTestFramework,
          lintTool,
          buildTool,
        },
      });

      await taskManager.updatePhaseProgress(taskId, 'completion', 40, {
        type: 'PHASE_PROGRESS',
        message: 'Project status updated to ACTIVE',
      });

      // Phase 4: Sprint Setup - Create default first sprint (now that project is ACTIVE)
      await taskManager.startPhase(taskId, 'sprint_setup');

      try {
        console.log(`Setting up default sprint for project: ${projectName}...`);

        await taskManager.updatePhaseProgress(
          taskId,
          'sprint_setup',
          30,
          {
            type: 'PHASE_PROGRESS',
            message: 'Setting up default sprint plan',
          }
        );

        // Import and call createDefaultFirstSprint
        const { createDefaultFirstSprint } = await import('@/lib/sprints/default-sprint');

        await taskManager.updatePhaseProgress(
          taskId,
          'sprint_setup',
          60,
          {
            type: 'PHASE_PROGRESS',
            message: 'Creating first sprint and work items',
          }
        );

        const sprintResult = await createDefaultFirstSprint(projectId, projectName);

        console.log(
          `✅ Default sprint created successfully for project: ${projectName}`
        );
        console.log(`   Sprint: ${sprintResult.sprint.name}`);
        console.log(`   Epic: ${sprintResult.epic.title}`);
        console.log(`   Stories created: ${sprintResult.stories.length}`);

        await taskManager.updatePhaseProgress(
          taskId,
          'sprint_setup',
          100,
          {
            type: 'PHASE_PROGRESS',
            message: 'Sprint setup completed',
          }
        );

        await taskManager.completePhase(taskId, 'sprint_setup', {
          sprintId: sprintResult.sprint.id,
          sprintName: sprintResult.sprint.name,
          epicId: sprintResult.epic.id,
          epicTitle: sprintResult.epic.title,
          storiesCreated: sprintResult.stories.length,
          totalStoryPoints: sprintResult.stories.reduce((sum, story) => sum + (story.storyPoints || 0), 0),
        });
      } catch (sprintError) {
        console.error(
          `❌ Error setting up sprint for ${projectName}:`,
          sprintError
        );
        await taskManager.updatePhaseProgress(
          taskId,
          'sprint_setup',
          100,
          {
            type: 'ERROR',
            message: `Sprint setup error: ${sprintError instanceof Error ? sprintError.message : 'Unknown error'}`,
          }
        );
        await taskManager.completePhase(taskId, 'sprint_setup', {
          error:
            sprintError instanceof Error
              ? sprintError.message
              : 'Unknown error',
        });
      }

      await taskManager.updatePhaseProgress(taskId, 'completion', 70, {
        type: 'PHASE_PROGRESS',
        message: 'Creating initial project cards',
      });

      // Create initial Kanban cards
      const initialCards = [
        {
          title: 'Project Setup',
          description: 'Initialize project dependencies and configuration',
          status: 'TODO',
          position: 0,
        },
        {
          title: 'Code Analysis',
          description: 'Analyze codebase for quality and potential issues',
          status: 'TODO',
          position: 1,
        },
        {
          title: 'Documentation Review',
          description: 'Review and update project documentation',
          status: 'TODO',
          position: 2,
        },
      ];

      await prisma.kanbanCard.createMany({
        data: initialCards.map(card => ({
          projectId: projectId,
          ...card,
        })),
      });

      await taskManager.updatePhaseProgress(taskId, 'completion', 80, {
        type: 'PHASE_PROGRESS',
        message: '生成智能描述',
      });

      // Generate project description using Claude Code
      let projectDescription = gitUrl
        ? `Imported from ${gitUrl}`
        : `Imported from local repository at ${finalLocalPath}`;
      try {
        console.log(
          `🤖 Generating project description using Claude Code for: ${projectName}...`
        );

        await taskManager.updatePhaseProgress(taskId, 'completion', 85, {
          type: 'PHASE_PROGRESS',
          message: '使用 Claude Code 分析專案結構',
        });

        const descriptionResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/agents/project-manager`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              projectId: projectId,
              action: 'analyze',
            }),
          }
        );

        const descriptionResult = await descriptionResponse.json();
        if (descriptionResult.success && descriptionResult.data?.context) {
          await taskManager.updatePhaseProgress(taskId, 'initialization', 50, {
            type: 'PHASE_PROGRESS',
            message: '生成智能專案描述',
          });

          // Generate project summary using the context
          const summaryResponse = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/agents/project-manager`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                projectId: projectId,
                action: 'generate-summary',
                context: descriptionResult.data.context,
              }),
            }
          );

          const summaryResult = await summaryResponse.json();
          if (summaryResult.success && summaryResult.data?.summary) {
            projectDescription = summaryResult.data.summary;
            console.log(
              `Generated intelligent description: "${projectDescription}"`
            );
          }
        }
      } catch (descriptionError) {
        console.error(
          `⚠️ Failed to generate project description for ${projectName}:`,
          descriptionError
        );

        // Try to generate a basic description based on analysis results
        if (
          analysisResult?.detectedFramework &&
          analysisResult.detectedFramework !== 'None specified'
        ) {
          projectDescription = `${analysisResult.detectedFramework} application`;
        } else if (
          analysisResult?.detectedLanguage &&
          analysisResult.detectedLanguage !== 'None specified'
        ) {
          projectDescription = `${analysisResult.detectedLanguage} project`;
        }

        console.log(`Using fallback description: "${projectDescription}"`);
      }

      // Step 2: Update project with generated description and complete status
      await prisma.project.update({
        where: { id: projectId },
        data: { description: projectDescription },
      });

      await taskManager.updatePhaseProgress(taskId, 'completion', 100, {
        type: 'PHASE_COMPLETE',
        message: '專案導入完成',
      });

      await taskManager.completePhase(taskId, 'completion', {
        projectUpdated: true,
        descriptionGenerated: true,
        sprintSetupCompleted: true,
        finalDescription: projectDescription,
        initialCards: 3,
      });

      // Complete entire task
      const finalResult = {
        success: true,
        project: {
          id: projectId,
          name: projectName,
          gitUrl: actualRemoteUrl,
          localPath: finalLocalPath,
          branch: currentBranch,
          isGitManaged: true,
          importSource: gitUrl ? 'remote' : 'local',
          analysis: analysisResult,
        },
        message: `Git repository imported successfully ${needsClone ? 'from remote' : 'from local path'} and project review initiated`,
      };

      await taskManager.completeTask(taskId, finalResult);

      console.log(`🎉 Import task ${taskId} completed successfully`);
    } catch (error) {
      console.error('Import task failed:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Update project status to failed
      await prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'ARCHIVED',
          description: `導入失敗: ${errorMessage}`,
        },
      });

      await taskManager.failPhase(
        taskId,
        'unknown',
        `Failed to import project: ${errorMessage}`
      );
    }
  } catch (error) {
    console.error('Error in import request:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input format',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process import request',
      },
      { status: 500 }
    );
  }
}
