import { prisma, ProjectSettings } from '@/lib/db';

/**
 * Get project settings with defaults
 */
export async function getProjectSettings(
  projectId: string
): Promise<ProjectSettings> {
  let settings = await prisma.projectSettings.findUnique({
    where: { projectId },
  });

  if (!settings) {
    // Create default settings if they don't exist
    settings = await prisma.projectSettings.create({
      data: {
        projectId,
      },
    });
  }

  return settings;
}

/**
 * Update project settings
 */
export async function updateProjectSettings(
  projectId: string,
  updates: Partial<
    Omit<ProjectSettings, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
  >
): Promise<ProjectSettings> {
  return await prisma.projectSettings.upsert({
    where: { projectId },
    update: updates,
    create: {
      projectId,
      ...updates,
    },
  });
}

/**
 * Get current queue size for a project
 */
export async function getQueueSize(projectId: string): Promise<number> {
  return await prisma.queuedTask.count({
    where: {
      projectId,
      status: {
        in: ['PENDING', 'RUNNING'],
      },
    },
  });
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