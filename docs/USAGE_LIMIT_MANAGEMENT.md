# Usage Limit Management System

## Overview

CodeHive implements a centralized usage limit management system that monitors Claude API usage across all projects and automatically halts/resumes development based on rate limits.

## Architecture

### Usage Monitor Components

```typescript
// lib/usage/monitor.ts
interface UsageState {
  currentUsage: {
    requests: number;
    tokens: number;
    timestamp: Date;
  };
  limits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    dailyTokenLimit: number;
  };
  resetTime: Date;
  isPaused: boolean;
}

export class UsageMonitor {
  private state: UsageState;
  private subscribers: Set<UsageSubscriber> = new Set();

  async checkUsage(): Promise<UsageStatus> {
    const usage = await this.getCurrentUsage();
    const limits = await this.getLimits();

    return {
      isNearLimit: usage.tokens > limits.dailyTokenLimit * 0.9,
      isAtLimit: usage.tokens >= limits.dailyTokenLimit,
      resetIn: this.calculateResetTime(),
      currentPercentage: (usage.tokens / limits.dailyTokenLimit) * 100,
    };
  }

  async recordUsage(tokens: number, projectId: string): Promise<void> {
    // Update usage in database
    await this.db.tokenUsage.create({
      projectId,
      tokens,
      timestamp: new Date(),
    });

    // Check if we hit limits
    const status = await this.checkUsage();
    if (status.isAtLimit && !this.state.isPaused) {
      await this.pauseAllProjects();
    }
  }

  private async pauseAllProjects(): Promise<void> {
    this.state.isPaused = true;

    // Notify all subscribers
    for (const subscriber of this.subscribers) {
      await subscriber.onUsagePaused(this.state.resetTime);
    }

    // Update all active projects
    await this.db.project.updateMany({
      where: { status: 'active' },
      data: { status: 'paused', pauseReason: 'usage_limit' },
    });

    // Schedule resume
    this.scheduleResume();
  }

  private scheduleResume(): void {
    const resetDelay = this.state.resetTime.getTime() - Date.now();

    setTimeout(async () => {
      await this.resumeAllProjects();
    }, resetDelay);
  }
}
```

### Rate Limiter Implementation

```typescript
// lib/usage/rate-limiter.ts
export class RateLimiter {
  private queues: Map<string, TaskQueue> = new Map();
  private globalPaused = false;

  async executeWithRateLimit<T>(
    projectId: string,
    task: () => Promise<T>
  ): Promise<T> {
    // Check global pause
    if (this.globalPaused) {
      throw new UsageLimitError('All projects paused due to usage limits');
    }

    // Get or create project queue
    const queue = this.getOrCreateQueue(projectId);

    return queue.enqueue(async () => {
      // Pre-execution check
      const canExecute = await this.canExecute();
      if (!canExecute) {
        throw new UsageLimitError('Rate limit exceeded');
      }

      // Execute task
      const startTokens = await this.getCurrentTokens();
      const result = await task();
      const endTokens = await this.getCurrentTokens();

      // Record usage
      const tokensUsed = endTokens - startTokens;
      await this.usageMonitor.recordUsage(tokensUsed, projectId);

      return result;
    });
  }

  async pauseAll(reason: string, resumeAt: Date): Promise<void> {
    this.globalPaused = true;

    // Pause all queues
    for (const [projectId, queue] of this.queues) {
      await queue.pause();
    }

    // Notify UI
    this.broadcast({
      type: 'global_pause',
      reason,
      resumeAt,
    });
  }

  async resumeAll(): Promise<void> {
    this.globalPaused = false;

    // Resume all queues
    for (const [projectId, queue] of this.queues) {
      await queue.resume();
    }

    // Notify UI
    this.broadcast({
      type: 'global_resume',
    });
  }
}
```

### Agent Wrapper with Usage Tracking

