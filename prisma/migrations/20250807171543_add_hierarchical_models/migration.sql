-- CreateTable
CREATE TABLE "epics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "businessValue" TEXT,
    "acceptanceCriteria" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "phase" TEXT,
    "estimatedEffort" INTEGER,
    "actualEffort" INTEGER,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "tokenUsage" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "stories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "epicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "userStory" TEXT,
    "description" TEXT,
    "acceptanceCriteria" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "storyPoints" INTEGER,
    "iteration" INTEGER,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "tokenUsage" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "stories_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "epics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "acceptanceCriteria" TEXT,
    "expectedOutcome" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "estimatedTime" INTEGER,
    "actualTime" INTEGER,
    "assignedAgent" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "validationResult" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tasks_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "stories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "instructions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "directive" TEXT NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "validationCriteria" TEXT,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "output" TEXT,
    "error" TEXT,
    "tokenUsage" INTEGER NOT NULL DEFAULT 0,
    "executionTime" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "executedBy" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "instructions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "epic_dependencies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dependentEpicId" TEXT NOT NULL,
    "requiredEpicId" TEXT NOT NULL,
    "dependencyType" TEXT NOT NULL DEFAULT 'BLOCKS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "epic_dependencies_dependentEpicId_fkey" FOREIGN KEY ("dependentEpicId") REFERENCES "epics" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "epic_dependencies_requiredEpicId_fkey" FOREIGN KEY ("requiredEpicId") REFERENCES "epics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dependentTaskId" TEXT NOT NULL,
    "requiredTaskId" TEXT NOT NULL,
    "dependencyType" TEXT NOT NULL DEFAULT 'BLOCKS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_dependencies_dependentTaskId_fkey" FOREIGN KEY ("dependentTaskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_dependencies_requiredTaskId_fkey" FOREIGN KEY ("requiredTaskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "instruction_dependencies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dependentInstructionId" TEXT NOT NULL,
    "requiredInstructionId" TEXT NOT NULL,
    "dependencyType" TEXT NOT NULL DEFAULT 'SEQUENTIAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "instruction_dependencies_dependentInstructionId_fkey" FOREIGN KEY ("dependentInstructionId") REFERENCES "instructions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "instruction_dependencies_requiredInstructionId_fkey" FOREIGN KEY ("requiredInstructionId") REFERENCES "instructions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "epics_projectId_status_idx" ON "epics"("projectId", "status");

-- CreateIndex
CREATE INDEX "epics_projectId_priority_idx" ON "epics"("projectId", "priority");

-- CreateIndex
CREATE INDEX "stories_epicId_status_idx" ON "stories"("epicId", "status");

-- CreateIndex
CREATE INDEX "stories_epicId_priority_idx" ON "stories"("epicId", "priority");

-- CreateIndex
CREATE INDEX "tasks_storyId_status_idx" ON "tasks"("storyId", "status");

-- CreateIndex
CREATE INDEX "tasks_storyId_priority_idx" ON "tasks"("storyId", "priority");

-- CreateIndex
CREATE INDEX "instructions_taskId_sequence_idx" ON "instructions"("taskId", "sequence");

-- CreateIndex
CREATE INDEX "instructions_taskId_status_idx" ON "instructions"("taskId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "epic_dependencies_dependentEpicId_requiredEpicId_key" ON "epic_dependencies"("dependentEpicId", "requiredEpicId");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_dependentTaskId_requiredTaskId_key" ON "task_dependencies"("dependentTaskId", "requiredTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "instruction_dependencies_dependentInstructionId_requiredInstructionId_key" ON "instruction_dependencies"("dependentInstructionId", "requiredInstructionId");
