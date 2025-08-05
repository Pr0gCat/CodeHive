import { z } from 'zod';

export const globalSettingsSchema = z.object({
  dailyTokenLimit: z.number().min(1000, 'Daily token limit must be at least 1,000').max(1000000000, 'Daily token limit cannot exceed 1 billion'),
  warningThreshold: z.number().min(0.1, 'Warning threshold must be at least 10%').max(0.95, 'Warning threshold cannot exceed 95%'),
  criticalThreshold: z.number().min(0.1, 'Critical threshold must be at least 10%').max(1.0, 'Critical threshold cannot exceed 100%'),
  allocationStrategy: z.number().min(0, 'Allocation strategy must be between 0 and 1').max(1, 'Allocation strategy must be between 0 and 1'),
  autoResumeEnabled: z.boolean(),
  pauseOnWarning: z.boolean(),
  claudeCodePath: z.string().min(1, 'Claude Code path cannot be empty').max(500, 'Claude Code path is too long'),
  rateLimitPerMinute: z.number().min(1, 'Rate limit must be at least 1 request per minute').max(1000, 'Rate limit cannot exceed 1000 requests per minute'),
}).refine(
  (data) => data.warningThreshold < data.criticalThreshold,
  {
    message: 'Warning threshold must be less than critical threshold',
    path: ['warningThreshold'],
  }
);

export type GlobalSettingsInput = z.infer<typeof globalSettingsSchema>;

// Validation schema for project-specific settings
export const projectSettingsSchema = z.object({
  id: z.string().uuid('Invalid project ID format'),
  name: z.string().min(1, 'Project name cannot be empty').max(200, 'Project name is too long'),
  description: z.string().max(1000, 'Project description is too long').optional(),
  dailyTokenBudget: z.number().min(100, 'Daily token budget must be at least 100').max(100000000, 'Daily token budget cannot exceed 100 million'),
  allocatedPercentage: z.number().min(0.01, 'Allocated percentage must be at least 1%').max(1.0, 'Allocated percentage cannot exceed 100%'),
  priorityLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  autoManagement: z.boolean(),
  notificationsEnabled: z.boolean(),
  developmentPhase: z.enum(['PLANNING', 'DEVELOPMENT', 'TESTING', 'DEPLOYMENT', 'MAINTENANCE']).optional(),
});

export type ProjectSettingsInput = z.infer<typeof projectSettingsSchema>;

// Validation schema for usage tracking
export const usageTrackingSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
  tokensUsed: z.number().min(0, 'Tokens used cannot be negative'),
  operationType: z.enum(['TDD_CYCLE', 'CODE_REVIEW', 'DOCUMENTATION', 'ANALYSIS', 'QUERY_RESPONSE']),
  timestamp: z.date().default(() => new Date()),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type UsageTrackingInput = z.infer<typeof usageTrackingSchema>;

// Common validation rules
export const commonValidations = {
  projectId: z.string().uuid('Invalid project ID format'),
  tokenAmount: z.number().min(0, 'Token amount cannot be negative'),
  percentage: z.number().min(0, 'Percentage cannot be negative').max(1, 'Percentage cannot exceed 100%'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  phase: z.enum(['RED', 'GREEN', 'REFACTOR', 'REVIEW', 'COMPLETED']),
} as const;