```typescript
// lib/agents/usage-aware-agent.ts
export class UsageAwareAgent extends BaseAgent {
  constructor(
    private agent: BaseAgent,
    private rateLimiter: RateLimiter
  ) {
    super();
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    try {
      return await this.rateLimiter.executeWithRateLimit(
        task.projectId,
        async () => {
          // Estimate tokens before execution
          const estimatedTokens = await this.estimateTokens(task);

          // Check if we have enough quota
          const canProceed = await this.checkQuota(estimatedTokens);
          if (!canProceed) {
            return this.createPausedResult(task);
          }

          // Execute the actual agent
          return await this.agent.execute(task);
        }
      );
    } catch (error) {
      if (error instanceof UsageLimitError) {
        // Handle gracefully
        return this.handleUsageLimit(task, error);
      }
      throw error;
    }
  }

  private async estimateTokens(task: AgentTask): Promise<number> {
    // Estimate based on task complexity and historical data
    const baseEstimate = task.description.length * 4; // Rough estimate
    const historicalMultiplier = await this.getHistoricalMultiplier(
      task.agentType
    );

    return Math.ceil(baseEstimate * historicalMultiplier);
  }

  private async handleUsageLimit(
    task: AgentTask,
    error: UsageLimitError
  ): Promise<AgentResult> {
    // Save task state for resume
    await this.saveTaskState(task);

    return {
      success: false,
      paused: true,
      reason: 'usage_limit',
      resumeAt: error.resumeAt,
      message: `Task paused due to usage limits. Will resume at ${error.resumeAt}`,
      artifacts: {
        savedState: task.id,
      },
    };
  }
}
```

### Persistent Queue System

```typescript
// lib/usage/persistent-queue.ts
export class PersistentTaskQueue {
  constructor(
    private projectId: string,
    private db: DatabaseClient
  ) {}

  async enqueue(task: QueuedTask): Promise<void> {
    await this.db.queuedTask.create({
      data: {
        projectId: this.projectId,
        taskId: task.id,
        agentType: task.agentType,
        payload: task.payload,
        priority: task.priority,
        status: 'pending',
        createdAt: new Date(),
      },
    });
  }

  async pauseQueue(): Promise<void> {
    // Mark all pending tasks as paused
    await this.db.queuedTask.updateMany({
      where: {
        projectId: this.projectId,
        status: 'pending',
      },
      data: {
        status: 'paused',
        pausedAt: new Date(),
      },
    });
  }

  async resumeQueue(): Promise<void> {
    // Get all paused tasks
    const pausedTasks = await this.db.queuedTask.findMany({
      where: {
        projectId: this.projectId,
        status: 'paused',
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    // Resume execution
    for (const task of pausedTasks) {
      await this.executeTask(task);
    }
  }

  private async executeTask(task: QueuedTask): Promise<void> {
    // Update status
    await this.db.queuedTask.update({
      where: { id: task.id },
      data: { status: 'running' },
    });

    try {
      // Execute through rate limiter
      await this.rateLimiter.executeWithRateLimit(this.projectId, async () => {
        const agent = this.agentFactory.create(task.agentType);
        return await agent.execute(task.payload);
      });

      // Mark complete
      await this.db.queuedTask.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof UsageLimitError) {
        // Re-pause the task
        await this.db.queuedTask.update({
          where: { id: task.id },
          data: { status: 'paused' },
        });
      } else {
        // Mark as failed
        await this.db.queuedTask.update({
          where: { id: task.id },
          data: {
            status: 'failed',
            error: error.message,
          },
        });
      }
    }
  }
}
```

### UI Components for Usage Display

```typescript
// app/components/UsageLimitIndicator.tsx
export function UsageLimitIndicator() {
  const { usage, limits, isPaused, resetTime } = useUsageMonitor();

  const percentage = (usage.tokens / limits.dailyTokenLimit) * 100;
  const isNearLimit = percentage > 90;

  return (
    <div className="fixed top-4 right-4 p-4 bg-white rounded-lg shadow-lg">
      {isPaused ? (
        <div className="text-red-600">
          <div className="font-bold">Development Paused</div>
          <div className="text-sm">
            Usage limit reached. Resuming in {formatDuration(resetTime)}
          </div>
        </div>
      ) : (
        <div>
          <div className="text-sm text-gray-600">Token Usage</div>
          <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                isNearLimit ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {usage.tokens.toLocaleString()} / {limits.dailyTokenLimit.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

// app/components/ProjectCard.tsx
export function ProjectCard({ project }: { project: Project }) {
  const isPausedByLimit = project.status === 'paused' &&
                         project.pauseReason === 'usage_limit';

  return (
    <div className={`border rounded-lg p-4 ${
      isPausedByLimit ? 'opacity-50' : ''
    }`}>
      <div className="flex justify-between items-start">
        <h3 className="font-bold">{project.name}</h3>
        {isPausedByLimit && (
          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
            Paused - Usage Limit
          </span>
        )}
      </div>
      {/* Rest of card content */}
    </div>
  );
}
```

