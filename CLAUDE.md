# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeHive is a multi-agent software development platform that orchestrates Claude Code agents for intelligent project management and automated development. It features a portable project system where all metadata is stored locally in `.codehive/` directories, making projects fully self-contained.

## Architecture Overview

### Core Technologies
- **Next.js 14** with App Router and TypeScript
- **SQLite + Prisma ORM** for data persistence
- **Tailwind CSS** for UI styling
- **Socket.IO** for real-time WebSocket communication
- **Bun** as package manager and runtime

### Project Structure
```
CodeHive/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (project management, agents, tokens)
│   ├── projects/          # Project pages and components
│   └── settings/          # Configuration pages
├── components/            # Shared React components
├── lib/                   # Core business logic
│   ├── agents/           # Claude Code agent orchestration
│   ├── portable/         # Portable project system (.codehive/ metadata)
│   ├── tasks/            # Task management and execution
│   ├── workspace/        # Workspace and snapshot management
│   ├── db/               # Database client and schemas
│   └── socket/           # Real-time WebSocket communication
├── prisma/               # Database schema and migrations
└── repos/                # Local Git repositories (auto-created)
```

### Key Systems

#### Portable Projects
- **Self-contained**: All project metadata stored in `.codehive/` directories
- **No central database dependency**: Projects are fully portable between systems
- **Migration support**: Convert existing projects to portable format
- **Discovery service**: Automatic scanning and validation of portable projects

#### Task Management
- **Unified execution system**: `TaskExecution`, `TaskPhase`, `TaskEvent` models
- **Real-time progress tracking**: Genuine progress indicators, no fake setTimeout delays
- **WebSocket integration**: Socket.IO for live updates during operations
- **Recovery system**: Task cancellation and recovery mechanisms

#### Agent Orchestration
- **Multi-agent coordination**: Project Manager, TDD Developer, Code Reviewer agents
- **Claude Code integration**: Subprocess execution with token tracking
- **Command validation**: Real execution tracking and output parsing

#### TDD Cycle Engine
- **RED-GREEN-REFACTOR-REVIEW phases**: Complete TDD workflow automation
- **Test management**: Automated test creation and execution
- **Workspace snapshots**: File versioning and change tracking

## Development Commands

```bash
# Primary workflow
bun run app                # Setup database + build + start production
bun run dev               # Start development server

# Database operations
bun run db:setup          # Initialize database and generate Prisma client
bun run db:migrate        # Run migrations
bun run db:studio         # Open Prisma Studio

# Code quality
bun run lint              # ESLint check
bun run lint:fix          # Auto-fix ESLint issues
bun run type-check        # TypeScript type checking
bun run format            # Prettier formatting

# Testing
bun test                  # Run Jest tests
bun test --watch          # Run tests in watch mode
bun test --coverage       # Run tests with coverage
```

## Key APIs and Routes

### Project Management
- `POST /api/projects/create` - Create new projects with real-time progress
- `POST /api/projects/import` - Import existing Git repositories
- `GET /api/projects` - List all discovered projects
- `GET /api/projects/[id]` - Project details and metadata

### Task Execution
- `POST /api/tasks/[taskId]/cancel` - Cancel running tasks
- `GET /api/projects/[id]/logs/stream` - Real-time task progress via SSE

### Agent Coordination
- `POST /api/agents/execute` - Execute Claude Code agents
- `GET /api/agents/queue/live` - Live agent queue status
- `POST /api/development/coordinate` - Multi-agent coordination

### Token Management
- `GET /api/tokens/total` - Token usage analytics
- `POST /api/tokens/monitor` - Token limit monitoring
- `GET /api/projects/budgets` - Project token budgets

### Project Registry Cleanup
- `GET /api/registry/cleanup` - Get cleanup scheduler status
- `POST /api/registry/cleanup` - Control cleanup scheduler
  - `{"action": "run"}` - Run cleanup immediately
  - `{"action": "start"}` - Start automatic cleanup scheduler
  - `{"action": "stop"}` - Stop automatic cleanup scheduler
  - `{"action": "status"}` - Get scheduler status
  - `{"action": "update-interval", "intervalMinutes": 30}` - Update cleanup interval

## Database Schema

The system uses SQLite with Prisma ORM. Key models:

### Core Models
- **Project**: Main project entity with portable metadata support
- **TaskExecution/TaskPhase/TaskEvent**: Unified task management system
- **GlobalSettings/ProjectSettings**: Configuration management
- **TokenUsage/ProjectBudget**: Resource tracking and limits

### Development Models
- **Epic/KanbanCard**: Project management and story hierarchy
- **Cycle/Test/Artifact**: TDD workflow management
- **Query/QueryComment**: Agent communication system
- **Sprint/SprintBurndown**: Sprint planning and tracking

### Agent Models  
- **AgentSpecification/AgentPerformance**: Dynamic agent system
- **QueuedTask/AgentTask**: Task queue and execution tracking

## Technical Patterns

### Portable Project System
All projects store metadata in `.codehive/` directories:
```
project-root/
├── .codehive/
│   ├── project.json      # Project metadata
│   ├── settings.json     # Project settings
│   ├── kanban.json       # Kanban board state
│   └── database.sqlite   # Local project database
└── [project files]
```

### Task Execution Flow
1. **Task Creation**: Create `TaskExecution` record
2. **Phase Management**: Track progress through `TaskPhase`
3. **Event Logging**: Record all events in `TaskEvent`
4. **WebSocket Updates**: Broadcast real-time progress via Socket.IO
5. **Recovery Support**: Handle cancellation and recovery

### Agent Coordination
- **Subprocess Execution**: Claude Code runs as child process
- **Token Tracking**: Monitor API usage across all agents
- **Command Validation**: Verify agent commands before execution
- **Progress Parsing**: Extract real progress from agent output

## Memories

- Update TASKS.md after finished tasks
- Update PROJECT_STATUS.md after finished tasks
- Do not launch dev server
- **CRITICAL**: All CodeHive projects MUST be Git repositories - verify Git status before any operations
- **IMPORTANT**: Git Operations Agent is always enabled - include Git recommendations in all agent coordination
- **NO FAKE PROGRESS**: All progress tracking must reflect real operations - no setTimeout delays or simulated progress
- **WEBSOCKET EVENTS**: All real-time events use Socket.IO WebSockets for reliable communication
- **GENUINE OPERATIONS**: Git clones, file scanning, and project analysis must report actual progress
- **SOCKET.IO ONLY**: Server-Sent Events have been replaced with Socket.IO - use WebSocket for all real-time features
- **PORTABLE BY DEFAULT**: All projects use the portable format with `.codehive/` directories
- **NO DATABASE DEPENDENCY**: Projects are fully self-contained and portable
- **STANDARD APIS**: Use `/api/projects/create` and `/api/projects/import` for all project operations
- **AUTOMATIC CLEANUP**: Project registry automatically cleans up orphaned entries every 30 minutes
- **REGISTRY SYNC**: When projects are removed from repos/ directory, they're automatically removed from registry
- This project is not just for frontend developement
- Treat Claude Code as a normal LLM, just give instructions and it do the job. You must make Claude Code make its questions response in certain format for the program to parse.
- Do not change too much of the project unless it is really needed to
- Do not launch or restart the server by yourself, ask user to do it instead
- Texts on UI should be written Traditional Chinese

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.