# CodeHive Architecture

## System Overview

CodeHive is designed as a monolithic Next.js application with minimal dependencies. It orchestrates Claude Code agents through subprocess execution while maintaining project state in a local SQLite database.

## Core Design Principles

1. **Minimalism**: Use the least amount of dependencies and infrastructure
2. **Local-First**: Everything runs on the user's machine
3. **Simplicity**: Straightforward architecture without unnecessary abstractions
4. **Real-Time**: Immediate feedback on agent activities

## Component Architecture

### Frontend Layer

```typescript
// Next.js App Router Structure
app/
├── (dashboard)/
│   ├── layout.tsx          // Main dashboard layout
│   └── page.tsx           // Project list view
├── projects/
│   ├── [id]/
│   │   ├── page.tsx       // Project detail with Kanban
│   │   └── roadmap/
│   │       └── page.tsx   // Roadmap visualization
│   └── new/
│       └── page.tsx       // Create/import project
└── api/                   // API routes
```

**Key Components:**

- `KanbanBoard`: Drag-and-drop task management
- `RoadmapView`: Timeline visualization
- `AgentStatus`: Real-time agent activity display
- `TokenUsageChart`: Usage analytics

### Backend Layer

**API Routes Structure:**

```typescript
// Project Management
POST   /api/projects              // Create project
GET    /api/projects              // List projects
GET    /api/projects/:id          // Get project
DELETE /api/projects/:id          // Delete project

// Kanban Operations
GET    /api/projects/:id/cards    // Get Kanban cards
PUT    /api/projects/:id/cards    // Update card positions
POST   /api/projects/:id/cards    // Create new card

// Agent Operations
POST   /api/agents/execute        // Execute agent task
GET    /api/agents/status/:taskId // Get task status
GET    /api/agents/logs/:taskId   // Get execution logs

// Analytics
GET    /api/usage/tokens          // Token usage stats
GET    /api/usage/projects/:id    // Project-specific usage
```

### Database Schema

```sql
-- Projects table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  git_url TEXT,
  local_path TEXT NOT NULL,
  status TEXT CHECK(status IN ('active', 'paused', 'completed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Kanban cards
CREATE TABLE kanban_cards (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK(status IN ('backlog', 'todo', 'in_progress', 'review', 'done')),
  position INTEGER NOT NULL,
  assigned_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Agent tasks
CREATE TABLE agent_tasks (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  command TEXT NOT NULL,
  status TEXT CHECK(status IN ('pending', 'running', 'completed', 'failed')),
  output TEXT,
  error TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES kanban_cards(id) ON DELETE CASCADE
);

-- Token usage
CREATE TABLE token_usage (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  task_id TEXT,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Roadmap milestones
CREATE TABLE roadmap_milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT CHECK(status IN ('planned', 'in_progress', 'completed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### Agent System

**Agent Orchestrator (`lib/agents/orchestrator.ts`):**

```typescript
interface AgentTask {
  id: string;
  cardId: string;
  agentType: AgentType;
  command: string;
  context: ProjectContext;
}

class AgentOrchestrator {
  async executeTask(task: AgentTask): Promise<TaskResult> {
    // 1. Prepare working directory
    // 2. Build Claude Code command
    // 3. Execute subprocess
    // 4. Parse output and update database
    // 5. Emit real-time updates
  }
}
```

**Agent Types:**

```typescript
enum AgentType {
  PROJECT_MANAGER = 'project_manager',
  ARCHITECT = 'architect',
  TDD_DEVELOPER = 'tdd_developer',
  CODE_REVIEWER = 'code_reviewer',
  INTEGRATION = 'integration',
}
```

**Agent Prompts Structure:**

```
lib/agents/prompts/
├── project-manager.md
├── architect.md
├── tdd-developer.md
├── code-reviewer.md
└── integration.md
```

### Git Integration

**Repository Management (`lib/git/manager.ts`):**

- Clone repositories to `repos/` directory
- Execute git commands via subprocess
- Track commit history per Kanban card
- Handle branch management for features

### Real-Time Updates

**WebSocket Events:**

```typescript
// Server -> Client events
interface ServerEvents {
  'agent:started': { taskId: string; agentType: string };
  'agent:output': { taskId: string; output: string };
  'agent:completed': { taskId: string; result: any };
  'card:updated': { cardId: string; changes: Partial<KanbanCard> };
  'token:used': { projectId: string; tokens: number };
}

// Client -> Server events
interface ClientEvents {
  'subscribe:project': { projectId: string };
  'unsubscribe:project': { projectId: string };
}
```

## Data Flow

1. **User Action** → UI Component → API Route
2. **API Route** → Database Operation → Agent Orchestrator
3. **Agent Orchestrator** → Claude Code Subprocess → Output Parser
4. **Output Parser** → Database Update → WebSocket Broadcast
5. **WebSocket** → UI Update → User Feedback

## Security Considerations

1. **Input Validation**: All user inputs sanitized
2. **Path Traversal**: Restricted to `repos/` directory
3. **Command Injection**: No direct shell command execution
4. **Rate Limiting**: Token usage limits per project
5. **File Access**: Agents restricted to project directories

## Performance Optimizations

1. **Lazy Loading**: Load project data on demand
2. **Pagination**: Limit Kanban cards and logs
3. **Debouncing**: Batch WebSocket updates
4. **Caching**: In-memory cache for active projects
5. **Indexes**: Database indexes on foreign keys

## Deployment

### Development

```bash
bun run dev
```

### Production

```bash
bun run build
bun run start
```

### Docker (Optional)

```dockerfile
FROM oven/bun:1 as base
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
EXPOSE 3000
CMD ["bun", "run", "start"]
```

## Monitoring

- **Logs**: Structured logging with timestamps
- **Metrics**: Token usage, task completion rates
- **Health Check**: `/api/health` endpoint
- **Error Tracking**: Captured in agent_tasks table

## Future Considerations

1. **Scaling**: Move to PostgreSQL for larger deployments
2. **Queue System**: Add Redis for heavy workloads
3. **Cloud Agents**: Support for remote Claude Code execution
4. **Plugins**: Extensible agent system
5. **Multi-User**: Authentication and authorization
