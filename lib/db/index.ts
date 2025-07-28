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
  GlobalSettings,
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

export type ProjectStatusType = (typeof ProjectStatus)[keyof typeof ProjectStatus];
export type CardStatusType = (typeof CardStatus)[keyof typeof CardStatus];
export type TaskStatusType = (typeof TaskStatus)[keyof typeof TaskStatus];
export type MilestoneStatusType = (typeof MilestoneStatus)[keyof typeof MilestoneStatus];
export type TaskPriorityType = (typeof TaskPriority)[keyof typeof TaskPriority];
export type CodeAnalysisDepthType = (typeof CodeAnalysisDepth)[keyof typeof CodeAnalysisDepth];