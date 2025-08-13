import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { ProjectDiscoveryService } from '@/lib/portable/project-discovery';
import { getProjectIndexService } from '@/lib/db/project-index';
import { promises as fs } from 'fs';
import path from 'path';

// Mock file system
const mockFs = {
  readdir: mock(() => Promise.resolve([])),
  stat: mock(() => Promise.resolve({ isDirectory: () => true })),
  access: mock(() => Promise.resolve()),
  readFile: mock(() => Promise.resolve('{}')),
};

// Mock getProjectIndexService
const mockIndexService = {
  getAllProjects: mock(() => Promise.resolve([])),
  syncWithProject: mock(() => Promise.resolve()),
  cleanupOrphanedEntries: mock(() => Promise.resolve({ removed: 0, archived: 0 })),
};

// Override modules
jest.mock('fs', () => ({
  promises: mockFs,
}));

jest.mock('@/lib/db/project-index', () => ({
  getProjectIndexService: () => mockIndexService,
}));

describe('ProjectDiscoveryService', () => {
  let service: ProjectDiscoveryService;
  const testReposPath = '/test/repos';

  beforeEach(() => {
    service = new ProjectDiscoveryService(testReposPath);
    
    // Reset all mocks
    Object.values(mockFs).forEach(fn => {
      if (fn.mockReset) fn.mockReset();
    });
    Object.values(mockIndexService).forEach(fn => {
      if (fn.mockReset) fn.mockReset();
    });
  });

  describe('discoverProjects', () => {
    test('應該發現並驗證 portable 專案', async () => {
      // Mock file system structure
      mockFs.readdir.mockImplementation((path: string) => {
        if (path === testReposPath) {
          return Promise.resolve(['project1', 'project2']);
        }
        if (path.includes('project1')) {
          return Promise.resolve(['.codehive', 'src', 'package.json']);
        }
        if (path.includes('project2')) {
          return Promise.resolve(['src', 'package.json']); // No .codehive
        }
        return Promise.resolve([]);
      });

      mockFs.stat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date(),
        size: 1000,
      });

      // Mock .codehive/project.json content
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('project1') && filePath.includes('project.json')) {
          return Promise.resolve(JSON.stringify({
            id: 'project1-id',
            name: '專案一',
            description: '測試專案一',
            status: 'ACTIVE',
            localPath: path.join(testReposPath, 'project1'),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
        }
        return Promise.resolve('{}');
      });

      mockIndexService.getAllProjects.mockResolvedValue([]);

      const projects = await service.discoverProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0].metadata.name).toBe('專案一');
      expect(projects[0].isValid).toBe(true);
      expect(mockIndexService.syncWithProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '專案一',
        })
      );
    });

    test('應該處理無效的專案（缺少 .codehive）', async () => {
      mockFs.readdir.mockImplementation((path: string) => {
        if (path === testReposPath) {
          return Promise.resolve(['invalid-project']);
        }
        return Promise.resolve(['src', 'package.json']); // No .codehive
      });

      mockFs.access.mockRejectedValue(new Error('ENOENT'));
      mockIndexService.getAllProjects.mockResolvedValue([]);

      const projects = await service.discoverProjects(true); // includeInvalid = true

      expect(projects).toHaveLength(1);
      expect(projects[0].isValid).toBe(false);
      expect(mockIndexService.syncWithProject).not.toHaveBeenCalled();
    });

    test('應該合併資料庫和檔案系統的專案', async () => {
      // Database projects
      const dbProjects = [
        {
          id: 'db-project-1',
          name: '資料庫專案',
          localPath: path.join(testReposPath, 'db-project'),
          status: 'ACTIVE',
        },
      ];

      // Filesystem projects
      mockFs.readdir.mockImplementation((path: string) => {
        if (path === testReposPath) {
          return Promise.resolve(['fs-project']);
        }
        if (path.includes('fs-project')) {
          return Promise.resolve(['.codehive']);
        }
        return Promise.resolve([]);
      });

      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('fs-project')) {
          return Promise.resolve(JSON.stringify({
            id: 'fs-project-1',
            name: '檔案系統專案',
            localPath: path.join(testReposPath, 'fs-project'),
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
        }
        if (filePath.includes('db-project')) {
          return Promise.resolve(JSON.stringify({
            id: 'db-project-1',
            name: '資料庫專案',
            localPath: path.join(testReposPath, 'db-project'),
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
        }
        return Promise.resolve('{}');
      });

      mockIndexService.getAllProjects.mockResolvedValue(dbProjects);

      const projects = await service.discoverProjects();

      expect(projects).toHaveLength(2);
      expect(projects.some(p => p.metadata.name === '資料庫專案')).toBe(true);
      expect(projects.some(p => p.metadata.name === '檔案系統專案')).toBe(true);
    });

    test('應該使用快取避免重複分析', async () => {
      mockFs.readdir.mockResolvedValue(['project1']);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        id: 'project1',
        name: '專案',
        localPath: path.join(testReposPath, 'project1'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      mockIndexService.getAllProjects.mockResolvedValue([]);

      // First call
      await service.discoverProjects();
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await service.discoverProjects();
      expect(mockFs.readFile).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });

  describe('scanForProjects', () => {
    test('應該遞迴掃描專案目錄', async () => {
      mockFs.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === testReposPath) {
          return Promise.resolve(['group1', 'project1']);
        }
        if (dirPath.includes('group1')) {
          return Promise.resolve(['project2', 'project3']);
        }
        return Promise.resolve([]);
      });

      mockFs.stat.mockImplementation((filePath: string) => {
        return Promise.resolve({
          isDirectory: () => !filePath.includes('.'),
        });
      });

      // Mock .codehive existence check
      let callCount = 0;
      mockFs.access.mockImplementation((filePath: string) => {
        if (filePath.includes('.codehive')) {
          callCount++;
          // project1 and project2 have .codehive
          if (callCount <= 2) {
            return Promise.resolve();
          }
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve();
      });

      const projects = await service.scanForProjects();

      expect(projects).toHaveLength(2);
    });

    test('應該處理掃描錯誤', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const projects = await service.scanForProjects();

      expect(projects).toHaveLength(0);
    });
  });

  describe('analyzeProject', () => {
    test('應該分析有效的專案', async () => {
      const projectPath = path.join(testReposPath, 'valid-project');
      
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 5000,
      });
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        id: 'valid-project',
        name: '有效專案',
        description: '這是有效專案',
        status: 'ACTIVE',
        localPath: projectPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const project = await service.analyzeProject(projectPath);

      expect(project).not.toBeNull();
      expect(project?.metadata.name).toBe('有效專案');
      expect(project?.isValid).toBe(true);
    });

    test('應該驗證專案 metadata', async () => {
      const projectPath = path.join(testReposPath, 'invalid-metadata');
      
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 1000,
      });
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        // Missing required fields
        name: '無效專案',
      }));

      const project = await service.analyzeProject(projectPath, true);

      expect(project).not.toBeNull();
      expect(project?.isValid).toBe(false);
    });

    test('應該處理讀取錯誤', async () => {
      const projectPath = path.join(testReposPath, 'error-project');
      
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const project = await service.analyzeProject(projectPath);

      expect(project).toBeNull();
    });
  });

  describe('getProjectByPath', () => {
    test('應該根據路徑獲取專案', async () => {
      const projectPath = path.join(testReposPath, 'project1');
      
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        id: 'project1',
        name: '專案一',
        localPath: projectPath,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 2000,
      });

      const project = await service.getProjectByPath(projectPath);

      expect(project).not.toBeNull();
      expect(project?.metadata.name).toBe('專案一');
    });

    test('應該使用快取', async () => {
      const projectPath = path.join(testReposPath, 'cached-project');
      
      // Pre-populate cache
      const cachedProject = {
        path: projectPath,
        metadata: {
          id: 'cached',
          name: '快取專案',
          localPath: projectPath,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        isValid: true,
        lastModified: new Date(),
        size: 1000,
      };
      
      // First call to populate cache
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(cachedProject.metadata));
      mockFs.stat.mockResolvedValue({
        mtime: cachedProject.lastModified,
        size: cachedProject.size,
      });
      
      await service.getProjectByPath(projectPath);
      
      // Second call should use cache
      const project = await service.getProjectByPath(projectPath);
      
      expect(project?.metadata.name).toBe('快取專案');
      expect(mockFs.readFile).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe('clearCache', () => {
    test('應該清除快取', async () => {
      const projectPath = path.join(testReposPath, 'project');
      
      // Populate cache
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        id: 'project',
        name: '專案',
        localPath: projectPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      mockFs.stat.mockResolvedValue({
        mtime: new Date(),
        size: 1000,
      });
      
      await service.getProjectByPath(projectPath);
      
      // Clear cache
      service.clearCache();
      
      // Next call should read from filesystem again
      await service.getProjectByPath(projectPath);
      
      expect(mockFs.readFile).toHaveBeenCalledTimes(2);
    });
  });
});