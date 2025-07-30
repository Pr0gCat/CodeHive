# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeHive is a multi-agent software development platform where users provide feature requests and feedback, while the Project Manager agent autonomously manages project backlogs through Epic and Story organization. The system uses AI-driven Test-Driven Development with minimal human interruption.

**Current Status**: AI-Native TDD Development System - Foundation Complete ✅

- Next.js 14 + TypeScript + Tailwind CSS with complete UI
- SQLite database with Prisma ORM and tech stack configuration
- 4 specialized agents with command validation
- User-controlled tech stack preferences system
- ESLint, Prettier, and code quality tools configured

**User Experience Philosophy**: Just Feature Requests & Feedback

- 🎯 **User Role**: Provide feature requests and feedback only - no manual project management
- 🤖 **Project Manager Agent**: Autonomously breaks down features into Epics and Stories
- 🔄 **TDD Phases**: RED (generate tests) → GREEN (implement) → REFACTOR (improve) → REVIEW
- 📋 **Backlog Management**: AI manages Epic/Story hierarchy, priorities, and dependencies
- 🎨 **Simple UI**: Focus on development progress, not ceremony

**Foundation Complete**:

- ✅ Database models for Cycles, Tests, Queries, and Artifacts
- ✅ TDD Cycle Engine with RED-GREEN-REFACTOR-REVIEW phases
- ✅ Type-safe status constants and database client
- ✅ Project Manager with Claude Code integration for intelligent descriptions
- ✅ Real-time project logs with Server-Sent Events
- ✅ Improved UI layout with better information organization
- 🔄 Epic/Story management system (needed)
- 🔄 Autonomous backlog management (needed)
- 🔄 Feature request processing pipeline (needed)

## Core Development Commands

**CodeHive Platform Commands:**

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

**Managed Project Commands (Language Agnostic):**
CodeHive manages projects in ANY programming language or framework. Commands are determined by the project's tech stack configuration:

```bash
# Examples for different project types:

# Node.js/JavaScript projects
npm install / yarn install / pnpm install / bun install
npm run dev / yarn dev
npm test / yarn test

# Python projects
pip install -r requirements.txt
python -m pytest
python manage.py runserver

# Go projects
go mod tidy
go test ./...
go run main.go

# Rust projects
cargo build
cargo test
cargo run

# Java projects
mvn clean install
mvn test
./gradlew build

# Any other language/framework
# Commands are configured per project based on tech stack
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
   - **Project Manager**: Full project control including: (1) Maintains project CLAUDE.md for unified agent context, (2) Autonomously manages backlogs and Epic/Story breakdown, (3) Ensures development aligns with project goals, (4) Orchestrates all downstream agents with consistent direction
   - Each agent has command validation, prompt templates, and execution tracking

2. **Language-Agnostic Tech Stack**: Flexible preference system supporting any technology:
   - **Framework**: Next.js, React, Django, Rails, Spring Boot, Express, FastAPI, etc.
   - **Language**: TypeScript, JavaScript, Python, Go, Rust, Java, C#, PHP, etc.
   - **Package Manager**: npm, yarn, pnpm, bun, pip, cargo, maven, gradle, composer, etc.
   - **Test Framework**: Jest, Pytest, Go test, Cargo test, JUnit, PHPUnit, etc.
   - **Lint Tool**: ESLint, Pylint, Golint, Clippy, Checkstyle, etc.
   - **Build Tool**: Webpack, Vite, Make, CMake, Gradle, Maven, etc.
   - Global settings with text input fields for any tool names
   - Per-project overrides in database schema
   - Agents adapt behavior based on user-defined preferences
   - No auto-detection - user specifies exactly what tools to use

3. **Database Design**: SQLite with Prisma ORM storing:
   - Projects with tech stack preferences and Epic/Story hierarchy
   - Epics and Stories with AI-managed priorities and dependencies
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

// Epic/Story management
GET /api/projects/:id/epics - Get project epics
POST /api/projects/:id/epics - Create new epic from feature request
GET /api/epics/:id - Get epic details with stories
PUT /api/epics/:id - Update epic
DELETE /api/epics/:id - Delete epic

GET /api/epics/:id/stories - Get stories for an epic
POST /api/epics/:id/stories - Create new story
GET /api/stories/:id - Get story details
PUT /api/stories/:id - Update story
DELETE /api/stories/:id - Delete story

// Agent operations
GET/POST /api/agents/capabilities - Get agent capabilities and validate commands
POST /api/agents/execute - Execute agent task
POST /api/agents/project-manager - Execute project manager actions (includes CLAUDE.md updates)
GET /api/agents/status/:taskId - Get task status
GET /api/agents/queue - Get task queue status

// AI-Native TDD Cycle operations
GET /api/projects/:id/cycles - List project TDD cycles
POST /api/projects/:id/cycles - Create new TDD cycle from feature request
GET /api/cycles/:id - Get cycle details with tests and artifacts
PUT /api/cycles/:id/execute - Execute current phase of cycle
DELETE /api/cycles/:id - Delete cycle

// Test Management
GET /api/cycles/:id/tests - Get tests for a cycle
POST /api/cycles/:id/tests - Generate new test for cycle
PUT /api/tests/:id - Update test status/results
DELETE /api/tests/:id - Delete test

// Query System (AI Decision Points)
GET /api/projects/:id/queries - List pending queries (decision inbox)
POST /api/queries - Create new query when AI needs decision
GET /api/queries/:id - Get query details with context
PUT /api/queries/:id/answer - Answer query and resume development
PUT /api/queries/:id/dismiss - Dismiss advisory query

// Artifact Management
GET /api/cycles/:id/artifacts - Get generated code/docs for cycle
POST /api/artifacts - Create new artifact (generated code)
GET /api/artifacts/:id/content - Get artifact content
PUT /api/artifacts/:id - Update artifact content

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

// Good - uses Prisma client (works for any project type)
const projects = await prisma.project.findMany({
  include: {
    kanbanCards: true,
    tokenUsage: true,
  },
});

// Example projects of different types
const activeProjects = await prisma.project.findMany({
  where: { status: ProjectStatus.ACTIVE },
  // Could be: Next.js, Django, Rails, Spring Boot, Go API, etc.
});

// Projects support any language/framework
const pythonProjects = await prisma.project.findMany({
  where: { language: 'python' },
});

const rustProjects = await prisma.project.findMany({
  where: { language: 'rust' },
});

// Bad - raw SQL queries
const projects = await db.execute('SELECT * FROM projects');
```

