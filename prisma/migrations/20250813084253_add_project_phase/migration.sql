-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_project_index" (
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
    "phase" TEXT NOT NULL DEFAULT 'REQUIREMENTS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "epicCount" INTEGER NOT NULL DEFAULT 0,
    "storyCount" INTEGER NOT NULL DEFAULT 0,
    "tokenUsage" INTEGER NOT NULL DEFAULT 0,
    "isHealthy" BOOLEAN NOT NULL DEFAULT true,
    "lastHealthCheck" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_project_index" ("buildTool", "createdAt", "description", "epicCount", "framework", "gitUrl", "id", "importSource", "isHealthy", "language", "lastAccessedAt", "lastHealthCheck", "lintTool", "localPath", "name", "packageManager", "projectType", "status", "storyCount", "testFramework", "tokenUsage", "updatedAt") SELECT "buildTool", "createdAt", "description", "epicCount", "framework", "gitUrl", "id", "importSource", "isHealthy", "language", "lastAccessedAt", "lastHealthCheck", "lintTool", "localPath", "name", "packageManager", "projectType", "status", "storyCount", "testFramework", "tokenUsage", "updatedAt" FROM "project_index";
DROP TABLE "project_index";
ALTER TABLE "new_project_index" RENAME TO "project_index";
CREATE UNIQUE INDEX "project_index_localPath_key" ON "project_index"("localPath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
