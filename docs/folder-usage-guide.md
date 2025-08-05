# CodeHive Project Folder Usage Guide

## Root Level Files & Directories

### Configuration Files
- **`package.json`** - Node.js dependencies, scripts, and project metadata
- **`bun.lock`** - Lockfile for Bun package manager (like package-lock.json)
- **`tsconfig.json`** - TypeScript compiler configuration
- **`next.config.js`** - Next.js framework configuration
- **`tailwind.config.js`** - Tailwind CSS configuration
- **`jest.config.js`** - Jest testing framework configuration
- **`server.ts`** - Custom Next.js server with Socket.IO integration

### Documentation
- **`CLAUDE.md`** - Instructions for Claude Code AI assistant
- **`README.md`** - Project overview and setup instructions
- **`USER_MANUAL.md`** - User guide for the application
- **`IMPROVED_ARCHITECTURE.md`** - Architecture documentation
- **`AgenticTDD.md`** - Test-driven development methodology docs

## Core Application Directories

### `/app` - Next.js 14 App Router
**Purpose**: Main application code using Next.js App Router pattern

#### `/app/api` - Backend API Routes
- **Purpose**: REST API endpoints for the application
- **Structure**: File-based routing (route.ts files)
- **Key Areas**:
  - `/admin` - Administrative functions (maintenance, task recovery)
  - `/agents` - AI agent management and execution
  - `/projects` - Project CRUD operations, settings, logs
  - `/epics` - Epic and story management
  - `/sprints` - Sprint management and tracking
  - `/queries` - User query management
  - `/oversight` - System analytics and monitoring
  - `/tokens` - Token usage monitoring

#### `/app/components` - React Components
- **Purpose**: Reusable React components for the UI
- **Key Components**:
  - `KanbanBoard.tsx` - Drag-and-drop project board
  - `ProjectOverview.tsx` - Project dashboard and metrics
  - `TDDDashboard.tsx` - Test-driven development interface
  - `TokenMonitor.tsx` - Resource usage tracking
  - `/initialization` - Project setup animations and progress
  - `/sprints` - Sprint planning and management UI
  - `/oversight` - System monitoring dashboards

#### `/app` Pages
- **`page.tsx`** - Home page
- **`layout.tsx`** - Root layout with navigation
- **`/projects`** - Project management pages
- **`/oversight`** - System monitoring and analytics
- **`/settings`** - Application configuration

### `/lib` - Business Logic and Utilities
**Purpose**: Core business logic, utilities, and services

#### Core Business Logic
- **`/project-management`** - Project lifecycle management
  - `project-manager.ts` - Main project management logic
  - `improved-project-manager.ts` - Enhanced project features
  - `project-settings.ts` - Project configuration

- **`/tasks`** - Task execution and management
  - `task-manager.ts` - Core task coordination
  - `project-creation.ts` - New project workflows
  - `project-import.ts` - Import existing projects
  - `task-recovery.ts` - Error recovery and retry logic

- **`/tdd`** - Test-Driven Development
  - `cycle-engine.ts` - RED-GREEN-REFACTOR-REVIEW cycle management
  - `ai-integration.ts` - AI-powered test generation

- **`/sprints`** - Agile Sprint Management
  - `sprint-manager.ts` - Sprint lifecycle and tracking
  - `default-sprint.ts` - Default sprint configurations

#### Infrastructure & Integration
- **`/db`** - Database layer
  - `index.ts` - Prisma client and database connection

- **`/claude-code`** - Claude Code AI Integration
  - `index.ts` - Main Claude Code client
  - `token-tracker.ts` - API usage monitoring
  - `interactive-integration.ts` - Interactive mode support

- **`/socket`** - Real-time Communication
  - `server.ts` - Socket.IO server setup
  - `client.ts` - React Socket.IO hooks
  - `types.ts` - WebSocket event types

- **`/git`** - Version Control Integration
  - `index.ts` - Git operations wrapper
  - `branch-manager.ts` - Branch management utilities

#### Execution & Commands
- **`/execution`** - Command execution system
  - `executor.ts` - Main command executor
  - `agent-factory.ts` - Creates specific command handlers
  - `code-analyzer.ts` - Code analysis commands
  - `documentation.ts` - Documentation generation
  - `git-operations.ts` - Git command handlers
  - `test-runner.ts` - Test execution commands

#### Support Services
- **`/logging`** - Logging infrastructure
  - `structured-logger.ts` - Main logging service
  - `project-logger.ts` - Project-specific logging
  - `migration-helper.ts` - Database migration logging

- **`/events`** - Event system
  - `task-event-emitter.ts` - Task lifecycle events
  - `queue-event-emitter.ts` - Queue status events

- **`/config`** - Configuration management
  - `index.ts` - Main configuration loader
  - `database-config.ts` - Database settings
  - `unified-config.ts` - Application-wide settings

### `/prisma` - Database Schema and Migrations
**Purpose**: Database schema definition and version control
- **`schema.prisma`** - Database schema definition
- **`/migrations`** - Database migration files
- **`codehive.db`** - SQLite database file

### `/components/ui` - Shared UI Components
**Purpose**: Reusable UI components shared across the application
- Form controls, sliders, modals, toasts
- Styled with Tailwind CSS

## Development & Testing

### `/__tests__` - Test Suite
**Purpose**: Comprehensive test coverage
- **`/app`** - Component and API route tests
- **`/lib`** - Business logic unit tests
- **`/integration`** - End-to-end integration tests
- **`/helpers`** - Test utilities and mocks

### `/docs` - Project Documentation
**Purpose**: Technical documentation and guides
- Architecture decisions
- API documentation
- Development guides

### `/scripts` - Automation Scripts
**Purpose**: Development and deployment automation
- Database setup scripts
- Import/export utilities
- Maintenance scripts

## Special Directories

### `/coverage` - Test Coverage Reports
**Purpose**: Generated test coverage reports (HTML format)

### `/public` - Static Assets
**Purpose**: Public assets served by Next.js
- Icons, images, favicon

### `/repos` - Managed Git Repositories
**Purpose**: Local storage for CodeHive-managed project repositories
- Each managed project gets a subdirectory here

## Key Architectural Patterns

### 1. **Domain-Driven Design**
- Business logic organized by domain (projects, tasks, sprints)
- Clear separation between UI, business logic, and infrastructure

### 2. **Real-time Architecture**
- Socket.IO for real-time updates
- Event-driven communication between components
- Database-backed progress tracking

### 3. **AI Integration**
- Claude Code integration for intelligent development
- AI-powered project analysis and code generation
- Autonomous project management

### 4. **Test-Driven Development**
- Built-in TDD cycle management
- Automated test generation and execution
- Progress tracking through RED-GREEN-REFACTOR phases

This structure supports CodeHive's mission as an AI-native software development platform that manages projects autonomously while providing real-time feedback to users.