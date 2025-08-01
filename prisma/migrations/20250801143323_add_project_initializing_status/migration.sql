-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "summary" TEXT,
    "gitUrl" TEXT,
    "localPath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIALIZING',
    "framework" TEXT,
    "language" TEXT,
    "packageManager" TEXT,
    "testFramework" TEXT,
    "lintTool" TEXT,
    "buildTool" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_projects" ("buildTool", "createdAt", "description", "framework", "gitUrl", "id", "language", "lintTool", "localPath", "name", "packageManager", "status", "summary", "testFramework", "updatedAt") SELECT "buildTool", "createdAt", "description", "framework", "gitUrl", "id", "language", "lintTool", "localPath", "name", "packageManager", "status", "summary", "testFramework", "updatedAt" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
CREATE UNIQUE INDEX "projects_localPath_key" ON "projects"("localPath");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
