/**
 * Application Configuration
 * 應用程式配置文件 - 包含重要的系統配置
 */

export interface AppConfig {
  // Claude API Configuration
  claude: {
    codePath: string;
    rateLimitPerMinute: number;
  };

  // Application URLs
  app: {
    url: string;
    wsUrl: string;
  };

  // Database Configuration
  database: {
    url: string;
  };

  // Environment
  environment: {
    nodeEnv: string;
    isProduction: boolean;
    isDevelopment: boolean;
  };
}

/**
 * Default configuration values
 */
const defaultConfig: AppConfig = {
  claude: {
    codePath: 'claude',
    rateLimitPerMinute: 50,
  },
  app: {
    url: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000',
  },
  database: {
    url: 'file:./prisma/codehive.db',
  },
  environment: {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
  },
};

/**
 * Load configuration from environment variables with fallbacks
 */
function loadConfig(): AppConfig {
  return {
    claude: {
      codePath: process.env.CLAUDE_CODE_PATH || defaultConfig.claude.codePath,
      rateLimitPerMinute: parseInt(
        process.env.CLAUDE_RATE_LIMIT ||
          defaultConfig.claude.rateLimitPerMinute.toString()
      ),
    },
    app: {
      url: process.env.APP_URL || defaultConfig.app.url,
      wsUrl: process.env.WS_URL || defaultConfig.app.wsUrl,
    },
    database: {
      url: process.env.DATABASE_URL || defaultConfig.database.url,
    },
    environment: defaultConfig.environment,
  };
}

/**
 * Validate configuration
 */
function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  // Validate Claude configuration
  if (!config.claude.codePath) {
    errors.push('Claude Code path is required');
  }

  if (
    config.claude.rateLimitPerMinute <= 0 ||
    config.claude.rateLimitPerMinute > 1000
  ) {
    errors.push('Claude rate limit must be between 1 and 1000');
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

// Load and validate configuration
const config = loadConfig();
validateConfig(config);

// Log configuration in development
if (config.environment.isDevelopment) {
  console.log('📝 Application configuration loaded:', {
    claudePath: config.claude.codePath,
    rateLimit: config.claude.rateLimitPerMinute,
    appUrl: config.app.url,
    wsUrl: config.app.wsUrl,
    databaseUrl: config.database.url,
    environment: config.environment.nodeEnv,
  });
}

export default config;
export { defaultConfig, loadConfig, validateConfig };
