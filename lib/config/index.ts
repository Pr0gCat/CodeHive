/**
 * Environment configuration and validation
 */

export interface Config {
  // Database
  databaseUrl: string;
  
  // Claude Code
  claudeCodePath: string;
  claudeDailyTokenLimit: string;
  claudeRateLimitPerMinute: string;
  
  // Application
  appUrl: string;
  wsUrl: string;
  nodeEnv: string;
  
  // Runtime
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

function getEnvNumber(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${value}`);
  }
  
  return parsed;
}

export const config: Config = {
  // Database
  databaseUrl: getEnvVar('DATABASE_URL'),
  
  // Claude Code
  claudeCodePath: getEnvVar('CLAUDE_CODE_PATH', 'claude'),
  claudeDailyTokenLimit: getEnvVar('CLAUDE_DAILY_TOKEN_LIMIT', '10000000'),
  claudeRateLimitPerMinute: getEnvVar('CLAUDE_RATE_LIMIT_PER_MINUTE', '50'),
  
  // Application
  appUrl: getEnvVar('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  wsUrl: getEnvVar('NEXT_PUBLIC_WS_URL', 'ws://localhost:3000'),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  
  // Runtime flags
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
};

// Validate configuration on module load
export function validateConfig(): void {
  const errors: string[] = [];
  
  // Check required paths
  if (!config.databaseUrl) {
    errors.push('DATABASE_URL is required');
  }
  
  // Check token limits
  if (parseInt(config.claudeDailyTokenLimit) <= 0) {
    errors.push('CLAUDE_DAILY_TOKEN_LIMIT must be positive');
  }
  
  if (parseInt(config.claudeRateLimitPerMinute) <= 0) {
    errors.push('CLAUDE_RATE_LIMIT_PER_MINUTE must be positive');
  }
  
  // Check URLs
  try {
    new URL(config.appUrl);
  } catch {
    errors.push('NEXT_PUBLIC_APP_URL must be a valid URL');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Run validation
validateConfig();

// Log configuration in development
if (config.isDevelopment) {
  console.log('📝 Configuration loaded:', {
    nodeEnv: config.nodeEnv,
    appUrl: config.appUrl,
    claudeCodePath: config.claudeCodePath,
    tokenLimit: parseInt(config.claudeDailyTokenLimit).toLocaleString(),
    rateLimit: config.claudeRateLimitPerMinute,
  });
}