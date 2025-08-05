import { runImportAsync } from '@/lib/tasks/project-import';
import { prisma } from '@/lib/db';
import { TaskManager } from '@/lib/tasks/task-manager';
import fetch from 'node-fetch';

jest.mock('@/lib/db', () => ({
  prisma: {
    project: {
      update: jest.fn(),
    },
    taskExecution: {
      update: jest.fn(),
    },
  },
}));

jest.mock('node-fetch');

jest.mock('@/lib/git', () => ({
  gitClient: {
    generateProjectPath: jest.fn((name: string) => `/generated/path/${name}`),
    isValidRepository: jest.fn(),
    clone: jest.fn(),
    getCurrentBranch: jest.fn(),
    getRemoteUrl: jest.fn(),
  },
}));

jest.mock('@/lib/analysis/project-analyzer', () => ({
  projectAnalyzer: {
    analyzeProject: jest.fn(),
  },
}));

jest.mock('@/lib/sprints/default-sprint', () => ({
  createDefaultFirstSprint: jest.fn(),
}));

const mockPrismaDb = prisma as jest.Mocked<typeof prisma>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock TaskManager
const mockTaskManager = {
  startPhase: jest.fn(),
  updatePhaseProgress: jest.fn(),
  completePhase: jest.fn(),
  failPhase: jest.fn(),
  completeTask: jest.fn(),
  getInstance: jest.fn(),
};

jest.mock('@/lib/tasks/task-manager', () => ({
  TaskManager: {
    getInstance: () => mockTaskManager,
  },
}));

const { gitClient } = require('@/lib/git');
const { projectAnalyzer } = require('@/lib/analysis/project-analyzer');
const { createDefaultFirstSprint } = require('@/lib/sprints/default-sprint');

