import { prisma } from '@/lib/db';
import { TaskManager } from './task-manager';
import { promises as fs } from 'fs';
import path from 'path';

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
    console.log(`🚀 Starting project creation recovery for: ${name}`);

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

    // Create README if it doesn't exist
    const readmePath = path.join(finalLocalPath, 'README.md');
    try {
      await fs.access(readmePath);
      console.log(`📄 README.md already exists`);
    } catch {
      const readmeContent = `# ${name}

${description || 'A CodeHive managed project'}

## Getting Started

This project is managed by CodeHive, an AI-native project management platform.

### Features
- Automated TDD cycles with AI-driven development
- Real-time progress tracking and project insights
- Intelligent Epic and Story management

### Development Workflow
1. Create feature requests through CodeHive UI
2. Project Manager agent breaks down features into Epics and Stories
3. TDD cycles drive development with minimal manual intervention
4. All changes are tracked through Git commits
`;

      await fs.writeFile(readmePath, readmeContent, 'utf8');
      console.log(`📄 Created README.md`);
    }

    await taskManager.updatePhaseProgress(taskId, setupPhaseId, 100, {
      type: 'PHASE_COMPLETE',
      message: 'Project structure created',
    });

    // Phase 3: Git initialization
    const gitInitPhaseId = 'git_init';
    await taskManager.updatePhaseProgress(taskId, gitInitPhaseId, 0, {
      type: 'PHASE_START',
      message: 'Initializing Git repository',
    });

    if (initializeGit) {
      const isExistingRepo = await gitClient.isValidRepository(finalLocalPath);

      if (!isExistingRepo) {
        const initResult = await gitClient.init(finalLocalPath);

        if (!initResult.success) {
          throw new Error(`Failed to initialize Git: ${initResult.error}`);
        }

        // Create initial commit
        const commitResult = await gitClient.initialCommit(
          finalLocalPath,
          'Initial commit - CodeHive project setup (recovered)'
        );

        if (!commitResult.success) {
          console.warn('Failed to create initial commit:', commitResult.error);
        }
      } else {
        console.log(`📦 Git repository already exists`);
      }
    }

    await taskManager.updatePhaseProgress(taskId, gitInitPhaseId, 100, {
      type: 'PHASE_COMPLETE',
      message: 'Git repository initialized',
    });

    // Phase 4: CLAUDE.md generation
    const claudeMdPhaseId = 'claude_md_generation';
    await taskManager.updatePhaseProgress(taskId, claudeMdPhaseId, 0, {
      type: 'PHASE_START',
      message: 'Generating CLAUDE.md',
    });

    try {
      const claudeMdPath = path.join(finalLocalPath, 'CLAUDE.md');
      const claudeMdExists = await fs
        .access(claudeMdPath)
        .then(() => true)
        .catch(() => false);

      if (!claudeMdExists) {
        await taskManager.updatePhaseProgress(taskId, claudeMdPhaseId, 40, {
          type: 'PHASE_PROGRESS',
          message: 'Generating CLAUDE.md with Claude Code...',
        });

        // Run project analysis first
        const { projectAnalyzer } = await import('@/lib/analysis/project-analyzer');
        const analysisResult = await projectAnalyzer.analyzeProject(finalLocalPath);

        const projectContext = `You are helping to create a CLAUDE.md file for a ${analysisResult.detectedLanguage || 'software'} project.

Project Analysis Results:
- Total Files: ${analysisResult.totalFiles}
- Detected Language: ${analysisResult.detectedLanguage || 'Unknown'}
- Detected Framework: ${analysisResult.detectedFramework || 'None'}
- Detected Package Manager: ${analysisResult.detectedPackageManager || 'Unknown'}
- Detected Test Framework: ${analysisResult.detectedTestFramework || 'None'}

Task: Create a comprehensive CLAUDE.md file for this project (recovered initialization).`;

        const { claudeCode } = await import('@/lib/claude-code');
        const claudeResult = await claudeCode.execute(projectContext, {
          workingDirectory: finalLocalPath,
          timeout: 180000,
        });

        if (!claudeResult.success) {
          throw new Error(`Claude Code failed: ${claudeResult.error}`);
        }

        console.log(`✅ CLAUDE.md generated successfully (recovery)`);
      } else {
        console.log(`📋 CLAUDE.md already exists, skipping generation`);
      }

      await taskManager.updatePhaseProgress(taskId, claudeMdPhaseId, 100, {
        type: 'PHASE_COMPLETE',
        message: 'CLAUDE.md ready',
      });
    } catch (claudeMdError) {
      console.error(`❌ Error generating CLAUDE.md:`, claudeMdError);
      // Continue without CLAUDE.md
      await taskManager.updatePhaseProgress(taskId, claudeMdPhaseId, 100, {
        type: 'PHASE_COMPLETE',
        message: 'CLAUDE.md generation skipped due to error',
      });
    }

    // Phase 5: Completion
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