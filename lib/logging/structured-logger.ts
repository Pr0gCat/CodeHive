/**
 * Structured Logging System
 * 結構化日誌系統 - 支援不同日誌級別和環境過濾
 */


export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

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
  data?: Record<string, unknown>;
}

class StructuredLogger {
  private logLevel: LogLevel;
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    // Use process.env directly to avoid circular dependency issues
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // Set log level based on environment
    if (this.isProduction) {
      this.logLevel = LogLevel.INFO; // Only show INFO and above in production
    } else {
      this.logLevel = LogLevel.DEBUG; // Show DEBUG and above in development
    }

    // Override with environment variable if set
    const envLogLevel = process.env.LOG_LEVEL;
    if (envLogLevel) {
      const levelMap: Record<string, LogLevel> = {
        'ERROR': LogLevel.ERROR,
        'WARN': LogLevel.WARN,
        'INFO': LogLevel.INFO,
        'DEBUG': LogLevel.DEBUG,
        'TRACE': LogLevel.TRACE,
      };
      this.logLevel = levelMap[envLogLevel.toUpperCase()] || this.logLevel;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext, error?: Error, data?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    
    let formattedMessage = `[${timestamp}] ${levelName}: ${message}`;
    
    if (context) {
      const contextStr = Object.entries(context)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      if (contextStr) {
        formattedMessage += ` | ${contextStr}`;
      }
    }
    
    if (error) {
      formattedMessage += ` | Error: ${error.message}`;
      if (this.isDevelopment && error.stack) {
        formattedMessage += `\n${error.stack}`;
      }
    }
    
    if (data && this.isDevelopment) {
      formattedMessage += ` | Data: ${JSON.stringify(data, null, 2)}`;
    }
    
    return formattedMessage;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, context, error, data);
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        console.log(formattedMessage);
        break;
    }
  }

  error(message: string, context?: LogContext, error?: Error, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error, data);
  }

  warn(message: string, context?: LogContext, error?: Error, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context, error, data);
  }

  info(message: string, context?: LogContext, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context, undefined, data);
  }

  debug(message: string, context?: LogContext, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context, undefined, data);
  }

  trace(message: string, context?: LogContext, data?: Record<string, unknown>): void {
    this.log(LogLevel.TRACE, message, context, undefined, data);
  }

  // Convenience methods for common logging patterns
  taskStart(taskId: string, taskType: string, context?: LogContext): void {
    this.info(`🚀 Task started: ${taskType}`, { ...context, taskId, taskType });
  }

  taskComplete(taskId: string, taskType: string, duration?: number, context?: LogContext): void {
    const message = `✅ Task completed: ${taskType}`;
    const data = duration ? { duration: `${duration}ms` } : undefined;
    this.info(message, { ...context, taskId, taskType }, data);
  }

  taskError(taskId: string, taskType: string, error: Error, context?: LogContext): void {
    this.error(`❌ Task failed: ${taskType}`, { ...context, taskId, taskType }, error);
  }

  phaseStart(phase: string, taskId?: string, context?: LogContext): void {
    this.info(`🔄 Phase started: ${phase}`, { ...context, taskId, phase });
  }

  phaseComplete(phase: string, taskId?: string, context?: LogContext): void {
    this.info(`✅ Phase completed: ${phase}`, { ...context, taskId, phase });
  }

  agentAction(agentType: string, action: string, taskId?: string, context?: LogContext): void {
    this.info(`🤖 ${agentType}: ${action}`, { ...context, taskId, agentType, action });
  }

  socketEvent(event: string, socketId?: string, taskId?: string, context?: LogContext): void {
    this.debug(`🔌 Socket: ${event}`, { ...context, socketId, taskId, event });
  }

  configLoad(module: string, context?: LogContext): void {
    this.debug(`⚙️ Config loaded: ${module}`, { ...context, module });
  }

  databaseQuery(operation: string, table: string, context?: LogContext): void {
    this.trace(`🗄️ DB: ${operation} on ${table}`, { ...context, operation, table });
  }

  // Performance logging
  performance(operation: string, duration: number, context?: LogContext): void {
    if (duration > 1000) {
      this.warn(`⏱️ Slow operation: ${operation} took ${duration}ms`, { ...context, operation, duration });
    } else {
      this.debug(`⏱️ Operation: ${operation} took ${duration}ms`, { ...context, operation, duration });
    }
  }

  // Security logging
  security(event: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', context?: LogContext): void {
    const level = severity === 'CRITICAL' ? LogLevel.ERROR : 
                  severity === 'HIGH' ? LogLevel.WARN : LogLevel.INFO;
    this.log(level, `🔒 Security: ${event}`, { ...context, securityEvent: event, severity });
  }

  // Rate limiting logging
  rateLimit(service: string, limit: number, current: number, context?: LogContext): void {
    const percentage = (current / limit) * 100;
    if (percentage > 90) {
      this.warn(`🚫 Rate limit warning: ${service} at ${percentage.toFixed(1)}%`, 
                { ...context, service, limit, current, percentage });
    } else {
      this.debug(`🚫 Rate limit: ${service} at ${percentage.toFixed(1)}%`, 
                 { ...context, service, limit, current, percentage });
    }
  }
}

// Create singleton instance
export const logger = new StructuredLogger();

// Export convenience functions
export const logError = (message: string, context?: LogContext, error?: Error, data?: Record<string, unknown>) => 
  logger.error(message, context, error, data);

export const logWarn = (message: string, context?: LogContext, error?: Error, data?: Record<string, unknown>) => 
  logger.warn(message, context, error, data);

export const logInfo = (message: string, context?: LogContext, data?: Record<string, unknown>) => 
  logger.info(message, context, data);

export const logDebug = (message: string, context?: LogContext, data?: Record<string, unknown>) => 
  logger.debug(message, context, data);

export const logTrace = (message: string, context?: LogContext, data?: Record<string, unknown>) => 
  logger.trace(message, context, data);

// Export for backward compatibility
export default logger; 