import { prisma } from '@/lib/db';
import { promises as fs } from 'fs';
import { ProjectAnalyzer } from './analyzers/project-analyzer';
import { AgentExecutor } from './executor';
import { SpecificationGenerator } from './generators/spec-generator';
import {
  checkRateLimit,
  checkTokenLimit,
  logTokenUsage,
} from './project-settings';
import { AgentResult, AgentSpec } from './types';

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

export interface FeatureRequestAnalysis {
  title: string;
  description: string;
  epicTitle: string;
  epicDescription: string;
  stories: StoryBreakdown[];
  estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH' | 'COMPLEX';
  dependencies: string[];
}

export interface StoryBreakdown {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dependencies: string[];
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

      console.log(
        `🔍 Reviewing project: ${project.name} at ${project.localPath}`
      );

      // Analyze project structure
      const context = await this.analyzeProject(projectId);
      const recommendations = await this.recommendNextActions(context);

      // Generate project summary based on analysis
      const projectSummary = await this.generateProjectSummary(context);

      // Generate CLAUDE.md using Claude Code for imported projects
      const claudeMdPath = `${project.localPath}/CLAUDE.md`;
      let claudeMdContent = '';

      try {
        // Check if CLAUDE.md already exists
        const claudeMdExists = await fs.access(claudeMdPath).then(() => true).catch(() => false);
        
        if (claudeMdExists) {
          console.log(`📋 CLAUDE.md already exists at ${claudeMdPath}, skipping generation`);
          claudeMdContent = await fs.readFile(claudeMdPath, 'utf8');
        } else {
          // Use Claude Code to generate CLAUDE.md
          console.log(`🤖 Generating CLAUDE.md using Claude Code for project: ${context.name}`);
          
          const claudeResult = await this.generateClaudeMdWithClaudeCode(
            project.localPath,
            context,
            recommendations.map(r => typeof r === 'string' ? r : r.reason || r.agentType || 'Unknown recommendation')
          );
          
          if (claudeResult.success) {
            claudeMdContent = claudeResult.content || '';
            console.log(`✅ CLAUDE.md generated successfully using Claude Code`);
            
            // Log token usage from Claude Code execution
            if (claudeResult.tokensUsed && claudeResult.tokensUsed > 0) {
              const inputTokens = Math.ceil(claudeResult.tokensUsed * 0.3); // Approximate input tokens
              const outputTokens = claudeResult.tokensUsed - inputTokens;
              
              await logTokenUsage(
                projectId,
                'project-manager-claude-md',
                inputTokens,
                outputTokens
              );
            }
          } else {
            // No fallback - Claude Code generation is required
            throw new Error(`Claude Code CLAUDE.md generation failed: ${claudeResult.error}`);
          }
        }

        // Update project with generated summary
        await prisma.project.update({
          where: { id: projectId },
          data: { summary: projectSummary },
        });

        // Calculate actual tokens used (based on content size)
        const inputTokens = Math.ceil(context.name.length / 4);
        const outputTokens = Math.ceil(
          (claudeMdContent.length + projectSummary.length) / 4
        );
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
        const inputTokens = Math.ceil(context.name.length / 4);
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
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during project review',
        tokensUsed: 100,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async generateProjectSummary(
    context: ProjectContext
  ): Promise<string> {
    const { name, localPath, structure } = context;

    try {
      console.log(
        `🤖 Generating project description using Claude Code for: ${name}`
      );

      // Prepare project analysis data for Claude Code
      const analysisData = {
        projectName: name,
        totalFiles: structure?.files.length || 0,
        sourceFiles: structure?.sourceFiles.length || 0,
        testFiles: structure?.testFiles.length || 0,
        directories: structure?.directories?.slice(0, 10) || [], // Top 10 directories
        keyFiles:
          structure?.files
            ?.filter(f => {
              const fileName = f.path.toLowerCase();
              return (
                fileName.includes('readme') ||
                fileName.includes('package.json') ||
                fileName.includes('main') ||
                fileName.includes('index') ||
                fileName.includes('app') ||
                fileName.includes('server')
              );
            })
            ?.slice(0, 5)
            ?.map(f => f.path) || [],
        configFiles: structure?.configFiles?.slice(0, 5) || [],
        packageFiles: structure?.packageFiles || [],
      };

      // Use Claude Code via executor to analyze the project
      const prompt = `Analyze this project structure and generate a brief, accurate description of what this software project does. Focus on functionality, not technical stack.

Project: ${name}
Directory structure: ${analysisData.directories.join(', ')}
Key files: ${analysisData.keyFiles.join(', ')}
Config files: ${analysisData.configFiles.join(', ')}
Package files: ${analysisData.packageFiles.join(', ')}
Total files: ${analysisData.totalFiles} (${analysisData.sourceFiles} source, ${analysisData.testFiles} test)

Special notes:
- If this is "CodeHive" or contains "multi-agent", "Claude Code", "TDD", or "agent orchestration" concepts, it's a development platform
- Look for keywords in files and directories to understand the core functionality
- Don't just classify by tech stack (avoid "Node.js app", "Python package" etc.)

Respond with only a brief description (3-6 words maximum) of what this project does. Examples:
- "E-commerce platform"
- "Task management app" 
- "Development platform"
- "Multi-agent system"
- "API service"
- "Documentation site"
- "Chat application"
- "Data visualization tool"

Description:`;

      const result = await this.executor.execute(prompt, {
        workingDirectory: localPath,
        timeout: 120000, // 2 minutes timeout for project analysis
      });

      if (result.success && result.output) {
        // Clean up the response - remove common prefixes and keep it brief
        let description = result.output
          .trim()
          .replace(
            /^(Description:|The project is|This is|This project is)\s*/i,
            ''
          )
          .replace(/\.$/, '')
          .trim();

        // Ensure it's not too long (max 50 characters)
        if (description.length > 50) {
          description = description.substring(0, 50).trim();
          // Cut at last space to avoid cutting words
          const lastSpace = description.lastIndexOf(' ');
          if (lastSpace > 20) {
            description = description.substring(0, lastSpace);
          }
        }

        console.log(`✅ Generated description: "${description}"`);
        return description || 'Software project';
      } else {
        console.warn(
          'Claude Code analysis failed, falling back to basic description'
        );
        return 'Software project';
      }
    } catch (error) {
      console.error(
        'Error generating project summary with Claude Code:',
        error
      );
      
      // Provide a more intelligent fallback based on project structure
      
      // Special case for CodeHive itself
      if (name.toLowerCase().includes('codehive') || name.toLowerCase().includes('code-hive')) {
        return 'Multi-agent development platform';
      }
      
      // Check for specific framework indicators first (more specific than package files)
      if (structure?.files?.some(f => f.path.includes('next.config'))) {
        return 'Next.js application';
      } else if (structure?.files?.some(f => f.path.includes('vue.config'))) {
        return 'Vue.js application';
      } else if (structure?.files?.some(f => f.path.includes('angular.json'))) {
        return 'Angular application';
      }
      
      // Then check package files
      if (structure?.packageFiles?.length) {
        const packageFile = structure.packageFiles[0];
        if (packageFile.includes('package.json')) {
          // Check if it's a web application based on dependencies
          return 'Web application';
        } else if (packageFile.includes('requirements.txt') || packageFile.includes('pyproject.toml')) {
          return 'Python application';
        } else if (packageFile.includes('Cargo.toml')) {
          return 'Rust application';
        } else if (packageFile.includes('go.mod')) {
          return 'Go application';
        }
      }
      
      return 'Software project';
    }
  }

  /**
   * Generate project summary from provided context (used during import/creation)
   */
  async generateProjectSummaryFromContext(context: ProjectContext): Promise<string> {
    return this.generateProjectSummary(context);
  }


  async analyzeProject(projectId: string): Promise<ProjectContext> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    console.log(`🔍 Analyzing project: ${project.name}`);

    // Analyze project structure
    const structure = await this.analyzer.analyzeStructure(project.localPath);

    // Use project-specific settings
    const framework = project.framework || undefined;
    const language = project.language || undefined;

    // Extract dependencies
    const dependencies = await this.analyzer.extractDependencies(
      project.localPath
    );

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
        framework: project.framework || undefined,
        language: project.language || undefined,
        packageManager: project.packageManager || undefined,
        testFramework: project.testFramework || undefined,
        lintTool: project.lintTool || undefined,
        buildTool: project.buildTool || undefined,
      },
    };

    // Store analysis results
    await this.storeProjectAnalysis(projectId, context);

    return context;
  }

  async generateAgentSpecs(
    projectContext: ProjectContext
  ): Promise<AgentSpec[]> {
    console.log(
      `🤖 Generating agent specifications for ${projectContext.name}`
    );

    const specs: AgentSpec[] = [];

    // Always create core agents (all projects are Git-managed)
    specs.push(await this.specGenerator.generateCodeAnalyzer(projectContext));
    specs.push(await this.specGenerator.generateFileModifier(projectContext));
    specs.push(await this.specGenerator.generateTestRunner(projectContext));
    
    // Git operations agent is always needed since all projects are Git-managed
    specs.push(
      await this.specGenerator.generateGitOperationsAgent(projectContext)
    );

    // Framework-specific agents if applicable
    if (projectContext.framework) {
      specs.push(
        await this.specGenerator.generateFrameworkSpecialist(projectContext)
      );
    }

    // Store generated specs
    for (const spec of specs) {
      await this.storeAgentSpec(projectContext.id, spec);
    }

    return specs;
  }

  async recommendNextActions(
    projectContext: ProjectContext
  ): Promise<AgentRecommendation[]> {
    const recommendations: AgentRecommendation[] = [];

    // Analyze current project state
    const hasTests = projectContext.structure?.testFiles.length || 0 > 0;
    const hasTypeScript = projectContext.language === 'typescript';
    const hasPackageFile =
      projectContext.structure?.packageFiles.length || 0 > 0;
    const hasRemote = !!projectContext.gitUrl;

    // Git repository status check (always needed since all projects are Git-managed)
    recommendations.push({
      agentType: 'git-operations',
      priority: 9,
      reason: 'Check Git repository status and health',
      suggestedCommand: 'Check git status and repository health',
      estimatedDuration: 120, // 2 minutes
    });

    // Remote repository setup if not configured
    if (!hasRemote) {
      recommendations.push({
        agentType: 'git-operations',
        priority: 6,
        reason: 'No remote repository configured - consider adding one',
        suggestedCommand: 'Review Git repository and suggest remote setup if needed',  
        estimatedDuration: 180, // 3 minutes
      });
    }

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
        suggestedCommand:
          'Set up testing framework and create basic test files',
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
    const hasReadme =
      projectContext.structure?.files.some(f =>
        f.path.toLowerCase().includes('readme')
      ) || false;

    if (!hasReadme) {
      recommendations.push({
        agentType: 'documentation',
        priority: 7,
        reason: 'No README found - create project documentation',
        suggestedCommand:
          'Generate comprehensive README with project overview and setup instructions',
        estimatedDuration: 420, // 7 minutes
      });
    }

    // Dependency management
    if (hasPackageFile) {
      recommendations.push({
        agentType: 'code-analyzer',
        priority: 5,
        reason: 'Check for outdated dependencies and security issues',
        suggestedCommand:
          'Analyze package dependencies for updates and vulnerabilities',
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

    console.log(
      `🎯 Orchestrating ${agentRecommendations.length} agents for project ${projectId}`
    );

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
    const hasReadme =
      analysis?.structure?.files.some(f =>
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

  private async storeProjectAnalysis(
    projectId: string,
    context: ProjectContext
  ): Promise<void> {
    // Generate brief description using the same logic as summary
    const summary = await this.generateProjectSummary(context);

    // Store analysis in a JSON field or separate table
    // For now, we'll use the project's description field to store basic info
    await prisma.project.update({
      where: { id: projectId },
      data: {
        description: summary,
      },
    });
  }

  private async storeAgentSpec(
    projectId: string,
    spec: AgentSpec
  ): Promise<void> {
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

  private async getStoredProjectAnalysis(
    projectId: string
  ): Promise<ProjectContext | null> {
    // In a real implementation, this would retrieve from a proper storage
    // For now, return null and analyze on demand
    return null;
  }

  // === NEW: Epic/Story Management Functions ===

  /**
   * Process a natural language feature request and create Epic/Story breakdown
   */
  async processFeatureRequest(
    request: string,
    projectId: string
  ): Promise<FeatureRequestAnalysis> {
    const startTime = Date.now();

    try {
      console.log(`🎯 Processing feature request for project: ${projectId}`);

      // Get project context for informed analysis
      const context = await this.analyzeProject(projectId);

      // Use Claude Code to analyze the feature request
      const prompt = `Analyze this feature request and create a structured breakdown for a ${context.language || 'software'} project using ${context.framework || 'standard'} framework.

Feature Request: "${request}"

Project Context:
- Language: ${context.language || 'Unknown'}
- Framework: ${context.framework || 'Unknown'}  
- Existing files: ${context.structure?.sourceFiles.length || 0} source files

Please provide a JSON response with the following structure:
{
  "title": "brief title for the request",
  "description": "detailed description of what user wants",
  "epicTitle": "Epic title (3-5 words)",
  "epicDescription": "Epic description explaining the business value", 
  "stories": [
    {
      "title": "Story title (user story format)",
      "description": "Detailed story description",
      "acceptanceCriteria": ["criteria 1", "criteria 2", "criteria 3"],
      "storyPoints": 3,
      "priority": "HIGH",
      "dependencies": []
    }
  ],
  "estimatedComplexity": "MEDIUM",
  "dependencies": ["list of technical dependencies or assumptions"]
}

Guidelines:
- Create 3-7 stories per epic
- Use proper user story format: "As a [user], I want [goal] so that [benefit]"
- Story points: 1=simple, 2=small, 3=medium, 5=large, 8=complex
- Keep stories focused and achievable in one sprint
- Consider the existing tech stack when suggesting implementation`;

      const result = await this.executor.execute(prompt, {
        workingDirectory: context.localPath,
        timeout: 120000, // 2 minutes timeout for feature analysis
      });

      if (!result.success || !result.output) {
        throw new Error('Failed to analyze feature request with Claude Code');
      }

      // Parse the JSON response
      let analysis: FeatureRequestAnalysis;
      try {
        analysis = JSON.parse(result.output.trim());
      } catch (parseError) {
        console.error('Failed to parse Claude Code response:', result.output);
        throw new Error('Invalid response format from feature analysis');
      }

      // Log token usage
      const inputTokens = Math.ceil(request.length / 4);
      const outputTokens = Math.ceil(result.output.length / 4);
      await logTokenUsage(
        projectId,
        'project-manager-feature-request',
        inputTokens,
        outputTokens
      );

      console.log(`✅ Feature request analyzed: ${analysis.epicTitle}`);
      return analysis;
    } catch (error) {
      console.error('Error processing feature request:', error);

      // Fallback analysis if Claude Code fails
      return {
        title: request.length > 50 ? request.substring(0, 50) + '...' : request,
        description: request,
        epicTitle: 'New Feature Epic',
        epicDescription: 'Feature requested by user: ' + request,
        stories: [
          {
            title: 'Implement core functionality',
            description: request,
            acceptanceCriteria: [
              'Feature works as requested',
              'No errors occur',
              'User can complete the workflow',
            ],
            storyPoints: 5,
            priority: 'MEDIUM',
            dependencies: [],
          },
        ],
        estimatedComplexity: 'MEDIUM',
        dependencies: [],
      };
    }
  }

  /**
   * Create an Epic from analyzed feature request
   */
  async createEpicFromRequest(
    analysis: FeatureRequestAnalysis,
    projectId: string
  ): Promise<string> {
    try {
      console.log(`📋 Creating Epic: ${analysis.epicTitle}`);

      // Determine MVP priority based on complexity
      const mvpPriority =
        analysis.estimatedComplexity === 'HIGH' ||
        analysis.estimatedComplexity === 'COMPLEX'
          ? 'HIGH'
          : analysis.estimatedComplexity === 'LOW'
            ? 'MEDIUM'
            : 'HIGH';

      // Create Epic
      const epic = await prisma.epic.create({
        data: {
          projectId,
          title: analysis.epicTitle,
          description: analysis.epicDescription,
          type: 'FEATURE',
          phase: 'PLANNING',
          status: 'ACTIVE',
          mvpPriority,
          coreValue: analysis.description,
          estimatedStoryPoints: analysis.stories.reduce(
            (sum, story) => sum + story.storyPoints,
            0
          ),
        },
      });

      console.log(`✅ Created Epic: ${epic.id}`);
      return epic.id;
    } catch (error) {
      console.error('Error creating Epic:', error);
      throw new Error(
        `Failed to create Epic: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Break down Epic into Stories and create them in database
   */
  async breakdownEpicToStories(
    epicId: string,
    stories: StoryBreakdown[]
  ): Promise<string[]> {
    try {
      console.log(`📝 Creating ${stories.length} stories for Epic: ${epicId}`);

      const storyIds: string[] = [];

      for (let i = 0; i < stories.length; i++) {
        const story = stories[i];

        const kanbanCard = await prisma.kanbanCard.create({
          data: {
            projectId: (await prisma.epic.findUnique({
              where: { id: epicId },
            }))!.projectId,
            epicId,
            title: story.title,
            description: story.description,
            status: 'BACKLOG',
            position: i,
            storyPoints: story.storyPoints,
            priority: story.priority,
            sequence: i,
            tddEnabled: true,
            acceptanceCriteria: JSON.stringify(story.acceptanceCriteria),
          },
        });

        storyIds.push(kanbanCard.id);
        console.log(`✅ Created Story: ${story.title}`);
      }

      // Update Epic phase to IN_PROGRESS
      await prisma.epic.update({
        where: { id: epicId },
        data: { phase: 'IN_PROGRESS' },
      });

      return storyIds;
    } catch (error) {
      console.error('Error creating Stories:', error);
      throw new Error(
        `Failed to create Stories: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Maintain and update project CLAUDE.md with current Epic/Story context
   */
  async maintainProjectClaudeMd(projectId: string): Promise<void> {
    try {
      console.log(`📝 Updating CLAUDE.md for project: ${projectId}`);

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          epics: {
            where: { status: 'ACTIVE' },
            include: {
              stories: {
                orderBy: { sequence: 'asc' },
              },
            },
            orderBy: { sequence: 'asc' },
          },
          cycles: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      // Get project analysis
      const context = await this.analyzeProject(projectId);

      // Use Claude Code to generate/update CLAUDE.md
      const claudeMdPath = `${project.localPath}/CLAUDE.md`;
      
      // Update CLAUDE.md using Claude Code
      console.log(`🤖 Updating CLAUDE.md using Claude Code for project: ${context.name}`);
      
      const claudeResult = await this.generateClaudeMdWithClaudeCode(
        project.localPath,
        context,
        []
      );
      
      if (!claudeResult.success) {
        throw new Error(`Claude Code CLAUDE.md generation failed: ${claudeResult.error}`);
      }
      
      console.log(`✅ CLAUDE.md updated successfully using Claude Code`);
    } catch (error) {
      console.error('Error maintaining CLAUDE.md:', error);
      throw new Error(
        `Failed to maintain CLAUDE.md: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }


  /**
   * Generate CLAUDE.md using Claude Code with /init prompt
   */
  private async generateClaudeMdWithClaudeCode(
    projectPath: string,
    context: ProjectContext,
    recommendations: string[]
  ): Promise<{ success: boolean; content?: string; error?: string; tokensUsed?: number }> {
    try {
      const { name, framework, language, techStack } = context;
      const description = (context as any).description;
      
      // Prepare context information for Claude Code
      const contextInfo = `
Project Name: ${name}
Description: ${description || 'No description provided'}
Primary Language: ${language}
Framework: ${framework}
Tech Stack:
${techStack ? Object.entries(techStack).map(([key, value]) => `- ${key}: ${value}`).join('\n') : '- No tech stack information available'}

Recommendations:
${recommendations.length > 0 ? recommendations.map(r => `- ${r}`).join('\n') : '- No specific recommendations'}

Project Path: ${projectPath}
`.trim();

      // Execute Claude Code with /init prompt only
      const result = await this.executor.execute(
        `/init`,
        {
          workingDirectory: projectPath,
          timeout: 180000, // 3 minutes
          agentType: 'project-manager-claude-md',
        }
      );

      if (result.success && result.output) {
        return {
          success: true,
          content: result.output,
          tokensUsed: result.tokensUsed || 0,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Claude Code execution failed',
          tokensUsed: result.tokensUsed || 0,
        };
      }
    } catch (error) {
      console.error('Error generating CLAUDE.md with Claude Code:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tokensUsed: 0,
      };
    }
  }
}