### Database Schema Notes

- SQLite doesn't support enums, so status fields use strings with constants
- All models include `createdAt` and `updatedAt` timestamps
- Foreign key relationships use CASCADE deletes where appropriate
- JSON fields store complex data (agent capabilities, performance metrics)

## Configuration System

CodeHive uses a **database-driven configuration system** - no `.env` file needed! All application settings are managed through the Settings page at `/settings`.

### Using Configuration in Code

```typescript
import { getConfig } from '@/lib/config';

// Get runtime configuration (async)
const config = await getConfig();
const dbUrl = config.databaseUrl;
const isProduction = config.isProduction;

// For synchronous access when database might not be available
import { fallbackConfig } from '@/lib/config';
const claudePath = fallbackConfig.claudeCodePath;
```

### Configuration Management

- **UI-Based**: All settings configurable through `/settings` page
- **Database Storage**: Settings stored in `GlobalSettings` table
- **Real-time Updates**: Changes take effect immediately with cache invalidation
- **Fallback System**: Hardcoded defaults if database unavailable
- **No Environment Files**: `.env` file has been removed

### Available Settings

All settings can be configured via the web interface:

- **Token Management**: Daily limits, warning/critical thresholds
- **Claude API**: Command path, rate limiting
- **Application URLs**: Main app URL, WebSocket URL
- **Database**: SQLite file location
- **Auto Management**: Resume settings, pause behavior

### Environment Variables

Only `NODE_ENV` is still needed (automatically set by Next.js in development):

- `development` (default for `bun run dev`)
- `production` (set manually in production deployments)

## Recent Improvements

### Project Manager Intelligence

- **CLAUDE.md Maintenance**: Project Manager maintains and updates project CLAUDE.md to ensure all downstream agents have unified, current context about project goals, architecture, and development standards
- **Full Project Control**: Takes complete ownership of project direction, ensuring all development activities align with defined goals and user requirements
- **Autonomous Backlog Management**: Breaks down feature requests into proper Epic/Story hierarchies without user intervention
- **Agent Coordination**: Orchestrates all downstream agents with consistent direction and ensures they work towards unified objectives
- **Smart Prioritization**: Automatically determines Story priorities and dependencies based on project context and user feedback patterns
- **Context Synchronization**: Keeps all agents informed of project changes, architectural decisions, and evolving requirements through CLAUDE.md updates

### UI/UX Enhancements

- **ProjectLogsModal**: Fixed array handling bug preventing log display errors
- **Project View Layout**: Improved information organization with "Last updated" timestamp positioned next to action buttons
- **Real-time Logs**: Server-Sent Events integration for live project log streaming
- **Type Safety**: Enhanced type checking throughout the application to prevent runtime errors

### Bug Fixes

- Fixed `filteredLogs.map is not a function` error with proper array validation
- Improved error handling for API responses in log components
- Enhanced project analysis stability with Claude Code integration

## Development Workflow

### AI-Native TDD Development Process

**Phase 1: Feature Request Processing**

- User provides feature request or feedback (natural language)
- Project Manager agent analyzes request against current project goals
- Updates project CLAUDE.md with new requirements and context changes
- Creates Epic/Story breakdown and TDD Cycles for each Story
- Ensures all downstream agents have updated context before proceeding

**Phase 2: RED Phase (Test Generation)**

- AI generates failing tests from acceptance criteria
- Tests are stored in database with expected behavior
- System validates tests are properly failing

**Phase 3: GREEN Phase (Implementation)**

- AI writes minimal code to make tests pass
- Generated code stored as artifacts
- Tests updated to passing status

**Phase 4: REFACTOR Phase (Code Improvement)**

- AI improves code quality while keeping tests green
- Refactored versions stored as new artifacts
- Performance and maintainability optimized

**Phase 5: REVIEW Phase (Validation)**

- Final check that all requirements are met
- User can review generated code and tests
- Cycle marked as completed or returns to earlier phase

**Query-Driven Decision Points**:

- AI creates queries only when truly blocked
- BLOCKING queries pause development until answered
- ADVISORY queries continue with reasonable defaults
- User answers via simple inbox interface

### Code Quality Standards

- All code must pass TypeScript compilation
- ESLint and Prettier rules are enforced
- Use the provided utility functions in `/lib/utils`
- Follow existing patterns for error handling and validation

## Memories

- Update TASKS.md after finished tasks
- Update PROJECT_STATUS.md after finished tasks
- Do not launch dev server