### Configuration

```typescript
// lib/config/usage-limits.ts
export const USAGE_LIMITS = {
  // Claude API limits (example values)
  requests: {
    perMinute: 50,
    perHour: 1000,
    perDay: 10000,
  },
  tokens: {
    perMinute: 100000,
    perHour: 1000000,
    perDay: 10000000, // 10M tokens per day
  },

  // Buffer to avoid hitting hard limits
  safetyBuffer: 0.9, // Stop at 90% of limit

  // Check intervals
  checkInterval: 60000, // Check every minute

  // Queue settings
  maxQueueSize: 1000,
  queueTimeout: 3600000, // 1 hour
};

// Environment variables
// .env.local
CLAUDE_API_KEY = your - api - key;
CLAUDE_DAILY_TOKEN_LIMIT = 10000000;
CLAUDE_RATE_LIMIT_PER_MINUTE = 50;
```

### Database Schema

```sql
-- Queued tasks for resume
CREATE TABLE queued_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  payload JSON NOT NULL,
  priority INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('pending', 'running', 'paused', 'completed', 'failed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paused_at DATETIME,
  resumed_at DATETIME,
  completed_at DATETIME,
  error TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Usage tracking with more detail
CREATE TABLE usage_tracking (
  id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  token_count INTEGER NOT NULL,
  request_count INTEGER DEFAULT 1,
  project_id TEXT,
  agent_type TEXT,
  reset_period TEXT, -- 'minute', 'hour', 'day'
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Usage limits configuration
CREATE TABLE usage_limits (
  id TEXT PRIMARY KEY,
  limit_type TEXT NOT NULL, -- 'tokens_per_day', 'requests_per_minute', etc.
  limit_value INTEGER NOT NULL,
  current_usage INTEGER DEFAULT 0,
  reset_at DATETIME NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Auto-Resume System

```typescript
// lib/usage/auto-resume.ts
export class AutoResumeManager {
  private resumeTimers: Map<string, NodeJS.Timeout> = new Map();

  async initialize(): Promise<void> {
    // Check for any paused projects on startup
    const pausedProjects = await this.db.project.findMany({
      where: {
        status: 'paused',
        pauseReason: 'usage_limit',
      },
    });

    // Schedule resume for each
    for (const project of pausedProjects) {
      await this.scheduleProjectResume(project);
    }

    // Start monitoring loop
    this.startMonitoringLoop();
  }

  private async startMonitoringLoop(): Promise<void> {
    setInterval(async () => {
      const status = await this.usageMonitor.checkUsage();

      if (!status.isAtLimit && this.hasQueuedTasks()) {
        await this.processQueuedTasks();
      }
    }, USAGE_LIMITS.checkInterval);
  }

  private async processQueuedTasks(): Promise<void> {
    const tasks = await this.getHighestPriorityTasks();

    for (const task of tasks) {
      try {
        await this.executeQueuedTask(task);
      } catch (error) {
        if (error instanceof UsageLimitError) {
          // Stop processing if we hit limit again
          break;
        }
      }
    }
  }
}
```

## Benefits

1. **Automatic Pause/Resume**: No manual intervention needed
2. **Fair Resource Distribution**: Priority-based queue system
3. **Persistent State**: Tasks resume exactly where they left off
4. **Real-time Monitoring**: Visual indicators of usage status
5. **Graceful Degradation**: Projects pause cleanly without data loss
