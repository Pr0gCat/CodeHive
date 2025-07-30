import { WorkspaceManager } from '@/lib/workspace/workspace-manager';
import { mockFs, mockPrisma, clearAllMocks } from '../../helpers/test-utils';

describe('WorkspaceManager', () => {
  let workspaceManager: WorkspaceManager;
  const testProjectPath = '/test/project/path';

  beforeEach(() => {
    clearAllMocks();
    workspaceManager = new WorkspaceManager(testProjectPath);
    mockFs();
    mockPrisma();
  });

  describe('initialize', () => {
    it('should create required directories', async () => {
      const fs = mockFs();

      await workspaceManager.initialize();

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.codehive'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('cycles'), {
        recursive: true,
      });
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('workspaces'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('locks'), {
        recursive: true,
      });
    });

    it('should update gitignore with .codehive', async () => {
      const fs = mockFs();
      fs.readFile.mockResolvedValue('node_modules/\n.env\n');

      await workspaceManager.initialize();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.gitignore'),
        expect.stringContaining('.codehive/')
      );
    });

    it('should create gitignore if it does not exist', async () => {
      const fs = mockFs();
      fs.readFile.mockRejectedValue(new Error('File not found'));

      await workspaceManager.initialize();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.gitignore'),
        '# CodeHive\n.codehive/\n'
      );
    });
  });

  describe('createSnapshot', () => {
    it('should create workspace snapshot with files and metadata', async () => {
      const fs = mockFs();
      const { prisma } = require('@/lib/db');

      // Mock cycle with related data
      prisma.cycle.findUnique.mockResolvedValue({
        id: 'test-cycle-id',
        tests: [{ id: 'test-1', name: 'test 1' }],
        artifacts: [{ id: 'artifact-1', name: 'artifact 1' }],
        queries: [{ id: 'query-1', title: 'query 1' }],
      });

      // Mock readdir to return test files
      fs.readdir.mockResolvedValue([
        { name: 'src', isDirectory: () => true, isFile: () => false },
        { name: 'test.js', isDirectory: () => false, isFile: () => true },
      ]);

      // Mock file content
      fs.readFile.mockResolvedValue('file content');
      fs.stat.mockResolvedValue({ mtime: new Date('2023-01-01') });

      const snapshot = await workspaceManager.createSnapshot(
        'test-cycle-id',
        'feature-branch',
        'RED'
      );

      expect(snapshot.cycleId).toBe('test-cycle-id');
      expect(snapshot.branchName).toBe('feature-branch');
      expect(snapshot.phase).toBe('RED');
      expect(snapshot.snapshotId).toMatch(/^snapshot-test-cycle-id-\d+$/);
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(snapshot.snapshotId),
        { recursive: true }
      );
    });

    it('should handle missing cycle gracefully', async () => {
      const { prisma } = require('@/lib/db');
      prisma.cycle.findUnique.mockResolvedValue(null);

      const snapshot = await workspaceManager.createSnapshot(
        'invalid-cycle-id',
        'feature-branch',
        'RED'
      );

      expect(snapshot.metadata.tests).toEqual([]);
      expect(snapshot.metadata.artifacts).toEqual([]);
      expect(snapshot.metadata.queries).toEqual([]);
    });
  });

  describe('restoreSnapshot', () => {
    it('should restore files from snapshot', async () => {
      const fs = mockFs();

      // Mock snapshot metadata
      fs.readFile.mockResolvedValue(
        JSON.stringify({
          snapshotId: 'test-snapshot',
          files: [
            {
              path: 'src/test.js',
              content: 'test content',
              hash: 'hash123',
              lastModified: '2023-01-01T00:00:00.000Z',
            },
          ],
        })
      );

      await workspaceManager.restoreSnapshot('test-snapshot');

      expect(fs.copyFile).toHaveBeenCalledWith(
        expect.stringContaining('test-snapshot/src/test.js'),
        expect.stringContaining('src/test.js')
      );
    });

    it('should handle missing snapshot', async () => {
      const fs = mockFs();
      fs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(
        workspaceManager.restoreSnapshot('invalid-snapshot')
      ).rejects.toThrow('Snapshot invalid-snapshot not found');
    });
  });

  describe('analyzeChanges', () => {
    it('should detect file changes between snapshots', async () => {
      const fs = mockFs();

      // Mock previous snapshot
      fs.readFile.mockResolvedValue(
        JSON.stringify({
          files: [
            {
              path: 'src/test.js',
              content: 'old content',
              hash: 'old-hash',
            },
          ],
        })
      );

      // Mock current file content
      const originalReadFile = fs.readFile;
      fs.readFile.mockImplementation((path: string) => {
        if (path.includes('metadata.json')) {
          return originalReadFile(path);
        }
        return Promise.resolve('new content');
      });

      // Mock crypto hash
      const crypto = require('crypto');
      crypto.createHash().digest.mockReturnValue('new-hash');

      const changes = await workspaceManager.analyzeChanges(
        'current-cycle-id',
        'previous-snapshot-id'
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('MODIFY');
      expect(changes[0].path).toBe('src/test.js');
      expect(changes[0].content).toBe('new content');
      expect(changes[0].oldContent).toBe('old content');
    });

    it('should detect new files', async () => {
      const fs = mockFs();

      // Mock previous snapshot with no files
      fs.readFile.mockResolvedValue(JSON.stringify({ files: [] }));

      // Mock current files
      fs.readdir.mockResolvedValue([
        { name: 'new-file.js', isDirectory: () => false, isFile: () => true },
      ]);

      const changes = await workspaceManager.analyzeChanges(
        'current-cycle-id',
        'previous-snapshot-id'
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('CREATE');
      expect(changes[0].path).toBe('new-file.js');
    });

    it('should detect deleted files', async () => {
      const fs = mockFs();

      // Mock previous snapshot with files
      fs.readFile.mockResolvedValue(
        JSON.stringify({
          files: [
            {
              path: 'deleted-file.js',
              content: 'deleted content',
              hash: 'hash123',
            },
          ],
        })
      );

      // Mock current files (empty)
      fs.readdir.mockResolvedValue([]);

      const changes = await workspaceManager.analyzeChanges(
        'current-cycle-id',
        'previous-snapshot-id'
      );

      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('DELETE');
      expect(changes[0].path).toBe('deleted-file.js');
      expect(changes[0].oldContent).toBe('deleted content');
    });

    it('should return empty array when no previous snapshot', async () => {
      const changes = await workspaceManager.analyzeChanges('current-cycle-id');

      expect(changes).toEqual([]);
    });
  });

  describe('detectConflicts', () => {
    it('should detect conflicts when same files are modified in different cycles', async () => {
      // Mock that both cycles have modified the same file
      workspaceManager['isFileModified'] = jest.fn().mockResolvedValue(true);

      const conflicts = await workspaceManager.detectConflicts(
        'cycle-1',
        'cycle-2'
      );

      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('should not detect conflicts when files are not modified', async () => {
      workspaceManager['isFileModified'] = jest.fn().mockResolvedValue(false);

      const conflicts = await workspaceManager.detectConflicts(
        'cycle-1',
        'cycle-2'
      );

      expect(conflicts).toEqual([]);
    });
  });

  describe('cleanupOldSnapshots', () => {
    it('should remove old snapshots', async () => {
      const fs = mockFs();

      // Mock old snapshots
      fs.readdir.mockResolvedValue(['snapshot-1', 'snapshot-2']);
      fs.readFile.mockResolvedValue(
        JSON.stringify({
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days old
        })
      );

      await workspaceManager.cleanupOldSnapshots(7); // Keep 7 days

      expect(fs.rm).toHaveBeenCalledWith(
        expect.stringContaining('snapshot-1'),
        { recursive: true, force: true }
      );
      expect(fs.rm).toHaveBeenCalledWith(
        expect.stringContaining('snapshot-2'),
        { recursive: true, force: true }
      );
    });

    it('should keep recent snapshots', async () => {
      const fs = mockFs();

      // Mock recent snapshots
      fs.readdir.mockResolvedValue(['recent-snapshot']);
      fs.readFile.mockResolvedValue(
        JSON.stringify({
          createdAt: new Date(), // Recent
        })
      );

      await workspaceManager.cleanupOldSnapshots(7);

      expect(fs.rm).not.toHaveBeenCalled();
    });

    it('should handle missing metadata gracefully', async () => {
      const fs = mockFs();

      fs.readdir.mockResolvedValue(['corrupted-snapshot']);
      fs.readFile.mockRejectedValue(new Error('Metadata not found'));

      await expect(
        workspaceManager.cleanupOldSnapshots(7)
      ).resolves.not.toThrow();
    });
  });
});
