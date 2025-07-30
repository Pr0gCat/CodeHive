import { prisma } from '@/lib/db';

export interface QueryContext {
  cardId?: string;
  cycleId?: string;
  feature?: string;
  codeContext?: string;
  options?: string[];
  [key: string]: any;
}

export interface CreateQueryOptions {
  projectId: string;
  type: 'ARCHITECTURE' | 'BUSINESS_LOGIC' | 'UI_UX' | 'INTEGRATION' | 'CLARIFICATION';
  title: string;
  question: string;
  context: QueryContext;
  urgency: 'BLOCKING' | 'ADVISORY';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  cycleId?: string;
}

/**
 * Create a query for user decision
 */
export async function createQuery(options: CreateQueryOptions) {
  try {
    const query = await prisma.query.create({
      data: {
        projectId: options.projectId,
        cycleId: options.cycleId || null,
        type: options.type,
        title: options.title,
        question: options.question,
        context: JSON.stringify(options.context),
        urgency: options.urgency,
        priority: options.priority,
        status: 'PENDING',
      },
      include: {
        cycle: {
          select: {
            id: true,
            title: true,
            phase: true,
          },
        },
      },
    });

    console.log(`Query created: ${query.title} (${query.urgency})`);
    return query;
  } catch (error) {
    console.error('Failed to create query:', error);
    throw error;
  }
}

/**
 * Create a blocking query that pauses development
 */
export async function createBlockingQuery(
  projectId: string,
  cardId: string,
  title: string,
  question: string,
  context: Omit<QueryContext, 'cardId'> = {}
) {
  return createQuery({
    projectId,
    type: 'CLARIFICATION',
    title,
    question,
    context: { ...context, cardId },
    urgency: 'BLOCKING',
    priority: 'HIGH',
  });
}

/**
 * Create an advisory query for suggestions
 */
export async function createAdvisoryQuery(
  projectId: string,
  cardId: string,
  title: string,
  question: string,
  context: Omit<QueryContext, 'cardId'> = {}
) {
  return createQuery({
    projectId,
    type: 'CLARIFICATION',
    title,
    question,
    context: { ...context, cardId },
    urgency: 'ADVISORY',
    priority: 'MEDIUM',
  });
}

/**
 * Check if a card has pending blocking queries
 */
export async function hasBlockingQueries(projectId: string, cardId: string): Promise<boolean> {
  try {
    const queries = await prisma.query.findMany({
      where: {
        projectId,
        status: 'PENDING',
        urgency: 'BLOCKING',
      },
    });

    return queries.some(query => {
      try {
        const context = JSON.parse(query.context);
        return context.cardId === cardId;
      } catch {
        return false;
      }
    });
  } catch (error) {
    console.error('Failed to check blocking queries:', error);
    return false;
  }
}

/**
 * Get pending queries for a card
 */
export async function getCardQueries(projectId: string, cardId: string) {
  try {
    const queries = await prisma.query.findMany({
      where: {
        projectId,
        status: 'PENDING',
      },
      include: {
        comments: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return queries.filter(query => {
      try {
        const context = JSON.parse(query.context);
        return context.cardId === cardId;
      } catch {
        return false;
      }
    });
  } catch (error) {
    console.error('Failed to get card queries:', error);
    return [];
  }
}

/**
 * Wait for user response to a query
 */
export async function waitForQueryResponse(queryId: string, timeoutMs: number = 300000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const query = await prisma.query.findUnique({
        where: { id: queryId },
      });

      if (query && query.status === 'ANSWERED') {
        return true;
      }

      if (query && query.status === 'DISMISSED') {
        return false;
      }

      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error('Error checking query status:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw new Error(`Query ${queryId} timed out after ${timeoutMs}ms`);
}

/**
 * Get the answer to a query
 */
export async function getQueryAnswer(queryId: string): Promise<string | null> {
  try {
    const query = await prisma.query.findUnique({
      where: { id: queryId },
    });

    return query?.answer || null;
  } catch (error) {
    console.error('Failed to get query answer:', error);
    return null;
  }
} 