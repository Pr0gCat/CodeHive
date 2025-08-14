# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 ABSOLUTE REQUIREMENT: Test-Driven Development (TDD)

**⚠️ MANDATORY: YOU MUST FOLLOW TDD METHODOLOGY FOR ALL FEATURE IMPLEMENTATIONS ⚠️**

**🔴 RED → 🟢 GREEN → 🔵 REFACTOR → REPEAT**

**NO EXCEPTIONS. NO SHORTCUTS. NO IMPLEMENTATION WITHOUT TESTS FIRST.**

If you are asked to implement ANY feature, API endpoint, component, or function:

1. ✋ **STOP** - Do not write implementation code immediately
2. 📝 **WRITE TESTS FIRST** - Create failing tests that describe the expected behavior
3. ✅ **VERIFY TESTS FAIL** - Run tests to confirm they fail (RED phase)
4. 💻 **MINIMAL IMPLEMENTATION** - Write only enough code to make tests pass (GREEN phase)
5. 🔧 **REFACTOR** - Improve code quality while keeping tests green (REFACTOR phase)
6. 🔄 **REPEAT** - Continue cycle for next piece of functionality

**⛔ IF YOU SKIP TDD, YOU ARE NOT FOLLOWING INSTRUCTIONS ⛔**

## 🛑 CRITICAL: Do ONLY What is Asked

**⚠️ STRICT INSTRUCTION ADHERENCE - NO UNSOLICITED ACTIONS ⚠️**

### Absolutely Forbidden Actions (Unless Explicitly Requested)

**❌ NEVER DO THESE WITHOUT EXPLICIT REQUEST:**
- Installing or updating dependencies (package.json changes)
- Running database migrations or schema changes
- Creating new files or directories
- Modifying existing configuration files (.env, tsconfig.json, etc.)
- Starting or stopping servers/services
- Running build, dev, or deployment commands
- Refactoring code that wasn't part of the task
- Adding new features beyond the specific request
- Optimizing performance unless asked
- Updating documentation unless specifically requested
- Committing changes to Git
- Running tests unless asked to verify implementation
- Cleaning up or organizing code that works
- Adding comments or improving code style (unless requested)
- Installing development tools or utilities

### Required Behavior: Scope Limitation

**✅ ONLY DO WHAT IS EXPLICITLY ASKED:**
1. **Read the Request Carefully**
   - Identify the EXACT task requested
   - Note any explicit constraints or limitations
   - Ask for clarification if requirements are ambiguous

2. **Minimal Implementation**
   - Implement ONLY the requested functionality
   - Do NOT add "helpful" extra features
   - Do NOT "improve" unrelated code

3. **Stop When Complete**
   - Complete the specific task
   - Report completion
   - Do NOT suggest additional improvements
   - Do NOT offer to do related tasks

### Examples of Correct Behavior

**Request**: "Fix the login button styling"
**Correct Response**: Modify only the login button CSS/styling
**Incorrect Response**: Fix login button + improve form layout + add validation + update other buttons

**Request**: "Add validation to email field"
**Correct Response**: Add email validation to that specific field
**Incorrect Response**: Add validation + improve error handling + refactor form component + add tests

**Request**: "Update project name display"
**Correct Response**: Change how project name is displayed
**Incorrect Response**: Update display + add tooltip + improve typography + update related components

### Communication Guidelines

**When Asked to Implement Something:**
1. Confirm understanding: "I'll implement [specific feature] by [approach]"
2. Implement only what was requested
3. Report completion: "Task complete. [Brief description of what was done]"

**When You Notice Other Issues:**
- Do NOT mention them unless directly relevant
- Focus solely on the requested task

**When Tempted to "Improve" Things:**
- Resist the urge to make unrequested changes
- Stick to the minimum required implementation
- Remember: The user asked for A, deliver A (not A+B+C)

### TDD Workflow - MANDATORY for Every Feature

1. **RED Phase (Write Tests First)**
   - ALWAYS write tests BEFORE implementation
   - Tests must initially FAIL (no implementation exists yet)
   - Write comprehensive test cases covering:
     - Happy path scenarios
     - Edge cases
     - Error conditions
     - Boundary conditions

2. **GREEN Phase (Minimal Implementation)**
   - Write ONLY the minimum code needed to pass tests
   - Do NOT add extra features or optimizations
   - Focus solely on making tests pass

3. **REFACTOR Phase (Improve Code Quality)**
   - Refactor ONLY after tests are passing
   - Maintain all tests in passing state
   - Improve code structure, readability, and performance
   - Extract common patterns and remove duplication

