import {
  getConfig,
  validateConfig,
  fallbackConfig,
  config,
  getDefaultProjectId,
} from '@/lib/config';
import { getUnifiedConfig } from '@/lib/config/unified-config';
import { PrismaClient } from '@prisma/client';

// Mock unified config
jest.mock('@/lib/config/unified-config', () => ({
  getUnifiedConfig: jest.fn(),
}));

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}));

const mockGetUnifiedConfig = getUnifiedConfig as jest.MockedFunction<typeof getUnifiedConfig>;
const MockPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;

describe('Config Index', () => {
  const mockUnifiedConfig = {
    database: {
      url: 'file:./test.db',
    },
    claude: {
      codePath: 'test-claude',
      dailyTokenLimit: 50000,
      rateLimitPerMinute: 25,
    },
    app: {
      url: 'http://test.localhost:3000',
      wsUrl: 'ws://test.localhost:3000',
    },
    environment: {
      nodeEnv: 'test',
      isProduction: false,
      isDevelopment: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUnifiedConfig.mockResolvedValue(mockUnifiedConfig);
  });

  describe('fallbackConfig', () => {
    it('should provide default configuration values', () => {
      expect(fallbackConfig).toEqual({
        databaseUrl: 'file:./prisma/codehive.db',
        claudeCodePath: 'claude',
        claudeDailyTokenLimit: 100000000,
        claudeRateLimitPerMinute: 50,
        appUrl: 'http://localhost:3000',
        wsUrl: 'ws://localhost:3000',
        nodeEnv: expect.any(String),
        isProduction: expect.any(Boolean),
        isDevelopment: expect.any(Boolean),
      });
    });

    it('should set environment flags based on NODE_ENV', () => {
      // Test current environment
      if (process.env.NODE_ENV === 'production') {
        expect(fallbackConfig.isProduction).toBe(true);
        expect(fallbackConfig.isDevelopment).toBe(false);
      } else {
        expect(fallbackConfig.isProduction).toBe(false);
        expect(fallbackConfig.isDevelopment).toBe(true);
      }
    });
  });

  describe('getConfig', () => {
    it('should return config from unified configuration', async () => {
      const result = await getConfig();

      expect(result).toEqual({
        databaseUrl: 'file:./test.db',
        claudeCodePath: 'test-claude',
        claudeDailyTokenLimit: 50000,
        claudeRateLimitPerMinute: 25,
        appUrl: 'http://test.localhost:3000',
        wsUrl: 'ws://test.localhost:3000',
        nodeEnv: 'test',
        isProduction: false,
        isDevelopment: true,
      });

      expect(mockGetUnifiedConfig).toHaveBeenCalled();
    });

    it('should handle unified config loading errors', async () => {
      mockGetUnifiedConfig.mockRejectedValue(new Error('Config load failed'));

      await expect(getConfig()).rejects.toThrow('Config load failed');
    });
  });

  describe('validateConfig', () => {
    const validConfig = {
      databaseUrl: 'file:./test.db',
      claudeCodePath: 'claude',
      claudeDailyTokenLimit: 1000,
      claudeRateLimitPerMinute: 10,
      appUrl: 'http://localhost:3000',
      wsUrl: 'ws://localhost:3000',
      nodeEnv: 'test',
      isProduction: false,
      isDevelopment: true,
    };

    it('should validate a correct configuration', () => {
      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    it('should throw error for missing database URL', () => {
      const invalidConfig = { ...validConfig, databaseUrl: '' };

      expect(() => validateConfig(invalidConfig)).toThrow(
        'Configuration validation failed:\nDatabase URL is required'
      );
    });

    it('should throw error for invalid token limit', () => {
      const invalidConfig = { ...validConfig, claudeDailyTokenLimit: 0 };

      expect(() => validateConfig(invalidConfig)).toThrow(
        'Claude daily token limit must be positive'
      );
    });

    it('should throw error for negative token limit', () => {
      const invalidConfig = { ...validConfig, claudeDailyTokenLimit: -100 };

      expect(() => validateConfig(invalidConfig)).toThrow(
        'Claude daily token limit must be positive'
      );
    });

    it('should throw error for invalid rate limit', () => {
      const invalidConfig = { ...validConfig, claudeRateLimitPerMinute: 0 };

      expect(() => validateConfig(invalidConfig)).toThrow(
        'Claude rate limit per minute must be positive'
      );
    });

    it('should throw error for negative rate limit', () => {
      const invalidConfig = { ...validConfig, claudeRateLimitPerMinute: -5 };

      expect(() => validateConfig(invalidConfig)).toThrow(
        'Claude rate limit per minute must be positive'
      );
    });

    it('should throw error for invalid app URL', () => {
      const invalidConfig = { ...validConfig, appUrl: 'not-a-url' };

      expect(() => validateConfig(invalidConfig)).toThrow(
        'App URL must be a valid URL'
      );
    });

    it('should throw error for multiple validation failures', () => {
      const invalidConfig = {
        ...validConfig,
        databaseUrl: '',
        claudeDailyTokenLimit: -1,
        appUrl: 'invalid-url',
      };

      expect(() => validateConfig(invalidConfig)).toThrow(
        expect.stringContaining('Database URL is required') &&
        expect.stringContaining('Claude daily token limit must be positive') &&
        expect.stringContaining('App URL must be a valid URL')
      );
    });

    it('should accept valid URLs with different protocols', () => {
      const httpsConfig = { ...validConfig, appUrl: 'https://example.com' };
      const httpConfig = { ...validConfig, appUrl: 'http://example.com:8080' };

      expect(() => validateConfig(httpsConfig)).not.toThrow();
      expect(() => validateConfig(httpConfig)).not.toThrow();
    });
  });

  describe('config export', () => {
    it('should provide synchronous access to configuration', () => {
      expect(config).toBeDefined();
      expect(config.databaseUrl).toBeDefined();
      expect(config.claudeCodePath).toBeDefined();
      expect(config.appUrl).toBeDefined();
      expect(typeof config.isProduction).toBe('boolean');
    });
  });

  describe('getDefaultProjectId', () => {
    let mockPrismaInstance: any;

    beforeEach(() => {
      mockPrismaInstance = {
        project: {
          findFirst: jest.fn(),
        },
      };
      MockPrismaClient.mockImplementation(() => mockPrismaInstance);
    });

    it('should return active project ID when available', async () => {
      const mockProject = {
        id: 'active-project-id',
        status: 'ACTIVE',
        updatedAt: new Date(),
      };
      mockPrismaInstance.project.findFirst.mockResolvedValue(mockProject);

      const result = await getDefaultProjectId();

      expect(result).toBe('active-project-id');
      expect(mockPrismaInstance.project.findFirst).toHaveBeenCalledWith({
        where: {
          status: {
            in: ['ACTIVE', 'INITIALIZING'],
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    });

    it('should return initializing project ID when no active projects', async () => {
      const mockProject = {
        id: 'initializing-project-id',
        status: 'INITIALIZING',
        updatedAt: new Date(),
      };
      mockPrismaInstance.project.findFirst.mockResolvedValue(mockProject);

      const result = await getDefaultProjectId();

      expect(result).toBe('initializing-project-id');
    });

    it('should fallback to most recent project when no active/initializing projects', async () => {
      const mockFallbackProject = {
        id: 'fallback-project-id',
        status: 'INACTIVE',
        updatedAt: new Date(),
      };

      mockPrismaInstance.project.findFirst
        .mockResolvedValueOnce(null) // No active/initializing projects
        .mockResolvedValueOnce(mockFallbackProject); // Fallback project

      const result = await getDefaultProjectId();

      expect(result).toBe('fallback-project-id');
      expect(mockPrismaInstance.project.findFirst).toHaveBeenCalledTimes(2);

      // Verify fallback query
      expect(mockPrismaInstance.project.findFirst).toHaveBeenNthCalledWith(2, {
        orderBy: {
          updatedAt: 'desc',
        },
      });
    });

    it('should return null when no projects exist', async () => {
      mockPrismaInstance.project.findFirst.mockResolvedValue(null);

      const result = await getDefaultProjectId();

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaInstance.project.findFirst.mockRejectedValue(new Error('Database connection failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await getDefaultProjectId();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error getting default project ID:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle Prisma import errors', async () => {
      MockPrismaClient.mockImplementation(() => {
        throw new Error('Failed to create Prisma client');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await getDefaultProjectId();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error getting default project ID:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should prefer active projects over initializing ones', async () => {
      // Mock returns active project first
      const mockActiveProject = {
        id: 'active-project-id',
        status: 'ACTIVE',
        updatedAt: new Date('2023-02-01'),
      };
      mockPrismaInstance.project.findFirst.mockResolvedValue(mockActiveProject);

      const result = await getDefaultProjectId();

      expect(result).toBe('active-project-id');
      
      // Should only call once since active project was found
      expect(mockPrismaInstance.project.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should handle project with null ID gracefully', async () => {
      mockPrismaInstance.project.findFirst
        .mockResolvedValueOnce(null) // No active projects
        .mockResolvedValueOnce({ id: null, status: 'INACTIVE' }); // Invalid project

      const result = await getDefaultProjectId();

      expect(result).toBeNull();
    });
  });

  describe('type exports', () => {
    it('should export Config interface', () => {
      // This is primarily a TypeScript compile-time check
      // But we can verify the structure matches what's expected
      const testConfig: typeof config = {
        databaseUrl: 'test',
        claudeCodePath: 'test',
        claudeDailyTokenLimit: 1,
        claudeRateLimitPerMinute: 1,
        appUrl: 'http://test',
        wsUrl: 'ws://test',
        nodeEnv: 'test',
        isProduction: false,
        isDevelopment: true,
      };
      
      expect(testConfig).toBeDefined();
    });
  });

  describe('integration with unified config', () => {
    it('should properly transform unified config to legacy format', async () => {
      const customUnifiedConfig = {
        database: {
          url: 'file:./custom.db',
        },
        claude: {
          codePath: 'custom-claude',
          dailyTokenLimit: 999999,
          rateLimitPerMinute: 100,
        },
        app: {
          url: 'https://custom.example.com',
          wsUrl: 'wss://custom.example.com',
        },
        environment: {
          nodeEnv: 'staging',
          isProduction: false,
          isDevelopment: false,
        },
      };

      mockGetUnifiedConfig.mockResolvedValue(customUnifiedConfig);

      const result = await getConfig();

      expect(result).toEqual({
        databaseUrl: 'file:./custom.db',
        claudeCodePath: 'custom-claude',
        claudeDailyTokenLimit: 999999,
        claudeRateLimitPerMinute: 100,
        appUrl: 'https://custom.example.com',
        wsUrl: 'wss://custom.example.com',
        nodeEnv: 'staging',
        isProduction: false,
        isDevelopment: false,
      });
    });
  });
});