import { WorkspaceManager, WorkspaceSnapshot, FileChange } from '@/lib/workspace/workspace-manager';
import { prisma } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

jest.mock('@/lib/db', () => ({
  prisma: {
    cycle: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('fs/promises');
jest.mock('crypto');

const mockPrismaDb = prisma as jest.Mocked<typeof prisma>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockCrypto = crypto as jest.Mocked<typeof crypto>;

describe('WorkspaceManager', () => {
  let workspaceManager: WorkspaceManager;
  const testProjectPath = '/test/project/path';
  const mockHash = 'mock-hash-12345';

  beforeEach(() => {
    jest.clearAllMocks();
    workspaceManager = new WorkspaceManager(testProjectPath);
    
    // Mock crypto.createHash
    const mockHashObj = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue(mockHash),
    };
    mockCrypto.createHash = jest.fn().mockReturnValue(mockHashObj as any);
  });

  describe('constructor', () => {
    it('should initialize with correct paths', () => {
      expect(workspaceManager).toBeInstanceOf(WorkspaceManager);
    });
  });

  describe('initialize', () => {
    it('should create required directories', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('');
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await workspaceManager.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(testProjectPath, '.codehive'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(testProjectPath, '.codehive', 'cycles'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(testProjectPath, '.codehive', 'workspaces'),
        { recursive: true }
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(testProjectPath, '.codehive', 'locks'),
        { recursive: true }
      );
    });

    it('should update .gitignore file', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('# Existing content\nnode_modules/');
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.access.mockResolvedValue(undefined);

      await workspaceManager.initialize();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testProjectPath, '.gitignore'),
        expect.stringContaining('.codehive/')
      );
    });

    it('should create .gitignore if it does not exist', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await workspaceManager.initialize();

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testProjectPath, '.gitignore'),
        expect.stringContaining('.codehive/')
      );
    });

    it('should handle filesystem errors during directory creation', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(workspaceManager.initialize()).rejects.toThrow('Permission denied');
    });
  });

  describe('createSnapshot', () => {
    const mockCycleData = {
      id: 'test-cycle-id',
      tests: [
        { id: 'test-1', name: 'should work', status: 'PASSING' },
        { id: 'test-2', name: 'should fail', status: 'FAILING' },
      ],
      artifacts: [
        { id: 'artifact-1', name: 'implementation.ts', type: 'CODE' },
      ],
      queries: [
        { id: 'query-1', title: 'Architecture question', status: 'PENDING' },
      ],
    };

    beforeEach(() => {
      mockPrismaDb.cycle.findUnique.mockResolvedValue(mockCycleData as any);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue(['src', 'tests', 'package.json'] as any);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false, mtime: new Date() } as any);
      mockFs.readFile.mockResolvedValue('file content');
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.copyFile.mockResolvedValue(undefined);
    });

    it('should create workspace snapshot successfully', async () => {
      const cycleId = 'test-cycle-id';
      const branchName = 'feature/test';
      const phase = 'GREEN';

      const snapshot = await workspaceManager.createSnapshot(cycleId, branchName, phase);

      expect(snapshot).toMatchObject({
        cycleId,
        branchName,
        phase,
        snapshotId: expect.stringMatching(/^snapshot-test-cycle-id-\d+$/),
        files: expect.any(Array),
        metadata: {
          tests: mockCycleData.tests,
          artifacts: mockCycleData.artifacts,
          queries: mockCycleData.queries,
        },
        createdAt: expect.any(Date),
      });

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('workspaces/snapshot-'),
        { recursive: true }
      );
    });

    it('should handle cycles without metadata', async () => {
      mockPrismaDb.cycle.findUnique.mockResolvedValue(null);

      const snapshot = await workspaceManager.createSnapshot(
        'missing-cycle-id',
        'main',
        'RED'
      );

      expect(snapshot.metadata).toEqual({
        tests: [],
        artifacts: [],
        queries: [],
      });
    });

    it('should handle file reading errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      const snapshot = await workspaceManager.createSnapshot(
        'test-cycle-id',
        'main',
        'RED'
      );

      expect(snapshot.files).toEqual([]);
    });

    it('should save snapshot metadata to disk', async () => {
      await workspaceManager.createSnapshot('test-cycle-id', 'main', 'RED');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('metadata.json'),
        expect.stringContaining('test-cycle-id')
      );
    });
  });

  describe('restoreSnapshot', () => {
    const mockSnapshot: WorkspaceSnapshot = {
      cycleId: 'test-cycle-id',
      branchName: 'feature/test',
      phase: 'GREEN',
      snapshotId: 'snapshot-test-123',
      files: [
        {
          path: 'src/index.ts',
          content: 'export * from "./main";',
          hash: 'hash-1',
          lastModified: new Date('2023-01-01'),
        },
        {
          path: 'tests/index.test.ts',
          content: 'describe("test", () => {});',
          hash: 'hash-2',
          lastModified: new Date('2023-01-01'),
        },
      ],
      metadata: {
        tests: [],
        artifacts: [],
        queries: [],
      },
      createdAt: new Date('2023-01-01'),
    };

    it('should restore snapshot successfully', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSnapshot));
      mockFs.copyFile.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await workspaceManager.restoreSnapshot('snapshot-test-123');

      expect(mockFs.copyFile).toHaveBeenCalledTimes(mockSnapshot.files.length);
      
      // Verify each file is restored
      mockSnapshot.files.forEach(file => {
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          path.join(testProjectPath, file.path),
          file.content
        );
      });
    });

    it('should throw error for non-existent snapshot', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(
        workspaceManager.restoreSnapshot('non-existent-snapshot')
      ).rejects.toThrow('Snapshot non-existent-snapshot not found');
    });

    it('should handle file restoration errors', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSnapshot));
      mockFs.copyFile.mockRejectedValue(new Error('Permission denied'));
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(
        workspaceManager.restoreSnapshot('snapshot-test-123')
      ).rejects.toThrow();
    });
  });

  describe('analyzeChanges', () => {
    const mockPreviousSnapshot: WorkspaceSnapshot = {
      cycleId: 'previous-cycle-id',
      branchName: 'main',
      phase: 'RED',
      snapshotId: 'snapshot-previous',
      files: [
        {
          path: 'src/existing.ts',
          content: 'old content',
          hash: 'old-hash',
          lastModified: new Date('2023-01-01'),
        },
        {
          path: 'src/deleted.ts',
          content: 'deleted content',
          hash: 'deleted-hash',
          lastModified: new Date('2023-01-01'),
        },
      ],
      metadata: { tests: [], artifacts: [], queries: [] },
      createdAt: new Date('2023-01-01'),
    };

    it('should return empty changes when no previous snapshot', async () => {
      const changes = await workspaceManager.analyzeChanges('test-cycle-id');
      
      expect(changes).toEqual([]);
    });

    it('should detect file changes correctly', async () => {
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockPreviousSnapshot))
        .mockResolvedValueOnce('modified content') // existing.ts modified
        .mockResolvedValueOnce('new content'); // new.ts created
      
      mockFs.readdir.mockResolvedValue(['src'] as any);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      
      // Mock getRelevantFiles to return current files
      const mockGetRelevantFiles = jest.spyOn(workspaceManager as any, 'getRelevantFiles');
      mockGetRelevantFiles.mockResolvedValue([
        'src/existing.ts', // modified
        'src/new.ts',      // created
        // src/deleted.ts is missing - will be detected as deleted
      ]);

      const changes = await workspaceManager.analyzeChanges(
        'test-cycle-id',
        'snapshot-previous'
      );

      expect(changes).toHaveLength(3);
      
      const createChange = changes.find(c => c.type === 'CREATE');
      expect(createChange).toMatchObject({
        type: 'CREATE',
        path: 'src/new.ts',
        content: 'new content',
      });

      const modifyChange = changes.find(c => c.type === 'MODIFY');
      expect(modifyChange).toMatchObject({
        type: 'MODIFY',
        path: 'src/existing.ts',
        content: 'modified content',
        oldContent: 'old content',
      });

      const deleteChange = changes.find(c => c.type === 'DELETE');
      expect(deleteChange).toMatchObject({
        type: 'DELETE',
        path: 'src/deleted.ts',
        oldContent: 'deleted content',
      });
    });

    it('should handle missing previous snapshot gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const changes = await workspaceManager.analyzeChanges(
        'test-cycle-id',
        'non-existent-snapshot'
      );

      expect(changes).toEqual([]);
    });
  });

  describe('detectConflicts', () => {
    it('should detect conflicting files between cycles', async () => {
      const mockSnapshot1: WorkspaceSnapshot = {
        cycleId: 'cycle-1',
        branchName: 'feature-1',
        phase: 'GREEN',
        snapshotId: 'snapshot-1',
        files: [
          {
            path: 'src/shared.ts',
            content: 'content from cycle 1',
            hash: 'hash-1',
            lastModified: new Date('2023-01-01'),
          },
        ],
        metadata: { tests: [], artifacts: [], queries: [] },
        createdAt: new Date('2023-01-01'),
      };

      const mockSnapshot2: WorkspaceSnapshot = {
        cycleId: 'cycle-2',
        branchName: 'feature-2',
        phase: 'GREEN',
        snapshotId: 'snapshot-2',
        files: [
          {
            path: 'src/shared.ts',
            content: 'content from cycle 2',
            hash: 'hash-2',
            lastModified: new Date('2023-01-02'),
          },
        ],
        metadata: { tests: [], artifacts: [], queries: [] },
        createdAt: new Date('2023-01-02'),
      };

      // Mock finding snapshots for both cycles
      const mockFindLatestSnapshot = jest.spyOn(workspaceManager as any, 'findLatestSnapshot');
      mockFindLatestSnapshot
        .mockResolvedValueOnce(mockSnapshot1)
        .mockResolvedValueOnce(mockSnapshot2);

      const conflicts = await workspaceManager.detectConflicts('cycle-1', 'cycle-2');

      expect(conflicts).toContain('src/shared.ts');
    });

    it('should return empty array when no conflicts exist', async () => {
      const mockSnapshot1: WorkspaceSnapshot = {
        cycleId: 'cycle-1',
        branchName: 'feature-1',
        phase: 'GREEN',
        snapshotId: 'snapshot-1',
        files: [
          {
            path: 'src/file1.ts',
            content: 'content 1',
            hash: 'hash-1',
            lastModified: new Date('2023-01-01'),
          },
        ],
        metadata: { tests: [], artifacts: [], queries: [] },
        createdAt: new Date('2023-01-01'),
      };

      const mockSnapshot2: WorkspaceSnapshot = {
        cycleId: 'cycle-2',
        branchName: 'feature-2',
        phase: 'GREEN',
        snapshotId: 'snapshot-2',
        files: [
          {
            path: 'src/file2.ts',
            content: 'content 2',
            hash: 'hash-2',
            lastModified: new Date('2023-01-02'),
          },
        ],
        metadata: { tests: [], artifacts: [], queries: [] },
        createdAt: new Date('2023-01-02'),
      };

      const mockFindLatestSnapshot = jest.spyOn(workspaceManager as any, 'findLatestSnapshot');
      mockFindLatestSnapshot
        .mockResolvedValueOnce(mockSnapshot1)
        .mockResolvedValueOnce(mockSnapshot2);

      const conflicts = await workspaceManager.detectConflicts('cycle-1', 'cycle-2');

      expect(conflicts).toEqual([]);
    });
  });

  describe('utility methods', () => {
    describe('calculateHash', () => {
      it('should calculate file hash correctly', () => {
        const content = 'test file content';
        const hash = (workspaceManager as any).calculateHash(content);

        expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
        expect(hash).toBe(mockHash);
      });
    });

    describe('readFile', () => {
      it('should read file with caching', async () => {
        const filePath = 'src/test.ts';
        const content = 'file content';
        mockFs.readFile.mockResolvedValue(content);

        const result1 = await (workspaceManager as any).readFile(filePath);
        const result2 = await (workspaceManager as any).readFile(filePath);

        expect(result1).toBe(content);
        expect(result2).toBe(content);
        expect(mockFs.readFile).toHaveBeenCalledTimes(1); // Should use cache on second call
      });

      it('should handle file reading errors', async () => {
        const filePath = 'src/missing.ts';
        mockFs.readFile.mockRejectedValue(new Error('File not found'));

        await expect(
          (workspaceManager as any).readFile(filePath)
        ).rejects.toThrow('File not found');
      });
    });

    describe('getRelevantFiles', () => {
      it('should return relevant files for a cycle', async () => {
        mockFs.readdir.mockResolvedValue(['src', 'tests', 'node_modules', '.git'] as any);
        mockFs.stat.mockImplementation((filePath: string) => {
          if (filePath.includes('node_modules') || filePath.includes('.git')) {
            return Promise.resolve({ isDirectory: () => true } as any);
          }
          return Promise.resolve({ isDirectory: () => false } as any);
        });

        const files = await (workspaceManager as any).getRelevantFiles('test-cycle-id');

        expect(files).not.toContain(expect.stringContaining('node_modules'));
        expect(files).not.toContain(expect.stringContaining('.git'));
      });
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      mockPrismaDb.cycle.findUnique.mockRejectedValue(new Error('Database error'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue([]);

      await expect(
        workspaceManager.createSnapshot('test-cycle-id', 'main', 'RED')
      ).rejects.toThrow('Database error');
    });

    it('should handle file system permission errors', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(
        workspaceManager.initialize()
      ).rejects.toThrow('Permission denied');
    });

    it('should handle corrupted snapshot metadata', async () => {
      mockFs.readFile.mockResolvedValue('invalid json content');

      await expect(
        workspaceManager.restoreSnapshot('corrupt-snapshot')
      ).rejects.toThrow();
    });
  });
});
