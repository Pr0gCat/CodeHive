import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Export types from Prisma Client
export type {
  ProjectIndex,
  GlobalSettings,
  TokenUsage,
  ProjectBudget,
  TaskExecution,
  TaskPhase,
  TaskEvent,
  Epic,
  Story,
  Task,
  Instruction,
  EpicDependency,
  TaskDependency,
  InstructionDependency
} from '@prisma/client';

// Re-export hierarchy manager and types
export { HierarchyManager } from './models/hierarchy-manager';
export * from './models/types';