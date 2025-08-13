/**
 * Conversation Context Manager
 * 
 * Manages context gathering and preparation for AI service conversations,
 * including project metadata, conversation history, and phase-specific information.
 */

import { prisma } from '@/lib/db';
import { ConversationContext } from './ai-service';

export interface ProjectInfo {
  id: string;
  name?: string;
  description?: string;
  framework?: string;
  language?: string;
  status?: string;
  localPath?: string;
  phase?: string;
}

export interface ConversationMetrics {
  totalMessages: number;
  userMessages: number;
  agentMessages: number;
  averageResponseTime: number;
  totalTokenUsage: number;
}

export class ConversationContextManager {
  
  /**
   * Build complete conversation context for AI service
   */
  async buildContext(
    projectId: string,
    conversationId: string,
    phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS',
    maxMessages: number = 20
  ): Promise<ConversationContext> {
    try {
      // Get project information
      const projectInfo = await this.getProjectInfo(projectId);
      
      // Get recent conversation messages
      const recentMessages = await this.getRecentMessages(conversationId, maxMessages);
      
      // Get project metadata (epics, stories, etc.)
      const projectMetadata = await this.getProjectMetadata(projectId, phase);

      return {
        projectId,
        projectPhase: (projectInfo?.phase as 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS') || phase,
        conversationId,
        recentMessages,
        projectMetadata: {
          name: projectInfo?.name,
          description: projectInfo?.description,
          framework: projectInfo?.framework,
          language: projectInfo?.language,
          ...projectMetadata
        }
      };

    } catch (error) {
      console.error('Error building conversation context:', error);
      
      // Return minimal context on error
      return {
        projectId,
        projectPhase: phase,
        conversationId,
        recentMessages: [],
        projectMetadata: {}
      };
    }
  }

  /**
   * Get project information from database or external source
   */
  private async getProjectInfo(projectId: string): Promise<ProjectInfo | null> {
    try {
      // Try to get from database first
      const project = await prisma.projectIndex.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          description: true,
          framework: true,
          language: true,
          status: true,
          localPath: true,
          phase: true
        }
      });

      if (project) {
        return project;
      }

