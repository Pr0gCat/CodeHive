/**
 * Unified Configuration System
 * 統一配置系統 - 合併靜態配置和資料庫配置
 */

import { formatShortNumber } from '@/lib/utils';
import { configCache, DatabaseConfig } from './database-config';

export interface UnifiedConfig {
  // Database Configuration
  database: {
    url: string;
  };

  // Claude API Configuration
  claude: {
    codePath: string;
    dailyTokenLimit: number;
    rateLimitPerMinute: number;
    warningThreshold: number;
    criticalThreshold: number;
    allocationStrategy: number;
    autoResumeEnabled: boolean;
    pauseOnWarning: boolean;
  };

  // Application Configuration
  app: {
    url: string;
    wsUrl: string;
  };

  // Environment Configuration
  environment: {
    nodeEnv: string;
    isProduction: boolean;
    isDevelopment: boolean;
  };
}

// Static configuration from environment variables
interface StaticConfig {
  nodeEnv: string;
  isProduction: boolean;
  isDevelopment: boolean;
}

// Static config with sensible defaults
const staticConfig: StaticConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
};

// Default configuration values
const defaultConfig: UnifiedConfig = {
  database: {
    url: 'file:./prisma/codehive.db',
  },
  claude: {
    codePath: 'claude',
    dailyTokenLimit: 100000000, // 100M tokens
    rateLimitPerMinute: 50,
    warningThreshold: 0.75,
    criticalThreshold: 0.9,
    allocationStrategy: 0.5,
    autoResumeEnabled: true,
    pauseOnWarning: false,
  },
  app: {
    url: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000',
  },
  environment: staticConfig,
};

/**
 * Load configuration from environment variables with fallbacks
 */
function loadEnvironmentConfig(): Partial<UnifiedConfig> {
  return {
    database: {
      url: process.env.DATABASE_URL || defaultConfig.database.url,
    },
    claude: {
      codePath: process.env.CLAUDE_CODE_PATH || defaultConfig.claude.codePath,
      dailyTokenLimit: parseInt(
        process.env.CLAUDE_DAILY_TOKEN_LIMIT ||
          defaultConfig.claude.dailyTokenLimit.toString()
      ),
      rateLimitPerMinute: parseInt(
        process.env.CLAUDE_RATE_LIMIT ||
          defaultConfig.claude.rateLimitPerMinute.toString()
      ),
      warningThreshold: parseFloat(
        process.env.CLAUDE_WARNING_THRESHOLD ||
          defaultConfig.claude.warningThreshold.toString()
      ),
      criticalThreshold: parseFloat(
        process.env.CLAUDE_CRITICAL_THRESHOLD ||
          defaultConfig.claude.criticalThreshold.toString()
      ),
      allocationStrategy: parseFloat(
        process.env.CLAUDE_ALLOCATION_STRATEGY ||
          defaultConfig.claude.allocationStrategy.toString()
      ),
      autoResumeEnabled: process.env.CLAUDE_AUTO_RESUME !== 'false',
      pauseOnWarning: process.env.CLAUDE_PAUSE_ON_WARNING === 'true',
    },
    app: {
      url: process.env.APP_URL || defaultConfig.app.url,
      wsUrl: process.env.WS_URL || defaultConfig.app.wsUrl,
    },
    environment: staticConfig,
  };
}

/**
 * Merge database configuration with environment configuration
 */
function mergeConfigs(
  envConfig: Partial<UnifiedConfig>,
  dbConfig: DatabaseConfig
): UnifiedConfig {
  return {
    database: {
      url: envConfig.database?.url || defaultConfig.database.url,
    },
    claude: {
      codePath: dbConfig.claudeCodePath || envConfig.claude?.codePath || defaultConfig.claude.codePath,
      dailyTokenLimit: dbConfig.dailyTokenLimit || envConfig.claude?.dailyTokenLimit || defaultConfig.claude.dailyTokenLimit,
      rateLimitPerMinute: dbConfig.rateLimitPerMinute || envConfig.claude?.rateLimitPerMinute || defaultConfig.claude.rateLimitPerMinute,
      warningThreshold: dbConfig.warningThreshold || envConfig.claude?.warningThreshold || defaultConfig.claude.warningThreshold,
      criticalThreshold: dbConfig.criticalThreshold || envConfig.claude?.criticalThreshold || defaultConfig.claude.criticalThreshold,
      allocationStrategy: dbConfig.allocationStrategy || envConfig.claude?.allocationStrategy || defaultConfig.claude.allocationStrategy,
      autoResumeEnabled: dbConfig.autoResumeEnabled ?? envConfig.claude?.autoResumeEnabled ?? defaultConfig.claude.autoResumeEnabled,
      pauseOnWarning: dbConfig.pauseOnWarning ?? envConfig.claude?.pauseOnWarning ?? defaultConfig.claude.pauseOnWarning,
    },
    app: {
      url: envConfig.app?.url || defaultConfig.app.url,
      wsUrl: envConfig.app?.wsUrl || defaultConfig.app.wsUrl,
    },
    environment: staticConfig,
  };
}

