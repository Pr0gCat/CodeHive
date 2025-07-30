// Mock environment variables
process.env.DATABASE_URL = 'file:./test.db';
process.env.CLAUDE_CODE_PATH = 'mock-claude';
process.env.CLAUDE_DAILY_TOKEN_LIMIT = '1000000';
process.env.CLAUDE_RATE_LIMIT_PER_MINUTE = '50';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';

// Mock prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    cycle: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    test: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    artifact: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    query: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    queryComment: {
      create: jest.fn(),
    },
  },
  CyclePhase: {
    RED: 'RED',
    GREEN: 'GREEN',
    REFACTOR: 'REFACTOR',
    REVIEW: 'REVIEW',
  },
  CycleStatus: {
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
  },
  TestStatus: {
    FAILING: 'FAILING',
    PASSING: 'PASSING',
    SKIPPED: 'SKIPPED',
    BROKEN: 'BROKEN',
  },
  QueryUrgency: {
    BLOCKING: 'BLOCKING',
    ADVISORY: 'ADVISORY',
  },
  QueryStatus: {
    PENDING: 'PENDING',
    ANSWERED: 'ANSWERED',
    DISMISSED: 'DISMISSED',
    EXPIRED: 'EXPIRED',
  },
  QueryType: {
    ARCHITECTURE: 'ARCHITECTURE',
    BUSINESS_LOGIC: 'BUSINESS_LOGIC',
    UI_UX: 'UI_UX',
    INTEGRATION: 'INTEGRATION',
    CLARIFICATION: 'CLARIFICATION',
  },
}));

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    access: jest.fn(),
    copyFile: jest.fn(),
    rm: jest.fn(),
  },
}));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// Mock crypto
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked-hash'),
  })),
}));

// Setup console spies
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};