### Test File Organization

```
__tests__/
├── unit/                 # Unit tests for individual functions/components
│   ├── lib/             # Library function tests
│   └── components/      # React component tests
├── integration/         # Integration tests for API routes and services
│   └── api/            # API endpoint tests
└── e2e/                # End-to-end tests for user workflows
```

### Test Implementation Guidelines

1. **Test Naming Convention**
   ```typescript
   describe('ComponentName/FunctionName', () => {
     describe('methodName', () => {
       it('should [expected behavior] when [condition]', () => {
         // Test implementation
       });
     });
   });
   ```

2. **Test Structure Pattern**
   ```typescript
   // Arrange - Set up test data and conditions
   const testData = { ... };
   
   // Act - Execute the function/component being tested
   const result = functionUnderTest(testData);
   
   // Assert - Verify the results
   expect(result).toBe(expectedValue);
   ```

3. **Coverage Requirements**
   - Minimum 80% code coverage for new features
   - 100% coverage for critical business logic
   - All edge cases must have corresponding tests

### Example TDD Implementation Flow

```typescript
// Step 1: Write failing test first
describe('ProjectManager', () => {
  it('should create project with valid metadata', async () => {
    const project = await createProject({ name: 'Test Project' });
    expect(project.id).toBeDefined();
    expect(project.metadata.version).toBe('1.0.0');
  });
});

// Step 2: Implement minimum code to pass
async function createProject(data) {
  return {
    id: generateId(),
    metadata: { version: '1.0.0' }
  };
}

// Step 3: Refactor and improve
async function createProject(data: ProjectInput): Promise<Project> {
  validateProjectInput(data);
  const project = new Project(data);
  await project.save();
  return project;
}
```

### TDD Implementation Checklist

Before considering ANY feature complete, verify:

- [ ] **Tests Written First**: All tests were written before implementation
- [ ] **Tests Initially Failed**: Confirmed RED phase with failing tests
- [ ] **Minimal Implementation**: Only wrote code needed to pass tests
- [ ] **All Tests Pass**: Confirmed GREEN phase with passing tests
- [ ] **Code Refactored**: Improved structure while maintaining green tests
- [ ] **Edge Cases Covered**: Tests include boundary conditions and error scenarios
- [ ] **Performance Verified**: Critical paths have performance assertions
- [ ] **Mocks Properly Used**: External dependencies are mocked
- [ ] **Test Coverage**: Minimum 80% coverage achieved (100% for critical logic)
- [ ] **Integration Tests**: API endpoints have integration test coverage

### Forbidden Practices

**❌ NEVER DO THESE:**
- Write implementation code before tests
- Skip test cases for "simple" functions
- Write tests after implementation
- Mock internal functions being tested
- Write overly complex tests that test multiple behaviors
- Ignore failing tests or mark them as "TODO"
- Copy-paste test code without understanding
- Write tests that don't actually test the behavior

**✅ ALWAYS DO THESE:**
- Start with the simplest failing test
- Write descriptive test names
- Use the AAA pattern (Arrange-Act-Assert)
- Keep tests fast and independent
- Refactor tests when refactoring code
- Delete or update obsolete tests
- Mock external dependencies only
- Test one behavior per test case

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

## TDD Best Practices for CodeHive Development

### When Implementing ANY New Feature

1. **Start with User Story**
   ```
   As a [user type]
   I want to [action]
   So that [benefit]
   ```

2. **Write Acceptance Tests First (ATDD)**
   ```typescript
   // __tests__/e2e/feature.test.ts
   describe('Feature: Project Import', () => {
     it('should allow user to import Git repository', async () => {
       // Given: User is on projects page
       // When: User clicks import and enters Git URL
       // Then: Project should be imported and displayed
     });
   });
   ```

3. **Break Down to Unit Tests**
   ```typescript
   // __tests__/unit/lib/git/clone.test.ts
   describe('GitClient.clone', () => {
     it('should clone repository with progress tracking', async () => {
       // Test implementation
     });
   });
   ```

### Testing React Components

```typescript
// __tests__/unit/components/ProjectCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import ProjectCard from '@/components/ProjectCard';

describe('ProjectCard', () => {
  it('should display project information', () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText('Project Name')).toBeInTheDocument();
  });
  
  it('should handle click events', () => {
    const handleClick = jest.fn();
    render(<ProjectCard project={mockProject} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledWith(mockProject.id);
  });
});
```

### Testing API Routes

