import { prisma } from '@/lib/db';
import { Epic, KanbanCard, Sprint } from '@prisma/client';

interface SprintWithDetails extends Sprint {
  stories: (KanbanCard & { epic: Epic | null })[];
  progress?: number;
}

interface SprintSummary {
  id: string;
  velocity: number | null;
  completedStoryPoints: number;
  duration: number;
  completedAt: Date | null;
}

export class SprintManager {
  /**
   * Create a new sprint for a project
   */
  async createSprint(data: {
    projectId: string;
    name: string;
    goal?: string;
    startDate: Date;
    endDate: Date;
    duration: number;
  }) {
    // Validate dates
    if (data.startDate >= data.endDate) {
      throw new Error('Start date must be before end date');
    }

    // Check for active project
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project || project.status !== 'ACTIVE') {
      throw new Error('Project must be active to create sprints');
    }

    // Check for overlapping sprints
    const overlapping = await this.checkOverlappingSprints(
      data.projectId,
      data.startDate,
      data.endDate
    );

    if (overlapping) {
      throw new Error('Sprint dates overlap with existing sprint');
    }

    // Create sprint
    const sprint = await prisma.sprint.create({
      data: {
        ...data,
        status: 'PLANNING',
        plannedStoryPoints: 0,
      },
    });

    // Initialize burndown
    await this.initializeBurndown(sprint.id, data.startDate);

