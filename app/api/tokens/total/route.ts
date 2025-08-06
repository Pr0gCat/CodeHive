import { NextResponse } from 'next/server';
import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { ProjectMetadataManager } from '@/lib/portable/metadata-manager';

export async function GET() {
  try {
    // Get all portable projects
    const discoveryService = getProjectDiscoveryService();
    const projects = await discoveryService.discoverProjects();

    // Calculate date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)

    // Aggregate stats across all projects
    let totalStats = { inputTokens: 0, outputTokens: 0, requests: 0 };
    let todayStats = { inputTokens: 0, outputTokens: 0, requests: 0 };
    let weekStats = { inputTokens: 0, outputTokens: 0, requests: 0 };
    const agentStatsMap = new Map();

    // Process each project
    for (const project of projects) {
      try {
        const metadataManager = new ProjectMetadataManager(project.path);
        
        let tokenUsage;
        try {
          tokenUsage = await metadataManager.getTokenUsage();
        } catch {
          tokenUsage = [];
        }

        // Process each usage record
        for (const usage of tokenUsage) {
          const usageDate = new Date(usage.timestamp);
          const inputTokens = usage.inputTokens || 0;
          const outputTokens = usage.outputTokens || 0;

          // Add to total stats
          totalStats.inputTokens += inputTokens;
          totalStats.outputTokens += outputTokens;
          totalStats.requests += 1;

          // Add to today's stats if applicable
          if (usageDate >= today) {
            todayStats.inputTokens += inputTokens;
            todayStats.outputTokens += outputTokens;
            todayStats.requests += 1;
          }

          // Add to week's stats if applicable
          if (usageDate >= weekStart) {
            weekStats.inputTokens += inputTokens;
            weekStats.outputTokens += outputTokens;
            weekStats.requests += 1;
          }

          // Add to agent stats
          const agentType = usage.agentType || 'unknown';
          if (!agentStatsMap.has(agentType)) {
            agentStatsMap.set(agentType, { inputTokens: 0, outputTokens: 0, requests: 0 });
          }
          const agentStat = agentStatsMap.get(agentType);
          agentStat.inputTokens += inputTokens;
          agentStat.outputTokens += outputTokens;
          agentStat.requests += 1;
        }
      } catch (error) {
        console.warn(`Failed to get token usage for project ${project.metadata.name}:`, error);
        // Continue with other projects
      }
    }

    // Convert agent stats to array and sort
    const agentStats = Array.from(agentStatsMap.entries()).map(([agentType, stats]) => ({
      agentType,
      tokens: stats.inputTokens + stats.outputTokens,
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      requests: stats.requests,
    }));

    // Sort by total tokens descending
    agentStats.sort((a, b) => b.tokens - a.tokens);

    return NextResponse.json({
      success: true,
      data: {
        total: {
          tokens: totalStats.inputTokens + totalStats.outputTokens,
          inputTokens: totalStats.inputTokens,
          outputTokens: totalStats.outputTokens,
          requests: totalStats.requests,
        },
        today: {
          tokens: todayStats.inputTokens + todayStats.outputTokens,
          inputTokens: todayStats.inputTokens,
          outputTokens: todayStats.outputTokens,
          requests: todayStats.requests,
        },
        week: {
          tokens: weekStats.inputTokens + weekStats.outputTokens,
          inputTokens: weekStats.inputTokens,
          outputTokens: weekStats.outputTokens,
          requests: weekStats.requests,
        },
        byAgent: agentStats,
      },
    });
  } catch (error) {
    console.error('Error fetching token statistics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch token statistics',
      },
      { status: 500 }
    );
  }
}
