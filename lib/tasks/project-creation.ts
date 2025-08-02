import { prisma } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';
import { TaskManager } from './task-manager';

const taskManager = TaskManager.getInstance();

/**
 * Extracted project creation logic for task recovery
 */
export async function createProjectAsync(
  taskId: string,
  projectId: string,
  data: {
    name: string;
    description?: string;
    gitUrl?: string;
    localPath: string | null;
    initializeGit?: boolean;
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
    initializeGit = true,
    framework,
    language,
    packageManager,
    testFramework,
    lintTool,
    buildTool,
  } = data;

  // Get actual local path
  const { gitClient } = await import('@/lib/git');
  const finalLocalPath = localPath || gitClient.generateProjectPath(name);

  try {
    console.log(`Starting project creation recovery for: ${name}`);

    // Update task status to running
    await prisma.taskExecution.update({
      where: { taskId },
      data: { status: 'RUNNING' },
    });

    // Phase 1: Validation
    const validationPhaseId = 'validation';
    await taskManager.updatePhaseProgress(taskId, validationPhaseId, 0, {
      type: 'PHASE_START',
      message: 'Starting validation (recovery)',
    });

    // Ensure directory exists
    await fs.mkdir(path.dirname(finalLocalPath), { recursive: true });

    await taskManager.updatePhaseProgress(taskId, validationPhaseId, 100, {
      type: 'PHASE_COMPLETE',
      message: 'Validation completed',
    });

    // Phase 2: Setup
    const setupPhaseId = 'setup';
    await taskManager.updatePhaseProgress(taskId, setupPhaseId, 0, {
      type: 'PHASE_START',
      message: 'Creating project structure',
    });

    // Create project directory if it doesn't exist
    try {
      await fs.access(finalLocalPath);
      console.log(`📁 Project directory already exists: ${finalLocalPath}`);
    } catch {
      await fs.mkdir(finalLocalPath, { recursive: true });
      console.log(`📁 Created project directory: ${finalLocalPath}`);
    }

    // Phase 3: Create default first sprint with README task
    const sprintSetupPhaseId = 'sprint_setup';
    await taskManager.updatePhaseProgress(taskId, sprintSetupPhaseId, 0, {
      type: 'PHASE_START',
      message: 'Creating default first sprint with README task',
    });

    try {
      const { createDefaultFirstSprint } = await import('@/lib/sprints/default-sprint');
      const sprintResult = await createDefaultFirstSprint(projectId, name);
      
      await taskManager.updatePhaseProgress(taskId, sprintSetupPhaseId, 100, {
        type: 'PHASE_COMPLETE',
        message: `Created first sprint with README creation task`,
      });
      console.log(`🚀 Created default first sprint for project recovery: ${name}`);
    } catch (sprintError) {
      console.error('❌ Failed to create default sprint during recovery:', sprintError);
      await taskManager.updatePhaseProgress(taskId, sprintSetupPhaseId, 100, {
        type: 'PHASE_COMPLETE',
        message: 'Sprint creation skipped due to error',
      });
    }

    // Phase 4: Completion
    const completionPhaseId = 'completion';
    await taskManager.updatePhaseProgress(taskId, completionPhaseId, 0, {
      type: 'PHASE_START',
      message: 'Finalizing project setup',
    });

    // Generate intelligent project description
    let finalDescription = description || 'Software project';
    try {
      await taskManager.updatePhaseProgress(taskId, completionPhaseId, 50, {
        type: 'PHASE_PROGRESS',
        message: 'Generating project description',
      });

      // Try to generate description using Claude Code
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
        if (descriptionResult.success) {
          finalDescription = descriptionResult.data.summary || finalDescription;
        }
      }
    } catch (descriptionError) {
      console.error('Failed to generate description:', descriptionError);
    }

    // Update project with final details
    await prisma.project.update({
      where: { id: projectId },
      data: {
        description: finalDescription,
        localPath: finalLocalPath,
        status: 'ACTIVE', // Mark as active
        framework: framework || null,
        language: language || null,
        packageManager: packageManager || null,
        testFramework: testFramework || null,
        lintTool: lintTool || null,
        buildTool: buildTool || null,
      },
    });

    await taskManager.updatePhaseProgress(taskId, completionPhaseId, 100, {
      type: 'PHASE_COMPLETE',
      message: 'Project setup completed (recovery)',
    });

    // Complete the task
    await taskManager.completeTask(taskId, {
      project: {
        id: projectId,
        name: name,
        localPath: finalLocalPath,
      },
      recovered: true,
    });

    console.log(`🎉 Project creation recovery completed for: ${name}`);
  } catch (error) {
    console.error('Error in createProjectAsync (recovery):', error);
    await taskManager.updatePhaseProgress(taskId, 'error', 100, {
      type: 'ERROR',
      message: `Project creation recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
    throw error;
  }
}