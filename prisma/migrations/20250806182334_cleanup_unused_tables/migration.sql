/*
  Warnings:

  - You are about to drop the `agent_evolution` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `epic_dependencies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mvp_phases` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `roadmap_milestones` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `story_dependencies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `usage_limits` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `usage_tracking` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "agent_evolution";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "epic_dependencies";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "mvp_phases";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "roadmap_milestones";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "story_dependencies";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "usage_limits";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "usage_tracking";
PRAGMA foreign_keys=on;
