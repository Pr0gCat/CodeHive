/**
 * Hybrid configuration system - uses database config first, falls back to env vars
 */

import { formatShortNumber } from '@/lib/utils';
import { configCache } from './database-config';

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

// Static configuration from environment (fallback only)
interface StaticConfig {
  nodeEnv: string;
  isProduction: boolean;
  isDevelopment: boolean;
}

// Static config with sensible defaults (no environment variables required)
const staticConfig: StaticConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
};

/**
 * Get runtime configuration by merging database config with static config
 */
export async function getConfig(): Promise<Config> {
  const dbConfig = await configCache.getConfig();

  return {
    // Database config takes precedence
    databaseUrl: fallbackConfig.databaseUrl,
    claudeCodePath: dbConfig.claudeCodePath,
    claudeDailyTokenLimit: dbConfig.dailyTokenLimit,
    claudeRateLimitPerMinute: dbConfig.rateLimitPerMinute,
    appUrl: fallbackConfig.appUrl,
    wsUrl: fallbackConfig.wsUrl,

    // Static config from environment
    nodeEnv: staticConfig.nodeEnv,
    isProduction: staticConfig.isProduction,
    isDevelopment: staticConfig.isDevelopment,
  };
}

/**
 * Synchronous fallback config with sensible defaults
 * No environment variables required - works out of the box
 */
export const fallbackConfig: Config = {
  // Database - default SQLite file
  databaseUrl: 'file:./prisma/codehive.db',

  // Claude Code - sensible defaults
  claudeCodePath: 'claude',
  claudeDailyTokenLimit: 100000000, // 100M tokens
  claudeRateLimitPerMinute: 50,

  // Application - localhost defaults
  appUrl: 'http://localhost:3000',
  wsUrl: 'ws://localhost:3000',

  // Runtime environment
  nodeEnv: staticConfig.nodeEnv,
  isProduction: staticConfig.isProduction,
  isDevelopment: staticConfig.isDevelopment,
};

/**
 * Validate a configuration object
 */
export function validateConfig(config: Config): void {
  const errors: string[] = [];

  // Check required paths
  if (!config.databaseUrl) {
    errors.push('Database URL is required');
  }

  // Check token limits
  if (config.claudeDailyTokenLimit <= 0) {
    errors.push('Claude daily token limit must be positive');
  }

  if (config.claudeRateLimitPerMinute <= 0) {
    errors.push('Claude rate limit per minute must be positive');
  }

  // Check URLs
  try {
    new URL(config.appUrl);
  } catch {
    errors.push('App URL must be a valid URL');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Validate fallback configuration on module load
validateConfig(fallbackConfig);

// Log configuration in development
if (staticConfig.isDevelopment) {
  console.log('📝 Fallback configuration loaded:', {
    nodeEnv: staticConfig.nodeEnv,
    appUrl: fallbackConfig.appUrl,
    claudeCodePath: fallbackConfig.claudeCodePath,
    tokenLimit: formatShortNumber(fallbackConfig.claudeDailyTokenLimit),
    rateLimit: fallbackConfig.claudeRateLimitPerMinute,
  });
}

// Export a synchronous config object for immediate use
export const config = fallbackConfig;

// Export individual functions for config management
export {
  configCache,
  getDatabaseConfig,
  updateDatabaseConfig,
} from './database-config';
export type { DatabaseConfig } from './database-config';
