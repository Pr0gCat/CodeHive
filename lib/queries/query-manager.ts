import { prisma, Query, QueryComment, QueryStatusType, QueryTypeType, QueryUrgencyType } from '@/lib/db';

export interface QueryCreationData {
  projectId: string;
  cycleId?: string;
  type: QueryTypeType;
  title: string;
  question: string;
  context: Record<string, unknown>;
  urgency: QueryUrgencyType;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface QueryAnswer {
  queryId: string;
  answer: string;
  userId?: string;
}

export interface QueryFilters {
  projectId?: string;
  cycleId?: string;
  status?: QueryStatusType;
  urgency?: QueryUrgencyType;
  type?: QueryTypeType;
}

export interface DecisionResult {
  query: Query;
  shouldContinue: boolean;
  alternativeAction?: string;
}

/**
 * Query Manager - handles decision points and user queries in TDD cycles
 */
export class QueryManager {
  /**
   * Create a new query/decision point
   */
  async createQuery(data: QueryCreationData): Promise<Query> {
    const query = await prisma.query.create({
      data: {
        projectId: data.projectId,
        cycleId: data.cycleId,
        type: data.type,
        title: data.title,
        question: data.question,
        context: JSON.stringify(data.context),
        urgency: data.urgency,
        priority:
          data.priority || (data.urgency === 'BLOCKING' ? 'HIGH' : 'MEDIUM'),
        status: 'PENDING',
      },
      include: {
        cycle: true,
        comments: true,
      },
    });

    // If it's a blocking query, pause the cycle
    if (data.urgency === 'BLOCKING' && data.cycleId) {
      await this.pauseCycleForQuery(data.cycleId, query.id);
    }

    return query;
  }

  /**
   * Get queries with filters
   */
  async getQueries(filters: QueryFilters): Promise<Query[]> {
    const where: Record<string, unknown> = {};

    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.cycleId) where.cycleId = filters.cycleId;
    if (filters.status) where.status = filters.status;
    if (filters.urgency) where.urgency = filters.urgency;
    if (filters.type) where.type = filters.type;

    const queries = await prisma.query.findMany({
      where,
      include: {
        cycle: true,
        comments: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [
        { urgency: 'asc' }, // BLOCKING first
        { priority: 'desc' }, // HIGH priority first
        { createdAt: 'desc' },
      ],
    });

    return queries;
  }

  /**
   * Get pending queries for a project (decision inbox)
   */
  async getPendingQueries(projectId: string): Promise<Query[]> {
    return this.getQueries({
      projectId,
      status: 'PENDING',
    });
  }

  /**
   * Answer a query
   */
  async answerQuery(queryId: string, answer: string): Promise<DecisionResult> {
    const query = await prisma.query.update({
      where: { id: queryId },
      data: {
        answer,
        answeredAt: new Date(),
        status: 'ANSWERED',
      },
      include: {
        cycle: true,
      },
    });

    // Add system comment about the answer
    await this.addComment(queryId, `Query answered: ${answer}`, 'system');

    // Resume cycle if it was paused
    if (query.urgency === 'BLOCKING' && query.cycleId) {
      await this.resumeCycleAfterQuery(query.cycleId, queryId);
    }

    // Determine if development should continue
    const shouldContinue = this.evaluateAnswer(answer, query);

    return {
      query,
      shouldContinue,
      alternativeAction: shouldContinue
        ? undefined
        : 'retry_with_different_approach',
    };
  }

  /**
   * Dismiss an advisory query
   */
  async dismissQuery(queryId: string): Promise<Query> {
    const query = await prisma.query.update({
      where: { id: queryId },
      data: {
        status: 'DISMISSED',
        updatedAt: new Date(),
      },
    });

    // Add system comment
    await this.addComment(queryId, 'Query dismissed by user', 'system');

    return query;
  }

