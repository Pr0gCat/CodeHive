import { AgentSpec, AgentResult, AgentExecutionOptions } from './types';
import { AgentExecutor } from './executor';
import { prisma } from '@/lib/db';
import { ProjectAnalyzer } from './analyzers/project-analyzer';
import { SpecificationGenerator } from './generators/spec-generator';
import { promises as fs } from 'fs';
import path from 'path';
import { logTokenUsage, checkRateLimit, checkTokenLimit } from './project-settings';

export interface ProjectContext {
  id: string;
  name: string;
  localPath: string;
  gitUrl?: string;
  framework?: string;
  language?: string;
  dependencies?: string[];
  structure?: ProjectStructure;
  techStack?: {
    framework?: string;
    language?: string;
    packageManager?: string;
    testFramework?: string;
    lintTool?: string;
    buildTool?: string;
  };
}

export interface ProjectStructure {
  directories: string[];
  files: FileInfo[];
  packageFiles: string[];
  configFiles: string[];
  testFiles: string[];
  sourceFiles: string[];
}

export interface FileInfo {
  path: string;
  type: string;
  size: number;
  lastModified: Date;
}

export interface AgentRecommendation {
  agentType: string;
  priority: number;
  reason: string;
  suggestedCommand: string;
  estimatedDuration: number;
}

export class ProjectManagerAgent {
  private executor: AgentExecutor;
  private analyzer: ProjectAnalyzer;
  private specGenerator: SpecificationGenerator;

  constructor() {
    this.executor = new AgentExecutor();
    this.analyzer = new ProjectAnalyzer();
    this.specGenerator = new SpecificationGenerator();
  }

  async reviewProject(projectId: string): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      console.log(`📋 Starting project review for project: ${projectId}`);

      // Get project details
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Estimate tokens for this operation (analysis + generation)
      const estimatedTokens = 2000; // Reasonable estimate for project review
      
