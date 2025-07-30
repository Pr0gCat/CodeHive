export interface AgentResult {
  success: boolean;
  message?: string;
  output?: string;
  error?: string;
  artifacts?: Record<string, unknown>;
  tokensUsed?: number;
  executionTime?: number;
}

export interface AgentTask {
  id: string;
  cardId: string;
  projectId: string;
  agentType: string;
  command: string;
  priority: number;
  context?: Record<string, unknown>;
  createdAt: Date;
}

export interface AgentExecutionOptions {
  timeout?: number;
  maxRetries?: number;
  workingDirectory?: string;
  environment?: Record<string, string>;
}

export interface RateLimitConfig {
  tokensPerDay: number;
  requestsPerMinute: number;
  currentTokens: number;
  currentRequests: number;
  resetAt: Date;
}

export interface AgentSpec {
  name: string;
  type: string;
  purpose: string;
  capabilities: string[];
  dependencies: string[];
  constraints: Record<string, unknown>;
  prompt: string;
}

export enum AgentStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

export enum QueueStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
}
