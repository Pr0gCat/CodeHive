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
 * Check if request is within rate limits
 */
export async function checkRateLimit(projectId: string): Promise<{
  allowed: boolean;
  reason?: string;
  resetAt?: Date;
}> {
  const settings = await getProjectSettings(projectId);
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const startOfMinute = new Date(now.setSeconds(0, 0));
  const startOfHour = new Date(now.setMinutes(0, 0, 0));

  // Check daily token usage
  const dailyTokenUsage = await prisma.tokenUsage.aggregate({
    where: {
      projectId,
      timestamp: {
        gte: startOfDay,
      },
    },
    _sum: {
      inputTokens: true,
      outputTokens: true,
    },
  });

  const totalDailyTokens =
    (dailyTokenUsage._sum.inputTokens || 0) +
    (dailyTokenUsage._sum.outputTokens || 0);
  if (totalDailyTokens >= settings.maxTokensPerDay) {
    return {
      allowed: false,
      reason: `Daily token limit exceeded (${totalDailyTokens}/${settings.maxTokensPerDay})`,
      resetAt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000), // Next day
    };
  }

  // Check requests per minute
  const minuteRequestCount = await prisma.tokenUsage.count({
    where: {
      projectId,
      timestamp: {
        gte: startOfMinute,
      },
    },
  });

  if (minuteRequestCount >= settings.maxRequestsPerMinute) {
    return {
      allowed: false,
      reason: `Minute rate limit exceeded (${minuteRequestCount}/${settings.maxRequestsPerMinute})`,
      resetAt: new Date(startOfMinute.getTime() + 60 * 1000), // Next minute
    };
  }

  // Check requests per hour
  const hourRequestCount = await prisma.tokenUsage.count({
    where: {
      projectId,
      timestamp: {
        gte: startOfHour,
      },
    },
  });

  if (hourRequestCount >= settings.maxRequestsPerHour) {
    return {
      allowed: false,
      reason: `Hourly rate limit exceeded (${hourRequestCount}/${settings.maxRequestsPerHour})`,
      resetAt: new Date(startOfHour.getTime() + 60 * 60 * 1000), // Next hour
    };
  }

  return { allowed: true };
}

/**
 * Check if tokens for a request would exceed limits
 */
export async function checkTokenLimit(
  projectId: string,
  estimatedTokens: number
): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const settings = await getProjectSettings(projectId);

  // Check per-request token limit
  if (estimatedTokens > settings.maxTokensPerRequest) {
    return {
      allowed: false,
      reason: `Request token limit exceeded (${estimatedTokens}/${settings.maxTokensPerRequest})`,
    };
  }

  // Check daily token limit
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));

  const dailyTokenUsage = await prisma.tokenUsage.aggregate({
    where: {
      projectId,
      timestamp: {
        gte: startOfDay,
      },
    },
    _sum: {
      inputTokens: true,
      outputTokens: true,
    },
  });

  const totalDailyTokens =
    (dailyTokenUsage._sum.inputTokens || 0) +
    (dailyTokenUsage._sum.outputTokens || 0);
  if (totalDailyTokens + estimatedTokens > settings.maxTokensPerDay) {
    return {
      allowed: false,
      reason: `Daily token limit would be exceeded (${totalDailyTokens + estimatedTokens}/${settings.maxTokensPerDay})`,
    };
  }

  return { allowed: true };
}

/**
 * Log token usage for a project
 */
export async function logTokenUsage(
  projectId: string,
  agentType: string,
  inputTokens: number,
  outputTokens: number,
  taskId?: string
): Promise<void> {
  await prisma.tokenUsage.create({
    data: {
      projectId,
      agentType,
      taskId,
      inputTokens,
      outputTokens,
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
