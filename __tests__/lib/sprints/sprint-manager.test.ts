import { SprintManager } from '@/lib/sprints/sprint-manager';
import { prisma } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
    },
    sprint: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    kanbanCard: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    burndownEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const mockPrismaDb = prisma as jest.Mocked<typeof prisma>;

describe('SprintManager', () => {
  let sprintManager: SprintManager;

  const mockProject = {
    id: 'test-project-id',
    name: 'Test Project',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSprint = {
    id: 'test-sprint-id',
    projectId: 'test-project-id',
    name: 'Test Sprint',
    goal: 'Implement core features',
    status: 'PLANNING',
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-01-14'),
    duration: 14,
    plannedStoryPoints: 20,
    velocity: null,
    completedStoryPoints: 0,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStories = [
    {
      id: 'story-1',
      title: 'User Authentication',
      storyPoints: 8,
      status: 'TODO',
      sprintId: 'test-sprint-id',
      epic: { id: 'epic-1', title: 'User Management' },
    },
    {
      id: 'story-2',
      title: 'Dashboard UI',
      storyPoints: 5,
      status: 'TODO',
      sprintId: 'test-sprint-id',
      epic: { id: 'epic-2', title: 'Frontend' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    sprintManager = new SprintManager();
  });

  describe('createSprint', () => {
    const validSprintData = {
      projectId: 'test-project-id',
      name: 'Test Sprint',
      goal: 'Implement core features',
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-01-14'),
      duration: 14,
    };

    it('should create sprint successfully', async () => {
      mockPrismaDb.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrismaDb.sprint.findFirst.mockResolvedValue(null); // No overlapping sprints
      mockPrismaDb.sprint.create.mockResolvedValue(mockSprint as any);
      mockPrismaDb.burndownEntry.create.mockResolvedValue({} as any);

      const result = await sprintManager.createSprint(validSprintData);

      expect(result).toEqual(mockSprint);
      expect(mockPrismaDb.sprint.create).toHaveBeenCalledWith({
        data: {
          ...validSprintData,
          status: 'PLANNING',
          plannedStoryPoints: 0,
        },
      });
    });

    it('should throw error for invalid date range', async () => {
      const invalidData = {
        ...validSprintData,
        startDate: new Date('2023-01-14'),
        endDate: new Date('2023-01-01'),
      };

      await expect(sprintManager.createSprint(invalidData)).rejects.toThrow(
        'Start date must be before end date'
      );
    });

    it('should throw error for inactive project', async () => {
      mockPrismaDb.project.findUnique.mockResolvedValue({
        ...mockProject,
        status: 'INACTIVE',
      } as any);

      await expect(sprintManager.createSprint(validSprintData)).rejects.toThrow(
        'Project must be active to create sprints'
      );
    });

    it('should throw error for non-existent project', async () => {
      mockPrismaDb.project.findUnique.mockResolvedValue(null);

      await expect(sprintManager.createSprint(validSprintData)).rejects.toThrow(
        'Project must be active to create sprints'
      );
    });

    it('should throw error for overlapping sprints', async () => {
      mockPrismaDb.project.findUnique.mockResolvedValue(mockProject as any);
      mockPrismaDb.sprint.findFirst.mockResolvedValue(mockSprint as any); // Overlapping sprint exists

      await expect(sprintManager.createSprint(validSprintData)).rejects.toThrow(
        'Sprint dates overlap with existing sprint'
      );
    });
  });

  describe('startSprint', () => {
    it('should start sprint successfully', async () => {
      const sprintWithStories = {
        ...mockSprint,
        stories: mockStories,
      };
      const startedSprint = {
        ...mockSprint,
        status: 'ACTIVE',
        plannedStoryPoints: 13, // 8 + 5
      };

      mockPrismaDb.sprint.findUnique.mockResolvedValue(sprintWithStories as any);
      mockPrismaDb.sprint.findFirst.mockResolvedValue(null); // No active sprint
      mockPrismaDb.sprint.update.mockResolvedValue(startedSprint as any);

      const result = await sprintManager.startSprint('test-sprint-id');

      expect(result).toEqual(startedSprint);
      expect(mockPrismaDb.sprint.update).toHaveBeenCalledWith({
        where: { id: 'test-sprint-id' },
        data: {
          status: 'ACTIVE',
          plannedStoryPoints: 13,
        },
      });
    });

    it('should throw error for non-existent sprint', async () => {
      mockPrismaDb.sprint.findUnique.mockResolvedValue(null);

      await expect(sprintManager.startSprint('non-existent-sprint')).rejects.toThrow(
        'Sprint not found'
      );
    });

    it('should throw error if sprint is not in PLANNING status', async () => {
      mockPrismaDb.sprint.findUnique.mockResolvedValue({
        ...mockSprint,
        status: 'ACTIVE',
        stories: [],
      } as any);

      await expect(sprintManager.startSprint('test-sprint-id')).rejects.toThrow(
        'Sprint must be in PLANNING status to start'
      );
    });

    it('should throw error if there is already an active sprint', async () => {
      mockPrismaDb.sprint.findUnique.mockResolvedValue({
        ...mockSprint,
        stories: [],
      } as any);
      mockPrismaDb.sprint.findFirst.mockResolvedValue({
        id: 'other-sprint-id',
        status: 'ACTIVE',
      } as any);

      await expect(sprintManager.startSprint('test-sprint-id')).rejects.toThrow(
        'There is already an active sprint for this project'
      );
    });
  });

  describe('completeSprint', () => {
    it('should complete sprint successfully', async () => {
      const activeSprint = {
        ...mockSprint,
        status: 'ACTIVE',
        stories: mockStories,
      };
      const completedSprint = {
        ...activeSprint,
        status: 'COMPLETED',
        completedAt: new Date(),
        velocity: 10,
        completedStoryPoints: 10,
      };

      mockPrismaDb.sprint.findUnique.mockResolvedValue(activeSprint as any);
      mockPrismaDb.kanbanCard.findMany.mockResolvedValue([
        { ...mockStories[0], status: 'DONE' }, // 8 points completed
        { ...mockStories[1], status: 'TODO' }, // 5 points not completed
      ] as any);
      mockPrismaDb.sprint.update.mockResolvedValue(completedSprint as any);
      mockPrismaDb.kanbanCard.updateMany.mockResolvedValue({ count: 1 } as any);

      const result = await sprintManager.completeSprint('test-sprint-id');

      expect(result).toEqual(completedSprint);
      expect(mockPrismaDb.sprint.update).toHaveBeenCalledWith({
        where: { id: 'test-sprint-id' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
          velocity: expect.any(Number),
          completedStoryPoints: expect.any(Number),
        },
      });
    });

    it('should throw error for non-existent sprint', async () => {
      mockPrismaDb.sprint.findUnique.mockResolvedValue(null);

      await expect(sprintManager.completeSprint('non-existent-sprint')).rejects.toThrow(
        'Sprint not found'
      );
    });

    it('should throw error if sprint is not active', async () => {
      mockPrismaDb.sprint.findUnique.mockResolvedValue({
        ...mockSprint,
        status: 'PLANNING',
      } as any);

      await expect(sprintManager.completeSprint('test-sprint-id')).rejects.toThrow(
        'Sprint must be active to complete'
      );
    });
  });

  describe('getActiveSprint', () => {
    it('should return active sprint for project', async () => {
      const activeSprint = {
        ...mockSprint,
        status: 'ACTIVE',
        stories: mockStories,
      };

      mockPrismaDb.sprint.findFirst.mockResolvedValue(activeSprint as any);

      const result = await sprintManager.getActiveSprint('test-project-id');

      expect(result).toEqual(activeSprint);
      expect(mockPrismaDb.sprint.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'test-project-id',
          status: 'ACTIVE',
        },
        include: {
          stories: {
            include: { epic: true },
          },
        },
      });
    });

    it('should return null if no active sprint', async () => {
      mockPrismaDb.sprint.findFirst.mockResolvedValue(null);

      const result = await sprintManager.getActiveSprint('test-project-id');

      expect(result).toBeNull();
    });
  });

  describe('getSprintBurndown', () => {
    it('should return burndown data for sprint', async () => {
      const burndownEntries = [
        {
          id: 'entry-1',
          sprintId: 'test-sprint-id',
          date: new Date('2023-01-01'),
          remainingPoints: 13,
          idealRemaining: 13,
        },
        {
          id: 'entry-2',
          sprintId: 'test-sprint-id',
          date: new Date('2023-01-02'),
          remainingPoints: 10,
          idealRemaining: 12,
        },
      ];

      mockPrismaDb.burndownEntry.findMany.mockResolvedValue(burndownEntries as any);

      const result = await sprintManager.getSprintBurndown('test-sprint-id');

      expect(result).toEqual(burndownEntries);
      expect(mockPrismaDb.burndownEntry.findMany).toHaveBeenCalledWith({
        where: { sprintId: 'test-sprint-id' },
        orderBy: { date: 'asc' },
      });
    });
  });

  describe('addStoryToSprint', () => {
    it('should add story to sprint successfully', async () => {
      const planningSprint = {
        ...mockSprint,
        status: 'PLANNING',
      };
      const story = {
        id: 'story-3',
        title: 'New Feature',
        storyPoints: 3,
      };

      mockPrismaDb.sprint.findUnique.mockResolvedValue(planningSprint as any);
      mockPrismaDb.kanbanCard.findMany.mockResolvedValue([story] as any);
      mockPrismaDb.sprint.update.mockResolvedValue({
        ...planningSprint,
        plannedStoryPoints: 3,
      } as any);

      const result = await sprintManager.addStoryToSprint('test-sprint-id', 'story-3');

      expect(result).toBeDefined();
      expect(mockPrismaDb.sprint.update).toHaveBeenCalledWith({
        where: { id: 'test-sprint-id' },
        data: { plannedStoryPoints: 3 },
      });
    });

    it('should throw error if sprint is not in planning', async () => {
      mockPrismaDb.sprint.findUnique.mockResolvedValue({
        ...mockSprint,
        status: 'ACTIVE',
      } as any);

      await expect(
        sprintManager.addStoryToSprint('test-sprint-id', 'story-3')
      ).rejects.toThrow('Stories can only be added to sprints in PLANNING status');
    });
  });

  describe('removeStoryFromSprint', () => {
    it('should remove story from sprint successfully', async () => {
      const planningSprint = {
        ...mockSprint,
        status: 'PLANNING',
        plannedStoryPoints: 13,
      };

      mockPrismaDb.sprint.findUnique.mockResolvedValue(planningSprint as any);
      mockPrismaDb.kanbanCard.findMany.mockResolvedValue([
        { ...mockStories[1], storyPoints: 5 }, // Remaining story
      ] as any);
      mockPrismaDb.sprint.update.mockResolvedValue({
        ...planningSprint,
        plannedStoryPoints: 5,
      } as any);

      const result = await sprintManager.removeStoryFromSprint('test-sprint-id', 'story-1');

      expect(result).toBeDefined();
      expect(mockPrismaDb.sprint.update).toHaveBeenCalledWith({
        where: { id: 'test-sprint-id' },
        data: { plannedStoryPoints: 5 },
      });
    });
  });

  describe('getSprintVelocity', () => {
    it('should calculate average velocity from past sprints', async () => {
      const pastSprints = [
        { velocity: 15, completedStoryPoints: 15, duration: 14, completedAt: new Date() },
        { velocity: 12, completedStoryPoints: 12, duration: 14, completedAt: new Date() },
        { velocity: 18, completedStoryPoints: 18, duration: 14, completedAt: new Date() },
      ];

      mockPrismaDb.sprint.findMany.mockResolvedValue(pastSprints as any);

      const result = await sprintManager.getSprintVelocity('test-project-id');

      expect(result).toBe(15); // (15 + 12 + 18) / 3
      expect(mockPrismaDb.sprint.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'test-project-id',
          status: 'COMPLETED',
          velocity: { not: null },
        },
        orderBy: { completedAt: 'desc' },
        take: 5,
      });
    });

    it('should return null if no completed sprints', async () => {
      mockPrismaDb.sprint.findMany.mockResolvedValue([]);

      const result = await sprintManager.getSprintVelocity('test-project-id');

      expect(result).toBeNull();
    });
  });

  describe('updateBurndown', () => {
    it('should update burndown entry successfully', async () => {
      const date = new Date('2023-01-05');
      const burndownEntry = {
        id: 'entry-5',
        sprintId: 'test-sprint-id',
        date,
        remainingPoints: 8,
        idealRemaining: 6,
      };

      mockPrismaDb.burndownEntry.create.mockResolvedValue(burndownEntry as any);

      const result = await sprintManager.updateBurndown('test-sprint-id', date, 8, 6);

      expect(result).toEqual(burndownEntry);
      expect(mockPrismaDb.burndownEntry.create).toHaveBeenCalledWith({
        data: {
          sprintId: 'test-sprint-id',
          date,
          remainingPoints: 8,
          idealRemaining: 6,
        },
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrismaDb.project.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(
        sprintManager.createSprint({
          projectId: 'test-project-id',
          name: 'Test Sprint',
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-01-14'),
          duration: 14,
        })
      ).rejects.toThrow('Database error');
    });

    it('should handle invalid sprint ID', async () => {
      mockPrismaDb.sprint.findUnique.mockResolvedValue(null);

      await expect(sprintManager.startSprint('invalid-id')).rejects.toThrow(
        'Sprint not found'
      );
    });
  });
});
