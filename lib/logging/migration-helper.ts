/**
 * Logging Migration Helper
 * 日誌遷移工具 - 幫助識別和替換console.log語句
 */

import { LogContext } from './structured-logger';

/**
 * Migration patterns for common console.log usage
 */
export const migrationPatterns = {
  // Server startup and shutdown
  serverStart: {
    pattern: /console\.log\(['"`]Server|Ready on|Socket\.IO server initialized/,
    replacement: (match: string, context?: LogContext) => {
      if (match.includes('Ready on')) {
        return `logger.info('Server ready', { module: 'server' })`;
      }
      if (match.includes('Socket.IO server initialized')) {
        return `logger.info('Socket.IO server initialized', { module: 'socket' })`;
      }
      return `logger.info('Server started', { module: 'server' })`;
    }
  },

  // Task and agent operations
  taskOperations: {
    pattern: /console\.log\(['"`].*Task|Agent|🤖|🚀|✅|❌/,
    replacement: (match: string, context?: LogContext) => {
      if (match.includes('Task started') || match.includes('🚀')) {
        return `logger.taskStart(taskId, '${extractTaskType(match)}', { module: 'task-manager' })`;
      }
      if (match.includes('Task completed') || match.includes('✅')) {
        return `logger.taskComplete(taskId, '${extractTaskType(match)}', undefined, { module: 'task-manager' })`;
      }
      if (match.includes('Task failed') || match.includes('❌')) {
        return `logger.taskError(taskId, '${extractTaskType(match)}', error, { module: 'task-manager' })`;
      }
      if (match.includes('🤖')) {
        return `logger.agentAction('${extractAgentType(match)}', '${extractAction(match)}', taskId, { module: 'agents' })`;
      }
      return `logger.info('${extractMessage(match)}', { module: 'task-manager' })`;
    }
  },

  // Socket operations
  socketOperations: {
    pattern: /console\.log\(['"`].*Socket|🔌|🔗/,
    replacement: (match: string, context?: LogContext) => {
      if (match.includes('connected') || match.includes('🔗')) {
        return `logger.socketEvent('connected', socketId, taskId, { module: 'socket' })`;
      }
      if (match.includes('disconnected') || match.includes('🔌')) {
        return `logger.socketEvent('disconnected', socketId, taskId, { module: 'socket' })`;
      }
      return `logger.socketEvent('${extractEvent(match)}', socketId, taskId, { module: 'socket' })`;
    }
  },

  // Phase operations
  phaseOperations: {
    pattern: /console\.log\(['"`].*Phase|🔄|👁️/,
    replacement: (match: string, context?: LogContext) => {
      if (match.includes('Phase started') || match.includes('🔄')) {
        return `logger.phaseStart('${extractPhase(match)}', taskId, { module: 'tdd' })`;
      }
      if (match.includes('Phase completed') || match.includes('✅')) {
        return `logger.phaseComplete('${extractPhase(match)}', taskId, { module: 'tdd' })`;
      }
      return `logger.info('${extractMessage(match)}', { module: 'tdd' })`;
    }
  },

  // Configuration and setup
  configOperations: {
    pattern: /console\.log\(['"`].*Config|⚙️/,
    replacement: (match: string, context?: LogContext) => {
      return `logger.configLoad('${extractModule(match)}', { module: 'config' })`;
    }
  },

  // Development logs (should be debug level)
  developmentLogs: {
    pattern: /console\.log\(['"`].*Development|Debug|Trace/,
    replacement: (match: string, context?: LogContext) => {
      return `logger.debug('${extractMessage(match)}', { module: 'development' })`;
    }
  },

  // Generic info logs
  infoLogs: {
    pattern: /console\.log\(['"`].*Info|📋|📈/,
    replacement: (match: string, context?: LogContext) => {
      return `logger.info('${extractMessage(match)}', { module: 'general' })`;
    }
  }
};

/**
 * Helper functions to extract information from log messages
 */
function extractTaskType(message: string): string {
  const match = message.match(/Task.*?(\w+)/);
  return match ? match[1] : 'unknown';
}

function extractAgentType(message: string): string {
  const match = message.match(/🤖\s*(\w+)/);
  return match ? match[1] : 'unknown';
}

function extractAction(message: string): string {
  const match = message.match(/:\s*(.+?)(?:'|"|`|$)/);
  return match ? match[1].trim() : 'action';
}

function extractEvent(message: string): string {
  const match = message.match(/Socket.*?(\w+)/);
  return match ? match[1] : 'event';
}

function extractPhase(message: string): string {
  const match = message.match(/Phase.*?(\w+)/);
  return match ? match[1] : 'unknown';
}

function extractModule(message: string): string {
  const match = message.match(/Config.*?(\w+)/);
  return match ? match[1] : 'config';
}

function extractMessage(message: string): string {
  const match = message.match(/['"`](.+?)['"`]/);
  return match ? match[1] : 'message';
}

/**
 * Migration helper functions
 */
export class LogMigrationHelper {
  /**
   * Analyze a file for console.log usage and suggest replacements
   */
  static analyzeFile(filePath: string, content: string): {
    totalLogs: number;
    suggestions: Array<{
      line: number;
      original: string;
      suggested: string;
      pattern: string;
    }>;
  } {
    const lines = content.split('\n');
    const suggestions: Array<{
      line: number;
      original: string;
      suggested: string;
      pattern: string;
    }> = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // Check for console.log
      if (line.includes('console.log(')) {
        const original = line.trim();
        
        // Try to match with patterns
        for (const [patternName, pattern] of Object.entries(migrationPatterns)) {
          if (pattern.pattern.test(original)) {
            const suggested = pattern.replacement(original);
            suggestions.push({
              line: lineNumber,
              original,
              suggested,
              pattern: patternName
            });
            break;
          }
        }
        
        // If no pattern matches, suggest generic replacement
        if (!suggestions.some(s => s.line === lineNumber)) {
          suggestions.push({
            line: lineNumber,
            original,
            suggested: `logger.info('${extractMessage(original)}', { module: '${LogMigrationHelper.extractModuleFromPath(filePath)}' })`,
            pattern: 'generic'
          });
        }
      }
    });

    return {
      totalLogs: suggestions.length,
      suggestions
    };
  }

  /**
   * Generate migration report for multiple files
   */
  static generateReport(fileAnalyses: Array<{
    filePath: string;
    analysis: ReturnType<typeof LogMigrationHelper.analyzeFile>;
  }>): string {
    let report = '# Logging Migration Report\n\n';
    
    const totalFiles = fileAnalyses.length;
    const totalLogs = fileAnalyses.reduce((sum, { analysis }) => sum + analysis.totalLogs, 0);
    
    report += `## Summary\n`;
    report += `- Files analyzed: ${totalFiles}\n`;
    report += `- Total console.log statements: ${totalLogs}\n`;
    report += `- Migration patterns available: ${Object.keys(migrationPatterns).length}\n\n`;
    
    report += `## File Details\n\n`;
    
    fileAnalyses.forEach(({ filePath, analysis }) => {
      if (analysis.totalLogs > 0) {
        report += `### ${filePath}\n`;
        report += `- Console.log statements: ${analysis.totalLogs}\n`;
        report += `- Suggested replacements:\n\n`;
        
        analysis.suggestions.forEach(({ line, original, suggested, pattern }) => {
          report += `**Line ${line}** (${pattern}):\n`;
          report += `\`\`\`typescript\n`;
          report += `// Original:\n${original}\n`;
          report += `// Suggested:\n${suggested}\n`;
          report += `\`\`\`\n\n`;
        });
      }
    });
    
    return report;
  }

  /**
   * Extract module name from file path
   */
  static extractModuleFromPath(filePath: string): string {
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const moduleName = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');
    
    // Map common file patterns to module names
    const moduleMap: Record<string, string> = {
      'server': 'server',
      'route': 'api',
      'socket': 'socket',
      'agent': 'agents',
      'task': 'tasks',
      'config': 'config',
      'logger': 'logging',
      'db': 'database',
      'prisma': 'database',
      'tdd': 'tdd',
      'cycle': 'tdd',
      'project': 'projects',
      'epic': 'epics',
      'story': 'stories',
      'sprint': 'sprints',
    };
    
    for (const [key, value] of Object.entries(moduleMap)) {
      if (fileName.includes(key)) {
        return value;
      }
    }
    
    return moduleName;
  }
}

// Export for use in migration scripts
export default LogMigrationHelper; 