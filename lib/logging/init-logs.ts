import { logProjectEvent, projectLogger } from './project-logger';

// Initialize some sample logs for demonstration when the application starts
export function initializeSampleLogs() {
  // This would normally be called when the application starts
  // For now, we'll add it as a utility that can be called

  setTimeout(() => {
    projectLogger.info(
      'system',
      'application',
      'CodeHive application started',
      {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      }
    );

    projectLogger.info(
      'system',
      'database',
      'Database connection established',
      {
        provider: 'sqlite',
        status: 'connected',
      }
    );

    // API routes initialized - logged to console only, not stored in project logs
  }, 1000);
}

// Helper to add initial project logs when a project is accessed
export function addInitialProjectLogs(projectId: string, projectName: string) {
  // Add some initial context logs for the project
  projectLogger.info(
    projectId,
    'project-manager',
    `Project "${projectName}" accessed`,
    {
      timestamp: new Date().toISOString(),
      action: 'access',
    }
  );

  projectLogger.debug(
    projectId,
    'file-system',
    `Scanning project directory structure`,
    {
      projectId,
      action: 'scan',
    }
  );

  // Project API endpoints activated - not logged to avoid clutter
}
