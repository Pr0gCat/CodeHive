import { getConfig, fallbackConfig, invalidateCache } from '@/lib/config/unified-config';
import { prisma } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  prisma: {
    globalSettings: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Unified Config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateCache();
  });

  afterEach(() => {
    invalidateCache();
  });

  describe('getConfig', () => {
    it('should return fallback config when database is unavailable', async () => {
      mockPrisma.globalSettings.findFirst.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const config = await getConfig();

      expect(config).toEqual(expect.objectContaining({
        claudeCodePath: fallbackConfig.claudeCodePath,
        databaseUrl: fallbackConfig.databaseUrl,
        isProduction: fallbackConfig.isProduction,
      }));
    });

    it('should return database config when available', async () => {
      const dbSettings = {
        id: 1,
        claudeCodePath: '/custom/claude',
        databaseUrl: 'file:./custom.db',
        isProduction: true,
        maxTokensPerProject: 50000,
        maxRequestsPerProject: 200,
        enableUsageTracking: true,
        enableRealTimeUpdates: true,
        defaultProjectFramework: 'react',
        defaultProjectLanguage: 'typescript',
        defaultPackageManager: 'npm',
        defaultTestFramework: 'vitest',
        defaultLintTool: 'eslint',
        defaultBuildTool: 'vite',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.globalSettings.findFirst.mockResolvedValueOnce(dbSettings);

      const config = await getConfig();

      expect(config.claudeCodePath).toBe('/custom/claude');
      expect(config.databaseUrl).toBe('file:./custom.db');
      expect(config.isProduction).toBe(true);
      expect(config.maxTokensPerProject).toBe(50000);
    });

    it('should cache config and return same instance on subsequent calls', async () => {
      const dbSettings = {
        id: 1,
        claudeCodePath: '/cached/claude',
        databaseUrl: 'file:./cached.db',
        isProduction: false,
        maxTokensPerProject: 25000,
        maxRequestsPerProject: 100,
        enableUsageTracking: false,
        enableRealTimeUpdates: false,
        defaultProjectFramework: 'next',
        defaultProjectLanguage: 'javascript',
        defaultPackageManager: 'yarn',
        defaultTestFramework: 'jest',
        defaultLintTool: 'prettier',
        defaultBuildTool: 'webpack',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.globalSettings.findFirst.mockResolvedValueOnce(dbSettings);

      const config1 = await getConfig();
      const config2 = await getConfig();

      expect(config1).toBe(config2);
      expect(mockPrisma.globalSettings.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should handle partial database settings', async () => {
      const partialSettings = {
        id: 1,
        claudeCodePath: '/partial/claude',
        databaseUrl: null,
        isProduction: null,
        maxTokensPerProject: null,
        maxRequestsPerProject: null,
        enableUsageTracking: null,
        enableRealTimeUpdates: null,
        defaultProjectFramework: null,
        defaultProjectLanguage: null,
        defaultPackageManager: null,
        defaultTestFramework: null,
        defaultLintTool: null,
        defaultBuildTool: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.globalSettings.findFirst.mockResolvedValueOnce(partialSettings);

      const config = await getConfig();

      expect(config.claudeCodePath).toBe('/partial/claude');
      expect(config.databaseUrl).toBe(fallbackConfig.databaseUrl);
      expect(config.isProduction).toBe(fallbackConfig.isProduction);
    });
  });

  describe('fallbackConfig', () => {
    it('should have all required configuration properties', () => {
      expect(fallbackConfig).toMatchObject({
        claudeCodePath: expect.any(String),
        databaseUrl: expect.any(String),
        isProduction: expect.any(Boolean),
        maxTokensPerProject: expect.any(Number),
        maxRequestsPerProject: expect.any(Number),
        enableUsageTracking: expect.any(Boolean),
        enableRealTimeUpdates: expect.any(Boolean),
        defaultProjectFramework: expect.any(String),
        defaultProjectLanguage: expect.any(String),
        defaultPackageManager: expect.any(String),
        defaultTestFramework: expect.any(String),
        defaultLintTool: expect.any(String),
        defaultBuildTool: expect.any(String),
      });
    });

    it('should have sensible default values', () => {
      expect(fallbackConfig.claudeCodePath).toBe('claude');
      expect(fallbackConfig.databaseUrl).toContain('sqlite');
      expect(fallbackConfig.maxTokensPerProject).toBeGreaterThan(0);
      expect(fallbackConfig.maxRequestsPerProject).toBeGreaterThan(0);
    });
  });

  describe('invalidateCache', () => {
    it('should clear cache and force database reload', async () => {
      const dbSettings = {
        id: 1,
        claudeCodePath: '/first/claude',
        databaseUrl: 'file:./first.db',
        isProduction: false,
        maxTokensPerProject: 10000,
        maxRequestsPerProject: 50,
        enableUsageTracking: true,
        enableRealTimeUpdates: true,
        defaultProjectFramework: 'vue',
        defaultProjectLanguage: 'typescript',
        defaultPackageManager: 'pnpm',
        defaultTestFramework: 'vitest',
        defaultLintTool: 'eslint',
        defaultBuildTool: 'vite',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedSettings = {
        ...dbSettings,
        claudeCodePath: '/updated/claude',
        databaseUrl: 'file:./updated.db',
      };

      mockPrisma.globalSettings.findFirst
        .mockResolvedValueOnce(dbSettings)
        .mockResolvedValueOnce(updatedSettings);

      const config1 = await getConfig();
      expect(config1.claudeCodePath).toBe('/first/claude');

      invalidateCache();

      const config2 = await getConfig();
      expect(config2.claudeCodePath).toBe('/updated/claude');
      expect(mockPrisma.globalSettings.findFirst).toHaveBeenCalledTimes(2);
    });
  });
});