      // Check rate and token limits
      const rateLimitCheck = await checkRateLimit(projectId);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: `Rate limit exceeded: ${rateLimitCheck.reason}`,
          executionTime: Date.now() - startTime,
          tokensUsed: 0,
        };
      }

      const tokenLimitCheck = await checkTokenLimit(projectId, estimatedTokens);
      if (!tokenLimitCheck.allowed) {
        return {
          success: false,
          error: `Token limit exceeded: ${tokenLimitCheck.reason}`,
          executionTime: Date.now() - startTime,
          tokensUsed: 0,
        };
      }

      console.log(`🔍 Reviewing project: ${project.name} at ${project.localPath}`);

      // Analyze project structure
      const context = await this.analyzeProject(projectId);
      const recommendations = await this.recommendNextActions(context);

      // Generate project summary based on analysis
      const projectSummary = await this.generateProjectSummary(context);

      // Generate CLAUDE.md content based on analysis
      const claudeMdContent = await this.generateClaudeMd(context, recommendations);

      // Write CLAUDE.md to the project directory
      const claudeMdPath = `${project.localPath}/CLAUDE.md`;
      
      try {
        // Write CLAUDE.md file directly using Node.js fs
        await fs.writeFile(claudeMdPath, claudeMdContent, 'utf8');

        // Update project with generated summary
        await prisma.project.update({
          where: { id: projectId },
          data: { summary: projectSummary },
        });

        // Calculate actual tokens used (based on content size)
        const inputTokens = Math.ceil((context.name.length + (context.description || '').length) / 4);
        const outputTokens = Math.ceil((claudeMdContent.length + projectSummary.length) / 4);
        const totalTokens = inputTokens + outputTokens;

        // Log token usage for this review operation
        await logTokenUsage(
          projectId,
          'project-manager-review',
          inputTokens,
          outputTokens
        );

        const executionTime = Date.now() - startTime;

        return {
          success: true,
          message: `Project review completed successfully. CLAUDE.md created at ${claudeMdPath}`,
          artifacts: {
            claudeMdPath,
            claudeMdContent,
            projectContext: context,
            recommendations,
          },
          tokensUsed: totalTokens,
          executionTime,
        };
      } catch (writeError) {
        console.error('Failed to write CLAUDE.md:', writeError);
        
        // Log minimal token usage for failed operation
        const inputTokens = Math.ceil((context.name.length + (context.description || '').length) / 4);
        await logTokenUsage(
          projectId,
          'project-manager-review',
          inputTokens,
          0 // No output tokens for failed operation
        );

        return {
          success: false,
          error: `Failed to write CLAUDE.md: ${writeError instanceof Error ? writeError.message : 'Unknown write error'}`,
          artifacts: {
            claudeMdContent,
            projectContext: context,
            recommendations,
          },
          tokensUsed: inputTokens,
          executionTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      console.error('Project review failed:', error);
      
      // Log minimal token usage for completely failed operation
      try {
        await logTokenUsage(
          projectId,
          'project-manager-review',
          100, // Minimal estimated tokens for failed analysis
          0
        );
      } catch (logError) {
        console.error('Failed to log token usage:', logError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during project review',
        tokensUsed: 100,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async generateProjectSummary(context: ProjectContext): Promise<string> {
    const { name, framework, language, techStack, structure } = context;
    
    // Determine the primary language and framework
    const primaryLanguage = language || techStack?.language || 'Unknown';
    const primaryFramework = framework || techStack?.framework || '';
    
    // Generate file statistics
    const totalFiles = structure?.files.length || 0;
    const sourceFiles = structure?.sourceFiles.length || 0;
    const testFiles = structure?.testFiles.length || 0;
    
    // Create a concise project summary
    let summary = `A ${primaryLanguage} project`;
    
    if (primaryFramework) {
      summary += ` built with ${primaryFramework}`;
    }
    
    // Add file count context
    if (totalFiles > 0) {
      summary += ` containing ${totalFiles} files`;
      
      if (sourceFiles > 0) {
        summary += ` (${sourceFiles} source`;
        if (testFiles > 0) {
          summary += `, ${testFiles} test`;
        }
        summary += ')';
      }
    }
    
    // Add tech stack details if available
    const techDetails = [];
    if (techStack?.packageManager) techDetails.push(techStack.packageManager);
    if (techStack?.testFramework) techDetails.push(techStack.testFramework);
    if (techStack?.buildTool) techDetails.push(techStack.buildTool);
    
    if (techDetails.length > 0) {
      summary += `. Uses ${techDetails.join(', ')} for development workflow`;
    }
    
    return summary + '.';
  }

  private async generateClaudeMd(context: ProjectContext, recommendations: AgentRecommendation[]): Promise<string> {
    const { name, framework, language, techStack, structure } = context;
    
    // Determine the primary language and framework
    const primaryLanguage = language || techStack?.language || 'Unknown';
    const primaryFramework = framework || techStack?.framework || 'None specified';
    const packageManager = techStack?.packageManager || 'npm';
    const testFramework = techStack?.testFramework || 'Not configured';
    const lintTool = techStack?.lintTool || 'Not configured';
    const buildTool = techStack?.buildTool || 'Not configured';

    // Generate file structure overview
    const totalFiles = structure?.files.length || 0;
    const sourceFiles = structure?.sourceFiles.length || 0;
    const testFiles = structure?.testFiles.length || 0;
    const configFiles = structure?.configFiles.length || 0;

    // Generate development commands based on detected tech stack
    let devCommands = '';
    if (packageManager === 'bun') {
      devCommands = `# Development Commands

\`\`\`bash
# Install dependencies
bun install

# Development server
bun run dev

# Build for production
bun run build

# Run tests
bun test

# Lint code
bun run lint

# Format code
bun run format
\`\`\``;
    } else if (packageManager === 'yarn') {
      devCommands = `# Development Commands

\`\`\`bash
# Install dependencies
yarn install

# Development server
yarn dev

# Build for production
yarn build

# Run tests
yarn test

# Lint code
yarn lint

# Format code
yarn format
\`\`\``;
    } else {
      devCommands = `# Development Commands

\`\`\`bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
\`\`\``;
    }

    // Generate recommendations section
    const topRecommendations = recommendations.slice(0, 5);
    const recommendationsSection = topRecommendations.length > 0 
      ? `## Immediate Recommendations

${topRecommendations.map((rec, index) => 
  `${index + 1}. **${rec.agentType}** (Priority: ${rec.priority}): ${rec.reason}
   - Suggested action: ${rec.suggestedCommand}
   - Estimated time: ${Math.round(rec.estimatedDuration / 60)} minutes`
).join('\n\n')}` 
      : '';

    return `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**${name}** is a ${primaryLanguage} project${primaryFramework !== 'None specified' ? ` using ${primaryFramework}` : ''}.

### Project Statistics
- Total files: ${totalFiles}
- Source files: ${sourceFiles}
- Test files: ${testFiles}
- Configuration files: ${configFiles}

### Tech Stack
- **Language**: ${primaryLanguage}
- **Framework**: ${primaryFramework}
- **Package Manager**: ${packageManager}
- **Test Framework**: ${testFramework}
- **Linting**: ${lintTool}
- **Build Tool**: ${buildTool}

${devCommands}

## Project Structure

This project follows a ${primaryFramework !== 'None specified' ? primaryFramework : 'standard'} project structure.

${recommendationsSection}

## Development Guidelines

1. **Code Quality**: Maintain consistent code style and formatting
2. **Testing**: ${testFiles > 0 ? 'Ensure all tests pass before committing' : 'Add tests for new functionality'}
3. **Documentation**: Keep README and inline documentation up to date
4. **Dependencies**: Regularly audit and update project dependencies

## Working with This Project

When making changes to this codebase:

1. Follow the existing code patterns and conventions
2. ${testFiles > 0 ? 'Run tests before submitting changes' : 'Consider adding tests for new features'}
3. Use the configured linting and formatting tools
4. Update documentation when adding new features

---

*This CLAUDE.md was generated by CodeHive Project Manager on ${new Date().toISOString().split('T')[0]}*
`;
  }

  async analyzeProject(projectId: string): Promise<ProjectContext> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    console.log(`🔍 Analyzing project: ${project.name}`);

    // Get global settings for defaults
    const globalSettings = await prisma.globalSettings.findUnique({
      where: { id: 'global' },
    });

    // Analyze project structure
    const structure = await this.analyzer.analyzeStructure(project.localPath);
    
    // Use project-specific settings if available, otherwise fall back to global preferences
    const framework = project.framework || globalSettings?.preferredFramework || undefined;
    const language = project.language || globalSettings?.preferredLanguage || undefined;
    
    // Extract dependencies
    const dependencies = await this.analyzer.extractDependencies(project.localPath);

    const context: ProjectContext = {
      id: project.id,
      name: project.name,
      localPath: project.localPath,
      gitUrl: project.gitUrl || undefined,
      framework,
      language,
      dependencies,
      structure,
      techStack: {
        framework: project.framework || globalSettings?.preferredFramework || undefined,
        language: project.language || globalSettings?.preferredLanguage || undefined,
        packageManager: project.packageManager || globalSettings?.preferredPackageManager || undefined,
        testFramework: project.testFramework || globalSettings?.preferredTestFramework || undefined,
        lintTool: project.lintTool || globalSettings?.preferredLintTool || undefined,
        buildTool: project.buildTool || globalSettings?.preferredBuildTool || undefined,
      },
    };

    // Store analysis results
    await this.storeProjectAnalysis(projectId, context);

    return context;
  }

  async generateAgentSpecs(projectContext: ProjectContext): Promise<AgentSpec[]> {
    console.log(`🤖 Generating agent specifications for ${projectContext.name}`);

    const specs: AgentSpec[] = [];

    // Always create core agents
    specs.push(await this.specGenerator.generateCodeAnalyzer(projectContext));
    specs.push(await this.specGenerator.generateFileModifier(projectContext));
    specs.push(await this.specGenerator.generateTestRunner(projectContext));

    // Conditional agents based on project type
    if (projectContext.gitUrl) {
      specs.push(await this.specGenerator.generateGitOperationsAgent(projectContext));
    }

    if (projectContext.framework) {
      specs.push(await this.specGenerator.generateFrameworkSpecialist(projectContext));
    }

    // Store generated specs
    for (const spec of specs) {
      await this.storeAgentSpec(projectContext.id, spec);
    }

    return specs;
  }

  async recommendNextActions(projectContext: ProjectContext): Promise<AgentRecommendation[]> {
    const recommendations: AgentRecommendation[] = [];

    // Analyze current project state
    const hasTests = projectContext.structure?.testFiles.length || 0 > 0;
    const hasTypeScript = projectContext.language === 'typescript';
    const hasPackageFile = projectContext.structure?.packageFiles.length || 0 > 0;

    // Code quality recommendations
    if (hasTypeScript) {
      recommendations.push({
        agentType: 'code-analyzer',
        priority: 8,
        reason: 'TypeScript project detected - analyze for type errors',
        suggestedCommand: 'Run TypeScript compiler and fix any type errors',
        estimatedDuration: 300, // 5 minutes
      });
    }

    // Testing recommendations
    if (!hasTests) {
      recommendations.push({
        agentType: 'test-runner',
        priority: 9,
        reason: 'No test files found - create test structure',
        suggestedCommand: 'Set up testing framework and create basic test files',
        estimatedDuration: 600, // 10 minutes
      });
    } else {
      recommendations.push({
        agentType: 'test-runner',
        priority: 6,
        reason: 'Run existing tests to verify project health',
        suggestedCommand: 'Run all tests and report results',
        estimatedDuration: 180, // 3 minutes
      });
    }

    // Documentation recommendations
    const hasReadme = projectContext.structure?.files.some(f => 
      f.path.toLowerCase().includes('readme')
    ) || false;

    if (!hasReadme) {
      recommendations.push({
        agentType: 'documentation',
        priority: 7,
        reason: 'No README found - create project documentation',
        suggestedCommand: 'Generate comprehensive README with project overview and setup instructions',
        estimatedDuration: 420, // 7 minutes
      });
    }

    // Dependency management
    if (hasPackageFile) {
      recommendations.push({
        agentType: 'code-analyzer',
        priority: 5,
        reason: 'Check for outdated dependencies and security issues',
        suggestedCommand: 'Analyze package dependencies for updates and vulnerabilities',
        estimatedDuration: 240, // 4 minutes
      });
    }

    // Sort by priority (highest first)
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  async orchestrateAgents(
    projectId: string, 
    cardId: string, 
    agentRecommendations: AgentRecommendation[]
  ): Promise<string[]> {
    const taskIds: string[] = [];

    console.log(`🎯 Orchestrating ${agentRecommendations.length} agents for project ${projectId}`);

    // Execute top 3 recommendations
    const topRecommendations = agentRecommendations.slice(0, 3);

    for (let i = 0; i < topRecommendations.length; i++) {
      const rec = topRecommendations[i];
      
      try {
        const response = await fetch('/api/agents/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            cardId,
            agentType: rec.agentType,
            command: rec.suggestedCommand,
            priority: rec.priority,
            context: {
              orchestratedBy: 'project-manager',
              reason: rec.reason,
              estimatedDuration: rec.estimatedDuration,
            },
          }),
        });

        const data = await response.json();
        if (data.success) {
          taskIds.push(data.data.taskId);
          console.log(`✅ Queued ${rec.agentType}: ${data.data.taskId}`);
        } else {
          console.error(`❌ Failed to queue ${rec.agentType}:`, data.error);
        }
      } catch (error) {
        console.error(`❌ Error queuing ${rec.agentType}:`, error);
      }

      // Add delay between tasks to prevent overwhelming the system
      if (i < topRecommendations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return taskIds;
  }

  async getProjectInsights(projectId: string): Promise<{
    health: number;
    issues: string[];
    recommendations: string[];
    metrics: Record<string, number>;
  }> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        agentSpecs: true,
        tokenUsage: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
      },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const analysis = await this.getStoredProjectAnalysis(projectId);
    
    // Calculate health score (0-100)
    let health = 50; // Base score
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for tests
    if (analysis?.structure?.testFiles.length || 0 > 0) {
      health += 20;
    } else {
      issues.push('No test files found');
      recommendations.push('Add unit tests to improve code reliability');
    }

    // Check for documentation
    const hasReadme = analysis?.structure?.files.some(f => 
      f.path.toLowerCase().includes('readme')
    ) || false;
    
    if (hasReadme) {
      health += 15;
    } else {
      issues.push('Missing project documentation');
      recommendations.push('Add README with setup and usage instructions');
    }

    // Check for configuration files
    if (analysis?.structure?.configFiles.length || 0 > 2) {
      health += 10;
    } else {
      issues.push('Limited project configuration');
      recommendations.push('Set up proper development tooling');
    }

    // Recent activity bonus
    const recentTokenUsage = project.tokenUsage.length;
    if (recentTokenUsage > 5) {
      health += 5;
    }

    health = Math.min(100, Math.max(0, health));

    const metrics = {
      totalFiles: analysis?.structure?.files.length || 0,
      sourceFiles: analysis?.structure?.sourceFiles.length || 0,
      testFiles: analysis?.structure?.testFiles.length || 0,
      configFiles: analysis?.structure?.configFiles.length || 0,
      dependencies: analysis?.dependencies?.length || 0,
      agentSpecs: project.agentSpecs.length,
      recentTasks: recentTokenUsage,
    };

    return {
      health,
      issues,
      recommendations,
      metrics,
    };
  }

  private async storeProjectAnalysis(projectId: string, context: ProjectContext): Promise<void> {
    // Store analysis in a JSON field or separate table
    // For now, we'll use the project's description field to store basic info
    await prisma.project.update({
      where: { id: projectId },
      data: {
        description: `${context.framework || 'Unknown'} project with ${context.language || 'unknown'} (${context.structure?.files.length || 0} files)`,
      },
    });
  }

  private async storeAgentSpec(projectId: string, spec: AgentSpec): Promise<void> {
    await prisma.agentSpecification.upsert({
      where: {
        projectId_name: {
          projectId,
          name: spec.name,
        },
      },
      update: {
        type: spec.type,
        purpose: spec.purpose,
        capabilities: JSON.stringify(spec.capabilities),
        dependencies: JSON.stringify(spec.dependencies),
        constraints: JSON.stringify(spec.constraints),
        prompt: spec.prompt,
      },
      create: {
        projectId,
        name: spec.name,
        type: spec.type,
        purpose: spec.purpose,
        capabilities: JSON.stringify(spec.capabilities),
        dependencies: JSON.stringify(spec.dependencies),
        constraints: JSON.stringify(spec.constraints),
        prompt: spec.prompt,
      },
    });
  }

  private async getStoredProjectAnalysis(projectId: string): Promise<ProjectContext | null> {
    // In a real implementation, this would retrieve from a proper storage
    // For now, return null and analyze on demand
    return null;
  }
}