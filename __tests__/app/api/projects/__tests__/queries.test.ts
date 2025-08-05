import { prisma } from '@/lib/db';

// Mock the database
jest.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    query: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe('Queries API', () => {
  let testProjectId: string;

  beforeEach(async () => {
    // Create a test project
    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        description: 'Test project for queries',
        gitUrl: 'https://github.com/test/project',
        localPath: '/test/project/path',
      },
    });
    testProjectId = project.id;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.query.deleteMany({
      where: { projectId: testProjectId },
    });
    await prisma.project.delete({
      where: { id: testProjectId },
    });
  });

  it('should create a query', async () => {
    const mockQuery = {
      id: 'test-query-id',
      title: 'Test Query',
      description: 'Test query description',
      type: 'ARCHITECTURE',
      urgency: 'ADVISORY',
      projectId: testProjectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.query.create as jest.Mock).mockResolvedValue(mockQuery);

    const query = await prisma.query.create({
      data: {
        title: 'Test Query',
        question: 'Test query question',
        context: 'Test query context',
        type: 'ARCHITECTURE',
        urgency: 'ADVISORY',
        projectId: testProjectId,
      },
    });

    expect(query).toEqual(mockQuery);
    expect(prisma.query.create).toHaveBeenCalledWith({
      data: {
        title: 'Test Query',
        description: 'Test query description',
        type: 'ARCHITECTURE',
        urgency: 'ADVISORY',
        projectId: testProjectId,
      },
    });
  });

  it('should fetch queries for a project', async () => {
    const mockQueries = [
      {
        id: 'query-1',
        title: 'Query 1',
        description: 'Description 1',
        type: 'ARCHITECTURE',
        urgency: 'ADVISORY',
        projectId: testProjectId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'query-2',
        title: 'Query 2',
        description: 'Description 2',
        type: 'BUSINESS_LOGIC',
        urgency: 'BLOCKING',
        projectId: testProjectId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    (prisma.query.findMany as jest.Mock).mockResolvedValue(mockQueries);

    const queries = await prisma.query.findMany({
      where: { projectId: testProjectId },
    });

    expect(queries).toEqual(mockQueries);
    expect(prisma.query.findMany).toHaveBeenCalledWith({
      where: { projectId: testProjectId },
    });
  });
});
