# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeHive is a multi-agent software development platform where users provide feature requests and feedback, while the Project Manager agent autonomously manages project backlogs through Epic and Story organization. The system uses AI-driven Test-Driven Development with minimal human interruption.

**Current Status**: AI-Native TDD Development System - Real Progress Tracking Complete ✅

- Next.js 14 + TypeScript + Tailwind CSS with complete UI
- SQLite database with Prisma ORM and database-driven configuration
- 5 specialized agents with command validation and real execution tracking
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
- ✅ **REAL PROGRESS TRACKING**: Unified task system for both project creation and import
- ✅ **DATABASE-BACKED SSE**: Persistent progress tracking with TaskExecution, TaskPhase, TaskEvent models
- ✅ **GENUINE GIT PROGRESS**: Real Git clone progress parsing from stderr output
- ✅ **ACTUAL FILE SCANNING**: Real project analysis with file-by-file progress updates
- ✅ **NO FAKE PROGRESS**: All progress indicators reflect real operations, no setTimeout simulations
- ✅ Improved UI layout with better information organization
- 🔄 Epic/Story management system (needed)
- 🔄 Autonomous backlog management (needed)
- 🔄 Feature request processing pipeline (needed)

## Core Development Commands

**CodeHive Platform Commands:**

```bash
# Quick Start - Two simple commands
bun install              # Install dependencies (run first)
bun run app              # Setup database, build, and start

# Individual operations (if needed)
bun run db:setup         # Initialize database and run migrations
bun run db:migrate       # Run new migrations
bun run db:generate      # Regenerate Prisma client

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

### Real Progress Tracking System

**ALL PROGRESS IS REAL - NO FAKE ANIMATIONS**

1. **Unified Task System**: Both project creation and import use the same TaskManager
2. **Database Persistence**: TaskExecution, TaskPhase, TaskEvent models store real progress
3. **Server-Sent Events**: Database-backed SSE provides real-time updates
4. **Genuine Operations**: Git clone, file scanning, project analysis all report actual progress

### Key Components

1. **TaskManager** (`/lib/tasks/task-manager.ts`)
   - Creates and manages task execution records
   - Updates phase progress with real operation status
   - Provides SSE-compatible progress callbacks

2. **Git Integration** (`/lib/git/index.ts`)
   - Parses Git stderr for real clone progress
   - Reports actual percentages from Git operations
   - No simulated progress bars

3. **Project Analysis** (`/lib/analysis/project-analyzer.ts`)
   - Scans files with real progress tracking
   - Reports progress based on actual files processed
   - Updates progress every N files processed

4. **SSE Progress API** (`/app/api/projects/progress/[id]/route.ts`)
   - Polls database for real task updates
   - Streams live progress events to clients
   - No in-memory storage, all database-backed

### Project Structure

- `/app` - Next.js 14 App Router pages and API routes
  - `/app/api` - REST API endpoints with real progress tracking
  - `/app/components` - Reusable React components
  - `/app/projects` - Project-specific pages
- `/lib` - Core business logic organized by domain:
  - `/lib/config` - Database-driven configuration system
  - `/lib/db` - Database client, types, and status constants
  - `/lib/utils` - Common utilities and helper functions
  - `/lib/agents` - Claude Code agent orchestration
  - `/lib/git` - Real Git operations and progress tracking
  - `/lib/tasks` - Task management and real progress tracking
  - `/lib/usage` - Token usage monitoring
- `/repos` - Local storage for managed project git repositories
- `/prisma` - Database schema, migrations, and seed data
- `/docs` - Project documentation and guides

### Git Repository Management

**All CodeHive projects are Git-managed repositories by default:**

- **Local Git Repositories**: Every project is initialized as a Git repository
- **Optional Remote**: Remote repositories (GitHub, GitLab, etc.) are optional and can be added later
- **Automatic Initialization**: New projects automatically run `git init` and create initial commit
- **Existing Repository Import**: Can import existing local or remote Git repositories with real clone progress
- **Branch Management**: Full Git operations through specialized agents
- **Conventional Commits**: Required for all project commits

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

## Development Workflow

### Unified Project Creation and Import

**Both operations now use the same real-time task system:**

1. **Project Creation** (`/api/projects/create`)
   - Real validation, directory creation, Git initialization
   - Actual file generation and project analysis
   - Database-backed progress tracking

2. **Project Import** (`/api/projects/import`)
   - Real Git clone with stderr progress parsing
   - Actual repository analysis and file scanning
   - Database-backed progress tracking

3. **Real-Time Animation** (`HiveInitializationAnimation`)
   - Displays actual progress from database via SSE
   - Shows real phase transitions and progress percentages
   - No fake timeouts or simulated progress

### Task System Architecture

```typescript
// Real task creation
await taskManager.createTask(taskId, 'PROJECT_CREATE', phases, options);
await taskManager.startTask(taskId);

// Real progress updates
await taskManager.updatePhaseProgress(taskId, phaseId, actualProgress, {
  type: 'PROGRESS',
  message: 'Actual operation status',
});

// Real completion
await taskManager.completeTask(taskId, actualResult);
```

## Code Quality Standards

- All code must pass TypeScript compilation
- ESLint and Prettier rules are enforced
- Use the provided utility functions in `/lib/utils`
- Follow existing patterns for error handling and validation
- **NEVER implement fake progress or simulated delays**

## Memories

- Update TASKS.md after finished tasks
- Update PROJECT_STATUS.md after finished tasks
- Do not launch dev server
- **CRITICAL**: All CodeHive projects MUST be Git repositories - verify Git status before any operations
- **IMPORTANT**: Git Operations Agent is always enabled - include Git recommendations in all agent coordination
- **NO FAKE PROGRESS**: All progress tracking must reflect real operations - no setTimeout delays or simulated progress
- **REAL SSE**: All Server-Sent Events must come from database state, not in-memory simulations
- **GENUINE OPERATIONS**: Git clones, file scanning, and project analysis must report actual progress

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
NEVER implement fake progress indicators - all progress must reflect real operations.