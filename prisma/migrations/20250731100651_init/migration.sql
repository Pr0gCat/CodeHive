-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "summary" TEXT,
    "gitUrl" TEXT,
    "localPath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "framework" TEXT,
    "language" TEXT,
    "packageManager" TEXT,
    "testFramework" TEXT,
    "lintTool" TEXT,
    "buildTool" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "dailyTokenLimit" INTEGER NOT NULL DEFAULT 100000000,
    "warningThreshold" REAL NOT NULL DEFAULT 0.75,
    "criticalThreshold" REAL NOT NULL DEFAULT 0.90,
    "allocationStrategy" REAL NOT NULL DEFAULT 0.5,
    "autoResumeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pauseOnWarning" BOOLEAN NOT NULL DEFAULT false,
    "claudeCodePath" TEXT NOT NULL DEFAULT 'claude',
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "project_budgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "allocatedPercentage" REAL NOT NULL DEFAULT 0.0,
    "dailyTokenBudget" INTEGER NOT NULL DEFAULT 0,
    "usedTokens" INTEGER NOT NULL DEFAULT 0,
    "lastResetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warningNotified" BOOLEAN NOT NULL DEFAULT false,
    "criticalNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "project_budgets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "maxTokensPerDay" INTEGER NOT NULL DEFAULT 10000,
    "maxTokensPerRequest" INTEGER NOT NULL DEFAULT 4000,
    "maxRequestsPerMinute" INTEGER NOT NULL DEFAULT 20,
    "maxRequestsPerHour" INTEGER NOT NULL DEFAULT 100,
    "agentTimeout" INTEGER NOT NULL DEFAULT 300000,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "parallelAgentLimit" INTEGER NOT NULL DEFAULT 2,
    "autoReviewOnImport" BOOLEAN NOT NULL DEFAULT true,
    "maxQueueSize" INTEGER NOT NULL DEFAULT 50,
    "taskPriority" TEXT NOT NULL DEFAULT 'NORMAL',
    "autoExecuteTasks" BOOLEAN NOT NULL DEFAULT true,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "slackWebhookUrl" TEXT,
    "discordWebhookUrl" TEXT,
    "notifyOnTaskComplete" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnTaskFail" BOOLEAN NOT NULL DEFAULT true,
    "codeAnalysisDepth" TEXT NOT NULL DEFAULT 'STANDARD',
    "testCoverageThreshold" REAL NOT NULL DEFAULT 80.0,
    "enforceTypeChecking" BOOLEAN NOT NULL DEFAULT true,
    "autoFixLintErrors" BOOLEAN NOT NULL DEFAULT false,
    "claudeModel" TEXT NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',
    "customInstructions" TEXT,
    "excludePatterns" TEXT,
    "includeDependencies" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "project_settings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "kanban_cards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "epicId" TEXT,
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
    CONSTRAINT "kanban_cards_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "epics" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "story_dependencies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BLOCKS',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "story_dependencies_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "kanban_cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "story_dependencies_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "kanban_cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "output" TEXT,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_tasks_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "kanban_cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "token_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "taskId" TEXT,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "token_usage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "roadmap_milestones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roadmap_milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_executions" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_executions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_phases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" REAL NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "duration" INTEGER,
    "details" TEXT,
    "metrics" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "task_phases_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task_executions" ("taskId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "phaseId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT,
    "progress" REAL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_events_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task_executions" ("taskId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_events_taskId_phaseId_fkey" FOREIGN KEY ("taskId", "phaseId") REFERENCES "task_phases" ("taskId", "phaseId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "queued_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "cardId" TEXT,
    "taskId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" DATETIME,
    "resumedAt" DATETIME,
    "completedAt" DATETIME,
    "error" TEXT,
    CONSTRAINT "queued_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "queued_tasks_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "kanban_cards" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_specifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "capabilities" TEXT NOT NULL,
    "dependencies" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "constraints" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'project-manager-agent',
    CONSTRAINT "agent_specifications_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_performance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "executionTime" INTEGER NOT NULL,
    "tokensUsed" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "taskComplexity" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_performance_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent_specifications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_evolution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changes" TEXT NOT NULL,
    "performanceBefore" TEXT NOT NULL,
    "performanceAfter" TEXT,
    "reason" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_evolution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent_specifications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "usage_tracking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenCount" INTEGER NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT,
    "agentType" TEXT,
    "resetPeriod" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "usage_limits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "limitType" TEXT NOT NULL,
    "limitValue" INTEGER NOT NULL,
    "currentUsage" INTEGER NOT NULL DEFAULT 0,
    "resetAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "epics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'FEATURE',
    "phase" TEXT NOT NULL DEFAULT 'PLANNING',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mvpPriority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "coreValue" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "estimatedStoryPoints" INTEGER NOT NULL DEFAULT 0,
    "actualStoryPoints" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATETIME,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "epics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "epic_dependencies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "epicId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BLOCKS',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "epic_dependencies_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "epics" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "epic_dependencies_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "epics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mvp_phases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "targetDate" DATETIME,
    "coreFeatures" TEXT NOT NULL,
    "plannedStoryPoints" INTEGER NOT NULL DEFAULT 0,
    "completedStoryPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "releasedAt" DATETIME,
    CONSTRAINT "mvp_phases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "storyId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'RED',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "acceptanceCriteria" TEXT NOT NULL,
    "constraints" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "cycles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cycles_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "kanban_cards" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT NOT NULL,
    "filePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'FAILING',
    "lastRun" DATETIME,
    "duration" INTEGER,
    "errorOutput" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tests_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "cycles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "queries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "cycleId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'ADVISORY',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "answer" TEXT,
    "answeredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "queries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "queries_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "cycles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "query_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queryId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "query_comments_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "queries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "purpose" TEXT,
    "phase" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "artifacts_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "cycles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_localPath_key" ON "projects"("localPath");

-- CreateIndex
CREATE UNIQUE INDEX "project_budgets_projectId_key" ON "project_budgets"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_settings_projectId_key" ON "project_settings"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "story_dependencies_storyId_dependsOnId_key" ON "story_dependencies"("storyId", "dependsOnId");

-- CreateIndex
CREATE UNIQUE INDEX "task_executions_taskId_key" ON "task_executions"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_phases_taskId_phaseId_key" ON "task_phases"("taskId", "phaseId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_specifications_projectId_name_key" ON "agent_specifications"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "usage_limits_limitType_key" ON "usage_limits"("limitType");

-- CreateIndex
CREATE UNIQUE INDEX "epic_dependencies_epicId_dependsOnId_key" ON "epic_dependencies"("epicId", "dependsOnId");
