# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeHive is a multi-agent software development platform that orchestrates Claude Code agents to manage multiple projects simultaneously using Test-Driven Development principles. The system dynamically creates specialized agents based on project requirements.

**Current Status**: Sprint 5 completed ✅ - Production-ready agent architecture
- Next.js 14 + TypeScript + Tailwind CSS with complete UI
- SQLite database with Prisma ORM and tech stack configuration
- 4 specialized agents with command validation
- User-controlled tech stack preferences system
- ESLint, Prettier, and code quality tools configured

**Upcoming Major Feature**: Scrum Agile Integration with Query-Driven Development
- 🎯 **Goal**: Transform CodeHive into a full Scrum + Kanban platform with user query system
- 📋 **5 Sprint Roadmap**: 10-week implementation plan (140 tasks across 20 epics)
- 🔄 **Query-Driven Flow**: Development pauses for user decisions via mail-like query cards
- 🤖 **Enhanced Product Owner**: AI agent facilitates Scrum ceremonies and generates intelligent queries
- 🔒 **Single Claude Instance**: One active Claude Code session per project with smart pause/resume

## Core Development Commands

```bash
# Install dependencies
bun install

# Database operations
bun run db:setup          # Initialize database and run migrations
bun run db:migrate        # Run new migrations
bun run db:generate       # Regenerate Prisma client
bun run db:seed          # Seed database with demo data

# Development
bun run dev              # Start development server (auto-detects available port)
bun run build            # Build for production
bun run start            # Start production server

# Code quality
bun run lint             # Run ESLint
bun run lint:fix         # Fix auto-fixable lint issues
bun run format           # Format all files with Prettier
bun run format:check     # Check if files are formatted
bun run type-check       # Run TypeScript type checking

# Testing (when implemented)
bun test                 # Run all tests
bun test --watch         # Run tests in watch mode
```

## Architecture Overview

### Project Structure

- `/app` - Next.js 14 App Router pages and API routes
  - `/app/api` - REST API endpoints
  - `/app/components` - Reusable React components
  - `/app/projects` - Project-specific pages
- `/lib` - Core business logic organized by domain:
  - `/lib/config` - Environment configuration and validation
  - `/lib/db` - Database client, types, and status constants
  - `/lib/utils` - Common utilities and helper functions
  - `/lib/agents` - Claude Code agent orchestration (planned)
  - `/lib/git` - Git operations (planned)
  - `/lib/usage` - Token usage monitoring (planned)
- `/repos` - Local storage for managed project git repositories
- `/prisma` - Database schema, migrations, and seed data
- `/docs` - Project documentation and guides

### Key Architectural Patterns

1. **Agent System**: 4 specialized agents with type-safe registry:
   - **Code Analyzer**: Static analysis, linting, security scans (also handles file operations via Claude Code)
   - **Test Runner**: Multi-framework testing, coverage analysis, CI/CD integration
   - **Git Operations**: Version control, branching, repository health monitoring
   - **Documentation**: README generation, code docs, API documentation
   - Each agent has command validation, prompt templates, and execution tracking

2. **User-Controlled Tech Stack**: Flexible preference system:
   - Global settings with text input fields for any tool names
   - Per-project overrides in database schema
   - Agents adapt behavior based on user-defined preferences
   - No auto-detection - user specifies exactly what tools to use

3. **Database Design**: SQLite with Prisma ORM storing:
   - Projects with tech stack preferences and Kanban cards
   - Global settings for default tech stack preferences
   - Agent specifications and performance metrics
   - Token usage tracking and rate limiting
   - Queued tasks with priority-based processing

### API Route Patterns

All API routes follow RESTful conventions:

