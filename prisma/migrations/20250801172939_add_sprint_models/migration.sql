-- CreateTable
CREATE TABLE "sprints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "plannedStoryPoints" INTEGER NOT NULL DEFAULT 0,
    "commitedStoryPoints" INTEGER NOT NULL DEFAULT 0,
    "completedStoryPoints" INTEGER NOT NULL DEFAULT 0,
    "velocity" REAL,
    "planningNotes" TEXT,
    "reviewNotes" TEXT,
    "retrospectiveNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "sprints_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sprint_epics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sprintId" TEXT NOT NULL,
    "epicId" TEXT NOT NULL,
    "plannedStoryPoints" INTEGER NOT NULL DEFAULT 0,
    "completedStoryPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sprint_epics_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sprint_epics_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "epics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sprint_burndown" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sprintId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "remainingStoryPoints" INTEGER NOT NULL,
    "completedStoryPoints" INTEGER NOT NULL,
    "idealRemainingPoints" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sprint_burndown_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sprint_daily_updates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sprintId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "storiesCompleted" INTEGER NOT NULL DEFAULT 0,
    "storiesInProgress" INTEGER NOT NULL DEFAULT 0,
    "blockers" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sprint_daily_updates_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_kanban_cards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "epicId" TEXT,
    "sprintId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BACKLOG',
    "position" INTEGER NOT NULL,
    "assignedAgent" TEXT,
    "targetBranch" TEXT,
    "storyPoints" INTEGER,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "tddEnabled" BOOLEAN NOT NULL DEFAULT false,
    "acceptanceCriteria" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "kanban_cards_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "kanban_cards_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "epics" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "kanban_cards_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_kanban_cards" ("acceptanceCriteria", "assignedAgent", "createdAt", "description", "epicId", "id", "position", "priority", "projectId", "sequence", "status", "storyPoints", "targetBranch", "tddEnabled", "title", "updatedAt") SELECT "acceptanceCriteria", "assignedAgent", "createdAt", "description", "epicId", "id", "position", "priority", "projectId", "sequence", "status", "storyPoints", "targetBranch", "tddEnabled", "title", "updatedAt" FROM "kanban_cards";
DROP TABLE "kanban_cards";
ALTER TABLE "new_kanban_cards" RENAME TO "kanban_cards";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "sprint_epics_sprintId_epicId_key" ON "sprint_epics"("sprintId", "epicId");

-- CreateIndex
CREATE UNIQUE INDEX "sprint_burndown_sprintId_date_key" ON "sprint_burndown"("sprintId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "sprint_daily_updates_sprintId_date_key" ON "sprint_daily_updates"("sprintId", "date");
