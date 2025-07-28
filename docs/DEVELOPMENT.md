# CodeHive Development Guide

## Prerequisites

Before starting development, ensure you have:

- Node.js 18+ installed
- Bun package manager (`curl -fsSL https://bun.sh/install | bash`)
- Claude Code CLI configured with valid API key
- Git installed
- SQLite3 (usually pre-installed on most systems)

## Initial Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/codehive.git
   cd codehive
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local`:

   ```env
   # Claude Code path (find with `which claude-code`)
   CLAUDE_CODE_PATH=/usr/local/bin/claude-code

   # Database URL (SQLite)
   DATABASE_URL="file:./codehive.db"

   # Application URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # WebSocket URL (for real-time updates)
   NEXT_PUBLIC_WS_URL=ws://localhost:3000
   ```

4. **Initialize the database**

   ```bash
   bun run db:setup
   ```

5. **Create required directories**

   ```bash
   mkdir -p repos
   ```

6. **Start development server**
   ```bash
   bun run dev
   ```

## Development Workflow

### Working with the Frontend

The frontend uses Next.js 14 with App Router:

```typescript
// Creating a new component
// app/components/ProjectCard.tsx
export function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="border rounded-lg p-4">
      <h3>{project.name}</h3>
      <p>{project.description}</p>
    </div>
  );
}
```

### Adding API Routes

Create new API routes in `app/api/`:

```typescript
// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const projects = await db.project.findMany();
  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const project = await db.project.create({ data });
  return NextResponse.json(project);
}
```

### Working with Agents

1. **Create agent prompt**

   ```markdown
   <!-- lib/agents/prompts/tdd-developer.md -->

   You are a TDD Developer agent for CodeHive.

   Your responsibilities:

   1. Write tests before implementation
   2. Ensure all tests pass
   3. Follow project coding standards

   For the given task: {{TASK_DESCRIPTION}}
   In the project: {{PROJECT_PATH}}
   ```

2. **Implement agent executor**
   ```typescript
   // lib/agents/executors/tdd-developer.ts
   export async function executeTDDDeveloper(task: AgentTask) {
     const prompt = await loadPrompt('tdd-developer', {
       TASK_DESCRIPTION: task.description,
       PROJECT_PATH: task.projectPath,
     });

     return await executeClaudeCode({
       workingDirectory: task.projectPath,
       prompt,
       timeout: 300000, // 5 minutes
     });
   }
   ```

### Database Operations

Using Prisma for database operations:

```typescript
// Create a new Kanban card
const card = await prisma.kanbanCard.create({
  data: {
    projectId: project.id,
    title: 'Implement user authentication',
    status: 'todo',
    position: 0,
  },
});

// Update card position
await prisma.kanbanCard.updateMany({
  where: {
    projectId,
    position: { gte: newPosition },
  },
  data: {
    position: { increment: 1 },
  },
});
```

### Real-time Updates

Implement WebSocket handlers:

```typescript
// lib/websocket/handlers.ts
export function handleProjectSubscription(ws: WebSocket, projectId: string) {
  // Add to project subscribers
  projectSubscribers.get(projectId)?.add(ws) ||
    projectSubscribers.set(projectId, new Set([ws]));

  // Send updates
  export function broadcastCardUpdate(projectId: string, card: KanbanCard) {
    const subscribers = projectSubscribers.get(projectId);
    subscribers?.forEach(ws => {
      ws.send(
        JSON.stringify({
          type: 'card:updated',
          data: { card },
        })
      );
    });
  }
}
```

## Testing

### Unit Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test src/lib/agents/orchestrator.test.ts
```

### Integration Tests

```typescript
// tests/api/projects.test.ts
import { createMockProject } from '@/tests/helpers';

describe('Projects API', () => {
  it('creates a new project', async () => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify(createMockProject()),
    });

    expect(response.status).toBe(201);
  });
});
```

### E2E Tests

```typescript
// e2e/project-creation.spec.ts
import { test, expect } from '@playwright/test';

test('create new project', async ({ page }) => {
  await page.goto('/');
  await page.click('text=New Project');
  await page.fill('input[name="name"]', 'Test Project');
  await page.click('text=Create');
  await expect(page).toHaveURL(/\/projects\/.+/);
});
```

## Debugging

### Debug Claude Code Integration

```typescript
// Enable debug logging
process.env.DEBUG = 'codehive:agents';

// In your code
import debug from 'debug';
const log = debug('codehive:agents');

log('Executing Claude Code with prompt:', prompt);
```

### Debug Database Queries

```typescript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  log      = ["query", "info", "warn", "error"]
}
```

### Debug WebSocket Connections

```typescript
// lib/websocket/debug.ts
export function debugWebSocket(ws: WebSocket) {
  ws.on('message', data => {
    console.log('[WS] Received:', data.toString());
  });

  ws.on('error', error => {
    console.error('[WS] Error:', error);
  });
}
```

## Common Issues

### Issue: Claude Code not found

```bash
# Solution: Ensure Claude Code is in PATH
export PATH="$PATH:/path/to/claude-code"
```

### Issue: Database locked

```bash
# Solution: Close other connections
lsof | grep codehive.db
kill -9 <PID>
```

### Issue: Port already in use

```bash
# Solution: Change port or kill process
lsof -i :3000
kill -9 <PID>
# Or use different port
PORT=3001 bun run dev
```

## Code Style

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

### Formatting

```bash
# Format code
bun run format

# Check formatting
bun run format:check
```

### Linting

```bash
# Run ESLint
bun run lint

# Fix auto-fixable issues
bun run lint:fix
```

## Performance Tips

1. **Optimize Database Queries**

   ```typescript
   // Bad: N+1 query
   const projects = await prisma.project.findMany();
   for (const project of projects) {
     const cards = await prisma.kanbanCard.findMany({
       where: { projectId: project.id },
     });
   }

   // Good: Include related data
   const projects = await prisma.project.findMany({
     include: { kanbanCards: true },
   });
   ```

2. **Cache Agent Outputs**

   ```typescript
   const cache = new Map<string, AgentResult>();

   export async function getCachedOrExecute(task: AgentTask) {
     const key = `${task.agentType}:${task.id}`;
     if (cache.has(key)) return cache.get(key);

     const result = await executeAgent(task);
     cache.set(key, result);
     return result;
   }
   ```

3. **Debounce WebSocket Updates**

   ```typescript
   const updates = new Map();
   let timeout: Timer;

   export function queueUpdate(id: string, data: any) {
     updates.set(id, data);
     clearTimeout(timeout);
     timeout = setTimeout(flushUpdates, 100);
   }
   ```

## Deployment Checklist

- [ ] Run tests: `bun test`
- [ ] Check types: `bun run type-check`
- [ ] Lint code: `bun run lint`
- [ ] Build project: `bun run build`
- [ ] Test production build: `bun run start`
- [ ] Update documentation
- [ ] Tag release: `git tag v1.0.0`
- [ ] Deploy to server