/**
 * Get runtime configuration by merging database config with environment config
 */
export async function getUnifiedConfig(): Promise<UnifiedConfig> {
  try {
    const envConfig = loadEnvironmentConfig();
    const dbConfig = await configCache.getConfig();
    const mergedConfig = mergeConfigs(envConfig, dbConfig);
    
    validateUnifiedConfig(mergedConfig);
    return mergedConfig;
  } catch (error) {
    console.error('Failed to load unified config, using fallback:', error);
    return defaultConfig;
  }
}

/**
 * Get synchronous configuration (environment only, no database)
 */
export function getSyncConfig(): UnifiedConfig {
  const envConfig = loadEnvironmentConfig();
  const fallbackDbConfig: DatabaseConfig = {
    dailyTokenLimit: defaultConfig.claude.dailyTokenLimit,
    warningThreshold: defaultConfig.claude.warningThreshold,
    criticalThreshold: defaultConfig.claude.criticalThreshold,
    allocationStrategy: defaultConfig.claude.allocationStrategy,
    autoResumeEnabled: defaultConfig.claude.autoResumeEnabled,
    pauseOnWarning: defaultConfig.claude.pauseOnWarning,
    claudeCodePath: defaultConfig.claude.codePath,
    rateLimitPerMinute: defaultConfig.claude.rateLimitPerMinute,
  };
  
  const mergedConfig = mergeConfigs(envConfig, fallbackDbConfig);
  validateUnifiedConfig(mergedConfig);
  return mergedConfig;
}

/**
 * Validate unified configuration
 */
export function validateUnifiedConfig(config: UnifiedConfig): void {
  const errors: string[] = [];

  // Validate Claude configuration
  if (!config.claude.codePath) {
    errors.push('Claude Code path is required');
  }

  if (config.claude.dailyTokenLimit <= 0) {
    errors.push('Claude daily token limit must be positive');
  }

  if (config.claude.rateLimitPerMinute <= 0 || config.claude.rateLimitPerMinute > 1000) {
    errors.push('Claude rate limit must be between 1 and 1000');
  }

  if (config.claude.warningThreshold <= 0 || config.claude.warningThreshold >= 1) {
    errors.push('Claude warning threshold must be between 0 and 1');
  }

  if (config.claude.criticalThreshold <= 0 || config.claude.criticalThreshold >= 1) {
    errors.push('Claude critical threshold must be between 0 and 1');
  }

  if (config.claude.warningThreshold >= config.claude.criticalThreshold) {
    errors.push('Warning threshold must be less than critical threshold');
  }

  if (config.claude.allocationStrategy < 0 || config.claude.allocationStrategy > 1) {
    errors.push('Allocation strategy must be between 0 and 1');
  }

  // Validate URLs
  try {
    new URL(config.app.url);
  } catch {
    errors.push('App URL must be a valid URL');
  }

  try {
    new URL(config.app.wsUrl);
  } catch {
    errors.push('WebSocket URL must be a valid URL');
  }

  // Validate database URL
  if (!config.database.url) {
    errors.push('Database URL is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Create synchronous config instance for immediate use
const syncConfig = getSyncConfig();

// Log configuration in development
if (syncConfig.environment.isDevelopment) {
  console.log('Unified configuration loaded:', {
    nodeEnv: syncConfig.environment.nodeEnv,
    appUrl: syncConfig.app.url,
    wsUrl: syncConfig.app.wsUrl,
    claudePath: syncConfig.claude.codePath,
    tokenLimit: formatShortNumber(syncConfig.claude.dailyTokenLimit),
    rateLimit: syncConfig.claude.rateLimitPerMinute,
    warningThreshold: syncConfig.claude.warningThreshold,
    criticalThreshold: syncConfig.claude.criticalThreshold,
    databaseUrl: syncConfig.database.url,
  });
}

export default syncConfig;
export { defaultConfig, loadEnvironmentConfig, mergeConfigs };
