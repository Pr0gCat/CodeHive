-- CreateTable
CREATE TABLE "project_index" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "localPath" TEXT NOT NULL,
    "gitUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "framework" TEXT,
    "language" TEXT,
    "packageManager" TEXT,
    "testFramework" TEXT,
    "lintTool" TEXT,
    "buildTool" TEXT,
    "projectType" TEXT NOT NULL DEFAULT 'PORTABLE',
    "importSource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "epicCount" INTEGER NOT NULL DEFAULT 0,
    "storyCount" INTEGER NOT NULL DEFAULT 0,
    "tokenUsage" INTEGER NOT NULL DEFAULT 0,
    "isHealthy" BOOLEAN NOT NULL DEFAULT true,
    "lastHealthCheck" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "project_index_localPath_key" ON "project_index"("localPath");