  /**
   * Add a comment to a query
   */
  async addComment(
    queryId: string,
    content: string,
    author: 'user' | 'ai' | 'system' = 'user'
  ): Promise<QueryComment> {
    const comment = await prisma.queryComment.create({
      data: {
        queryId,
        content,
        author,
      },
    });

    return comment;
  }

  /**
   * Check if a cycle has blocking queries
   */
  async hasBlockingQueries(cycleId: string): Promise<boolean> {
    const count = await prisma.query.count({
      where: {
        cycleId,
        status: 'PENDING',
        urgency: 'BLOCKING',
      },
    });

    return count > 0;
  }

  /**
   * Auto-expire old queries
   */
  async expireOldQueries(daysOld: number = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await prisma.query.updateMany({
      where: {
        status: 'PENDING',
        urgency: 'ADVISORY',
        createdAt: { lt: cutoffDate },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    return result.count;
  }

  /**
   * Get decision statistics for a project
   */
  async getDecisionStats(projectId: string): Promise<{
    total: number;
    pending: number;
    answered: number;
    dismissed: number;
    expired: number;
    blocking: number;
    avgResponseTime: number;
  }> {
    const queries = await prisma.query.findMany({
      where: { projectId },
    });

    const stats = {
      total: queries.length,
      pending: queries.filter(q => q.status === 'PENDING').length,
      answered: queries.filter(q => q.status === 'ANSWERED').length,
      dismissed: queries.filter(q => q.status === 'DISMISSED').length,
      expired: queries.filter(q => q.status === 'EXPIRED').length,
      blocking: queries.filter(q => q.urgency === 'BLOCKING').length,
      avgResponseTime: 0,
    };

    // Calculate average response time for answered queries
    const answeredQueries = queries.filter(
      q => q.status === 'ANSWERED' && q.answeredAt
    );
    if (answeredQueries.length > 0) {
      const totalTime = answeredQueries.reduce((sum, q) => {
        const responseTime = q.answeredAt!.getTime() - q.createdAt.getTime();
        return sum + responseTime;
      }, 0);

      stats.avgResponseTime = totalTime / answeredQueries.length / 1000 / 60; // in minutes
    }

    return stats;
  }

  // Private helper methods

  private async pauseCycleForQuery(
    cycleId: string,
    queryId: string
  ): Promise<void> {
    await prisma.cycle.update({
      where: { id: cycleId },
      data: {
        status: 'PAUSED',
        updatedAt: new Date(),
      },
    });

    // Log the pause event
    console.log(`⏸️ Cycle ${cycleId} paused for blocking query ${queryId}`);
  }

  private async resumeCycleAfterQuery(
    cycleId: string,
    queryId: string
  ): Promise<void> {
    await prisma.cycle.update({
      where: { id: cycleId },
      data: {
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    // Log the resume event
    console.log(
      `▶️ Cycle ${cycleId} resumed after query ${queryId} was answered`
    );
  }

  private evaluateAnswer(answer: string, query: Query): boolean {
    // Simple evaluation - in real implementation, use more sophisticated logic
    const negativeIndicators = ['no', 'stop', 'cancel', 'abort', 'different'];
    const answerLower = answer.toLowerCase();

    return !negativeIndicators.some(indicator =>
      answerLower.includes(indicator)
    );
  }

  /**
   * Create a decision branch for complex queries
   */
  async createDecisionBranch(
    queryId: string,
    branchName: string,
    description: string
  ): Promise<void> {
    const query = await prisma.query.findUnique({
      where: { id: queryId },
      include: { cycle: true },
    });

    if (!query || !query.cycleId) {
      throw new Error('Query not found or not associated with a cycle');
    }

    // Store decision branch info in query context
    const context = JSON.parse(query.context);
    context.decisionBranch = {
      name: branchName,
      description,
      createdAt: new Date(),
    };

    await prisma.query.update({
      where: { id: queryId },
      data: {
        context: JSON.stringify(context),
      },
    });

    // Add comment about decision branch
    await this.addComment(
      queryId,
      `Decision branch created: ${branchName} - ${description}`,
      'system'
    );
  }
}
