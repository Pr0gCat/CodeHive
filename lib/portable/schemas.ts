/**
 * JSON schemas for portable CodeHive project metadata
 * These schemas define the structure of data stored in .codehive/ directories
 */

import { z } from 'zod';

// Core project metadata schema
export const ProjectMetadataSchema = z.object({
  version: z.string().default('1.0.0'),
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  summary: z.string().optional(),
  gitUrl: z.string().optional(),
  localPath: z.string(),
  status: z.string().default('ACTIVE'),
  framework: z.string().optional(),
  language: z.string().optional(),
  packageManager: z.string().optional(),
  testFramework: z.string().optional(),
  lintTool: z.string().optional(),
  buildTool: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Project settings schema - Simplified to essentials only
export const ProjectSettingsSchema = z.object({
  // AI Model Settings
  claudeModel: z.string().default('claude-3-5-sonnet-20241022'),
  maxTokensPerRequest: z.number().default(4000),
  
  // Rate Limiting
  maxRequestsPerMinute: z.number().default(20),
  
  // Execution Settings
  agentTimeout: z.number().default(300000), // 5 minutes
  maxRetries: z.number().default(3),
  autoExecuteTasks: z.boolean().default(true),
  
  // Code Quality
  testCoverageThreshold: z.number().default(80),
  enforceTypeChecking: z.boolean().default(true),
  
  // Optional Advanced Settings
  customInstructions: z.string().optional(),
  excludePatterns: z.string().optional(),
});

// Epic schema
export const EpicSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  type: z.string().default('FEATURE'),
  phase: z.string().default('PLANNING'),
  status: z.string().default('ACTIVE'),
  mvpPriority: z.string().default('MEDIUM'),
  coreValue: z.string().optional(),
  sequence: z.number().default(0),
  estimatedStoryPoints: z.number().default(0),
  actualStoryPoints: z.number().default(0),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable().optional(),
  dependencies: z.array(z.string()).default([]),
  dependents: z.array(z.string()).default([]),
});

// Story/Kanban Card schema
export const StorySchema = z.object({
  id: z.string(),
  epicId: z.string().optional(),
  sprintId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string().default('BACKLOG'),
  position: z.number(),
  assignedAgent: z.string().optional(),
  targetBranch: z.string().optional(),
  storyPoints: z.number().optional(),
  priority: z.string().default('MEDIUM'),
  sequence: z.number().default(0),
  tddEnabled: z.boolean().default(false),
  acceptanceCriteria: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dependencies: z.array(z.string()).default([]),
  dependents: z.array(z.string()).default([]),
});

// Sprint schema
export const SprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  goal: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  duration: z.number(),
  status: z.string().default('PLANNING'),
  plannedStoryPoints: z.number().default(0),
  commitedStoryPoints: z.number().default(0),
  completedStoryPoints: z.number().default(0),
  velocity: z.number().optional(),
  planningNotes: z.string().optional(),
  reviewNotes: z.string().optional(),
  retrospectiveNotes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  storyIds: z.array(z.string()).default([]),
  epicIds: z.array(z.string()).default([]),
});

// Agent specification schema
export const AgentSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  purpose: z.string(),
  capabilities: z.string(),
  dependencies: z.string(),
  prompt: z.string(),
  constraints: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().default('project-manager-agent'),
  performance: z.array(z.object({
    id: z.string(),
    executionTime: z.number(),
    tokensUsed: z.number(),
    success: z.boolean(),
    errorMessage: z.string().optional(),
    taskComplexity: z.string().optional(),
    timestamp: z.string(),
  })).default([]),
  evolution: z.array(z.object({
    id: z.string(),
    version: z.number(),
    changes: z.string(),
    performanceBefore: z.string(),
    performanceAfter: z.string().optional(),
    reason: z.string(),
    timestamp: z.string(),
  })).default([]),
});

// TDD Cycle schema
export const CycleSchema = z.object({
  id: z.string(),
  storyId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  phase: z.string().default('RED'),
  status: z.string().default('ACTIVE'),
  sequence: z.number().default(0),
  acceptanceCriteria: z.string(),
  constraints: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  tests: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    code: z.string(),
    filePath: z.string().optional(),
    status: z.string().default('FAILING'),
    lastRun: z.string().optional(),
    duration: z.number().optional(),
    errorOutput: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })).default([]),
  artifacts: z.array(z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    path: z.string(),
    content: z.string(),
    purpose: z.string().optional(),
    phase: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })).default([]),
  queries: z.array(z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    question: z.string(),
    context: z.string(),
    urgency: z.string().default('ADVISORY'),
    priority: z.string().default('MEDIUM'),
    status: z.string().default('PENDING'),
    answer: z.string().optional(),
    answeredAt: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    comments: z.array(z.object({
      id: z.string(),
      content: z.string(),
      author: z.string().default('user'),
      createdAt: z.string(),
    })).default([]),
  })).default([]),
});

// Token usage tracking schema
export const TokenUsageSchema = z.object({
  id: z.string(),
  agentType: z.string(),
  taskId: z.string().optional(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  timestamp: z.string(),
});

// Global settings schema
export const GlobalSettingsSchema = z.object({
  id: z.string().default('global'),
  dailyTokenLimit: z.number().default(100000000), // 100M tokens
  warningThreshold: z.number().default(0.75), // 75%
  criticalThreshold: z.number().default(0.9), // 90%
  allocationStrategy: z.number().default(0.5), // 50% mix
  autoResumeEnabled: z.boolean().default(true),
  pauseOnWarning: z.boolean().default(false),
  claudeCodePath: z.string().default('claude'),
  rateLimitPerMinute: z.number().default(50),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Project budget schema
export const ProjectBudgetSchema = z.object({
  allocatedPercentage: z.number().default(0.0),
  dailyTokenBudget: z.number().default(0),
  usedTokens: z.number().default(0),
  lastResetAt: z.string(),
  warningNotified: z.boolean().default(false),
  criticalNotified: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Portable project data structure
export const PortableProjectSchema = z.object({
  metadata: ProjectMetadataSchema,
  settings: ProjectSettingsSchema,
  budget: ProjectBudgetSchema.optional(),
  epics: z.array(EpicSchema).default([]),
  stories: z.array(StorySchema).default([]),
  sprints: z.array(SprintSchema).default([]),
  agents: z.array(AgentSpecSchema).default([]),
  cycles: z.array(CycleSchema).default([]),
  tokenUsage: z.array(TokenUsageSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Type exports
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>;
export type Epic = z.infer<typeof EpicSchema>;
export type Story = z.infer<typeof StorySchema>;
export type Sprint = z.infer<typeof SprintSchema>;
export type AgentSpec = z.infer<typeof AgentSpecSchema>;
export type Cycle = z.infer<typeof CycleSchema>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export type ProjectBudget = z.infer<typeof ProjectBudgetSchema>;
export type PortableProject = z.infer<typeof PortableProjectSchema>;