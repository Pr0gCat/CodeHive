-- CreateTable
CREATE TABLE "project_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "project_logs_projectId_createdAt_idx" ON "project_logs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "project_logs_projectId_level_idx" ON "project_logs"("projectId", "level");

-- CreateIndex
CREATE INDEX "project_logs_projectId_source_idx" ON "project_logs"("projectId", "source");
