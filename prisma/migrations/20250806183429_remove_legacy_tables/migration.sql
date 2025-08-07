/*
  Warnings:

  - You are about to drop the `agent_performance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `agent_specifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `agent_tasks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `artifacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cycles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `epics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kanban_cards` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_budgets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `projects` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `queries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `query_comments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `queued_tasks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sprint_burndown` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sprint_daily_updates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sprint_epics` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sprints` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tests` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "agent_specifications_projectId_name_key";

-- DropIndex
DROP INDEX "project_budgets_projectId_key";

-- DropIndex
DROP INDEX "project_logs_projectId_source_idx";

-- DropIndex
DROP INDEX "project_logs_projectId_level_idx";

-- DropIndex
DROP INDEX "project_logs_projectId_createdAt_idx";

-- DropIndex
DROP INDEX "project_settings_projectId_key";

-- DropIndex
DROP INDEX "projects_localPath_key";

-- DropIndex
DROP INDEX "sprint_burndown_sprintId_date_key";

-- DropIndex
DROP INDEX "sprint_daily_updates_sprintId_date_key";

-- DropIndex
DROP INDEX "sprint_epics_sprintId_epicId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "agent_performance";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "agent_specifications";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "agent_tasks";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "artifacts";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "cycles";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "epics";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "kanban_cards";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "project_budgets";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "project_logs";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "project_settings";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "projects";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "queries";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "query_comments";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "queued_tasks";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "sprint_burndown";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "sprint_daily_updates";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "sprint_epics";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "sprints";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "tests";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_task_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" REAL NOT NULL DEFAULT 0,
    "currentPhase" TEXT,
    "totalPhases" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT,
    "projectName" TEXT,
    "initiatedBy" TEXT,
    "startedAt" DATETIME,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "result" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_task_executions" ("completedAt", "createdAt", "currentPhase", "error", "id", "initiatedBy", "lastUpdatedAt", "progress", "projectId", "projectName", "result", "startedAt", "status", "taskId", "totalPhases", "type") SELECT "completedAt", "createdAt", "currentPhase", "error", "id", "initiatedBy", "lastUpdatedAt", "progress", "projectId", "projectName", "result", "startedAt", "status", "taskId", "totalPhases", "type" FROM "task_executions";
DROP TABLE "task_executions";
ALTER TABLE "new_task_executions" RENAME TO "task_executions";
CREATE UNIQUE INDEX "task_executions_taskId_key" ON "task_executions"("taskId");
CREATE TABLE "new_token_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "agentType" TEXT NOT NULL,
    "taskId" TEXT,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_token_usage" ("agentType", "id", "inputTokens", "outputTokens", "projectId", "taskId", "timestamp") SELECT "agentType", "id", "inputTokens", "outputTokens", "projectId", "taskId", "timestamp" FROM "token_usage";
DROP TABLE "token_usage";
ALTER TABLE "new_token_usage" RENAME TO "token_usage";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
