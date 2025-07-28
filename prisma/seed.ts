import { prisma, ProjectStatus, CardStatus } from '../lib/db';

async function main() {
  console.log('🌱 Seeding database...');

  // Create a demo project
  const demoProject = await prisma.project.create({
    data: {
      name: 'CodeHive Demo Project',
      description: 'A demonstration project showing CodeHive capabilities',
      localPath: 'repos/codehive-demo',
      status: ProjectStatus.ACTIVE,
      kanbanCards: {
        create: [
          {
            title: 'Project Setup',
            description: 'Initialize the project with basic structure',
            status: CardStatus.DONE,
            position: 0,
          },
          {
            title: 'User Authentication',
            description: 'Implement user login and registration',
            status: CardStatus.IN_PROGRESS,
            position: 1,
            assignedAgent: 'tdd-developer',
          },
          {
            title: 'Database Design',
            description: 'Design and implement the database schema',
            status: CardStatus.TODO,
            position: 2,
          },
          {
            title: 'API Endpoints',
            description: 'Create RESTful API endpoints',
            status: CardStatus.BACKLOG,
            position: 3,
          },
          {
            title: 'Frontend Interface',
            description: 'Build the user interface components',
            status: CardStatus.BACKLOG,
            position: 4,
          },
        ],
      },
      milestones: {
        create: [
          {
            title: 'MVP Release',
            description: 'Minimum Viable Product with core features',
            dueDate: new Date('2025-08-30'),
            status: 'PLANNED',
          },
          {
            title: 'Beta Release',
            description: 'Feature-complete beta version',
            dueDate: new Date('2025-09-30'),
            status: 'PLANNED',
          },
        ],
      },
    },
  });

  // Create some sample token usage data
  await prisma.tokenUsage.create({
    data: {
      projectId: demoProject.id,
      agentType: 'project-manager',
      inputTokens: 1500,
      outputTokens: 800,
      timestamp: new Date(),
    },
  });

  await prisma.tokenUsage.create({
    data: {
      projectId: demoProject.id,
      agentType: 'tdd-developer',
      inputTokens: 2500,
      outputTokens: 1200,
      timestamp: new Date(),
    },
  });

  // Create usage limits
  await prisma.usageLimit.create({
    data: {
      limitType: 'tokens_per_day',
      limitValue: 10000000,
      currentUsage: 0,
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    },
  });

  await prisma.usageLimit.create({
    data: {
      limitType: 'requests_per_minute',
      limitValue: 50,
      currentUsage: 0,
      resetAt: new Date(Date.now() + 60 * 1000), // 1 minute from now
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log(`📝 Created demo project: ${demoProject.name}`);
  console.log(`🆔 Project ID: ${demoProject.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });