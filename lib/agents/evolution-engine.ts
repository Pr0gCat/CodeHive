import { prisma } from '@/lib/db';
import { PerformanceMetrics, PerformanceTracker } from './performance-tracker';

export interface EvolutionSuggestion {
  type: 'prompt' | 'capabilities' | 'constraints' | 'dependencies';
  current: string;
  suggested: string;
  reason: string;
  confidence: number;
  expectedImprovement: string;
}

export interface EvolutionResult {
  agentId: string;
  version: number;
  changes: EvolutionSuggestion[];
  performanceBefore: PerformanceMetrics;
  implementedChanges: number;
  reasoning: string;
}

interface AgentSpecification {
  id: string;
  type: string;
  prompt: string;
  capabilities: string[];
  constraints: string[];
  dependencies: string[];
  evolution: Array<{
    version: number;
    timestamp: Date;
    performanceBefore: string | null;
  }>;
}

interface EvolutionRecord {
  version: number;
  timestamp: Date;
  changes: string;
  performanceBefore: string | null;
  performanceAfter: string | null;
}

export class EvolutionEngine {
  private performanceTracker: PerformanceTracker;

  constructor() {
    this.performanceTracker = new PerformanceTracker();
  }

  async analyzeAgentForEvolution(
    agentId: string
  ): Promise<EvolutionSuggestion[]> {
    try {
      const [agent, metrics] = await Promise.all([
        prisma.agentSpecification.findUnique({
          where: { id: agentId },
          include: {
            performance: {
              orderBy: { timestamp: 'desc' },
              take: 20,
            },
            evolution: {
              orderBy: { timestamp: 'desc' },
              take: 5,
            },
          },
        }),
        this.performanceTracker.getAgentMetrics(agentId),
      ]);

      if (!agent || !metrics) {
        throw new Error(
          `Agent ${agentId} not found or has no performance data`
        );
      }

      const suggestions: EvolutionSuggestion[] = [];

      // Analyze prompt effectiveness
      if (metrics.successRate < 75) {
        const promptSuggestion = await this.analyzePrompt(agent, metrics);
        if (promptSuggestion) suggestions.push(promptSuggestion);
      }

      // Analyze capabilities gaps
      if (metrics.commonErrors.length > 0) {
        const capabilitySuggestions = await this.analyzeCapabilities(
          agent,
          metrics
        );
        suggestions.push(...capabilitySuggestions);
      }

      // Analyze constraints effectiveness
      if (metrics.averageExecutionTime > 300000) {
        // 5 minutes
        const constraintSuggestion = await this.analyzeConstraints(
          agent,
          metrics
        );
        if (constraintSuggestion) suggestions.push(constraintSuggestion);
      }

      // Analyze dependency needs
      const dependencySuggestion = await this.analyzeDependencies(
        agent,
        metrics
      );
      if (dependencySuggestion) suggestions.push(dependencySuggestion);

      return suggestions.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error analyzing agent for evolution:', error);
      return [];
    }
  }

