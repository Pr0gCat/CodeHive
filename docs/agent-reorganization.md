# Agent Directory Reorganization

## Summary

The `lib/agents` directory has been reorganized into more semantic directories since the project is no longer using the agentic approach. Each module is now in a directory that reflects its actual purpose.

## New Structure

```
lib/
├── execution/           # Core execution and command implementations
│   ├── executor.ts      # Main executor for Claude Code commands
│   ├── agent-factory.ts # Factory for creating command instances
│   ├── base-agent.ts    # Base command class
│   ├── code-analyzer.ts # Code analysis commands
│   ├── documentation.ts # Documentation generation commands
│   ├── git-operations.ts # Git operations commands
│   ├── test-runner.ts   # Test execution commands
│   ├── evolution-engine.ts # Command evolution tracking
│   ├── performance-tracker.ts # Performance metrics tracking
│   ├── query-helper.ts  # Query management helper
│   └── types.ts        # Execution-related types
├── coordination/        # Multi-component coordination
│   └── coordination-system.ts # Component coordination logic
├── queue/              # Task queue management
│   └── queue.ts        # Task queue implementation
├── rate-limiting/      # API rate limiting
│   └── rate-limiter.ts # Rate limiting implementation
├── project-management/ # Project management functionality
│   ├── project-manager.ts # Main project manager
│   ├── improved-project-manager.ts # Enhanced project manager
│   └── project-settings.ts # Project-specific settings
├── code-generation/    # Code and spec generators
│   └── spec-generator.ts # Specification generator
└── claude-code/        # Claude-specific integration
    ├── index.ts        # Main Claude Code interface
    ├── interactive-integration.ts # Interactive mode integration
    └── token-tracker.ts # Token usage tracking
```

## Import Updates

All imports have been updated from:
- `@/lib/agents/*` → `@/lib/<appropriate-directory>/*`

### Examples:
- `@/lib/agents/executor` → `@/lib/execution/executor`
- `@/lib/agents/types` → `@/lib/execution/types`
- `@/lib/agents/queue` → `@/lib/queue/queue`
- `@/lib/agents/project-manager` → `@/lib/project-management/project-manager`
- `@/lib/agents/rate-limiter` → `@/lib/rate-limiting/rate-limiter`
- `@/lib/agents/coordination-system` → `@/lib/coordination/coordination-system`

## Backward Compatibility

- `ProjectManager` is exported as an alias for `ProjectManagerAgent` to maintain compatibility

## Benefits

1. **Semantic Organization**: Each directory name clearly indicates its purpose
2. **No "Agent" Terminology**: Since the project isn't using an agentic approach, the terminology is more appropriate
3. **Better Separation of Concerns**: Claude-specific code remains in `claude-code/` while general functionality is organized by purpose
4. **Easier to Navigate**: Developers can find code based on what it does, not how it's implemented

## Migration Complete

- ✅ All files moved to semantic directories
- ✅ All imports updated across the codebase
- ✅ Tests updated to use new paths
- ✅ TypeScript compilation passes (with some unrelated warnings)
- ✅ ESLint passes (with warnings, no errors)