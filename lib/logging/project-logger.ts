import { EventEmitter } from 'events';
import { prisma } from '@/lib/db';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
  projectId: string;
  metadata?: Record<string, any>;
}

export type LogLevel = LogEntry['level'];

class ProjectLogger extends EventEmitter {
  private logs: Map<string, LogEntry[]> = new Map(); // In-memory cache for real-time updates
  private maxLogsPerProject = 1000;
  private maxCachePerProject = 100; // Limit cache size

  // Log methods for different levels
  info(
    projectId: string,
    source: string,
    message: string,
    metadata?: Record<string, any>
  ) {
    this.log('info', projectId, source, message, metadata);
  }

  warn(
    projectId: string,
    source: string,
    message: string,
    metadata?: Record<string, any>
  ) {
    this.log('warn', projectId, source, message, metadata);
  }

  error(
    projectId: string,
    source: string,
    message: string,
    metadata?: Record<string, any>
  ) {
    this.log('error', projectId, source, message, metadata);
  }

  debug(
    projectId: string,
    source: string,
    message: string,
    metadata?: Record<string, any>
  ) {
    this.log('debug', projectId, source, message, metadata);
  }

  private async log(
    level: LogLevel,
    projectId: string,
    source: string,
    message: string,
    metadata?: Record<string, any>
  ) {
    const logEntry: LogEntry = {
      id: `${projectId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      source,
      projectId,
      metadata,
    };

    // Store in database for persistence
    try {
      await prisma.projectLog.create({
        data: {
          projectId,
          level,
          message,
          source,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    } catch (error) {
      console.error('Failed to save log to database:', error);
    }

    // Store log in memory cache for real-time updates
    if (!this.logs.has(projectId)) {
      this.logs.set(projectId, []);
    }

    const projectLogs = this.logs.get(projectId)!;
    projectLogs.push(logEntry);

    // Keep only the most recent logs in cache to prevent memory issues
    if (projectLogs.length > this.maxCachePerProject) {
      projectLogs.shift();
    }

    // Emit event for real-time updates
    this.emit('log', logEntry);
    this.emit(`log:${projectId}`, logEntry);

    // Also log to console for development
    const timestamp = logEntry.timestamp.toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()} [${source}] ${message}`;

    switch (level) {
      case 'error':
        console.error(logMessage, metadata || '');
        break;
      case 'warn':
        console.warn(logMessage, metadata || '');
        break;
      case 'debug':
        console.debug(logMessage, metadata || '');
        break;
      default:
        console.log(logMessage, metadata || '');
    }
  }

  // Get logs for a specific project from database
  async getProjectLogs(projectId: string, limit?: number): Promise<LogEntry[]> {
    try {
      const dbLogs = await prisma.projectLog.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: limit || this.maxLogsPerProject,
      });

      return dbLogs.map(log => ({
        id: log.id,
        timestamp: log.createdAt,
        level: log.level as LogLevel,
        message: log.message,
        source: log.source,
        projectId: log.projectId,
        metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
      }));
    } catch (error) {
      console.error('Failed to fetch logs from database:', error);
      // Fallback to in-memory cache
      const logs = this.logs.get(projectId) || [];
      if (limit) {
        return logs.slice(-limit);
      }
      return [...logs];
    }
  }

  // Synchronous method for backward compatibility (uses cache only)
  getProjectLogsSync(projectId: string, limit?: number): LogEntry[] {
    const logs = this.logs.get(projectId) || [];
    if (limit) {
      return logs.slice(-limit);
    }
    return [...logs];
  }

  // Clear logs for a project
  async clearProjectLogs(projectId: string) {
    try {
      // Clear from database
      await prisma.projectLog.deleteMany({
        where: { projectId },
      });
    } catch (error) {
      console.error('Failed to clear logs from database:', error);
    }

    // Clear from memory cache
    this.logs.delete(projectId);
    this.emit(`clear:${projectId}`);
  }

  // Get all projects with logs
  getProjectsWithLogs(): string[] {
    return Array.from(this.logs.keys());
  }
}

// Global logger instance
export const projectLogger = new ProjectLogger();

