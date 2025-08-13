/**
 * 階層化結構模型的 TypeScript 類型定義
 */

import type { 
  Epic as PrismaEpic,
  Story as PrismaStory,
  Task as PrismaTask,
  Instruction as PrismaInstruction,
  EpicDependency,
  TaskDependency,
  InstructionDependency
} from '@prisma/client';

// ===== 狀態枚舉 =====

export enum ModelStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum Priority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  URGENT = 3
}

export enum TaskType {
  DEV = 'DEV',           // 開發任務
  TEST = 'TEST',         // 測試任務
  REVIEW = 'REVIEW',     // 審查任務
  DEPLOY = 'DEPLOY',     // 部署任務
  DOCUMENT = 'DOCUMENT', // 文檔任務
  RESEARCH = 'RESEARCH', // 研究任務
  DESIGN = 'DESIGN',     // 設計任務
  REFACTOR = 'REFACTOR', // 重構任務
  FIX = 'FIX',          // 修復任務
  OTHER = 'OTHER'        // 其他任務
}

export enum DependencyType {
  BLOCKS = 'BLOCKS',           // 阻塞關係
  RELATES_TO = 'RELATES_TO',   // 相關關係
  SEQUENTIAL = 'SEQUENTIAL',   // 順序關係
  PARALLEL = 'PARALLEL'        // 並行關係
}

export enum ProjectPhase {
  REQUIREMENTS = 'REQUIREMENTS',
  MVP = 'MVP',
  CONTINUOUS = 'CONTINUOUS'
}

// ===== 基礎類型 =====

export type Epic = PrismaEpic;
export type Story = PrismaStory;
export type Task = PrismaTask;
export type Instruction = PrismaInstruction;

// ===== 擴展類型（包含關聯） =====

export interface EpicWithRelations extends Epic {
  stories?: StoryWithRelations[];
  dependencies?: EpicDependency[];
  dependents?: EpicDependency[];
}

export interface StoryWithRelations extends Story {
  epic?: Epic;
  tasks?: TaskWithRelations[];
}

export interface TaskWithRelations extends Task {
  story?: Story;
  instructions?: InstructionWithRelations[];
  dependencies?: TaskDependency[];
  dependents?: TaskDependency[];
}

export interface InstructionWithRelations extends Instruction {
  task?: Task;
  dependencies?: InstructionDependency[];
  dependents?: InstructionDependency[];
}

// ===== 創建輸入類型 =====

export interface CreateEpicInput {
  projectId: string;
  title: string;
  description?: string;
  businessValue?: string;
  acceptanceCriteria?: string;
  priority?: number;
  phase?: string;
  estimatedEffort?: number;
  createdBy?: string;
}

export interface CreateStoryInput {
  epicId: string;
  title: string;
  userStory?: string;
  description?: string;
  acceptanceCriteria?: string;
  priority?: number;
  storyPoints?: number;
  iteration?: number;
}

export interface CreateTaskInput {
  storyId: string;
  title: string;
  description?: string;
  type: string;
  acceptanceCriteria?: string;
  expectedOutcome?: string;
  priority?: number;
  estimatedTime?: number;
  assignedAgent?: string;
  maxRetries?: number;
}

export interface CreateInstructionInput {
  taskId: string;
  directive: string;
  expectedOutcome: string;
  validationCriteria?: string;
  sequence: number;
}

// ===== 更新輸入類型 =====

export interface UpdateEpicInput {
  title?: string;
  description?: string;
  businessValue?: string;
  acceptanceCriteria?: string;
  priority?: number;
  status?: string;
  phase?: string;
  estimatedEffort?: number;
  actualEffort?: number;
}

export interface UpdateStoryInput {
  title?: string;
  userStory?: string;
  description?: string;
  acceptanceCriteria?: string;
  priority?: number;
  status?: string;
  storyPoints?: number;
  iteration?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  type?: string;
  acceptanceCriteria?: string;
  expectedOutcome?: string;
  priority?: number;
  status?: string;
  estimatedTime?: number;
  actualTime?: number;
  assignedAgent?: string;
  retryCount?: number;
  validationResult?: string;
}

export interface UpdateInstructionInput {
  directive?: string;
  expectedOutcome?: string;
  validationCriteria?: string;
  sequence?: number;
  status?: string;
  output?: string;
  error?: string;
  tokenUsage?: number;
  executionTime?: number;
  retryCount?: number;
  executedBy?: string;
}

