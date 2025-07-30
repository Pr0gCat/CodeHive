import { PrismaClient } from '@prisma/client';

// Global instance to prevent multiple connections in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Type exports for use throughout the application
export type {
  Project,
  ProjectSettings,
  KanbanCard,
  AgentTask,
  TokenUsage,
  RoadmapMilestone,
  QueuedTask,
  AgentSpecification,
  AgentPerformance,
  AgentEvolution,
  UsageTracking,
  UsageLimit,
  // AI-Native TDD Models
  Cycle,
  Test,
  Query,
  QueryComment,
  Artifact,
} from '@prisma/client';

// Status type definitions (since SQLite doesn't support enums)
export const ProjectStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;

export const CardStatus = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  REVIEW: 'REVIEW',
  DONE: 'DONE',
} as const;

export const TaskStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  PAUSED: 'PAUSED',
} as const;

export const MilestoneStatus = {
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

export const TaskPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

export const CodeAnalysisDepth = {
  LIGHT: 'LIGHT',
  STANDARD: 'STANDARD',
  DEEP: 'DEEP',
} as const;

// AI-Native TDD Status Constants
export const CyclePhase = {
  RED: 'RED',
  GREEN: 'GREEN',
  REFACTOR: 'REFACTOR',
  REVIEW: 'REVIEW',
} as const;

export const CycleStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export const TestStatus = {
  FAILING: 'FAILING',
  PASSING: 'PASSING',
  SKIPPED: 'SKIPPED',
  BROKEN: 'BROKEN',
} as const;

export const QueryType = {
  ARCHITECTURE: 'ARCHITECTURE',
  BUSINESS_LOGIC: 'BUSINESS_LOGIC',
  UI_UX: 'UI_UX',
  INTEGRATION: 'INTEGRATION',
  CLARIFICATION: 'CLARIFICATION',
} as const;

export const QueryUrgency = {
  BLOCKING: 'BLOCKING',
  ADVISORY: 'ADVISORY',
} as const;

export const QueryStatus = {
  PENDING: 'PENDING',
  ANSWERED: 'ANSWERED',
  DISMISSED: 'DISMISSED',
  EXPIRED: 'EXPIRED',
} as const;

export const ArtifactType = {
  CODE: 'CODE',
  TEST: 'TEST',
  DOCS: 'DOCS',
  SCHEMA: 'SCHEMA',
  CONFIG: 'CONFIG',
} as const;

export type ProjectStatusType = (typeof ProjectStatus)[keyof typeof ProjectStatus];
export type CardStatusType = (typeof CardStatus)[keyof typeof CardStatus];
export type TaskStatusType = (typeof TaskStatus)[keyof typeof TaskStatus];
export type MilestoneStatusType = (typeof MilestoneStatus)[keyof typeof MilestoneStatus];
export type TaskPriorityType = (typeof TaskPriority)[keyof typeof TaskPriority];
export type CodeAnalysisDepthType = (typeof CodeAnalysisDepth)[keyof typeof CodeAnalysisDepth];

// AI-Native TDD Type definitions
export type CyclePhaseType = (typeof CyclePhase)[keyof typeof CyclePhase];
export type CycleStatusType = (typeof CycleStatus)[keyof typeof CycleStatus];
export type TestStatusType = (typeof TestStatus)[keyof typeof TestStatus];
export type QueryTypeType = (typeof QueryType)[keyof typeof QueryType];
export type QueryUrgencyType = (typeof QueryUrgency)[keyof typeof QueryUrgency];
export type QueryStatusType = (typeof QueryStatus)[keyof typeof QueryStatus];
export type ArtifactTypeType = (typeof ArtifactType)[keyof typeof ArtifactType];