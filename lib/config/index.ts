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

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Static config that doesn't come from database
const staticConfig: StaticConfig = {
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
};

/**
 * Get runtime configuration by merging database config with static config
 */
export async function getConfig(): Promise<Config> {
  const dbConfig = await configCache.getConfig();

  return {
    // Database config takes precedence
    databaseUrl: dbConfig.databaseUrl,
    claudeCodePath: dbConfig.claudeCodePath,
    claudeDailyTokenLimit: dbConfig.dailyTokenLimit,
    claudeRateLimitPerMinute: dbConfig.rateLimitPerMinute,
    appUrl: dbConfig.appUrl,
    wsUrl: dbConfig.wsUrl,

    // Static config from environment
    nodeEnv: staticConfig.nodeEnv,
    isProduction: staticConfig.isProduction,
    isDevelopment: staticConfig.isDevelopment,
  };
}

/**
 * Synchronous fallback config for when database is not available
 * Uses environment variables with sensible defaults
 */
export const fallbackConfig: Config = {
  // Database - use environment variable
  databaseUrl: process.env.DATABASE_URL || 'file:./prisma/codehive.db',

  // Claude Code - fallback values (environment variables as optional override)
  claudeCodePath: process.env.CLAUDE_CODE_PATH || 'claude',
  claudeDailyTokenLimit: 100000000, // 100M tokens
  claudeRateLimitPerMinute: parseInt(process.env.CLAUDE_RATE_LIMIT || '50'),

  // Application - use environment variables
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  wsUrl: process.env.WS_URL || 'ws://localhost:3000',

  // Static config from environment (NODE_ENV still needed)
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
