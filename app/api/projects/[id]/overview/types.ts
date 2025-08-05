import type {
  Project,
  Epic,
  KanbanCard,
  Cycle,
  Query,
  MVPPhase,
  EpicDependency,
  StoryDependency,
} from '@prisma/client';

// Extended types with relations
export interface ProjectWithRelations extends Project {
  epics: EpicWithRelations[];
  mvpPhases: MVPPhase[];
  kanbanCards: StoryWithCycles[];
  cycles: Pick<Cycle, 'id' | 'phase' | 'status' | 'storyId'>[];
  queries: Pick<Query, 'id' | 'type' | 'title' | 'urgency' | 'createdAt'>[];
}

export interface EpicWithRelations extends Epic {
  stories: StoryWithRelations[];
  dependencies: EpicDependencyWithRelation[];
}

export interface StoryWithRelations extends KanbanCard {
  cycles: Pick<Cycle, 'id' | 'title' | 'phase' | 'status'>[];
  dependencies: StoryDependencyWithRelation[];
}

export interface StoryWithCycles extends KanbanCard {
  cycles: Pick<Cycle, 'id' | 'title' | 'phase' | 'status'>[];
}

export interface EpicDependencyWithRelation extends EpicDependency {
  dependsOn: Pick<Epic, 'id' | 'title' | 'phase' | 'status'>;
}

export interface StoryDependencyWithRelation extends StoryDependency {
  dependsOn: Pick<KanbanCard, 'id' | 'title' | 'status' | 'epicId'>;
}

// Statistics types
export interface EpicStats {
  total: number;
  byPhase: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface StoryStats {
  total: number;
  withEpics: number;
  standalone: number;
  byStatus: Record<string, number>;
  totalStoryPoints: number;
  completedStoryPoints: number;
}

export interface CycleStats {
  total: number;
  byPhase: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface OverallProgress {
  epics: number;
  stories: number;
  storyPoints: number;
  cycles: number;
}

export interface ProjectStatistics {
  epics: EpicStats;
  stories: StoryStats;
  cycles: CycleStats;
  progress: OverallProgress;
}

// Hierarchical data types
export interface HierarchicalEpic {
  id: string;
  title: string;
  type: string;
  phase: string;
  status: string;
  mvpPriority: string;
  progress: {
    stories: {
      total: number;
      completed: number;
    };
    cycles: {
      total: number;
      completed: number;
    };
  };
  stories: HierarchicalStory[];
  dependencies: EpicDependencyWithRelation[];
}

export interface HierarchicalStory {
  id: string;
  title: string;
  status: string;
  storyPoints: number | null;
  tddEnabled: boolean;
  cycles: Pick<Cycle, 'id' | 'title' | 'phase' | 'status'>[];
  hasBlockers: boolean;
}

export interface HierarchicalData {
  epics: HierarchicalEpic[];
  standaloneStories: {
    id: string;
    title: string;
    status: string;
    storyPoints: number | null;
    tddEnabled: boolean;
    cycles: Pick<Cycle, 'id' | 'title' | 'phase' | 'status'>[];
  }[];
}

// MVP Phase progress types
export interface MVPPhaseProgress extends MVPPhase {
  progress: {
    epics: {
      total: number;
      completed: number;
    };
    stories: {
      total: number;
      completed: number;
      percentage: number;
    };
  };
  coreEpics: Pick<Epic, 'id' | 'title' | 'phase' | 'status'>[];
}

// Blocker types
export interface EpicBlocker {
  type: 'epic';
  id: string;
  title: string;
  blockedBy: {
    id: string;
    title: string;
    phase: string;
  }[];
}

export interface StoryBlocker {
  type: 'story';
  id: string;
  title: string;
  epicId: string;
  epicTitle: string;
  blockedBy: {
    id: string;
    title: string;
    status: string;
    epicId: string | null;
  }[];
}

export type Blocker = EpicBlocker | StoryBlocker;

// API Response type
export interface ProjectOverviewResponse {
  success: boolean;
  data: {
    project: Pick<
      Project,
      | 'id'
      | 'name'
      | 'description'
      | 'summary'
      | 'status'
      | 'createdAt'
      | 'updatedAt'
    >;
    hierarchy: HierarchicalData;
    mvpPhases: MVPPhaseProgress[];
    statistics: ProjectStatistics;
    blockers: Blocker[];
    recentQueries: Pick<
      Query,
      'id' | 'type' | 'title' | 'urgency' | 'createdAt'
    >[];
  };
}