describe('Project Import', () => {
  const mockImportData = {
    projectName: 'Test Import Project',
    localPath: null,
    gitUrl: 'https://github.com/test/repo.git',
    branch: 'main',
    framework: 'react',
    language: 'typescript',
    packageManager: 'npm',
    testFramework: 'jest',
    lintTool: 'eslint',
    buildTool: 'webpack',
  };

  const mockAnalysisResult = {
    totalFiles: 150,
    totalSize: 5242880,
    detectedFramework: 'next',
    detectedLanguage: 'typescript',
    detectedPackageManager: 'npm',
    detectedTestFramework: 'jest',
    filesByType: {
      '.ts': 50,
      '.tsx': 30,
      '.js': 20,
      '.json': 10,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  describe('runImportAsync', () => {
    it('should import remote repository successfully', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      // Mock successful operations
      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      gitClient.generateProjectPath.mockReturnValue('/generated/path/Test Import Project');
      gitClient.isValidRepository.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      gitClient.clone.mockResolvedValue({
        success: true,
        output: 'Clone completed successfully',
      });
      gitClient.getCurrentBranch.mockResolvedValue('main');
      gitClient.getRemoteUrl.mockResolvedValue('https://github.com/test/repo.git');
      projectAnalyzer.analyzeProject.mockResolvedValue(mockAnalysisResult);
      createDefaultFirstSprint.mockResolvedValue({
        sprint: { id: 'sprint-1' },
        epic: { id: 'epic-1' },
        stories: [{ id: 'story-1' }],
      });

      // Mock successful description generation
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { context: 'Project context data' },
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { summary: 'AI-generated project summary' },
          }),
        } as any);

      await runImportAsync(taskId, projectId, mockImportData);

      // Verify task execution update
      expect(mockPrismaDb.taskExecution.update).toHaveBeenCalledWith({
        where: { taskId },
        data: { status: 'RUNNING' },
      });

      // Verify all phases were started
      expect(mockTaskManager.startPhase).toHaveBeenCalledWith(taskId, 'git_clone');
      expect(mockTaskManager.startPhase).toHaveBeenCalledWith(taskId, 'analysis');
      expect(mockTaskManager.startPhase).toHaveBeenCalledWith(taskId, 'sprint_setup');
      expect(mockTaskManager.startPhase).toHaveBeenCalledWith(taskId, 'completion');

      // Verify git clone
      expect(gitClient.clone).toHaveBeenCalledWith({
        url: 'https://github.com/test/repo.git',
        targetPath: '/generated/path/Test Import Project',
        branch: 'main',
        depth: 1,
        taskId: taskId,
        phaseId: 'git_clone',
      });

      // Verify project analysis
      expect(projectAnalyzer.analyzeProject).toHaveBeenCalledWith(
        '/generated/path/Test Import Project',
        taskId,
        'analysis'
      );

      // Verify sprint creation
      expect(createDefaultFirstSprint).toHaveBeenCalledWith(
        projectId,
        'Test Import Project'
      );

      // Verify project updates
      expect(mockPrismaDb.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          description: 'Imported from https://github.com/test/repo.git (recovered)',
          gitUrl: 'https://github.com/test/repo.git',
          localPath: '/generated/path/Test Import Project',
          status: 'ACTIVE',
          framework: 'react',
          language: 'typescript',
          packageManager: 'npm',
          testFramework: 'jest',
          lintTool: 'eslint',
          buildTool: 'webpack',
        },
      });

      // Verify final description update
      expect(mockPrismaDb.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: { description: 'AI-generated project summary (recovered)' },
      });

      // Verify task completion
      expect(mockTaskManager.completeTask).toHaveBeenCalledWith(taskId, {
        success: true,
        projectId,
        message: 'Git repository imported successfully from remote and project review initiated (recovered)',
        recovered: true,
      });
    });

    it('should import local repository successfully', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';
      const localImportData = {
        ...mockImportData,
        localPath: '/existing/local/repo',
        gitUrl: undefined,
      };

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      gitClient.isValidRepository.mockResolvedValue(true);
      gitClient.getCurrentBranch.mockResolvedValue('develop');
      gitClient.getRemoteUrl.mockResolvedValue('https://github.com/existing/repo.git');
      projectAnalyzer.analyzeProject.mockResolvedValue(mockAnalysisResult);
      createDefaultFirstSprint.mockResolvedValue({
        sprint: { id: 'sprint-1' },
        epic: { id: 'epic-1' },
        stories: [],
      });
      mockFetch.mockResolvedValue({ ok: false } as any);

      await runImportAsync(taskId, projectId, localImportData);

      // Should not call clone for local repository
      expect(gitClient.clone).not.toHaveBeenCalled();

      // Should complete git_clone phase with local repository info
      expect(mockTaskManager.completePhase).toHaveBeenCalledWith(
        taskId,
        'git_clone',
        {
          repositoryPath: '/existing/local/repo',
          repositoryType: 'local',
          recovered: true,
        }
      );
    });

    it('should handle existing remote repository', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      gitClient.generateProjectPath.mockReturnValue('/generated/path/Test Import Project');
      gitClient.isValidRepository.mockResolvedValue(true); // Repository already exists
      gitClient.getCurrentBranch.mockResolvedValue('main');
      gitClient.getRemoteUrl.mockResolvedValue('https://github.com/test/repo.git');
      projectAnalyzer.analyzeProject.mockResolvedValue(mockAnalysisResult);
      createDefaultFirstSprint.mockResolvedValue({
        sprint: { id: 'sprint-1' },
        epic: { id: 'epic-1' },
        stories: [],
      });
      mockFetch.mockResolvedValue({ ok: false } as any);

      await runImportAsync(taskId, projectId, mockImportData);

      // Should not clone since repository already exists
      expect(gitClient.clone).not.toHaveBeenCalled();

      expect(mockTaskManager.completePhase).toHaveBeenCalledWith(
        taskId,
        'git_clone',
        {
          repositoryPath: '/generated/path/Test Import Project',
          repositoryType: 'remote',
          alreadyExists: true,
          recovered: true,
        }
      );
    });

    it('should handle invalid local repository', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';
      const invalidLocalData = {
        ...mockImportData,
        localPath: '/invalid/path',
        gitUrl: undefined,
      };

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      gitClient.isValidRepository.mockResolvedValue(false);

      await runImportAsync(taskId, projectId, invalidLocalData);

      expect(mockTaskManager.failPhase).toHaveBeenCalledWith(
        taskId,
        'git_clone',
        'Path is not a valid Git repository'
      );
    });

    it('should handle git clone failure', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      gitClient.generateProjectPath.mockReturnValue('/generated/path/Test Import Project');
      gitClient.isValidRepository.mockResolvedValueOnce(false); // Not exists initially
      gitClient.clone.mockResolvedValue({
        success: false,
        error: 'Authentication failed',
      });

      await runImportAsync(taskId, projectId, mockImportData);

      expect(mockTaskManager.failPhase).toHaveBeenCalledWith(
        taskId,
        'git_clone',
        'Failed to clone repository: Authentication failed'
      );
    });

    it('should handle repository verification failure after clone', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      gitClient.generateProjectPath.mockReturnValue('/generated/path/Test Import Project');
      gitClient.isValidRepository
        .mockResolvedValueOnce(false) // Not exists initially
        .mockResolvedValueOnce(false); // Still invalid after clone
      gitClient.clone.mockResolvedValue({
        success: true,
        output: 'Clone completed',
      });

      await runImportAsync(taskId, projectId, mockImportData);

      expect(mockTaskManager.failPhase).toHaveBeenCalledWith(
        taskId,
        'git_clone',
        'Repository clone verification failed'
      );
    });

    it('should handle sprint creation failure gracefully', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      gitClient.generateProjectPath.mockReturnValue('/generated/path/Test Import Project');
      gitClient.isValidRepository.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      gitClient.clone.mockResolvedValue({ success: true, output: 'Clone completed' });
      gitClient.getCurrentBranch.mockResolvedValue('main');
      gitClient.getRemoteUrl.mockResolvedValue('https://github.com/test/repo.git');
      projectAnalyzer.analyzeProject.mockResolvedValue(mockAnalysisResult);
      createDefaultFirstSprint.mockRejectedValue(new Error('Sprint creation failed'));
      mockFetch.mockResolvedValue({ ok: false } as any);

      await runImportAsync(taskId, projectId, mockImportData);

      // Should complete sprint_setup phase with error but continue
      expect(mockTaskManager.completePhase).toHaveBeenCalledWith(
        taskId,
        'sprint_setup',
        {
          error: 'Sprint creation failed',
          recovered: true,
        }
      );

      // Should still complete the overall task
      expect(mockTaskManager.completeTask).toHaveBeenCalled();
    });

    it('should use detected framework when not provided', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';
      const dataWithoutTech = {
        projectName: 'Test Project',
        localPath: null,
        gitUrl: 'https://github.com/test/repo.git',
      };

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      gitClient.generateProjectPath.mockReturnValue('/generated/path/Test Project');
      gitClient.isValidRepository.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      gitClient.clone.mockResolvedValue({ success: true, output: 'Clone completed' });
      gitClient.getCurrentBranch.mockResolvedValue('main');
      gitClient.getRemoteUrl.mockResolvedValue('https://github.com/test/repo.git');
      projectAnalyzer.analyzeProject.mockResolvedValue(mockAnalysisResult);
      createDefaultFirstSprint.mockResolvedValue({
        sprint: { id: 'sprint-1' },
        epic: { id: 'epic-1' },
        stories: [],
      });
      mockFetch.mockResolvedValue({ ok: false } as any);

      await runImportAsync(taskId, projectId, dataWithoutTech);

      expect(mockPrismaDb.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: expect.objectContaining({
          framework: 'next', // From analysis result
          language: 'typescript', // From analysis result
          packageManager: 'npm', // From analysis result
          testFramework: 'jest', // From analysis result
        }),
      });
    });

    it('should handle description generation with context and summary', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      gitClient.generateProjectPath.mockReturnValue('/generated/path/Test Import Project');
      gitClient.isValidRepository.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      gitClient.clone.mockResolvedValue({ success: true, output: 'Clone completed' });
      gitClient.getCurrentBranch.mockResolvedValue('main');
      gitClient.getRemoteUrl.mockResolvedValue('https://github.com/test/repo.git');
      projectAnalyzer.analyzeProject.mockResolvedValue(mockAnalysisResult);
      createDefaultFirstSprint.mockResolvedValue({
        sprint: { id: 'sprint-1' },
        epic: { id: 'epic-1' },
        stories: [],
      });

      // Mock successful two-step description generation
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { context: 'Detailed project context' },
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { summary: 'Comprehensive project summary' },
          }),
        } as any);

      await runImportAsync(taskId, projectId, mockImportData);

      // Verify both API calls were made
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/agents/project-manager',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze',
            projectId: projectId,
          }),
        }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/agents/project-manager',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'summarize',
            context: 'Detailed project context',
          }),
        }
      );

      expect(mockPrismaDb.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: { description: 'Comprehensive project summary (recovered)' },
      });
    });

    it('should handle description generation failures', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      gitClient.generateProjectPath.mockReturnValue('/generated/path/Test Import Project');
      gitClient.isValidRepository.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      gitClient.clone.mockResolvedValue({ success: true, output: 'Clone completed' });
      gitClient.getCurrentBranch.mockResolvedValue('main');
      gitClient.getRemoteUrl.mockResolvedValue('https://github.com/test/repo.git');
      projectAnalyzer.analyzeProject.mockResolvedValue(mockAnalysisResult);
      createDefaultFirstSprint.mockResolvedValue({
        sprint: { id: 'sprint-1' },
        epic: { id: 'epic-1' },
        stories: [],
      });
      mockFetch.mockRejectedValue(new Error('Network error'));

      await runImportAsync(taskId, projectId, mockImportData);

      // Should use fallback description
      expect(mockPrismaDb.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: { description: 'Imported from https://github.com/test/repo.git (recovered)' },
      });
    });

    it('should handle complete import failure', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';
      const error = new Error('Critical failure');

      mockPrismaDb.taskExecution.update.mockRejectedValueOnce(error);
      mockPrismaDb.project.update.mockResolvedValue({} as any);

      await runImportAsync(taskId, projectId, mockImportData);

      // Should update project to ARCHIVED status
      expect(mockPrismaDb.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          status: 'ARCHIVED',
          description: '導入失敗 (recovery): Critical failure',
        },
      });

      // Should fail the phase
      expect(mockTaskManager.failPhase).toHaveBeenCalledWith(
        taskId,
        'unknown',
        'Failed to import project (recovery): Critical failure'
      );
    });

    it('should handle local path import without git URL', async () => {
      const taskId = 'test-task-id';
      const projectId = 'test-project-id';
      const localOnlyData = {
        projectName: 'Local Project',
        localPath: '/local/repo/path',
      };

      mockPrismaDb.taskExecution.update.mockResolvedValue({} as any);
      mockPrismaDb.project.update.mockResolvedValue({} as any);
      gitClient.isValidRepository.mockResolvedValue(true);
      gitClient.getCurrentBranch.mockResolvedValue('feature-branch');
      gitClient.getRemoteUrl.mockResolvedValue(null); // No remote URL
      projectAnalyzer.analyzeProject.mockResolvedValue(mockAnalysisResult);
      createDefaultFirstSprint.mockResolvedValue({
        sprint: { id: 'sprint-1' },
        epic: { id: 'epic-1' },
        stories: [],
      });
      mockFetch.mockResolvedValue({ ok: false } as any);

      await runImportAsync(taskId, projectId, localOnlyData);

      expect(mockPrismaDb.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: expect.objectContaining({
          description: 'Imported from local repository at /local/repo/path (recovered)',
          gitUrl: null,
          localPath: '/local/repo/path',
        }),
      });
    });
  });
});
