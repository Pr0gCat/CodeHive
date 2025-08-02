/**
 * Shared Type Definitions
 * 共享類型定義 - 定義常用的類型接口
 */

// ============================================================================
// Basic Types
// ============================================================================

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// Project Related Types
// ============================================================================

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectStatus = 'INITIALIZING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'PAUSED';

export interface ProjectSettings {
  agentTimeout: number;
  maxRetries: number;
  dailyTokenLimit: number;
  rateLimitPerMinute: number;
  warningThreshold: number;
  criticalThreshold: number;
  allocationStrategy: number;
  autoResumeEnabled: boolean;
  pauseOnWarning: boolean;
}

// ============================================================================
// Task Related Types
// ============================================================================

export interface TaskExecution {
  taskId: string;
  projectId: string;
  agentType: string;
  status: TaskStatus;
  result?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  phases: TaskPhase[];
  events: TaskEvent[];
}

export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface TaskPhase {
  id: string;
  taskId: string;
  name: string;
  status: PhaseStatus;
  order: number;
  result?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export type PhaseStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface TaskEvent {
  id: string;
  taskId: string;
  type: TaskEventType;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export type TaskEventType = 
  | 'task_created'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'phase_updated'
  | 'event_created';

// ============================================================================
// Agent Related Types
// ============================================================================

export interface AgentCapability {
  name: string;
  description: string;
  parameters: AgentParameter[];
  examples: string[];
}

export interface AgentParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  defaultValue?: unknown;
}

export interface AgentResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  tokensUsed: number;
}

export interface AgentPerformance {
  agentId: string;
  agentType: string;
  projectId: string;
  successRate: number;
  averageExecutionTime: number;
  totalExecutions: number;
  totalTokensUsed: number;
  lastExecuted: Date;
}

// ============================================================================
// Epic and Story Types
// ============================================================================

export interface Epic {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: EpicStatus;
  phase: EpicPhase;
  priority: MVPPriority;
  storyPoints: number;
  createdAt: Date;
  updatedAt: Date;
  stories: Story[];
}

export type EpicStatus = 'BACKLOG' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type EpicPhase = 'DISCOVERY' | 'DESIGN' | 'DEVELOPMENT' | 'TESTING' | 'DEPLOYMENT';
export type MVPPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Story {
  id: string;
  epicId: string;
  projectId: string;
  title: string;
  description?: string;
  status: StoryStatus;
  storyPoints: number;
  priority: StoryPriority;
  sprintId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type StoryStatus = 'BACKLOG' | 'TO_DO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type StoryPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ============================================================================
// Sprint Related Types
// ============================================================================

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal?: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  status: SprintStatus;
  plannedStoryPoints: number;
  actualStoryPoints: number;
  velocity: number;
  createdAt: Date;
  updatedAt: Date;
  stories: Story[];
  burndown: SprintBurndown[];
  dailyUpdates: SprintDailyUpdate[];
}

export type SprintStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface SprintBurndown {
  id: string;
  sprintId: string;
  date: Date;
  remainingStoryPoints: number;
  completedStoryPoints: number;
  idealRemainingPoints: number;
}

export interface SprintDailyUpdate {
  id: string;
  sprintId: string;
  date: Date;
  completedPoints: number;
  remainingPoints: number;
  blockers: string[];
  notes: string;
}

// ============================================================================
// Query Related Types
// ============================================================================

export interface Query {
  id: string;
  projectId: string;
  title: string;
  content: string;
  urgency: QueryUrgency;
  status: QueryStatus;
  answer?: string;
  answeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type QueryUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type QueryStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

// ============================================================================
// Token Usage Types
// ============================================================================

export interface TokenUsage {
  id: string;
  projectId: string;
  agentType: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  timestamp: Date;
}

export interface TokenUsageSummary {
  projectId: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  usagePercentage: number;
  dailyLimit: number;
  remainingTokens: number;
}

// ============================================================================
// Socket and Event Types
// ============================================================================

export interface SocketEvent {
  type: string;
  taskId?: string;
  socketId?: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export interface TaskEventData {
  taskId: string;
  type: TaskEventType;
  timestamp: Date;
  data?: Record<string, unknown>;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type FunctionType<TArgs extends unknown[] = unknown[], TReturn = unknown> = (...args: TArgs) => TReturn;

export type AsyncFunctionType<TArgs extends unknown[] = unknown[], TReturn = unknown> = (...args: TArgs) => Promise<TReturn>;

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface DatabaseConfig {
  dailyTokenLimit: number;
  warningThreshold: number;
  criticalThreshold: number;
  allocationStrategy: number;
  autoResumeEnabled: boolean;
  pauseOnWarning: boolean;
  claudeCodePath: string;
  rateLimitPerMinute: number;
}

export interface UnifiedConfig {
  database: {
    url: string;
  };
  claude: {
    codePath: string;
    dailyTokenLimit: number;
    rateLimitPerMinute: number;
    warningThreshold: number;
    criticalThreshold: number;
    allocationStrategy: number;
    autoResumeEnabled: boolean;
    pauseOnWarning: boolean;
  };
  app: {
    url: string;
    wsUrl: string;
  };
  environment: {
    nodeEnv: string;
    isProduction: boolean;
    isDevelopment: boolean;
  };
}

// ============================================================================
// Logging Types
// ============================================================================

export interface LogContext {
  module?: string;
  function?: string;
  taskId?: string;
  projectId?: string;
  userId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
  data?: unknown;
}

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

// ============================================================================
// Drag and Drop Types
// ============================================================================

export interface DragResult {
  draggableId: string;
  type: string;
  source: {
    droppableId: string;
    index: number;
  };
  destination?: {
    droppableId: string;
    index: number;
  };
  reason: 'DROP' | 'CANCEL';
}

// ============================================================================
// File System Types
// ============================================================================

export interface FileSnapshot {
  path: string;
  content: string;
  timestamp: Date;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: Date;
}

// ============================================================================
// Git Related Types
// ============================================================================

export interface GitCommit {
  hash: string;
  author: string;
  date: Date;
  message: string;
  files: string[];
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  lastCommit?: GitCommit;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
}
