/**
 * SQLite database schema for portable CodeHive projects
 * Local database stored in .codehive/codehive.db
 */

export const PORTABLE_DB_SCHEMA = `
-- Epics table
CREATE TABLE IF NOT EXISTS epics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'FEATURE',
  phase TEXT DEFAULT 'PLANNING',
  status TEXT DEFAULT 'ACTIVE',
  mvp_priority TEXT DEFAULT 'MEDIUM',
  core_value TEXT,
  sequence INTEGER DEFAULT 0,
  estimated_story_points INTEGER DEFAULT 0,
  actual_story_points INTEGER DEFAULT 0,
  start_date TEXT,
  due_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

-- Stories/Cards table
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  epic_id TEXT REFERENCES epics(id) ON DELETE SET NULL,
  sprint_id TEXT REFERENCES sprints(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'BACKLOG',
  position INTEGER,
  assigned_agent TEXT,
  target_branch TEXT,
  story_points INTEGER,
  priority TEXT DEFAULT 'MEDIUM',
  sequence INTEGER DEFAULT 0,
  tdd_enabled BOOLEAN DEFAULT FALSE,
  acceptance_criteria TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Story dependencies
CREATE TABLE IF NOT EXISTS story_dependencies (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'BLOCKS',
  description TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(story_id, depends_on_id)
);

-- Sprints table
CREATE TABLE IF NOT EXISTS sprints (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  goal TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  duration INTEGER NOT NULL,
  status TEXT DEFAULT 'PLANNING',
  planned_story_points INTEGER DEFAULT 0,
  committed_story_points INTEGER DEFAULT 0,
  completed_story_points INTEGER DEFAULT 0,
  velocity REAL,
  planning_notes TEXT,
  review_notes TEXT,
  retrospective_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

-- TDD Cycles table
CREATE TABLE IF NOT EXISTS cycles (
  id TEXT PRIMARY KEY,
  story_id TEXT REFERENCES stories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  phase TEXT DEFAULT 'RED',
  status TEXT DEFAULT 'ACTIVE',
  sequence INTEGER DEFAULT 0,
  acceptance_criteria TEXT NOT NULL,
  constraints TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

-- Tests within cycles
CREATE TABLE IF NOT EXISTS tests (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  file_path TEXT,
  status TEXT DEFAULT 'FAILING',
  last_run TEXT,
  duration INTEGER,
  error_output TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Artifacts from cycles
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  purpose TEXT,
  phase TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Token usage tracking
CREATE TABLE IF NOT EXISTS token_usage (
  id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,
  task_id TEXT,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  timestamp TEXT NOT NULL
);

-- Project logs
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  timestamp TEXT NOT NULL
);

-- Workspace snapshots metadata
CREATE TABLE IF NOT EXISTS workspace_snapshots (
  id TEXT PRIMARY KEY,
  cycle_id TEXT REFERENCES cycles(id) ON DELETE CASCADE,
  branch_name TEXT,
  phase TEXT,
  snapshot_path TEXT NOT NULL,
  file_count INTEGER,
  total_size INTEGER,
  created_at TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stories_epic ON stories(epic_id);
CREATE INDEX IF NOT EXISTS idx_stories_sprint ON stories(sprint_id);
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
CREATE INDEX IF NOT EXISTS idx_cycles_story ON cycles(story_id);
CREATE INDEX IF NOT EXISTS idx_cycles_phase ON cycles(phase);
CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_token_usage_agent ON token_usage(agent_type);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source);

-- Views for common queries
CREATE VIEW IF NOT EXISTS epic_summary AS
SELECT 
  e.id,
  e.title,
  e.status,
  e.mvp_priority,
  COUNT(DISTINCT s.id) as story_count,
  SUM(CASE WHEN s.status = 'DONE' THEN 1 ELSE 0 END) as completed_stories,
  SUM(s.story_points) as total_story_points,
  SUM(CASE WHEN s.status = 'DONE' THEN s.story_points ELSE 0 END) as completed_points
FROM epics e
LEFT JOIN stories s ON e.id = s.epic_id
GROUP BY e.id;

CREATE VIEW IF NOT EXISTS sprint_progress AS
SELECT 
  sp.id,
  sp.name,
  sp.status,
  sp.start_date,
  sp.end_date,
  COUNT(DISTINCT s.id) as story_count,
  SUM(CASE WHEN s.status = 'DONE' THEN 1 ELSE 0 END) as completed_stories,
  SUM(s.story_points) as total_points,
  SUM(CASE WHEN s.status = 'DONE' THEN s.story_points ELSE 0 END) as completed_points,
  sp.velocity
FROM sprints sp
LEFT JOIN stories s ON sp.id = s.sprint_id
GROUP BY sp.id;

CREATE VIEW IF NOT EXISTS daily_token_usage AS
SELECT 
  DATE(timestamp) as date,
  agent_type,
  COUNT(*) as request_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(input_tokens + output_tokens) as total_tokens
FROM token_usage
GROUP BY DATE(timestamp), agent_type;
`;

// TypeScript interfaces for database rows
export interface DbEpic {
  id: string;
  title: string;
  description?: string;
  type: string;
  phase: string;
  status: string;
  mvp_priority: string;
  core_value?: string;
  sequence: number;
  estimated_story_points: number;
  actual_story_points: number;
  start_date?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface DbStory {
  id: string;
  epic_id?: string;
  sprint_id?: string;
  title: string;
  description?: string;
  status: string;
  position: number;
  assigned_agent?: string;
  target_branch?: string;
  story_points?: number;
  priority: string;
  sequence: number;
  tdd_enabled: boolean;
  acceptance_criteria?: string;
  created_at: string;
  updated_at: string;
}

export interface DbTokenUsage {
  id: string;
  agent_type: string;
  task_id?: string;
  input_tokens: number;
  output_tokens: number;
  timestamp: string;
}

export interface DbLog {
  id: string;
  level: string;
  source: string;
  message: string;
  metadata?: string;
  timestamp: string;
}