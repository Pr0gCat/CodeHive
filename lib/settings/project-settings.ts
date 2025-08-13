import { prisma } from '@/lib/db';

// Define ProjectSettings type locally since it doesn't exist in schema
export interface ProjectSettings {
  projectId: string;
  maxTokensPerDay?: number;
  maxTokensPerTask?: number;
  maxTokensPerRequest?: number;
  maxRequestsPerMinute?: number;
  maxRequestsPerHour?: number;
  maxQueueSize?: number;
  parallelAgentLimit?: number;
  autoReviewEnabled?: boolean;
  tddCyclesEnabled?: boolean;
  claudeCommandPath?: string;
  defaultAgentModel?: string;
  gitOperationsEnabled?: boolean;
}

/**
 * Get project settings with defaults
 * Note: Since ProjectSettings model doesn't exist in schema,
 * returning default settings for now
 */
export async function getProjectSettings(
  projectId: string
): Promise<ProjectSettings> {
  // TODO: Implement actual settings storage when schema is updated
  // For now, return default settings
  return {
    projectId,
    maxTokensPerDay: 1000000,
    maxTokensPerTask: 100000,
    maxTokensPerRequest: 50000,
    maxRequestsPerMinute: 20,
    maxRequestsPerHour: 100,
    maxQueueSize: 10,
    parallelAgentLimit: 3,
    autoReviewEnabled: true,
    tddCyclesEnabled: true,
    claudeCommandPath: 'claude',
    defaultAgentModel: 'claude-3-opus-20240229',
    gitOperationsEnabled: true,
  };
}

/**
 * Update project settings
 * Note: Since ProjectSettings model doesn't exist in schema,
 * this is a placeholder implementation
 */
export async function updateProjectSettings(
  projectId: string,
  updates: Partial<
    Omit<ProjectSettings, 'projectId'>
  >
): Promise<ProjectSettings> {
  // TODO: Implement actual settings storage when schema is updated
  // For now, return merged settings
  const currentSettings = await getProjectSettings(projectId);
  return {
    ...currentSettings,
    ...updates,
  };
}

/**
 * Get current queue size for a project
 */
export async function getQueueSize(projectId: string): Promise<number> {
  // TODO: QueuedTask model doesn't exist in current schema
  // Return 0 for now
  return 0;
}

/**
 * Check if project can queue more tasks
 */
export async function canQueueTask(projectId: string): Promise<{
  allowed: boolean;
  reason?: string;
  currentSize?: number;
  maxSize?: number;
}> {
  const settings = await getProjectSettings(projectId);
  const currentSize = await getQueueSize(projectId);

  if (currentSize >= settings.maxQueueSize) {
    return {
      allowed: false,
      reason: 'Queue is full',
      currentSize,
      maxSize: settings.maxQueueSize,
    };
  }

  return {
    allowed: true,
    currentSize,
    maxSize: settings.maxQueueSize,
  };
}

/**
 * Get running agents count for a project
 */
export async function getRunningAgentsCount(
  projectId: string
): Promise<number> {
  return await prisma.queuedTask.count({
    where: {
      projectId,
      status: 'RUNNING',
    },
  });
}

/**
 * Check if project can run more agents in parallel
 */
export async function canRunParallelAgent(projectId: string): Promise<{
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  maxLimit?: number;
}> {
  const settings = await getProjectSettings(projectId);
  const currentCount = await getRunningAgentsCount(projectId);

  if (currentCount >= settings.parallelAgentLimit) {
    return {
      allowed: false,
      reason: 'Parallel agent limit reached',
      currentCount,
      maxLimit: settings.parallelAgentLimit,
    };
  }

  return {
    allowed: true,
    currentCount,
    maxLimit: settings.parallelAgentLimit,
  };
}