import { NextRequest, NextResponse } from 'next/server';
import { AgentFactory } from '@/lib/agents/agent-factory';
import { ProjectManagerAgent } from '@/lib/agents/project-manager';
import { z } from 'zod';

const capabilitiesSchema = z.object({
  agentType: z.string().optional(),
  projectId: z.string().optional(),
  command: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const agentType = url.searchParams.get('agentType');
    const projectId = url.searchParams.get('projectId');

    if (!agentType) {
      // Return all available agents
      const availableAgents = AgentFactory.getAvailableAgents();
      const agentDetails = availableAgents.map(type => ({
        type,
        description: AgentFactory.getAgentDescription(type),
      }));

      return NextResponse.json({
        success: true,
        data: {
          availableAgents: agentDetails,
          totalAgents: availableAgents.length,
        },
      });
    }

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project ID is required to get agent capabilities',
        },
        { status: 400 }
      );
    }

    // Get project context and agent capabilities
    const projectManager = new ProjectManagerAgent();
    const projectContext = await projectManager.analyzeProject(projectId);
    
    const capabilities = await AgentFactory.getAgentCapabilities(agentType, projectContext);

    if (!capabilities) {
      return NextResponse.json(
        {
          success: false,
          error: `Agent type '${agentType}' not found or not supported`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        agentType,
        description: AgentFactory.getAgentDescription(agentType),
        capabilities: capabilities.capabilities,
        supportedCommands: capabilities.commands,
        projectContext: {
          name: projectContext.name,
          framework: projectContext.framework,
          language: projectContext.language,
        },
      },
    });
  } catch (error) {
    console.error('Error getting agent capabilities:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get agent capabilities',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = capabilitiesSchema.parse(body);

    const { agentType, projectId, command } = validatedData;

    if (!agentType || !projectId || !command) {
      return NextResponse.json(
        {
          success: false,
          error: 'agentType, projectId, and command are required for validation',
        },
        { status: 400 }
      );
    }

    // Get project context
    const projectManager = new ProjectManagerAgent();
    const projectContext = await projectManager.analyzeProject(projectId);

    // Validate command
    const validation = await AgentFactory.validateCommand(agentType, command, projectContext);

    if (validation.valid) {
      return NextResponse.json({
        success: true,
        data: {
          valid: true,
          agentType,
          command,
          message: 'Command is valid and can be executed',
        },
      });
    } else {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          agentType,
          command,
          error: validation.error,
          suggestions: validation.suggestions,
        },
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Error validating command:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to validate command',
      },
      { status: 500 }
    );
  }
}