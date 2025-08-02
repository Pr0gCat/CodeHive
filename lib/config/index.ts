/**
 * Unified Configuration System - Main Entry Point
 * 統一配置系統 - 主要入口點
 */

// Re-export unified configuration system
export type { UnifiedConfig } from './unified-config';
export {
    defaultConfig, getSyncConfig, getUnifiedConfig, validateUnifiedConfig
} from './unified-config';

// Re-export database configuration for backward compatibility
export {
    configCache,
    getDatabaseConfig,
    updateDatabaseConfig
} from './database-config';
export type { DatabaseConfig } from './database-config';

// Legacy interface for backward compatibility
export interface Config {
  // Database
  databaseUrl: string;

  // Claude Code
  claudeCodePath: string;
  claudeDailyTokenLimit: number;
  claudeRateLimitPerMinute: number;

  // Application
  appUrl: string;
  wsUrl: string;
  nodeEnv: string;

  // Runtime
  isProduction: boolean;
  isDevelopment: boolean;
}

// Legacy fallback config for backward compatibility
export const fallbackConfig: Config = {
  databaseUrl: 'file:./prisma/codehive.db',
  claudeCodePath: 'claude',
  claudeDailyTokenLimit: 100000000,
  claudeRateLimitPerMinute: 50,
  appUrl: 'http://localhost:3000',
  wsUrl: 'ws://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
};

// Legacy getConfig function for backward compatibility
export async function getConfig(): Promise<Config> {
  const { getUnifiedConfig } = await import('./unified-config');
  const unifiedConfig = await getUnifiedConfig();
  
  return {
    databaseUrl: unifiedConfig.database.url,
    claudeCodePath: unifiedConfig.claude.codePath,
    claudeDailyTokenLimit: unifiedConfig.claude.dailyTokenLimit,
    claudeRateLimitPerMinute: unifiedConfig.claude.rateLimitPerMinute,
    appUrl: unifiedConfig.app.url,
    wsUrl: unifiedConfig.app.wsUrl,
    nodeEnv: unifiedConfig.environment.nodeEnv,
    isProduction: unifiedConfig.environment.isProduction,
    isDevelopment: unifiedConfig.environment.isDevelopment,
  };
}

// Legacy validateConfig function for backward compatibility
export function validateConfig(config: Config): void {
  const errors: string[] = [];

  if (!config.databaseUrl) {
    errors.push('Database URL is required');
  }

  if (config.claudeDailyTokenLimit <= 0) {
    errors.push('Claude daily token limit must be positive');
  }

  if (config.claudeRateLimitPerMinute <= 0) {
    errors.push('Claude rate limit per minute must be positive');
  }

  try {
    new URL(config.appUrl);
  } catch {
    errors.push('App URL must be a valid URL');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Export synchronous config for immediate use (legacy compatibility)
import unifiedConfig from './unified-config';

export const config: Config = {
  databaseUrl: unifiedConfig.database.url,
  claudeCodePath: unifiedConfig.claude.codePath,
  claudeDailyTokenLimit: unifiedConfig.claude.dailyTokenLimit,
  claudeRateLimitPerMinute: unifiedConfig.claude.rateLimitPerMinute,
  appUrl: unifiedConfig.app.url,
  wsUrl: unifiedConfig.app.wsUrl,
  nodeEnv: unifiedConfig.environment.nodeEnv,
  isProduction: unifiedConfig.environment.isProduction,
  isDevelopment: unifiedConfig.environment.isDevelopment,
};