// ===== 依賴關係類型 =====

export interface CreateDependencyInput {
  dependentId: string;
  requiredId: string;
  dependencyType?: string;
}

// ===== 查詢過濾器類型 =====

export interface EpicFilter {
  projectId?: string;
  status?: string | string[];
  priority?: number | number[];
  phase?: string;
  createdBy?: string;
}

export interface StoryFilter {
  epicId?: string;
  status?: string | string[];
  priority?: number | number[];
  iteration?: number;
}

export interface TaskFilter {
  storyId?: string;
  type?: string | string[];
  status?: string | string[];
  priority?: number | number[];
  assignedAgent?: string;
}

export interface InstructionFilter {
  taskId?: string;
  status?: string | string[];
  executedBy?: string;
}

// ===== 統計類型 =====

export interface HierarchyStatistics {
  totalEpics: number;
  totalStories: number;
  totalTasks: number;
  totalInstructions: number;
  completedEpics: number;
  completedStories: number;
  completedTasks: number;
  completedInstructions: number;
  totalTokenUsage: number;
  averageStoryPoints: number;
  averageTaskTime: number;
}

export interface EpicStatistics {
  id: string;
  title: string;
  totalStories: number;
  completedStories: number;
  totalTasks: number;
  completedTasks: number;
  totalTokenUsage: number;
  estimatedEffort: number | null;
  actualEffort: number | null;
  progress: number; // 0-100
}

// ===== 執行結果類型 =====

export interface InstructionExecutionResult {
  instructionId: string;
  success: boolean;
  output?: string;
  error?: string;
  tokenUsage: number;
  executionTime: number;
  timestamp: Date;
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  completedInstructions: number;
  failedInstructions: number;
  totalTokenUsage: number;
  totalExecutionTime: number;
  validationPassed: boolean;
  validationResult?: string;
}

// ===== 進度追蹤類型 =====

export interface HierarchyProgress {
  epicId: string;
  epicProgress: number;
  stories: Array<{
    storyId: string;
    storyProgress: number;
    tasks: Array<{
      taskId: string;
      taskProgress: number;
      completedInstructions: number;
      totalInstructions: number;
    }>;
  }>;
}

// ===== 驗證類型 =====

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ===== 匯出管理器介面 =====

export interface IHierarchyManager {
  // Epic 操作
  createEpic(input: CreateEpicInput): Promise<Epic>;
  updateEpic(id: string, input: UpdateEpicInput): Promise<Epic>;
  deleteEpic(id: string): Promise<boolean>;
  getEpic(id: string, includeRelations?: boolean): Promise<EpicWithRelations | null>;
  listEpics(filter?: EpicFilter): Promise<Epic[]>;
  
  // Story 操作
  createStory(input: CreateStoryInput): Promise<Story>;
  updateStory(id: string, input: UpdateStoryInput): Promise<Story>;
  deleteStory(id: string): Promise<boolean>;
  getStory(id: string, includeRelations?: boolean): Promise<StoryWithRelations | null>;
  listStories(filter?: StoryFilter): Promise<Story[]>;
  
  // Task 操作
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;
  deleteTask(id: string): Promise<boolean>;
  getTask(id: string, includeRelations?: boolean): Promise<TaskWithRelations | null>;
  listTasks(filter?: TaskFilter): Promise<Task[]>;
  
  // Instruction 操作
  createInstruction(input: CreateInstructionInput): Promise<Instruction>;
  updateInstruction(id: string, input: UpdateInstructionInput): Promise<Instruction>;
  deleteInstruction(id: string): Promise<boolean>;
  getInstruction(id: string, includeRelations?: boolean): Promise<InstructionWithRelations | null>;
  listInstructions(filter?: InstructionFilter): Promise<Instruction[]>;
  
  // 依賴關係操作
  createEpicDependency(input: CreateDependencyInput): Promise<EpicDependency>;
  createTaskDependency(input: CreateDependencyInput): Promise<TaskDependency>;
  createInstructionDependency(input: CreateDependencyInput): Promise<InstructionDependency>;
  
  // 統計和進度
  getHierarchyStatistics(projectId: string): Promise<HierarchyStatistics>;
  getEpicStatistics(epicId: string): Promise<EpicStatistics>;
  getHierarchyProgress(epicId: string): Promise<HierarchyProgress>;
  
  // 驗證
  validateHierarchy(epicId: string): Promise<ValidationResult>;
}