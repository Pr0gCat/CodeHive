# CodeHive

A multi-agent software development platform that orchestrates Claude Code agents for intelligent project management and development.

## 🚀 Quick Start

**No configuration files needed!** Just clone and run:

```bash
# Clone the repository
git clone <your-repo-url>
cd CodeHive

# Install dependencies
bun install

# 🔥 Setup and start everything
bun run app
```

**That's it!** The application will be available at http://localhost:3000

## 📋 Manual Setup

If you prefer step-by-step setup:

```bash
# 1. Install dependencies
bun install

# 2. Setup database and generate Prisma client
bun run db:setup

# 3. Start development server
bun run dev
```

## 🛠 Development Commands

```bash
# Development
bun run dev              # Start development server
bun run build            # Build for production
bun run start            # Start production server

# Database
bun run db:setup         # Initialize database and run migrations
bun run db:migrate       # Run new migrations

# Code Quality
bun run lint             # Run ESLint
bun run lint:fix         # Fix auto-fixable lint issues
bun run format           # Format all files with Prettier
bun run type-check       # Run TypeScript type checking

# Testing
bun test                 # Run tests
bun test --watch         # Run tests in watch mode
```

## 🔧 Configuration

CodeHive uses a **database-driven configuration system** - no `.env` file needed!

All settings can be configured through the Settings page at `/settings` once the application is running. The system comes with sensible defaults:

- **Database**: SQLite file at `./prisma/codehive.db`
- **Claude Code Path**: `claude` (assumes it's in your PATH)
- **Port**: 3000 (development)
- **Token Limits**: 100M tokens daily

## 📁 Project Structure

```
CodeHive/
├── app/                 # Next.js 14 App Router
├── components/          # Reusable React components
├── lib/                 # Core business logic
│   ├── config/         # Database-driven configuration
│   ├── db/             # Database client and types
│   ├── agents/         # Claude Code agent orchestration
│   └── utils/          # Common utilities
├── prisma/             # Database schema and migrations
├── repos/              # Local Git repositories (auto-created)
└── docs/               # Documentation
```

## 🎯 Features

- **Multi-Agent Development**: Orchestrates specialized Claude Code agents
- **Real-Time Progress Tracking**: Live updates with Server-Sent Events
- **Git Integration**: Full Git operations with progress tracking
- **Database-Driven Configuration**: No config files needed
- **Project Management**: Epic/Story hierarchy with autonomous backlog management
- **Token Usage Monitoring**: Smart resource allocation and limits

## 🤖 Requirements

- **Bun** (recommended) or Node.js 18+
- **Claude Code CLI** installed and available in PATH
- **Git** for repository management

## 📖 Usage

1. **Install dependencies**: `bun install`
2. **Start the application**: `bun run app`
3. **Open**: http://localhost:3000
4. **Configure**: Visit `/settings` to adjust configuration
5. **Create Projects**: Add new projects or import existing repositories
6. **Manage**: Use the dashboard to monitor agent activity and progress

## 🔍 Troubleshooting

**Port already in use?**
The development server will automatically find an available port starting from 3000.

**Database issues?**
Delete `prisma/codehive.db` and run `bun run db:setup` to reset.

**Claude Code not found?**
Ensure Claude Code CLI is installed and available in your PATH, or configure the path in Settings.

## Overview

CodeHive is a web-based platform that enables automated software development through intelligent agent coordination. It provides visual project management through Kanban boards and roadmaps while leveraging Claude Code for actual development tasks.

## Key Features

- **Multi-Project Management**: Handle multiple software projects simultaneously
- **Visual Project Control**: Interactive Kanban boards and roadmap visualization
- **Test-Driven Development**: Enforces TDD practices across all projects
- **Agent Orchestration**: Coordinates multiple Claude Code agents for different development tasks
- **Git Integration**: Full version control integration for project management
- **Token Usage Tracking**: Monitor and analyze API usage across projects
- **Real-time Updates**: Live progress tracking through WebSocket connections

## Technology Stack

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: SQLite with Prisma ORM
- **Package Manager**: Bun
- **Agent Runtime**: Claude Code via subprocess
- **Version Control**: Git

## Project Structure

```
codehive/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── projects/          # Project pages
│   └── components/        # React components
├── lib/
│   ├── db/               # SQLite database layer
│   ├── agents/           # Claude Code agent orchestration
│   └── git/              # Git operations
├── prisma/               # Database schema
├── public/               # Static assets
├── repos/                # Git repositories storage
└── codehive.db           # SQLite database file
```

## Agent Types

1. **Project Manager Agent**: Creates project roadmaps and breaks down features
2. **Architect Agent**: Designs system architecture and technical specifications
3. **TDD Developer Agent**: Writes tests first, then implements features
4. **Code Reviewer Agent**: Reviews code quality and ensures standards
5. **Integration Agent**: Handles CI/CD and deployment tasks

## Getting Started

### Prerequisites

- Node.js 18+
- Bun package manager
- Claude Code CLI installed and configured
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/codehive.git
cd codehive

# Install dependencies
bun install

# Set up the database
bun run db:setup

# Start the development server
bun run dev
```

### Environment Variables

Create a `.env.local` file:

```env
# Claude Code Configuration
CLAUDE_CODE_PATH=/path/to/claude-code

# Database
DATABASE_URL="file:./codehive.db"

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Usage

1. **Create a New Project**: Click "New Project" and provide project details
2. **Import Existing Project**: Use "Import from Git" to add existing repositories
3. **Manage Development**: Drag Kanban cards to control development flow
4. **Monitor Progress**: View real-time updates on the roadmap
5. **Track Usage**: Check token usage analytics for cost monitoring

## Development Workflow

1. User creates or imports a project
2. Project Manager agent analyzes requirements and creates roadmap
3. Architect agent designs the system architecture
4. Tasks are broken down into Kanban cards
5. TDD Developer agents work on implementation
6. Code Reviewer agent ensures quality
7. Integration agent handles testing and deployment

## API Endpoints

- `POST /api/projects` - Create new project
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id/kanban` - Update Kanban board
- `POST /api/agents/execute` - Execute agent task
- `GET /api/usage` - Get token usage statistics

## Project Management

- [Current Status](PROJECT_STATUS.md) - Overall project progress
- 🗺️ [Roadmap](ROADMAP.md) - Development phases and milestones
- ✅ [Task Board](TASKS.md) - Current sprint and backlog
- 🏃 [Sprint Planning](SPRINTS.md) - Detailed sprint schedules and progress
- 📋 [Sprint Templates](SPRINT_TEMPLATES.md) - Templates for sprint ceremonies

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - System design and components
- [Development Guide](docs/DEVELOPMENT.md) - Setup and development workflow
- [Development Flow](docs/DEVELOPMENT_FLOW.md) - Recommended development order
- [Agent Development](docs/AGENT_DEVELOPMENT_GUIDE.md) - How to build agents
- [Agentic Development Flow](docs/AGENTIC_DEVELOPMENT_FLOW.md) - Agent coding methodology
- [Dynamic Agent System](docs/DYNAMIC_AGENT_SYSTEM.md) - How agents create other agents
- [Usage Limit Management](docs/USAGE_LIMIT_MANAGEMENT.md) - API limit handling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details
