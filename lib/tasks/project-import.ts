import { prisma } from '@/lib/db';
import { TaskManager } from './task-manager';

const taskManager = TaskManager.getInstance();

/**
 * Extracted project import logic for task recovery
 */
export async function runImportAsync(
  taskId: string,
  projectId: string,
  data: {
    projectName: string;
    localPath: string | null;
    gitUrl?: string;
    branch?: string;
    framework?: string;
    language?: string;
    packageManager?: string;
    testFramework?: string;
    lintTool?: string;
    buildTool?: string;
  }
) {
  const {
    projectName,
    localPath,
    gitUrl,
    branch,
    framework,
    language,
    packageManager,
    testFramework,
    lintTool,
    buildTool,
  } = data;

  try {
    console.log(`🚀 Starting project import recovery for: ${projectName}`);

    // Update task status to running
    await prisma.taskExecution.update({
      where: { taskId },
      data: { status: 'RUNNING' },
    });

    const { gitClient } = await import('@/lib/git');
    const { projectAnalyzer } = await import('@/lib/analysis/project-analyzer');

    // Get the final local path
    const finalLocalPath = localPath || gitClient.generateProjectPath(projectName);

    // Phase 1: Git Repository
    await taskManager.startPhase(taskId, 'git_clone');

    let needsClone = false;

    if (localPath) {
      // Importing existing local repository
      await taskManager.updatePhaseProgress(taskId, 'git_clone', 30, {
        type: 'PHASE_PROGRESS',
        message: '檢查本地儲存庫 (recovery)',
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
        recovered: true,
      });
    } else {
      // Clone from remote URL (if not already cloned)
      needsClone = true;

      // Check if directory already exists
      const repoExists = await gitClient.isValidRepository(finalLocalPath);
      if (repoExists) {
        console.log(`📦 Repository already exists at ${finalLocalPath}, skipping clone`);
        await taskManager.completePhase(taskId, 'git_clone', {
          repositoryPath: finalLocalPath,
          repositoryType: 'remote',
          alreadyExists: true,
          recovered: true,
        });
        needsClone = false;
      } else {
        // Clone the repository with real progress tracking
        console.log(`Cloning repository from ${gitUrl} to ${finalLocalPath}... (recovery)`);
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
          recovered: true,
        });
      }
    }

    // Phase 2: Project Analysis - WITH REAL PROGRESS
    await taskManager.startPhase(taskId, 'analysis');

    // Run real project analysis with progress tracking
    const analysisResult = await projectAnalyzer.analyzeProject(
      finalLocalPath,
      taskId,
      'analysis'
    );

    // Get additional repository metadata
    const currentBranch = await gitClient.getCurrentBranch(finalLocalPath);
    const actualRemoteUrl = gitUrl || (await gitClient.getRemoteUrl(finalLocalPath));

    await taskManager.completePhase(taskId, 'analysis', {
      filesAnalyzed: analysisResult.totalFiles,
      totalSize: analysisResult.totalSize,
      detectedFramework: analysisResult.detectedFramework,
      detectedLanguage: analysisResult.detectedLanguage,
      detectedPackageManager: analysisResult.detectedPackageManager,
      filesByType: analysisResult.filesByType,
      currentBranch,
      remoteUrl: actualRemoteUrl,
      recovered: true,
    });

    // Phase 3: Generate CLAUDE.md (if needed)
    await taskManager.startPhase(taskId, 'claude_md_generation');

    try {
      console.log(`📝 Generating CLAUDE.md for project: ${projectName}... (recovery)`);

      const claudeMdPath = `${finalLocalPath}/CLAUDE.md`;
      const { promises: fs } = await import('fs');
      const claudeMdExists = await fs
        .access(claudeMdPath)
        .then(() => true)
        .catch(() => false);

      if (claudeMdExists) {
        console.log(`📋 CLAUDE.md already exists, skipping generation`);
        await taskManager.updatePhaseProgress(
          taskId,
          'claude_md_generation',
          100,
          {
            type: 'PHASE_PROGRESS',
            message: 'CLAUDE.md 已存在，跳過生成 (recovery)',
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
            message: '使用 Claude Code 生成 CLAUDE.md (recovery)',
          }
        );

        const { claudeCode } = await import('@/lib/claude-code');

        const claudeResult = await claudeCode.execute('/init', {
          workingDirectory: finalLocalPath,
          timeout: 180000, // 3 minutes
        });

        if (claudeResult.success) {
          console.log(`✅ CLAUDE.md generated successfully using Claude Code (recovery)`);
        } else {
          console.log(`⚠️ Claude Code generation failed: ${claudeResult.error}`);
        }
      }

      await taskManager.completePhase(taskId, 'claude_md_generation', {
        claudeMdExists: claudeMdExists,
        generated: !claudeMdExists,
        recovered: true,
      });
    } catch (claudeMdError) {
      console.error(`❌ Error generating CLAUDE.md:`, claudeMdError);
      await taskManager.completePhase(taskId, 'claude_md_generation', {
        error: claudeMdError instanceof Error ? claudeMdError.message : 'Unknown error',
        recovered: true,
      });
    }

    // Phase 4: Completion
    await taskManager.startPhase(taskId, 'completion');

    await taskManager.updatePhaseProgress(taskId, 'completion', 20, {
      type: 'PHASE_PROGRESS',
      message: '更新專案資訊 (recovery)',
    });

    // Update project in database with analysis results
    await prisma.project.update({
      where: { id: projectId },
      data: {
        description: gitUrl
          ? `Imported from ${gitUrl} (recovered)`
          : `Imported from local repository at ${finalLocalPath} (recovered)`,
        gitUrl: actualRemoteUrl,
        localPath: finalLocalPath,
        status: 'ACTIVE', // Change status to ACTIVE
        framework: framework || analysisResult.detectedFramework,
        language: language || analysisResult.detectedLanguage,
        packageManager: packageManager || analysisResult.detectedPackageManager,
        testFramework: testFramework || analysisResult.detectedTestFramework,
        lintTool,
        buildTool,
      },
    });

    await taskManager.updatePhaseProgress(taskId, 'completion', 80, {
      type: 'PHASE_PROGRESS',
      message: '生成智能描述 (recovery)',
    });

    // Generate project description using Claude Code
    let projectDescription = gitUrl
      ? `Imported from ${gitUrl} (recovered)`
      : `Imported from local repository at ${finalLocalPath} (recovered)`;

    try {
      console.log(`🤖 Generating project description using Claude Code for: ${projectName}... (recovery)`);

      const descriptionResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/agents/project-manager`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze',
            projectId: projectId,
          }),
        }
      );

      if (descriptionResponse.ok) {
        const descriptionResult = await descriptionResponse.json();
        if (descriptionResult.success && descriptionResult.data?.context) {
          // Generate summary from context
          const summaryResponse = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/agents/project-manager`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'summarize',
                context: descriptionResult.data.context,
              }),
            }
          );

          const summaryResult = await summaryResponse.json();
          if (summaryResult.success && summaryResult.data?.summary) {
            projectDescription = summaryResult.data.summary + ' (recovered)';
            console.log(`✅ Generated intelligent description: "${projectDescription}"`);
          }
        }
      }
    } catch (descriptionError) {
      console.error(`⚠️ Failed to generate project description:`, descriptionError);
    }

    // Update project with generated description
    await prisma.project.update({
      where: { id: projectId },
      data: { description: projectDescription },
    });

    await taskManager.completePhase(taskId, 'completion', {
      projectId,
      finalDescription: projectDescription,
      recovered: true,
    });

    // Complete the task
    const finalResult = {
      success: true,
      projectId,
      message: `Git repository imported successfully ${needsClone ? 'from remote' : 'from local path'} and project review initiated (recovered)`,
      recovered: true,
    };

    await taskManager.completeTask(taskId, finalResult);

    console.log(`🎉 Import recovery task ${taskId} completed successfully`);
  } catch (error) {
    console.error('Import recovery task failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update project status to failed
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'ARCHIVED',
        description: `導入失敗 (recovery): ${errorMessage}`,
      },
    });

    await taskManager.failPhase(
      taskId,
      'unknown',
      `Failed to import project (recovery): ${errorMessage}`
    );
  }
}