      // If not in database, try to infer from project structure
      return await this.inferProjectInfo(projectId);

    } catch (error) {
      console.error('Error getting project info:', error);
      return null;
    }
  }

  /**
   * Infer project information from file system structure
   */
  private async inferProjectInfo(projectId: string): Promise<ProjectInfo | null> {
    try {
      // TODO: Implement project structure analysis
      // - Check for package.json, requirements.txt, etc.
      // - Detect framework from dependencies
      // - Read README or project description files
      
      return {
        id: projectId,
        name: `專案 ${projectId}`,
        description: '專案描述尚未設定',
        framework: '未偵測到',
        language: '未偵測到'
      };

    } catch (error) {
      console.error('Error inferring project info:', error);
      return null;
    }
  }

  /**
   * Get recent messages from conversation
   */
  private async getRecentMessages(conversationId: string, limit: number = 20) {
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          role: true,
          content: true,
          contentType: true,
          createdAt: true,
          tokenUsage: true,
          responseTime: true,
          phase: true,
          isError: true,
          conversationId: true
        }
      });

      // Return in chronological order (oldest first)
      return messages.reverse();

    } catch (error) {
      console.error('Error getting recent messages:', error);
      return [];
    }
  }

  /**
   * Get project metadata based on phase
   */
  private async getProjectMetadata(
    projectId: string, 
    phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS'
  ): Promise<Record<string, any>> {
    try {
      const metadata: Record<string, any> = {};

      switch (phase) {
        case 'REQUIREMENTS':
          // Get existing requirement discussions
          metadata.existingRequirements = await this.getRequirementsData(projectId);
          metadata.suggestedTemplates = await this.getRequirementTemplates();
          break;

        case 'MVP':
          // Get current epics and stories
          metadata.currentEpics = await this.getCurrentEpics(projectId);
          metadata.currentStories = await this.getCurrentStories(projectId);
          metadata.developmentStatus = await this.getDevelopmentStatus(projectId);
          break;

        case 'CONTINUOUS':
          // Get maintenance and enhancement info
          metadata.recentIssues = await this.getRecentIssues(projectId);
          metadata.performanceMetrics = await this.getPerformanceMetrics(projectId);
          metadata.technicalDebt = await this.getTechnicalDebt(projectId);
          break;
      }

      return metadata;

    } catch (error) {
      console.error('Error getting project metadata:', error);
      return {};
    }
  }

  /**
   * Get existing requirements data
   */
  private async getRequirementsData(projectId: string): Promise<any[]> {
    try {
      // TODO: Query requirements from conversation history or separate requirements table
      const requirementConversations = await prisma.conversation.findMany({
        where: {
          projectId,
          phase: 'REQUIREMENTS',
          status: 'COMPLETED'
        },
        include: {
          messages: {
            where: { role: 'USER' },
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      });

      return requirementConversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        summary: conv.summary,
        keyRequirements: conv.messages.map(msg => msg.content)
      }));

    } catch (error) {
      console.error('Error getting requirements data:', error);
      return [];
    }
  }

  /**
   * Get requirement templates
   */
  private async getRequirementTemplates(): Promise<string[]> {
    return [
      '網站應用程式',
      '移動應用程式', 
      '桌面應用程式',
      'API服務',
      '資料分析工具',
      '電商平台',
      '內容管理系統'
    ];
  }

  /**
   * Get current epics from project
   */
  private async getCurrentEpics(projectId: string): Promise<any[]> {
    try {
      const epics = await prisma.epic.findMany({
        where: { projectId },
        orderBy: { priority: 'desc' },
        take: 10, // Limit to 10 most important epics
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          phase: true,
          estimatedEffort: true,
          _count: {
            select: { stories: true }
          }
        }
      });

      return epics.map(epic => ({
        id: epic.id,
        title: epic.title,
        status: epic.status,
        priority: epic.priority,
        phase: epic.phase,
        estimatedEffort: epic.estimatedEffort,
        storyCount: epic._count.stories
      }));
    } catch (error) {
      console.error('Error getting current epics:', error);
      return [];
    }
  }

  /**
   * Get current stories from project
   */
  private async getCurrentStories(projectId: string): Promise<any[]> {
    try {
      const stories = await prisma.story.findMany({
        where: {
          epic: { projectId }
        },
        orderBy: { priority: 'desc' },
        take: 20, // Limit to 20 most important stories
        select: {
          id: true,
          title: true,
          userStory: true,
          status: true,
          priority: true,
          storyPoints: true,
          iteration: true,
          epic: {
            select: { id: true, title: true }
          },
          _count: {
            select: { tasks: true }
          }
        }
      });

      return stories.map(story => ({
        id: story.id,
        title: story.title,
        userStory: story.userStory,
        status: story.status,
        priority: story.priority,
        storyPoints: story.storyPoints,
        iteration: story.iteration,
        epic: story.epic,
        taskCount: story._count.tasks
      }));
    } catch (error) {
      console.error('Error getting current stories:', error);
      return [];
    }
  }

  /**
   * Get development status
   */
  private async getDevelopmentStatus(projectId: string): Promise<any> {
    try {
      // Get epic and story statistics
      const epics = await prisma.epic.findMany({
        where: { projectId },
        select: { status: true }
      });

      const stories = await prisma.story.findMany({
        where: {
          epic: { projectId }
        },
        select: { status: true, storyPoints: true }
      });

      const tasks = await prisma.task.findMany({
        where: {
          story: {
            epic: { projectId }
          }
        },
        select: { status: true, type: true }
      });

      const completedStories = stories.filter(s => s.status === 'COMPLETED').length;
      const inProgressStories = stories.filter(s => s.status === 'IN_PROGRESS').length;
      const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
      const testTasks = tasks.filter(t => t.type === 'TEST').length;
      const completedTestTasks = tasks.filter(t => t.type === 'TEST' && t.status === 'COMPLETED').length;

      const totalStoryPoints = stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
      const completedStoryPoints = stories
        .filter(s => s.status === 'COMPLETED')
        .reduce((sum, s) => sum + (s.storyPoints || 0), 0);

      return {
        totalEpics: epics.length,
        completedEpics: epics.filter(e => e.status === 'COMPLETED').length,
        totalStories: stories.length,
        completedStories,
        inProgressStories,
        totalTasks: tasks.length,
        completedTasks,
        totalStoryPoints,
        completedStoryPoints,
        testCoverage: testTasks > 0 ? Math.round((completedTestTasks / testTasks) * 100) : 0,
        overallProgress: stories.length > 0 ? Math.round((completedStories / stories.length) * 100) : 0
      };
    } catch (error) {
      console.error('Error getting development status:', error);
      return {
        completedStories: 0,
        inProgressStories: 0,
        totalStories: 0,
        testCoverage: 0,
        overallProgress: 0
      };
    }
  }

  /**
   * Get recent issues for continuous phase
   */
  private async getRecentIssues(projectId: string): Promise<any[]> {
    try {
      // TODO: Get from issue tracking system or error messages
      return [];
    } catch (error) {
      console.error('Error getting recent issues:', error);
      return [];
    }
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(projectId: string): Promise<any> {
    try {
      // TODO: Get from monitoring systems
      return {
        averageResponseTime: 0,
        errorRate: 0,
        uptime: 100
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return {};
    }
  }

  /**
   * Get technical debt information
   */
  private async getTechnicalDebt(projectId: string): Promise<any> {
    try {
      // TODO: Analyze code quality metrics
      return {
        codeQualityScore: 0,
        securityIssues: 0,
        outdatedDependencies: 0
      };
    } catch (error) {
      console.error('Error getting technical debt:', error);
      return {};
    }
  }

  /**
   * Get conversation metrics for analysis
   */
  async getConversationMetrics(conversationId: string): Promise<ConversationMetrics> {
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId },
        select: {
          role: true,
          tokenUsage: true,
          responseTime: true
        }
      });

      const totalMessages = messages.length;
      const userMessages = messages.filter(m => m.role === 'USER').length;
      const agentMessages = messages.filter(m => m.role === 'AGENT').length;
      
      const responseTimes = messages
        .filter(m => m.responseTime && m.responseTime > 0)
        .map(m => m.responseTime || 0);
      
      const averageResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0;

      const totalTokenUsage = messages
        .reduce((sum, m) => sum + (m.tokenUsage || 0), 0);

      return {
        totalMessages,
        userMessages,
        agentMessages,
        averageResponseTime,
        totalTokenUsage
      };

    } catch (error) {
      console.error('Error getting conversation metrics:', error);
      return {
        totalMessages: 0,
        userMessages: 0,
        agentMessages: 0,
        averageResponseTime: 0,
        totalTokenUsage: 0
      };
    }
  }

  /**
   * Update context cache (for performance optimization)
   */
  async updateContextCache(
    projectId: string, 
    conversationId: string, 
    context: ConversationContext
  ): Promise<void> {
    try {
      // TODO: Implement caching mechanism
      // Could use Redis, in-memory cache, or database cache table
      
    } catch (error) {
      console.error('Error updating context cache:', error);
    }
  }

  /**
   * Clear context cache for project
   */
  async clearContextCache(projectId: string): Promise<void> {
    try {
      // TODO: Clear cached context data
      
    } catch (error) {
      console.error('Error clearing context cache:', error);
    }
  }
}

// Export singleton instance
export const contextManager = new ConversationContextManager();