    return sprint;
  }

  /**
   * Start a sprint (transition from PLANNING to ACTIVE)
   */
  async startSprint(sprintId: string) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { stories: true },
    });

    if (!sprint) {
      throw new Error('Sprint not found');
    }

    if (sprint.status !== 'PLANNING') {
      throw new Error('Sprint must be in PLANNING status to start');
    }

    // Check if there's already an active sprint
    const activeSprint = await prisma.sprint.findFirst({
      where: {
        projectId: sprint.projectId,
        status: 'ACTIVE',
      },
    });

    if (activeSprint) {
      throw new Error('There is already an active sprint for this project');
    }

    // Calculate committed story points
    const committedPoints = sprint.stories.reduce(
      (sum: number, story: KanbanCard) => sum + (story.storyPoints || 0),
      0
    );

    // Update sprint status
    const updatedSprint = await prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: 'ACTIVE',
        commitedStoryPoints: committedPoints,
      },
    });

    // Update story statuses from BACKLOG to TODO
    await prisma.kanbanCard.updateMany({
      where: {
        sprintId,
        status: 'BACKLOG',
      },
      data: {
        status: 'TODO',
      },
    });

    // Create daily update entry
    await this.createDailyUpdate(sprintId);

    return updatedSprint;
  }

  /**
   * Complete a sprint
   */
  async completeSprint(
    sprintId: string,
    data: {
      reviewNotes?: string;
      retrospectiveNotes?: string;
    }
  ) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { stories: true },
    });

    if (!sprint) {
      throw new Error('Sprint not found');
    }

    if (sprint.status !== 'ACTIVE') {
      throw new Error('Sprint must be ACTIVE to complete');
    }

    // Calculate completed story points
    const completedPoints = sprint.stories
      .filter((story: KanbanCard) => story.status === 'DONE')
      .reduce((sum: number, story: KanbanCard) => sum + (story.storyPoints || 0), 0);

    // Calculate velocity
    const velocity = completedPoints / sprint.duration;

    // Update sprint
    const updatedSprint = await prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: 'COMPLETED',
        completedStoryPoints: completedPoints,
        velocity,
        completedAt: new Date(),
        ...data,
      },
    });

    // Move incomplete stories back to backlog
    await prisma.kanbanCard.updateMany({
      where: {
        sprintId,
        status: { notIn: ['DONE'] },
      },
      data: {
        sprintId: null,
        status: 'BACKLOG',
      },
    });

    // Update epic progress
    await this.updateEpicProgress(sprint.projectId);

    return updatedSprint;
  }

  /**
   * Add stories to a sprint
   */
  async addStoriesToSprint(sprintId: string, storyIds: string[]) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint || sprint.status !== 'PLANNING') {
      throw new Error('Sprint must be in PLANNING status to add stories');
    }

    // Verify all stories belong to the same project
    const stories = await prisma.kanbanCard.findMany({
      where: {
        id: { in: storyIds },
      },
    });

    const invalidStories = stories.filter(
      (story: KanbanCard) => story.projectId !== sprint.projectId
    );

    if (invalidStories.length > 0) {
      throw new Error('All stories must belong to the same project as the sprint');
    }

    // Assign stories to sprint
    await prisma.kanbanCard.updateMany({
      where: {
        id: { in: storyIds },
      },
      data: {
        sprintId,
      },
    });

    // Update sprint metrics
    await this.updateSprintMetrics(sprintId);

    return true;
  }

  /**
   * Update story status and recalculate burndown
   */
  async updateStoryStatus(storyId: string, newStatus: string) {
    const story = await prisma.kanbanCard.findUnique({
      where: { id: storyId },
      include: { sprint: true },
    });

    if (!story || !story.sprintId) {
      throw new Error('Story not found or not assigned to a sprint');
    }

    if (story.sprint?.status !== 'ACTIVE') {
      throw new Error('Sprint must be active to update story status');
    }

    // Update story status
    await prisma.kanbanCard.update({
      where: { id: storyId },
      data: { status: newStatus },
    });

    // Update burndown
    await this.updateBurndown(story.sprintId);

    // Update daily update
    await this.updateDailyProgress(story.sprintId);

    return true;
  }

  /**
   * Get sprint velocity history for a project
   */
  async getVelocityHistory(projectId: string, limit = 5) {
    const completedSprints = await prisma.sprint.findMany({
      where: {
        projectId,
        status: 'COMPLETED',
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        name: true,
        velocity: true,
        completedStoryPoints: true,
        duration: true,
        completedAt: true,
      },
    });

    const averageVelocity =
      completedSprints.reduce((sum: number, sprint: SprintSummary) => sum + (sprint.velocity || 0), 0) /
      completedSprints.length;

    return {
      sprints: completedSprints,
      averageVelocity: averageVelocity || 0,
    };
  }

  /**
   * Private helper methods
   */
  private async checkOverlappingSprints(
    projectId: string,
    startDate: Date,
    endDate: Date
  ) {
    return prisma.sprint.findFirst({
      where: {
        projectId,
        status: { in: ['PLANNING', 'ACTIVE'] },
        OR: [
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: startDate } },
            ],
          },
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: endDate } },
            ],
          },
        ],
      },
    });
  }

  private async initializeBurndown(sprintId: string, startDate: Date) {
    await prisma.sprintBurndown.create({
      data: {
        sprintId,
        date: startDate,
        remainingStoryPoints: 0,
        completedStoryPoints: 0,
        idealRemainingPoints: 0,
      },
    });
  }

  private async updateSprintMetrics(sprintId: string) {
    const stories = await prisma.kanbanCard.findMany({
      where: { sprintId },
    });

    const totalPoints = stories.reduce(
      (sum: number, story: KanbanCard) => sum + (story.storyPoints || 0),
      0
    );

    await prisma.sprint.update({
      where: { id: sprintId },
      data: {
        plannedStoryPoints: totalPoints,
      },
    });

    // Update sprint epics
    const epicGroups = stories.reduce((acc: Record<string, number>, story: KanbanCard) => {
      if (story.epicId) {
        acc[story.epicId] = (acc[story.epicId] || 0) + (story.storyPoints || 0);
      }
      return acc;
    }, {} as Record<string, number>);

    for (const [epicId, points] of Object.entries(epicGroups)) {
      await prisma.sprintEpic.upsert({
        where: {
          sprintId_epicId: {
            sprintId,
            epicId,
          },
        },
        create: {
          sprintId,
          epicId,
          plannedStoryPoints: points,
        },
        update: {
          plannedStoryPoints: points,
        },
      });
    }
  }

  private async updateBurndown(sprintId: string) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint) return;

    const stories = await prisma.kanbanCard.findMany({
      where: { sprintId },
    });

    const completedPoints = stories
      .filter((s: KanbanCard) => s.status === 'DONE')
      .reduce((sum: number, s: KanbanCard) => sum + (s.storyPoints || 0), 0);

    const remainingPoints = stories
      .filter((s: KanbanCard) => s.status !== 'DONE')
      .reduce((sum: number, s: KanbanCard) => sum + (s.storyPoints || 0), 0);

    // Calculate ideal burndown
    const today = new Date();
    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysElapsed = Math.ceil(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const dailyBurnRate = sprint.plannedStoryPoints / totalDays;
    const idealRemaining = Math.max(
      0,
      sprint.plannedStoryPoints - dailyBurnRate * daysElapsed
    );

    await prisma.sprintBurndown.upsert({
      where: {
        sprintId_date: {
          sprintId,
          date: new Date(today.toISOString().split('T')[0]),
        },
      },
      create: {
        sprintId,
        date: new Date(today.toISOString().split('T')[0]),
        remainingStoryPoints: remainingPoints,
        completedStoryPoints: completedPoints,
        idealRemainingPoints: idealRemaining,
      },
      update: {
        remainingStoryPoints: remainingPoints,
        completedStoryPoints: completedPoints,
        idealRemainingPoints: idealRemaining,
      },
    });
  }

  private async createDailyUpdate(sprintId: string) {
    const stories = await prisma.kanbanCard.findMany({
      where: { sprintId },
    });

    const completed = stories.filter((s: KanbanCard) => s.status === 'DONE').length;
    const inProgress = stories.filter((s: KanbanCard) => s.status === 'IN_PROGRESS').length;

    await prisma.sprintDailyUpdate.create({
      data: {
        sprintId,
        date: new Date(),
        storiesCompleted: completed,
        storiesInProgress: inProgress,
      },
    });
  }

  private async updateDailyProgress(sprintId: string) {
    const stories = await prisma.kanbanCard.findMany({
      where: { sprintId },
    });

    const completed = stories.filter((s: KanbanCard) => s.status === 'DONE').length;
    const inProgress = stories.filter((s: KanbanCard) => s.status === 'IN_PROGRESS').length;

    await prisma.sprintDailyUpdate.upsert({
      where: {
        sprintId_date: {
          sprintId,
          date: new Date(new Date().toISOString().split('T')[0]),
        },
      },
      create: {
        sprintId,
        date: new Date(new Date().toISOString().split('T')[0]),
        storiesCompleted: completed,
        storiesInProgress: inProgress,
      },
      update: {
        storiesCompleted: completed,
        storiesInProgress: inProgress,
      },
    });
  }

  private async updateEpicProgress(projectId: string) {
    const epics = await prisma.epic.findMany({
      where: { projectId },
      include: { stories: true },
    });

    for (const epic of epics) {
      const completedPoints = epic.stories
        .filter((s: KanbanCard) => s.status === 'DONE')
        .reduce((sum: number, s: KanbanCard) => sum + (s.storyPoints || 0), 0);

      await prisma.epic.update({
        where: { id: epic.id },
        data: {
          actualStoryPoints: completedPoints,
        },
      });
    }
  }
}