  async evolveAgent(
    agentId: string,
    selectedSuggestions: EvolutionSuggestion[]
  ): Promise<EvolutionResult> {
    try {
      const agent = await prisma.agentSpecification.findUnique({
        where: { id: agentId },
        include: {
          evolution: {
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      });

      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      const currentMetrics =
        await this.performanceTracker.getAgentMetrics(agentId);
      if (!currentMetrics) {
        throw new Error(`No performance metrics found for agent ${agentId}`);
      }

      const nextVersion = (agent.evolution[0]?.version || 0) + 1;
      const updatedAgent = { ...agent };
      const implementedChanges: EvolutionSuggestion[] = [];

      // Apply selected suggestions
      for (const suggestion of selectedSuggestions) {
        switch (suggestion.type) {
          case 'prompt':
            updatedAgent.prompt = suggestion.suggested;
            implementedChanges.push(suggestion);
            break;
          case 'capabilities':
            const capabilities = JSON.parse(updatedAgent.capabilities);
            const newCapability = suggestion.suggested;
            if (!capabilities.includes(newCapability)) {
              capabilities.push(newCapability);
              updatedAgent.capabilities = JSON.stringify(capabilities);
              implementedChanges.push(suggestion);
            }
            break;
          case 'constraints':
            const constraints = JSON.parse(updatedAgent.constraints);
            const [key, value] = suggestion.suggested.split(':');
            if (key && value) {
              constraints[key.trim()] = isNaN(Number(value.trim()))
                ? value.trim()
                : Number(value.trim());
              updatedAgent.constraints = JSON.stringify(constraints);
              implementedChanges.push(suggestion);
            }
            break;
          case 'dependencies':
            const dependencies = JSON.parse(updatedAgent.dependencies);
            const newDep = suggestion.suggested;
            if (!dependencies.includes(newDep)) {
              dependencies.push(newDep);
              updatedAgent.dependencies = JSON.stringify(dependencies);
              implementedChanges.push(suggestion);
            }
            break;
        }
      }

      // Update agent specification
      await prisma.agentSpecification.update({
        where: { id: agentId },
        data: {
          prompt: updatedAgent.prompt,
          capabilities: updatedAgent.capabilities,
          constraints: updatedAgent.constraints,
          dependencies: updatedAgent.dependencies,
        },
      });

      // Record evolution
      const changes = {
        implemented: implementedChanges,
        rejected: selectedSuggestions.filter(
          s => !implementedChanges.includes(s)
        ),
      };

      await prisma.agentEvolution.create({
        data: {
          agentId,
          version: nextVersion,
          changes: JSON.stringify(changes),
          performanceBefore: JSON.stringify(currentMetrics),
          reason: `Evolution based on performance analysis. Success rate: ${currentMetrics.successRate.toFixed(1)}%, Avg execution: ${(currentMetrics.averageExecutionTime / 1000).toFixed(1)}s`,
        },
      });

      return {
        agentId,
        version: nextVersion,
        changes: implementedChanges,
        performanceBefore: currentMetrics,
        implementedChanges: implementedChanges.length,
        reasoning: `Applied ${implementedChanges.length} improvements to address performance issues`,
      };
    } catch (error) {
      console.error('Error evolving agent:', error);
      throw error;
    }
  }

  async getEvolutionHistory(agentId: string): Promise<{
    agent: AgentSpecification;
    evolutions: EvolutionRecord[];
    performanceProgress: {
      version: number;
      successRate: number;
      executionTime: number;
      date: Date;
    }[];
  }> {
    try {
      const agent = await prisma.agentSpecification.findUnique({
        where: { id: agentId },
        include: {
          evolution: {
            orderBy: { version: 'asc' },
          },
        },
      });

      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      const performanceProgress = agent.evolution.map(evo => {
        const perfBefore = JSON.parse(evo.performanceBefore || '{}');
        return {
          version: evo.version,
          successRate: perfBefore.successRate || 0,
          executionTime: perfBefore.averageExecutionTime || 0,
          date: evo.timestamp,
        };
      });

      return {
        agent,
        evolutions: agent.evolution,
        performanceProgress,
      };
    } catch (error) {
      console.error('Error getting evolution history:', error);
      throw error;
    }
  }

  async suggestSystemWideImprovements(projectId: string): Promise<{
    agentCount: number;
    evolutionOpportunities: {
      agentId: string;
      agentType: string;
      priority: number;
      suggestedChanges: number;
      potentialImpact: string;
    }[];
    systemRecommendations: string[];
  }> {
    try {
      const agents = await prisma.agentSpecification.findMany({
        where: { projectId },
        include: {
          performance: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
      });

      const evolutionOpportunities: {
        agentId: string;
        agentType: string;
        priority: number;
        suggestedChanges: number;
        potentialImpact: string;
      }[] = [];

      const systemRecommendations: string[] = [];

      for (const agent of agents) {
        const suggestions = await this.analyzeAgentForEvolution(agent.id);
        if (suggestions.length > 0) {
          const metrics = await this.performanceTracker.getAgentMetrics(
            agent.id
          );
          const priority = this.calculateEvolutionPriority(
            metrics,
            suggestions
          );

          evolutionOpportunities.push({
            agentId: agent.id,
            agentType: agent.type,
            priority,
            suggestedChanges: suggestions.length,
            potentialImpact: this.estimateImpact(metrics, suggestions),
          });
        }
      }

      // System-wide recommendations
      const lowPerformingAgents = evolutionOpportunities.filter(
        op => op.priority > 7
      ).length;
      if (lowPerformingAgents > agents.length * 0.3) {
        systemRecommendations.push(
          'Consider reviewing overall agent architecture - multiple agents showing performance issues'
        );
      }

      const avgSuggestions =
        evolutionOpportunities.reduce(
          (sum, op) => sum + op.suggestedChanges,
          0
        ) / evolutionOpportunities.length;
      if (avgSuggestions > 3) {
        systemRecommendations.push(
          'Agents may be over-complex or under-specified - consider simplifying agent roles'
        );
      }

      if (agents.length < 3) {
        systemRecommendations.push(
          'Consider adding more specialized agents to improve task distribution'
        );
      }

      return {
        agentCount: agents.length,
        evolutionOpportunities: evolutionOpportunities.sort(
          (a, b) => b.priority - a.priority
        ),
        systemRecommendations,
      };
    } catch (error) {
      console.error('Error suggesting system-wide improvements:', error);
      return {
        agentCount: 0,
        evolutionOpportunities: [],
        systemRecommendations: [
          'Error analyzing system - check logs for details',
        ],
      };
    }
  }

  private async analyzePrompt(
    agent: AgentSpecification,
    metrics: PerformanceMetrics
  ): Promise<EvolutionSuggestion | null> {
    // Analyze common errors to suggest prompt improvements
    const errorPatterns = metrics.commonErrors;

    if (errorPatterns.some(error => error.includes('timeout'))) {
      return {
        type: 'prompt',
        current: agent.prompt.substring(0, 100) + '...',
        suggested:
          agent.prompt +
          '\n\nIMPORTANT: Keep responses concise and focus on essential information only. Avoid lengthy explanations.',
        reason: 'Frequent timeout errors suggest overly verbose responses',
        confidence: 0.8,
        expectedImprovement: 'Reduce execution time by 20-30%',
      };
    }

    if (errorPatterns.some(error => error.includes('validation'))) {
      return {
        type: 'prompt',
        current: agent.prompt.substring(0, 100) + '...',
        suggested:
          agent.prompt +
          '\n\nBefore executing commands, always validate inputs and check file existence.',
        reason: 'Validation errors indicate need for better input checking',
        confidence: 0.9,
        expectedImprovement: 'Improve success rate by 15-25%',
      };
    }

    return null;
  }

  private async analyzeCapabilities(
    agent: AgentSpecification,
    metrics: PerformanceMetrics
  ): Promise<EvolutionSuggestion[]> {
    const suggestions: EvolutionSuggestion[] = [];
    const capabilities = JSON.parse(agent.capabilities);

    // Suggest new capabilities based on common errors
    if (metrics.commonErrors.some(error => error.includes('permission'))) {
      suggestions.push({
        type: 'capabilities',
        current: capabilities.join(', '),
        suggested: 'Permission handling and access validation',
        reason:
          'Frequent permission errors suggest need for better access control',
        confidence: 0.85,
        expectedImprovement: 'Reduce permission-related failures by 80%',
      });
    }

    if (metrics.commonErrors.some(error => error.includes('network'))) {
      suggestions.push({
        type: 'capabilities',
        current: capabilities.join(', '),
        suggested: 'Network retry and connection management',
        reason: 'Network errors indicate need for better connection handling',
        confidence: 0.9,
        expectedImprovement: 'Improve reliability in network operations',
      });
    }

    return suggestions;
  }

  private async analyzeConstraints(
    agent: AgentSpecification,
    metrics: PerformanceMetrics
  ): Promise<EvolutionSuggestion | null> {
    const constraints = JSON.parse(agent.constraints);

    if (metrics.averageExecutionTime > 300000) {
      // 5 minutes
      return {
        type: 'constraints',
        current: `timeout: ${constraints.timeout || 'unlimited'}`,
        suggested: 'timeout: 240000',
        reason: 'High execution times suggest need for stricter timeout',
        confidence: 0.75,
        expectedImprovement: 'Prevent hanging tasks and improve responsiveness',
      };
    }

    return null;
  }

  private async analyzeDependencies(
    agent: AgentSpecification,
    metrics: PerformanceMetrics
  ): Promise<EvolutionSuggestion | null> {
    const dependencies = JSON.parse(agent.dependencies);

    // This is a simplified analysis - in practice, you'd analyze error logs for missing dependencies
    if (
      metrics.commonErrors.some(error => error.includes('command not found'))
    ) {
      return {
        type: 'dependencies',
        current: dependencies.join(', '),
        suggested: 'git', // Common missing dependency
        reason: 'Command not found errors suggest missing system dependencies',
        confidence: 0.7,
        expectedImprovement: 'Resolve missing command errors',
      };
    }

    return null;
  }

  private calculateEvolutionPriority(
    metrics: PerformanceMetrics | null,
    suggestions: EvolutionSuggestion[]
  ): number {
    if (!metrics) return 0;

    let priority = 0;

    // Success rate impact
    if (metrics.successRate < 50) priority += 10;
    else if (metrics.successRate < 70) priority += 7;
    else if (metrics.successRate < 85) priority += 4;

    // Execution time impact
    if (metrics.averageExecutionTime > 300000) priority += 5;
    else if (metrics.averageExecutionTime > 180000) priority += 3;

    // Number of suggestions
    priority += Math.min(suggestions.length, 5);

    return Math.min(priority, 10);
  }

  private estimateImpact(
    metrics: PerformanceMetrics | null,
    suggestions: EvolutionSuggestion[]
  ): string {
    if (!metrics) return 'Unknown impact';

    const highConfidenceSuggestions = suggestions.filter(
      s => s.confidence > 0.8
    ).length;

    if (highConfidenceSuggestions >= 3) {
      return 'High impact - significant performance improvement expected';
    } else if (highConfidenceSuggestions >= 1) {
      return 'Medium impact - moderate performance improvement expected';
    } else {
      return 'Low impact - minor improvements expected';
    }
  }
}
