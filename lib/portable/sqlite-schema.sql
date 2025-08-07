-- SQLite schema for CodeHive portable project data
-- This schema replaces JSON files in .codehive/ directories

-- Project metadata table
CREATE TABLE IF NOT EXISTS project_metadata (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL DEFAULT '1.0.0',
    name TEXT NOT NULL,
    description TEXT,
    summary TEXT,
    git_url TEXT,
    local_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    framework TEXT,
    language TEXT,
    package_manager TEXT,
    test_framework TEXT,
    lint_tool TEXT,
    build_tool TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Project settings table
CREATE TABLE IF NOT EXISTS project_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    claude_model TEXT NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',
    max_tokens_per_request INTEGER NOT NULL DEFAULT 4000,
    max_requests_per_minute INTEGER NOT NULL DEFAULT 20,
    agent_timeout INTEGER NOT NULL DEFAULT 300000,
    max_retries INTEGER NOT NULL DEFAULT 3,
    auto_execute_tasks BOOLEAN NOT NULL DEFAULT 1,
    test_coverage_threshold INTEGER NOT NULL DEFAULT 80,
    enforce_type_checking BOOLEAN NOT NULL DEFAULT 1,
    custom_instructions TEXT,
    exclude_patterns TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Project budget table
CREATE TABLE IF NOT EXISTS project_budget (
    id INTEGER PRIMARY KEY DEFAULT 1,
    allocated_percentage REAL NOT NULL DEFAULT 0.0,
    daily_token_budget INTEGER NOT NULL DEFAULT 0,
    used_tokens INTEGER NOT NULL DEFAULT 0,
    last_reset_at TEXT NOT NULL,
    warning_notified BOOLEAN NOT NULL DEFAULT 0,
    critical_notified BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Epics table
CREATE TABLE IF NOT EXISTS epics (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'FEATURE',
    phase TEXT NOT NULL DEFAULT 'PLANNING',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    mvp_priority TEXT NOT NULL DEFAULT 'MEDIUM',
    core_value TEXT,
    sequence INTEGER NOT NULL DEFAULT 0,
    estimated_story_points INTEGER NOT NULL DEFAULT 0,
    actual_story_points INTEGER NOT NULL DEFAULT 0,
    start_date TEXT,
    due_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES project_metadata(id)
);

-- Epic dependencies table (many-to-many)
CREATE TABLE IF NOT EXISTS epic_dependencies (
    epic_id TEXT NOT NULL,
    depends_on TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (epic_id, depends_on),
    FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on) REFERENCES epics(id) ON DELETE CASCADE
);

-- Stories table
CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    epic_id TEXT,
    sprint_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'BACKLOG',
    position INTEGER NOT NULL,
    assigned_agent TEXT,
    target_branch TEXT,
    story_points INTEGER,
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    sequence INTEGER NOT NULL DEFAULT 0,
    tdd_enabled BOOLEAN NOT NULL DEFAULT 0,
    acceptance_criteria TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE SET NULL
);

-- Story dependencies table (many-to-many)
CREATE TABLE IF NOT EXISTS story_dependencies (
    story_id TEXT NOT NULL,
    depends_on TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (story_id, depends_on),
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on) REFERENCES stories(id) ON DELETE CASCADE
);

-- Sprints table
CREATE TABLE IF NOT EXISTS sprints (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    goal TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    duration INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PLANNING',
    planned_story_points INTEGER NOT NULL DEFAULT 0,
    commited_story_points INTEGER NOT NULL DEFAULT 0,
    completed_story_points INTEGER NOT NULL DEFAULT 0,
    velocity REAL,
    planning_notes TEXT,
    review_notes TEXT,
    retrospective_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
);

-- Sprint stories table (many-to-many)
CREATE TABLE IF NOT EXISTS sprint_stories (
    sprint_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sprint_id, story_id),
    FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

