import { NextRequest, NextResponse } from 'next/server';
import { prisma, ProjectStatus } from '@/lib/db';
import { gitClient } from '@/lib/git';
import { taskManager, TaskPhase } from '@/lib/tasks/task-manager';
import { projectAnalyzer } from '@/lib/analysis/project-analyzer';

interface ImportRequest {
  gitUrl?: string; // Optional - can import existing local repos
  localPath?: string; // For importing existing local Git repos
  projectName: string;
  branch?: string;
  framework?: string;
  language?: string;
  packageManager?: string;
  testFramework?: string;
  lintTool?: string;
  buildTool?: string;
}

export async function POST(request: NextRequest) {
  const body: ImportRequest = await request.json();
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
  } = body;

  try {
    // Validate inputs first
    if (!gitUrl && !localPath) {
      return NextResponse.json(
        { success: false, error: 'Either Git URL or local path is required' },
        { status: 400 }
      );
    }

    if (!projectName) {
      return NextResponse.json(
        { success: false, error: 'Project name is required' },
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
          phaseId: 'claude_md_generation',
          title: '生成 CLAUDE.md',
          description: '使用 Claude Code 生成專案指南',
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

      // Phase 3.5: Generate CLAUDE.md BEFORE database creation
      await taskManager.startPhase(taskId, 'claude_md_generation');

      try {
        console.log(`📝 Generating CLAUDE.md for project: ${projectName}...`);

        await taskManager.updatePhaseProgress(
          taskId,
          'claude_md_generation',
          30,
          {
            type: 'PHASE_PROGRESS',
            message: '生成專案 CLAUDE.md 文件',
          }
        );

        // Check if CLAUDE.md already exists
        const claudeMdPath = `${finalLocalPath}/CLAUDE.md`;
        const { promises: fs } = await import('fs');
        const claudeMdExists = await fs
          .access(claudeMdPath)
          .then(() => true)
          .catch(() => false);

        if (claudeMdExists) {
          console.log(
            `📋 CLAUDE.md already exists at ${claudeMdPath}, skipping generation`
          );
          await taskManager.updatePhaseProgress(
            taskId,
            'claude_md_generation',
            100,
            {
              type: 'PHASE_PROGRESS',
              message: 'CLAUDE.md 已存在，跳過生成',
            }
          );
        } else {
          // Use Claude Code /init to generate CLAUDE.md
          await taskManager.updatePhaseProgress(
            taskId,
            'claude_md_generation',
            60,
            {
              type: 'PHASE_PROGRESS',
              message: '使用 Claude Code 生成 CLAUDE.md',
            }
          );

          const { claudeCode } = await import('@/lib/claude-code');

          const claudeResult = await claudeCode.execute('/init', {
            workingDirectory: finalLocalPath,
            timeout: 180000, // 3 minutes
          });

          if (claudeResult.success) {
            console.log(
              `✅ CLAUDE.md generated successfully using Claude Code`
            );
            await taskManager.updatePhaseProgress(
              taskId,
              'claude_md_generation',
              100,
              {
                type: 'PHASE_PROGRESS',
                message: 'CLAUDE.md 生成成功',
              }
            );
          } else {
            console.log(
              `⚠️ Claude Code generation failed: ${claudeResult.error}`
            );
            await taskManager.updatePhaseProgress(
              taskId,
              'claude_md_generation',
              100,
              {
                type: 'PHASE_PROGRESS',
                message: 'CLAUDE.md 生成失敗，將繼續匯入',
              }
            );
          }
        }

        await taskManager.completePhase(taskId, 'claude_md_generation', {
          claudeMdExists: claudeMdExists,
          generated: !claudeMdExists,
        });
      } catch (claudeMdError) {
        console.error(
          `❌ Error generating CLAUDE.md for ${projectName}:`,
          claudeMdError
        );
        await taskManager.updatePhaseProgress(
          taskId,
          'claude_md_generation',
          100,
          {
            type: 'ERROR',
            message: `CLAUDE.md 生成錯誤: ${claudeMdError instanceof Error ? claudeMdError.message : 'Unknown error'}`,
          }
        );
        await taskManager.completePhase(taskId, 'claude_md_generation', {
          error:
            claudeMdError instanceof Error
              ? claudeMdError.message
              : 'Unknown error',
        });
      }

      // Phase 4: Completion - Update project status
      await taskManager.startPhase(taskId, 'completion');

      await taskManager.updatePhaseProgress(taskId, 'completion', 20, {
        type: 'PHASE_PROGRESS',
        message: '更新專案資訊',
      });

      // Update project in database with analysis results
      await prisma.project.update({
        where: { id: projectId },
        data: {
          description: gitUrl
            ? `Imported from ${gitUrl}`
            : `Imported from local repository at ${finalLocalPath}`,
          gitUrl: actualRemoteUrl,
          localPath: finalLocalPath,
          status: 'ACTIVE', // Change status to ACTIVE
          framework: framework || analysisResult.detectedFramework,
          language: language || analysisResult.detectedLanguage,
          packageManager:
            packageManager || analysisResult.detectedPackageManager,
          testFramework: testFramework || analysisResult.detectedTestFramework,
          lintTool,
          buildTool,
        },
      });

      await taskManager.updatePhaseProgress(taskId, 'completion', 60, {
        type: 'PHASE_PROGRESS',
        message: '建立初始看板卡片',
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
              `✅ Generated intelligent description: "${projectDescription}"`
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

        console.log(`📝 Using fallback description: "${projectDescription}"`);
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
        claudeMdGenerated: true,
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
  }
}
