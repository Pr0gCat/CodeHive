import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { ProjectIndexService } from '@/lib/db/project-index';
import { prisma } from '@/lib/db';
import { ProjectMetadata } from '@/lib/portable/schemas';

// Mock prisma client
const mockProjectIndex = {
  create: mock(() => Promise.resolve({})),
  upsert: mock(() => Promise.resolve({})),
  update: mock(() => Promise.resolve({})),
  findUnique: mock(() => Promise.resolve(null)),
  findMany: mock(() => Promise.resolve([])),
  count: mock(() => Promise.resolve(0)),
  aggregate: mock(() => Promise.resolve({ _sum: {} })),
};

// Override prisma.projectIndex
(prisma as any).projectIndex = mockProjectIndex;

describe('ProjectIndexService', () => {
  let service: ProjectIndexService;

  beforeEach(() => {
    service = new ProjectIndexService();
    // Reset all mocks
    Object.values(mockProjectIndex).forEach(fn => {
      if (fn.mockReset) fn.mockReset();
    });
  });

  describe('registerProject', () => {
    test('應該使用 upsert 來處理重複的 localPath', async () => {
      const metadata: ProjectMetadata = {
        id: 'test-project-1',
        name: '測試專案',
        description: '測試描述',
        localPath: '/test/path',
        gitUrl: 'https://github.com/test/repo',
        status: 'ACTIVE',
        framework: 'Next.js',
        language: 'TypeScript',
        packageManager: 'bun',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const expectedProject = {
        ...metadata,
        projectType: 'PORTABLE',
      };

      mockProjectIndex.upsert.mockResolvedValue(expectedProject);

      const result = await service.registerProject(metadata, 'LOCAL_FOLDER');

      expect(mockProjectIndex.upsert).toHaveBeenCalledWith({
        where: {
          localPath: metadata.localPath,
        },
        update: expect.objectContaining({
          id: metadata.id,
          name: metadata.name,
          description: metadata.description,
        }),
        create: expect.objectContaining({
          id: metadata.id,
          name: metadata.name,
          localPath: metadata.localPath,
          importSource: 'LOCAL_FOLDER',
          projectType: 'PORTABLE',
        }),
      });

      expect(result).toEqual(expectedProject);
    });

    test('應該正確處理沒有 importSource 的情況', async () => {
      const metadata: ProjectMetadata = {
        id: 'test-project-2',
        name: '測試專案2',
        localPath: '/test/path2',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await service.registerProject(metadata);

      expect(mockProjectIndex.upsert).toHaveBeenCalledWith({
        where: {
          localPath: metadata.localPath,
        },
        update: expect.any(Object),
        create: expect.objectContaining({
          importSource: undefined,
        }),
      });
    });
  });

  describe('updateProject', () => {
    test('應該更新專案資訊', async () => {
      const projectId = 'test-project-1';
      const updates = {
        name: '更新的專案名稱',
        description: '更新的描述',
        status: 'PAUSED' as const,
      };

      const expectedProject = {
        id: projectId,
        ...updates,
        updatedAt: new Date(),
      };

      mockProjectIndex.update.mockResolvedValue(expectedProject);

      const result = await service.updateProject(projectId, updates);

      expect(mockProjectIndex.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: expect.objectContaining({
          ...updates,
          updatedAt: expect.any(Date),
        }),
      });

      expect(result).toEqual(expectedProject);
    });
  });

  describe('getProjectByPath', () => {
    test('應該根據路徑查找專案', async () => {
      const localPath = '/test/path';
      const expectedProject = {
        id: 'test-project',
        name: '測試專案',
        localPath,
      };

      mockProjectIndex.findUnique.mockResolvedValue(expectedProject);

      const result = await service.getProjectByPath(localPath);

      expect(mockProjectIndex.findUnique).toHaveBeenCalledWith({
        where: { localPath },
      });

      expect(result).toEqual(expectedProject);
    });

    test('應該在找不到專案時返回 null', async () => {
      mockProjectIndex.findUnique.mockResolvedValue(null);

      const result = await service.getProjectByPath('/non-existent');

      expect(result).toBeNull();
    });
  });

  describe('projectPathExists', () => {
    test('應該檢查路徑是否存在', async () => {
      const localPath = '/test/path';
      
      mockProjectIndex.count.mockResolvedValue(1);
      const exists = await service.projectPathExists(localPath);
      expect(exists).toBe(true);

      mockProjectIndex.count.mockResolvedValue(0);
      const notExists = await service.projectPathExists('/non-existent');
      expect(notExists).toBe(false);
    });
  });

  describe('archiveProject', () => {
    test('應該將專案狀態設為 ARCHIVED', async () => {
      const projectId = 'test-project';
      const expectedProject = {
        id: projectId,
        status: 'ARCHIVED',
        updatedAt: new Date(),
      };

      mockProjectIndex.update.mockResolvedValue(expectedProject);

      const result = await service.archiveProject(projectId);

      expect(mockProjectIndex.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          status: 'ARCHIVED',
          updatedAt: expect.any(Date),
        },
      });

      expect(result.status).toBe('ARCHIVED');
    });
  });

  describe('getAllProjects', () => {
    test('應該排除已歸檔的專案（預設）', async () => {
      const projects = [
        { id: '1', status: 'ACTIVE' },
        { id: '2', status: 'PAUSED' },
      ];

      mockProjectIndex.findMany.mockResolvedValue(projects);

      const result = await service.getAllProjects();

      expect(mockProjectIndex.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            not: 'ARCHIVED',
          },
        },
        orderBy: {
          lastAccessedAt: 'desc',
        },
      });

      expect(result).toEqual(projects);
    });

    test('應該包含已歸檔的專案（當 includeInactive = true）', async () => {
      const projects = [
        { id: '1', status: 'ACTIVE' },
        { id: '2', status: 'ARCHIVED' },
      ];

      mockProjectIndex.findMany.mockResolvedValue(projects);

      const result = await service.getAllProjects({ includeInactive: true });

      expect(mockProjectIndex.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: {
          lastAccessedAt: 'desc',
        },
      });
    });

    test('應該支援自定義排序', async () => {
      await service.getAllProjects({
        orderBy: 'name',
        orderDirection: 'asc',
      });

      expect(mockProjectIndex.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        orderBy: {
          name: 'asc',
        },
      });
    });
  });

  describe('updateProjectHealth', () => {
    test('應該更新專案健康狀態', async () => {
      const projectId = 'test-project';
      const isHealthy = true;
      const lastHealthCheck = new Date();

      const expectedProject = {
        id: projectId,
        isHealthy,
        lastHealthCheck,
        updatedAt: new Date(),
      };

      mockProjectIndex.update.mockResolvedValue(expectedProject);

      const result = await service.updateProjectHealth(projectId, isHealthy, lastHealthCheck);

      expect(mockProjectIndex.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          isHealthy,
          lastHealthCheck,
          updatedAt: expect.any(Date),
        },
      });

      expect(result.isHealthy).toBe(isHealthy);
    });
  });

  describe('searchProjects', () => {
    test('應該根據名稱或描述搜索專案', async () => {
      const query = '測試';
      const projects = [
        { id: '1', name: '測試專案1' },
        { id: '2', description: '這是測試' },
      ];

      mockProjectIndex.findMany.mockResolvedValue(projects);

      const result = await service.searchProjects(query);

      expect(mockProjectIndex.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              OR: [
                { name: { contains: query } },
                { description: { contains: query } },
              ],
            },
            {
              status: {
                not: 'ARCHIVED',
              },
            },
          ],
        },
        orderBy: {
          lastAccessedAt: 'desc',
        },
      });

      expect(result).toEqual(projects);
    });
  });

  describe('getProjectSummary', () => {
    test('應該返回專案統計摘要', async () => {
      mockProjectIndex.count.mockImplementation((args: any) => {
        if (!args?.where) return Promise.resolve(10);
        if (args.where.status === 'ACTIVE') return Promise.resolve(5);
        if (args.where.status === 'PAUSED') return Promise.resolve(2);
        if (args.where.status === 'ARCHIVED') return Promise.resolve(3);
        if (args.where.isHealthy === false) return Promise.resolve(1);
        return Promise.resolve(0);
      });

      mockProjectIndex.aggregate.mockResolvedValue({
        _sum: {
          epicCount: 15,
          storyCount: 45,
          tokenUsage: 10000,
        },
      });

      const result = await service.getProjectSummary();

      expect(result).toEqual({
        totalProjects: 10,
        activeProjects: 5,
        pausedProjects: 2,
        archivedProjects: 3,
        unhealthyProjects: 1,
        totalEpics: 15,
        totalStories: 45,
        totalTokenUsage: 10000,
      });
    });
  });

  describe('syncWithProject', () => {
    test('應該更新現有專案', async () => {
      const metadata: ProjectMetadata = {
        id: 'existing-project',
        name: '現有專案',
        localPath: '/existing/path',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock getProjectById to return existing project
      const spy = spyOn(service, 'getProjectById');
      spy.mockResolvedValue({
        id: metadata.id,
        name: '舊名稱',
        localPath: metadata.localPath,
      } as any);

      mockProjectIndex.update.mockResolvedValue(metadata);

      await service.syncWithProject(metadata);

      expect(mockProjectIndex.update).toHaveBeenCalled();
      expect(mockProjectIndex.upsert).not.toHaveBeenCalled();
    });

    test('應該創建新專案（如果不存在）', async () => {
      const metadata: ProjectMetadata = {
        id: 'new-project',
        name: '新專案',
        localPath: '/new/path',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock getProjectById to return null
      const spy = spyOn(service, 'getProjectById');
      spy.mockResolvedValue(null);

      mockProjectIndex.upsert.mockResolvedValue(metadata);

      await service.syncWithProject(metadata);

      expect(mockProjectIndex.upsert).toHaveBeenCalled();
      expect(mockProjectIndex.update).not.toHaveBeenCalled();
    });
  });
});