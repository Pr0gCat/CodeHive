// Socket.IO event types and data structures

export interface TaskEventData {
  phaseId?: string;
  progress?: number;
  message?: string;
  result?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
}

export interface TaskEvent {
  type: string;
  taskId: string;
  timestamp: string;
  data: TaskEventData;
}

export interface TaskExecutionStatus {
  taskId: string;
  type: string;
  status: string;
  progress: number;
  currentPhase: string | null;
  totalPhases: number;
  projectId?: string | null;
  projectName?: string | null;
  initiatedBy?: string | null;
  startedAt?: Date | null;
  lastUpdatedAt: Date;
  completedAt?: Date | null;
  result?: string | null;
  error?: string | null;
  createdAt: Date;
}

export interface TaskPhaseStatus {
  taskId: string;
  phaseId: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  order: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  duration?: number | null;
  details?: string | null;
  metrics?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskStatus {
  taskId: string;
  task: TaskExecutionStatus;
}

export interface PhaseStatus {
  taskId: string;
  phase: TaskPhaseStatus;
}

export interface TaskSubscriptionData {
  taskId: string;
}

export interface TaskCompletedData {
  taskId: string;
  result?: Record<string, unknown>;
}

export interface TaskErrorData {
  taskId: string;
  error: string;
}

export interface PhaseProgressData {
  taskId: string;
  phaseId: string;
  progress: number;
}

export interface PhaseStartData {
  taskId: string;
  phaseId: string;
}

export interface PhaseCompleteData {
  taskId: string;
  phaseId: string;
}

export interface SocketError {
  message: string;
  type?: string;
  code?: string;
}

export interface SocketState {
  connected: boolean;
  error: string | null;
  events: TaskEvent[];
}

// Phase data for UI
export interface UIPhase {
  id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  details: unknown[];
}