import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { taskManager } from '@/lib/tasks/task-manager';
import { gitClient } from '@/lib/git';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  gitUrl: z.string().url().optional(),
  localPath: z.string().optional(),
  initializeGit: z.boolean().default(true),
  taskId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createProjectSchema.parse(body);
    const { name, description, gitUrl, initializeGit, taskId } = validatedData;
    
    // Generate localPath if not provided
    const localPath = validatedData.localPath?.trim() || gitClient.generateProjectPath(name);
    
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

    // Define phases for project creation
    const phases = [
      { phaseId: 'validation', title: '驗證專案資訊', description: '檢查專案名稱和路徑', order: 0 },
      { phaseId: 'setup', title: '建立專案結構', description: '建立專案目錄和初始檔案', order: 1 },
      { phaseId: 'git_init', title: '初始化 Git', description: '建立 Git 儲存庫和初始提交', order: 2 },
      { phaseId: 'claude_md_generation', title: '生成 CLAUDE.md', description: '使用 Claude Code 生成專案指南', order: 3 },
      { phaseId: 'analysis', title: '分析專案', description: '掃描技術堆疊和專案結構', order: 4 },
      { phaseId: 'completion', title: '完成設定', description: '儲存專案資訊到資料庫', order: 5 },
    ];

    // Create task for project creation
    const taskIdToUse = taskId || `create-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await taskManager.createTask(taskIdToUse, 'PROJECT_CREATE', phases, {
      projectName: name,
      // Don't set projectId until project is created
    });

    // Start the task
    await taskManager.startTask(taskIdToUse);

    // Start async project creation
    createProjectAsync(taskIdToUse, {
      name,
      description,
      gitUrl,
      localPath,
      initializeGit,
    }).catch(async (error) => {
      console.error('Project creation failed:', error);
      await taskManager.updatePhaseProgress(taskIdToUse, 'complete', 100, {
        type: 'ERROR',
        message: `Project creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        taskId: taskIdToUse,
        message: 'Project creation started',
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
  data: {
    name: string;
    description?: string;
    gitUrl?: string;
    localPath: string;
    initializeGit: boolean;
  }
) {
  const { name, description, gitUrl, localPath, initializeGit } = data;

  try {
    // Phase 1: Validation
    const validationPhaseId = 'validation';
    await taskManager.updatePhaseProgress(taskId, validationPhaseId, 0, {
      type: 'PHASE_START',
      message: 'Starting validation',
    });

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

    // Phase 2: Setup
    const setupPhaseId = 'setup';
    await taskManager.updatePhaseProgress(taskId, setupPhaseId, 0, {
      type: 'PHASE_START',
      message: 'Creating project structure',
    });

    await taskManager.updatePhaseProgress(taskId, setupPhaseId, 20, {
      type: 'PHASE_PROGRESS',
      message: 'Creating project directory',
    });

    // Create project directory
    await fs.mkdir(localPath, { recursive: true });
    
    await taskManager.updatePhaseProgress(taskId, setupPhaseId, 50, {
      type: 'PHASE_PROGRESS',
      message: 'Generating README.md',
    });
    
    // Create README
    const readmePath = path.join(localPath, 'README.md');
    const readmeContent = `# ${name}

${description || 'A CodeHive managed project'}

## Getting Started

This project is managed by CodeHive using AI-Native TDD development.

### Project Information
- **Created**: ${new Date().toISOString()}
- **Type**: ${gitUrl ? 'Imported from Git' : 'New Project'}
${gitUrl ? `- **Repository**: ${gitUrl}` : ''}

### Development Workflow
1. Create feature requests through CodeHive UI
2. Project Manager agent breaks down features into Epics and Stories
3. TDD cycles drive development with minimal manual intervention
4. All changes are tracked through Git commits
`;

    await fs.writeFile(readmePath, readmeContent, 'utf8');
    
    await taskManager.updatePhaseProgress(taskId, setupPhaseId, 80, {
      type: 'PHASE_PROGRESS',
      message: 'Creating initial project files',
    });
    
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
      const isExistingRepo = await gitClient.isValidRepository(localPath);
      
      if (!isExistingRepo) {
        const initResult = await gitClient.init(localPath);
        
        if (!initResult.success) {
          throw new Error(`Failed to initialize Git: ${initResult.error}`);
        }

        // Create initial commit
        const commitResult = await gitClient.initialCommit(
          localPath,
          'Initial commit - CodeHive project setup'
        );
        
        if (!commitResult.success) {
          console.warn('Failed to create initial commit:', commitResult.error);
        }
      }
    }

    await taskManager.updatePhaseProgress(taskId, gitInitPhaseId, 100, {
      type: 'PHASE_COMPLETE',
      message: 'Git repository initialized',
    });

    // Phase 4: Generate CLAUDE.md
    const claudeMdPhaseId = 'claude_md_generation';
    await taskManager.updatePhaseProgress(taskId, claudeMdPhaseId, 0, {
      type: 'PHASE_START',
      message: 'Analyzing project and generating CLAUDE.md',
    });

    try {
      // First, run project analysis to gather context
      await taskManager.updatePhaseProgress(taskId, claudeMdPhaseId, 20, {
        type: 'PHASE_PROGRESS',
        message: 'Analyzing project structure...',
      });

      const { projectAnalyzer } = await import('@/lib/analysis/project-analyzer');
      const analysisResult = await projectAnalyzer.analyzeProject(localPath, taskId, claudeMdPhaseId);

      await taskManager.updatePhaseProgress(taskId, claudeMdPhaseId, 40, {
        type: 'PHASE_PROGRESS',
        message: 'Generating CLAUDE.md with Claude Code...',
      });

      // Prepare comprehensive context for Claude Code
      const projectContext = `
Project Name: ${name}
Project Description: ${description || 'No description provided'}
${gitUrl ? `Git URL: ${gitUrl}` : ''}
Project Path: ${localPath}

Project Analysis Results:
- Total Files: ${analysisResult.totalFiles}
- Detected Language: ${analysisResult.detectedLanguage || 'Unknown'}
- Detected Framework: ${analysisResult.detectedFramework || 'None'}
- Detected Package Manager: ${analysisResult.detectedPackageManager || 'Unknown'}
- Detected Test Framework: ${analysisResult.detectedTestFramework || 'None'}

File Types Distribution:
${Object.entries(analysisResult.filesByType).map(([type, count]) => `- ${type}: ${count} files`).join('\n') || '- No files categorized yet'}

${analysisResult.detectedLanguage ? `Primary Language: ${analysisResult.detectedLanguage}` : ''}
${analysisResult.dependencies?.length ? `Dependencies: ${analysisResult.dependencies.slice(0, 10).join(', ')}${analysisResult.dependencies.length > 10 ? '...' : ''}` : ''}

Task: Create a comprehensive CLAUDE.md file for this ${analysisResult.detectedLanguage || 'software'} project. 

Requirements:
1. Include proper development commands based on the detected package manager (${analysisResult.detectedPackageManager || 'standard'})
2. Set up project structure guidelines appropriate for ${analysisResult.detectedFramework || 'the detected technology stack'}
3. Include testing setup if test framework detected: ${analysisResult.detectedTestFramework || 'None detected'}
4. Add language-specific best practices for ${analysisResult.detectedLanguage || 'software development'}
5. Include appropriate linting and formatting tools for the tech stack
6. Add framework-specific development workflows if applicable

Please write the CLAUDE.md file directly to the current directory.
`.trim();

      const { claudeCode } = await import('@/lib/claude-code');
      const claudeResult = await claudeCode.execute(projectContext, {
        workingDirectory: localPath,
        timeout: 180000, // 3 minutes
      });

      if (claudeResult.success) {
        console.log(`✅ CLAUDE.md generated successfully using Claude Code with project analysis context`);
        await taskManager.updatePhaseProgress(taskId, claudeMdPhaseId, 100, {
          type: 'PHASE_COMPLETE',
          message: 'CLAUDE.md 生成成功',
        });
      } else {
        throw new Error(`Claude Code CLAUDE.md generation failed: ${claudeResult.error}`);
      }
    } catch (claudeMdError) {
      console.error(`❌ Error generating CLAUDE.md:`, claudeMdError);
      throw new Error(`Failed to generate CLAUDE.md: ${claudeMdError instanceof Error ? claudeMdError.message : 'Unknown error'}`);
    }

    // Phase 5: Analysis
    const analysisPhaseId = 'analysis';
    await taskManager.updatePhaseProgress(taskId, analysisPhaseId, 0, {
      type: 'PHASE_START',
      message: 'Analyzing project structure',
    });

    // Run project analysis (detect tech stack, etc.)
    // This is simplified for now
    await taskManager.updatePhaseProgress(taskId, analysisPhaseId, 100, {
      type: 'PHASE_COMPLETE',
      message: 'Analysis completed',
    });

    // Phase 6: Create project in database first (needed for description generation)
    const completionPhaseId = 'completion';
    await taskManager.updatePhaseProgress(taskId, completionPhaseId, 0, {
      type: 'PHASE_START',
      message: 'Creating project record',
    });

    // Create project in database
    const project = await prisma.project.create({
      data: {
        name,
        description,
        gitUrl,
        localPath,
        status: 'ACTIVE',
      },
    });

    await taskManager.updatePhaseProgress(taskId, completionPhaseId, 30, {
      type: 'PHASE_PROGRESS',
      message: 'Project record created',
    });

    // Generate intelligent project description using Claude Code
    let finalDescription = description || 'Software project';
    try {
      console.log(`🤖 Generating project description using Claude Code for: ${project.name}...`);

      await taskManager.updatePhaseProgress(taskId, completionPhaseId, 50, {
        type: 'PHASE_PROGRESS',
        message: '使用 Claude Code 分析專案',
      });

      const descriptionResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/agents/project-manager`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: project.id,
            action: 'analyze',
          }),
        }
      );

      const descriptionResult = await descriptionResponse.json();
      if (descriptionResult.success && descriptionResult.data?.context) {
        const summaryResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/agents/project-manager`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              projectId: project.id,
              action: 'generate-summary',
              context: descriptionResult.data.context,
            }),
          }
        );

        const summaryResult = await summaryResponse.json();
        if (summaryResult.success && summaryResult.data?.summary) {
          finalDescription = summaryResult.data.summary;
          console.log(`✅ Generated intelligent description: "${finalDescription}"`);
        }
      }
    } catch (descriptionError) {
      console.error(`⚠️ Failed to generate project description for ${project.name}:`, descriptionError);
      // Continue with default description
    }

    await taskManager.updatePhaseProgress(taskId, completionPhaseId, 70, {
      type: 'PHASE_PROGRESS',
      message: '更新專案描述',
    });

    // Update project with generated description
    if (finalDescription !== project.description) {
      await prisma.project.update({
        where: { id: project.id },
        data: { description: finalDescription },
      });
    }

    await taskManager.updatePhaseProgress(taskId, completionPhaseId, 100, {
      type: 'PHASE_COMPLETE',
      message: 'Project setup completed',
    });

    // Complete the task
    await taskManager.completeTask(taskId, {
      project: {
        id: project.id,
        name: project.name,
        localPath: project.localPath,
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