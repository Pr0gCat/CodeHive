import { prisma } from '@/lib/db';

export interface DatabaseConfig {
  dailyTokenLimit: number;
  warningThreshold: number;
  criticalThreshold: number;
  allocationStrategy: number;
  autoResumeEnabled: boolean;
  pauseOnWarning: boolean;
  claudeCodePath: string;
  rateLimitPerMinute: number;
}

/**
 * 從資料庫讀取全域配置，如果不存在則創建預設配置
 */
export async function getDatabaseConfig(): Promise<DatabaseConfig> {
  try {
    let settings = await prisma.globalSettings.findUnique({
      where: { id: 'global' },
    });

    // 如果沒有設定記錄，創建預設設定
    if (!settings) {
      settings = await prisma.globalSettings.create({
        data: {
          id: 'global',
          dailyTokenLimit: 100000000,
          warningThreshold: 0.75,
          criticalThreshold: 0.9,
          allocationStrategy: 0.5,
          autoResumeEnabled: true,
          pauseOnWarning: false,
          claudeCodePath: 'claude',
          rateLimitPerMinute: 50,
        },
      });
    }

    return {
      dailyTokenLimit: settings.dailyTokenLimit,
      warningThreshold: settings.warningThreshold,
      criticalThreshold: settings.criticalThreshold,
      allocationStrategy: settings.allocationStrategy,
      autoResumeEnabled: settings.autoResumeEnabled,
      pauseOnWarning: settings.pauseOnWarning,
      claudeCodePath: settings.claudeCodePath,
      rateLimitPerMinute: settings.rateLimitPerMinute,
    };
  } catch (error) {
    console.error('Failed to load database config:', error);

    // 如果資料庫讀取失敗，返回預設配置（與 fallbackConfig 一致）
    return {
      dailyTokenLimit: 100000000,
      warningThreshold: 0.75,
      criticalThreshold: 0.9,
      allocationStrategy: 0.5,
      autoResumeEnabled: true,
      pauseOnWarning: false,
      claudeCodePath: 'claude',
      rateLimitPerMinute: 50,
    };
  }
}

/**
 * 更新資料庫中的全域配置
 */
export async function updateDatabaseConfig(
  config: Partial<DatabaseConfig>
): Promise<DatabaseConfig> {
  const settings = await prisma.globalSettings.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      dailyTokenLimit: config.dailyTokenLimit ?? 100000000,
      warningThreshold: config.warningThreshold ?? 0.75,
      criticalThreshold: config.criticalThreshold ?? 0.9,
      allocationStrategy: config.allocationStrategy ?? 0.5,
      autoResumeEnabled: config.autoResumeEnabled ?? true,
      pauseOnWarning: config.pauseOnWarning ?? false,
      claudeCodePath: config.claudeCodePath ?? 'claude',
      rateLimitPerMinute: config.rateLimitPerMinute ?? 50,
    },
    update: config,
  });

  return {
    dailyTokenLimit: settings.dailyTokenLimit,
    warningThreshold: settings.warningThreshold,
    criticalThreshold: settings.criticalThreshold,
    allocationStrategy: settings.allocationStrategy,
    autoResumeEnabled: settings.autoResumeEnabled,
    pauseOnWarning: settings.pauseOnWarning,
    claudeCodePath: settings.claudeCodePath,
    rateLimitPerMinute: settings.rateLimitPerMinute,
  };
}

/**
 * 單例模式的配置快取，避免重複查詢資料庫
 */
class ConfigCache {
  private config: DatabaseConfig | null = null;
  private lastUpdated: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 分鐘快取

  async getConfig(): Promise<DatabaseConfig> {
    const now = Date.now();

    if (!this.config || now - this.lastUpdated > this.CACHE_TTL) {
      this.config = await getDatabaseConfig();
      this.lastUpdated = now;
    }

    return this.config;
  }

  invalidate(): void {
    this.config = null;
    this.lastUpdated = 0;
  }

  async updateConfig(
    updates: Partial<DatabaseConfig>
  ): Promise<DatabaseConfig> {
    this.config = await updateDatabaseConfig(updates);
    this.lastUpdated = Date.now();
    return this.config;
  }
}

export const configCache = new ConfigCache();
