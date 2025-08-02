import { prisma } from '@/lib/db';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Queries API', () => {
  let testProjectId: string;

  beforeEach(async () => {
    // Create a test project
    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        description: 'Test project for queries',
        localPath: '/test/path',
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
    jest.clearAllMocks();
  });

  it('should create a query', async () => {
    const queryData = {
      type: 'ARCHITECTURE',
      title: 'Test Query',
      question: 'What is the best architecture for this feature?',
      context: JSON.stringify({ feature: 'user authentication' }),
      urgency: 'BLOCKING',
      priority: 'HIGH',
    };

    // Mock successful response
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          title: 'Test Query',
          type: 'ARCHITECTURE',
        },
      }),
    });

    const response = await fetch(`/api/projects/${testProjectId}/queries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryData),
    });

    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.data.title).toBe('Test Query');
    expect(data.data.type).toBe('ARCHITECTURE');
  });

  it('should fetch queries for a project', async () => {
    // Create a test query first
    await prisma.query.create({
      data: {
        projectId: testProjectId,
        type: 'BUSINESS_LOGIC',
        title: 'Test Query',
        question: 'Test question',
        context: '{}',
        urgency: 'ADVISORY',
        priority: 'MEDIUM',
        status: 'PENDING',
      },
    });

    // Mock successful response
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            title: 'Test Query',
            type: 'BUSINESS_LOGIC',
          },
        ],
      }),
    });

    const response = await fetch(`/api/projects/${testProjectId}/queries`);
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].title).toBe('Test Query');
  });
});