-- Sprint epics table (many-to-many)
CREATE TABLE IF NOT EXISTS sprint_epics (
    sprint_id TEXT NOT NULL,
    epic_id TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sprint_id, epic_id),
    FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
    FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE CASCADE
);

-- Agent specifications table
CREATE TABLE IF NOT EXISTS agent_specs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    purpose TEXT NOT NULL,
    capabilities TEXT NOT NULL,
    dependencies TEXT NOT NULL,
    prompt TEXT NOT NULL,
    constraints TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT NOT NULL DEFAULT 'project-manager-agent'
);

-- Agent performance tracking table
CREATE TABLE IF NOT EXISTS agent_performance (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    execution_time INTEGER NOT NULL,
    tokens_used INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    task_complexity TEXT,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agent_specs(id) ON DELETE CASCADE
);

-- Agent evolution tracking table
CREATE TABLE IF NOT EXISTS agent_evolution (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    changes TEXT NOT NULL,
    performance_before TEXT NOT NULL,
    performance_after TEXT,
    reason TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agent_specs(id) ON DELETE CASCADE
);

-- TDD Cycles table
CREATE TABLE IF NOT EXISTS cycles (
    id TEXT PRIMARY KEY,
    story_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    phase TEXT NOT NULL DEFAULT 'RED',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    sequence INTEGER NOT NULL DEFAULT 0,
    acceptance_criteria TEXT NOT NULL,
    constraints TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE SET NULL
);

-- Tests table
CREATE TABLE IF NOT EXISTS tests (
    id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    file_path TEXT,
    status TEXT NOT NULL DEFAULT 'FAILING',
    last_run TEXT,
    duration INTEGER,
    error_output TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE CASCADE
);

-- Artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    content TEXT NOT NULL,
    purpose TEXT,
    phase TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE CASCADE
);

-- Queries table
CREATE TABLE IF NOT EXISTS queries (
    id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    question TEXT NOT NULL,
    context TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'ADVISORY',
    priority TEXT NOT NULL DEFAULT 'MEDIUM',
    status TEXT NOT NULL DEFAULT 'PENDING',
    answer TEXT,
    answered_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE CASCADE
);

-- Query comments table
CREATE TABLE IF NOT EXISTS query_comments (
    id TEXT PRIMARY KEY,
    query_id TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
);

-- Token usage tracking table
CREATE TABLE IF NOT EXISTS token_usage (
    id TEXT PRIMARY KEY,
    agent_type TEXT NOT NULL,
    task_id TEXT,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_epics_project_id ON epics(project_id);
CREATE INDEX IF NOT EXISTS idx_epics_status ON epics(status);
CREATE INDEX IF NOT EXISTS idx_epics_sequence ON epics(sequence);

CREATE INDEX IF NOT EXISTS idx_stories_epic_id ON stories(epic_id);
CREATE INDEX IF NOT EXISTS idx_stories_sprint_id ON stories(sprint_id);
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
CREATE INDEX IF NOT EXISTS idx_stories_position ON stories(position);

CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);
CREATE INDEX IF NOT EXISTS idx_sprints_start_date ON sprints(start_date);

CREATE INDEX IF NOT EXISTS idx_cycles_story_id ON cycles(story_id);
CREATE INDEX IF NOT EXISTS idx_cycles_phase ON cycles(phase);
CREATE INDEX IF NOT EXISTS idx_cycles_status ON cycles(status);

CREATE INDEX IF NOT EXISTS idx_tests_cycle_id ON tests(cycle_id);
CREATE INDEX IF NOT EXISTS idx_tests_status ON tests(status);

CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_token_usage_agent_type ON token_usage(agent_type);

-- Insert default project settings if not exists
INSERT OR IGNORE INTO project_settings (id) VALUES (1);

-- Insert default project budget if not exists  
INSERT OR IGNORE INTO project_budget (id, last_reset_at) VALUES (1, datetime('now'));