```typescript
// __tests__/integration/api/projects.test.ts
import { createMocks } from 'node-mocks-http';
import handler from '@/app/api/projects/route';

describe('POST /api/projects', () => {
  it('should create project with valid data', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { name: 'Test Project' }
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(201);
    expect(JSON.parse(res._getData())).toHaveProperty('id');
  });
});
```

### Mock and Stub Guidelines

```typescript
// Use Jest mocks for external dependencies
jest.mock('@/lib/git', () => ({
  gitClient: {
    clone: jest.fn().mockResolvedValue({ success: true })
  }
}));

// Use test doubles for database
const prismaMock = {
  project: {
    create: jest.fn(),
    findUnique: jest.fn()
  }
};
```

### Performance Testing

```typescript
describe('Performance', () => {
  it('should complete operation within 2 seconds', async () => {
    const start = Date.now();
    await performOperation();
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000);
  });
});
```

### Error Handling Tests

```typescript
describe('Error Handling', () => {
  it('should handle network errors gracefully', async () => {
    // Simulate network failure
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
    
    const result = await fetchData();
    
    expect(result.error).toBe('Network error');
    expect(result.success).toBe(false);
  });
});
```

## Memories

### Core Behavioral Rules
- **DO ONLY WHAT IS ASKED**: Never implement unrequested features or improvements
- **NO UNSOLICITED ACTIONS**: Don't run commands, install packages, or modify files unless explicitly requested
- **MINIMAL SCOPE**: Implement exactly what is requested, nothing more
- **ASK BEFORE EXPANDING**: If scope is unclear, ask for clarification rather than assuming
- **STOP WHEN DONE**: Complete the task and stop - don't suggest additional work

### TDD Requirements
- **TDD IS MANDATORY**: Always write tests BEFORE implementation
- **TEST FIRST, CODE SECOND**: Never write production code without a failing test
- **ONE TEST AT A TIME**: Write one failing test, make it pass, then refactor
- **KEEP TESTS SIMPLE**: Each test should verify ONE behavior
- **FAST FEEDBACK**: Tests should run quickly (< 100ms for unit tests)
- **INDEPENDENT TESTS**: Tests should not depend on each other
- **DESCRIPTIVE NAMES**: Test names should clearly describe what they test
- **AAA PATTERN**: Always use Arrange-Act-Assert pattern
- **NO TEST, NO CODE**: If you can't write a test for it, don't implement it
- **MOCK EXTERNAL DEPENDENCIES**: Always mock API calls, database operations, and file system

### Operational Constraints
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
- **UI LOCALIZATION**: Always respond in Traditional Chinese when asked to generate UI-related content or interactions
- **NEW ARCHITECTURE**: 正在設計新的單一專案代理架構，取代現有的多代理系統
- **PROJECT AGENT CONCEPT**: 新系統將使用單一專案代理處理所有對話和專案管理
- **THREE PHASES**: 專案生命週期包含三個階段：需求獲取、MVP開發、持續整合
- **ATDD/TDD**: 使用通用ATDD框架，支援開發和非開發任務
- **DESIGN DOCUMENT**: 完整設計文件位於 AI_PROJECT_DEVELOPMENT_DESIGN.md

# important-instruction-reminders

## ⚠️ ABSOLUTE RESTRICTIONS - NEVER VIOLATE THESE

**SCOPE LIMITATION:**
- Do what has been asked; nothing more, nothing less
- NEVER implement features not explicitly requested
- NEVER add "helpful" improvements or optimizations
- NEVER refactor code unless specifically asked to refactor
- NEVER suggest additional tasks or improvements

**FILE OPERATIONS:**
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files
- Only create documentation files if explicitly requested by the User
- NEVER modify configuration files unless specifically asked
- NEVER touch package.json, tsconfig.json, or similar unless requested

**COMMAND EXECUTION:**
- NEVER run commands unless explicitly asked
- Do not run prisma studio by yourself
- Do not launch or restart servers
- Do not run builds, migrations, or deployments
- Do not install or update packages
- Do not run tests unless asked to verify implementation
- Do not run linting or formatting tools automatically

**CODE MODIFICATIONS:**
- NEVER add comments unless requested
- NEVER improve code style unless asked
- NEVER optimize performance unless specifically requested
- NEVER add error handling unless it's part of the core request
- NEVER add logging unless requested
- NEVER add validation unless it's the specific task

**COMMUNICATION:**
- Ask for clarification if the request is ambiguous
- Confirm understanding before implementing
- Report completion briefly without suggesting next steps
- Do NOT offer additional services or improvements

## Remember: The user knows what they want. Trust their judgment and do exactly what they ask for.