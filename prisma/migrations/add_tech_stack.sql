-- Add GlobalSettings table
CREATE TABLE global_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    defaultFramework TEXT,
    defaultLanguage TEXT,
    defaultPackageManager TEXT,
    defaultTestFramework TEXT,
    defaultLintTool TEXT,
    defaultBuildTool TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add tech stack fields to projects table
ALTER TABLE projects ADD COLUMN framework TEXT;
ALTER TABLE projects ADD COLUMN language TEXT;
ALTER TABLE projects ADD COLUMN packageManager TEXT;
ALTER TABLE projects ADD COLUMN testFramework TEXT;
ALTER TABLE projects ADD COLUMN lintTool TEXT;
ALTER TABLE projects ADD COLUMN buildTool TEXT;