// Convenience functions for common logging patterns
export const logProjectEvent = {
  // Project lifecycle
  projectCreated: (projectId: string, projectName: string) => {
    projectLogger.info(
      projectId,
      'project-manager',
      `Project "${projectName}" created successfully`,
      {
        action: 'create',
        projectName,
      }
    );
  },

  projectImported: (projectId: string, gitUrl: string) => {
    projectLogger.info(
      projectId,
      'project-manager',
      `Project imported from ${gitUrl}`,
      {
        action: 'import',
        gitUrl,
      }
    );
  },

  projectDeleted: (projectId: string, projectName: string) => {
    projectLogger.warn(
      projectId,
      'project-manager',
      `Project "${projectName}" removed from database`,
      {
        action: 'delete',
        projectName,
      }
    );
  },

  // Agent operations
  agentTaskStarted: (
    projectId: string,
    agentType: string,
    taskId: string,
    description: string
  ) => {
    projectLogger.info(
      projectId,
      'agent-executor',
      `${agentType} agent started: ${description}`,
      {
        action: 'agent_start',
        agentType,
        taskId,
        description,
      }
    );
  },

  agentTaskCompleted: (
    projectId: string,
    agentType: string,
    taskId: string,
    duration: number
  ) => {
    projectLogger.info(
      projectId,
      'agent-executor',
      `${agentType} agent completed task in ${duration}ms`,
      {
        action: 'agent_complete',
        agentType,
        taskId,
        duration,
      }
    );
  },

  agentTaskFailed: (
    projectId: string,
    agentType: string,
    taskId: string,
    error: string
  ) => {
    projectLogger.error(
      projectId,
      'agent-executor',
      `${agentType} agent failed: ${error}`,
      {
        action: 'agent_error',
        agentType,
        taskId,
        error,
      }
    );
  },

  // API operations
  apiRequest: (
    projectId: string,
    method: string,
    endpoint: string,
    statusCode: number
  ) => {
    const level =
      statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
    projectLogger[level](
      projectId,
      'api',
      `${method} ${endpoint} - ${statusCode}`,
      {
        method,
        endpoint,
        statusCode,
      }
    );
  },

  // Database operations
  dbOperation: (
    projectId: string,
    operation: string,
    table: string,
    recordId?: string
  ) => {
    projectLogger.debug(
      projectId,
      'database',
      `${operation} operation on ${table}${recordId ? ` (${recordId})` : ''}`,
      {
        operation,
        table,
        recordId,
      }
    );
  },

  // File operations
  fileOperation: (projectId: string, operation: string, filepath: string) => {
    projectLogger.debug(projectId, 'file-system', `${operation}: ${filepath}`, {
      operation,
      filepath,
    });
  },

  // Git operations
  gitOperation: (projectId: string, operation: string, details: string) => {
    projectLogger.info(
      projectId,
      'git-operations',
      `Git ${operation}: ${details}`,
      {
        operation,
        details,
      }
    );
  },

  // Build & test operations
  buildStarted: (projectId: string, buildTool: string) => {
    projectLogger.info(
      projectId,
      'build-system',
      `Build started using ${buildTool}`,
      {
        buildTool,
        action: 'build_start',
      }
    );
  },

  buildCompleted: (projectId: string, buildTool: string, duration: number) => {
    projectLogger.info(
      projectId,
      'build-system',
      `Build completed successfully in ${duration}ms`,
      {
        buildTool,
        duration,
        action: 'build_complete',
      }
    );
  },

  buildFailed: (projectId: string, buildTool: string, error: string) => {
    projectLogger.error(projectId, 'build-system', `Build failed: ${error}`, {
      buildTool,
      error,
      action: 'build_error',
    });
  },

  testRun: (
    projectId: string,
    testFramework: string,
    passed: number,
    failed: number,
    duration: number
  ) => {
    const level = failed > 0 ? 'warn' : 'info';
    projectLogger[level](
      projectId,
      'test-runner',
      `Tests completed: ${passed} passed, ${failed} failed (${duration}ms)`,
      {
        testFramework,
        passed,
        failed,
        duration,
        action: 'test_complete',
      }
    );
  },
};