```typescript
// Health check
GET /api/health - Application health status

// Projects
GET /api/projects - List all projects
POST /api/projects - Create new project
GET /api/projects/:id - Get project details
PUT /api/projects/:id - Update project
DELETE /api/projects/:id - Delete project

// Kanban operations
GET /api/projects/:id/cards - Get project cards
POST /api/projects/:id/cards - Create new card
PUT /api/cards/:id - Update card
DELETE /api/cards/:id - Delete card

// Agent operations
GET/POST /api/agents/capabilities - Get agent capabilities and validate commands
POST /api/agents/execute - Execute agent task
POST /api/agents/project-manager - Execute project manager actions
GET /api/agents/status/:taskId - Get task status
GET /api/agents/queue - Get task queue status

// Scrum & Sprint operations (Planned)
GET /api/projects/:id/sprints - List project sprints
POST /api/projects/:id/sprints - Create new sprint
GET /api/sprints/:id - Get sprint details
PUT /api/sprints/:id - Update sprint
DELETE /api/sprints/:id - Delete sprint
GET/POST /api/sprints/:id/ceremonies - Manage ceremonies

// User Query system (Planned)
GET /api/projects/:id/queries - List project queries
POST /api/projects/:id/queries - Create new query
GET /api/queries/:id - Get query details
PUT /api/queries/:id - Update query
POST /api/queries/:id/comments - Add query comment
PUT /api/queries/:id/accept - Accept query
POST /api/queries/:id/block-development - Block development

// Instance Management (Planned)
GET /api/projects/:id/instance/status - Get Claude instance status
POST /api/projects/:id/instance/pause - Pause instance
POST /api/projects/:id/instance/resume - Resume instance
GET /api/projects/:id/queue - Get task queue

// Settings
GET /api/settings - Get global tech stack preferences
PUT /api/settings - Update global tech stack preferences
```

### Agent Development Flow

1. **Specification First**: Define agent capabilities in YAML/JSON
2. **Test-Driven**: Write behavior tests before implementation
3. **Progressive Prompts**: Start simple, add context incrementally
4. **Observable Execution**: Log all prompts and outputs for debugging

### Critical Implementation Notes

1. **Agent Communication**: Agents pass structured data through `AgentResult` interface with artifacts
2. **Error Handling**: All agents must implement retry logic with exponential backoff
3. **Token Estimation**: Estimate tokens before execution to prevent limit overruns
4. **Task Persistence**: Use `queued_tasks` table to save state during usage pauses

## Working with Agents

When creating or modifying agents:

1. Check existing agent patterns in `/lib/agents/executors/`
2. Use the base agent class for consistent error handling
3. Always wrap execution in rate limiter
4. Test with mock Claude Code before real execution

## Database Operations

Always use Prisma client for database operations:

```typescript
import { prisma, ProjectStatus, CardStatus } from '@/lib/db';

// Good - uses Prisma client
const projects = await prisma.project.findMany({
  include: {
    kanbanCards: true,
    tokenUsage: true,
  },
});

// Use status constants for type safety
const activeProjects = await prisma.project.findMany({
  where: { status: ProjectStatus.ACTIVE },
});

// Bad - raw SQL queries
const projects = await db.execute('SELECT * FROM projects');
```

### Database Schema Notes

- SQLite doesn't support enums, so status fields use strings with constants
- All models include `createdAt` and `updatedAt` timestamps
- Foreign key relationships use CASCADE deletes where appropriate
- JSON fields store complex data (agent capabilities, performance metrics)

## Environment Configuration

Use the configuration module for type-safe environment access:

```typescript
import { config } from '@/lib/config';

// Access validated configuration
const dbUrl = config.databaseUrl;
const isProduction = config.isProduction;
```

### Required Environment Variables

Create `.env` file (see `.env.example`):

```env
# Database
DATABASE_URL="file:./codehive.db"

# Claude Code Configuration
CLAUDE_CODE_PATH="claude-code"  # or full path like /usr/local/bin/claude-code
CLAUDE_DAILY_TOKEN_LIMIT="10000000"
CLAUDE_RATE_LIMIT_PER_MINUTE="50"

# Application URLs
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_WS_URL="ws://localhost:3000"

# Environment
NODE_ENV="development"
```

The configuration module validates all required variables on startup and provides type-safe access throughout the application.

## Development Workflow

### Current Sprint Status - Scrum Agile Feature Development
- 📋 **Sprint 1** (Weeks 1-2): Foundation & Database Models - 35 tasks
- 🔄 **Sprint 2** (Weeks 3-4): Query System & Instance Management - 25 tasks  
- 🤖 **Sprint 3** (Weeks 5-6): Product Owner Agent & Ceremonies - 28 tasks
- 🎨 **Sprint 4** (Weeks 7-8): UI Components & User Experience - 28 tasks
- 🚀 **Sprint 5** (Weeks 9-10): Integration & Testing - 28 tasks
- **Total**: 140 tasks across 20 epics with 30 documentation tasks (21% of effort)

### Code Quality Standards
- All code must pass TypeScript compilation
- ESLint and Prettier rules are enforced
- Use the provided utility functions in `/lib/utils`
- Follow existing patterns for error handling and validation

## Memories
- Update TASKS.md after finished tasks
- Update PROJECT_STATUS.md after finished tasks
- Do not launch dev server