/**
 * Intelligent Response Generation System
 * 
 * Orchestrates AI service and context management to generate intelligent, 
 * context-aware responses for project agent conversations.
 */

import { prisma } from '@/lib/db';
import { aiService, AIResponse, AIAction } from './ai-service';
import { contextManager, ConversationContextManager } from './conversation-context';
import { realtimeService } from './realtime-service';
import { streamingService, StreamingResponse } from './streaming-service';
import { epicManager } from './epic-manager';
import { storyManager } from './story-manager';
import { taskExecutor } from './task-executor';
import { phaseManager } from './phase-manager';
import { atddCycleManager } from './atdd-cycle';
import { codeGenerator, CodeGenerationRequest } from './code-generator';

export interface GenerationRequest {
  projectId: string;
  conversationId: string;
  userMessage: string;
  phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  enableStreaming?: boolean;
}

export interface GenerationResult {
  response: AIResponse;
  messageId: string;
  actionsCreated: string[];
  phaseChanged?: boolean;
  newPhase?: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
  metrics: GenerationMetrics;
}

export interface GenerationMetrics {
  contextBuildTime: number;
  aiResponseTime: number;
  totalTime: number;
  tokensUsed: number;
  contextSize: number;
}

export interface ActionExecutionResult {
  actionId: string;
  type: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  result?: any;
  error?: string;
}

export class ResponseGenerator {
  private contextManager: ConversationContextManager;

  constructor() {
    this.contextManager = contextManager;
  }

  /**
   * Generate intelligent response to user message
   */
  async generateResponse(request: GenerationRequest): Promise<GenerationResult> {
    if (request.enableStreaming) {
      return this.generateStreamingResponse(request);
    } else {
      return this.generateStandardResponse(request);
    }
  }

  /**
   * Generate streaming response with real-time updates
   */
  private async generateStreamingResponse(request: GenerationRequest): Promise<GenerationResult> {
    const startTime = Date.now();
    let contextBuildTime = 0;
    let aiResponseTime = 0;
    let finalContent = '';
    let finalTokenUsage = 0;
    let detectedActions: AIAction[] = [];

    try {
      // Start typing indicator and progress tracking
      realtimeService.startAgentTyping(request.conversationId, 15000); // Longer timeout for streaming
      realtimeService.emitProgress(request.conversationId, {
        conversationId: request.conversationId,
        stage: 'context_building',
        progress: 10,
        message: '正在分析對話內容...'
      });

      // Build conversation context
      const contextStart = Date.now();
      const context = await this.contextManager.buildContext(
        request.projectId,
        request.conversationId,
        request.phase
      );
      contextBuildTime = Date.now() - contextStart;

      realtimeService.emitProgress(request.conversationId, {
        conversationId: request.conversationId,
        stage: 'ai_processing',
        progress: 30,
        message: '正在生成智能回應...'
      });

      // Create message record early for streaming
      const messageRecord = await prisma.message.create({
        data: {
          conversationId: request.conversationId,
          role: 'AGENT',
          content: '', // Will be updated as we stream
          contentType: 'MARKDOWN',
          phase: request.phase,
          tokenUsage: 0,
          responseTime: 0
        }
      });

      const aiStart = Date.now();

      // Prepare prompt for streaming
      const fullPrompt = this.buildPromptForStreaming(request, context);

      // Start streaming response
      await streamingService.streamResponseWithActions(fullPrompt, {
        onChunk: (chunk: StreamingResponse) => {
          finalContent = chunk.content;
          finalTokenUsage = chunk.tokenCount;

          // Stream content to client
          realtimeService.streamResponse(request.conversationId, {
            conversationId: request.conversationId,
            messageId: messageRecord.id,
            content: chunk.content,
            isComplete: chunk.isComplete,
            tokenCount: chunk.tokenCount
          });

          // Update message in database periodically
          if (chunk.tokenCount % 50 === 0) {
            this.updateMessageContent(messageRecord.id, chunk.content, chunk.tokenCount);
          }
        },
        onComplete: async (finalResponse: StreamingResponse) => {
          aiResponseTime = Date.now() - aiStart;
          finalContent = finalResponse.content;
          finalTokenUsage = finalResponse.tokenCount;

          // Final update to database
          await this.updateMessageContent(
            messageRecord.id, 
            finalResponse.content, 
            finalResponse.tokenCount,
            aiResponseTime
          );

          // Parse actions from final content
          const { content: cleanContent, actions } = this.parseStreamedResponse(finalContent);
          detectedActions = actions;

          if (cleanContent !== finalContent) {
            await this.updateMessageContent(messageRecord.id, cleanContent, finalTokenUsage, aiResponseTime);
            finalContent = cleanContent;
          }
        },
        onActionDetected: (action: any) => {
          realtimeService.emitActionUpdate(request.conversationId, {
            actionId: `streaming-${Date.now()}`,
            type: action.type,
            status: 'PENDING'
          });
        },
        onError: (error: Error) => {
          console.error('Streaming error:', error);
          realtimeService.emitError(request.conversationId, {
            type: 'streaming_error',
            message: '串流回應發生錯誤',
            details: error.message
          });
        }
      });

      // Execute detected actions
      const actionResults = await this.executeActions(
        detectedActions,
        request.projectId,
        messageRecord.id,
        request.conversationId
      );

      const totalTime = Date.now() - startTime;

      // Emit completion
      realtimeService.emitResponseComplete(request.conversationId, {
        messageId: messageRecord.id,
        content: finalContent,
        tokenUsage: finalTokenUsage,
        responseTime: aiResponseTime,
        actionsCreated: actionResults.map(r => r.actionId),
        phaseChanged: false
      });

      return {
        response: {
          content: finalContent,
          contentType: 'MARKDOWN',
          confidence: 0.95,
          tokenUsage: finalTokenUsage,
          responseTime: aiResponseTime,
          suggestedActions: detectedActions
        },
        messageId: messageRecord.id,
        actionsCreated: actionResults.map(r => r.actionId),
        phaseChanged: false,
        metrics: {
          contextBuildTime,
          aiResponseTime,
          totalTime,
          tokensUsed: finalTokenUsage,
          contextSize: context.recentMessages.length
        }
      };

    } catch (error) {
      console.error('Error generating streaming response:', error);
      
      // Fallback to standard response
      return this.generateStandardResponse(request);
    }
  }

  /**
   * Generate standard (non-streaming) response
   */
  private async generateStandardResponse(request: GenerationRequest): Promise<GenerationResult> {
    const startTime = Date.now();
    let contextBuildTime = 0;
    let aiResponseTime = 0;

    try {
      // Start typing indicator and progress tracking
      realtimeService.startAgentTyping(request.conversationId, 10000);
      realtimeService.emitProgress(request.conversationId, {
        conversationId: request.conversationId,
        stage: 'context_building',
        progress: 10,
        message: '正在分析對話內容...'
      });

      // Build conversation context
      const contextStart = Date.now();
      const context = await this.contextManager.buildContext(
        request.projectId,
        request.conversationId,
        request.phase
      );
      contextBuildTime = Date.now() - contextStart;

      realtimeService.emitProgress(request.conversationId, {
        conversationId: request.conversationId,
        stage: 'ai_processing',
        progress: 40,
        message: '正在生成智能回應...'
      });

      // Generate AI response
      const aiStart = Date.now();
      const aiResponse = await aiService.generateResponse(request.userMessage, context);
      aiResponseTime = Date.now() - aiStart;

      realtimeService.emitProgress(request.conversationId, {
        conversationId: request.conversationId,
        stage: 'action_execution',
        progress: 70,
        message: '正在儲存回應並執行操作...'
      });

      // Save response to database
      const messageRecord = await this.saveResponseMessage(
        request.conversationId,
        aiResponse,
        request.phase
      );

      // Stream the response content immediately
      realtimeService.streamResponse(request.conversationId, {
        conversationId: request.conversationId,
        messageId: messageRecord.id,
        content: aiResponse.content,
        isComplete: true,
        tokenCount: aiResponse.tokenUsage
      });

      // Execute suggested actions
      const actionResults = await this.executeActions(
        aiResponse.suggestedActions || [],
        request.projectId,
        messageRecord.id,
        request.conversationId
      );

      // Handle phase transitions
      let phaseChanged = false;
      let newPhase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS' | undefined;
      if (aiResponse.phaseTransition) {
        phaseChanged = await this.handlePhaseTransition(
          request.projectId,
          request.conversationId,
          aiResponse.phaseTransition
        );
        if (phaseChanged) {
          newPhase = aiResponse.phaseTransition.to;
        }
      }

      const totalTime = Date.now() - startTime;

      // Emit final completion with progress
      realtimeService.emitProgress(request.conversationId, {
        conversationId: request.conversationId,
        stage: 'complete',
        progress: 100,
        message: '回應生成完成'
      });

      // Emit complete response event
      realtimeService.emitResponseComplete(request.conversationId, {
        messageId: messageRecord.id,
        content: aiResponse.content,
        tokenUsage: aiResponse.tokenUsage,
        responseTime: aiResponseTime,
        actionsCreated: actionResults.map(r => r.actionId),
        phaseChanged
      });

      return {
        response: aiResponse,
        messageId: messageRecord.id,
        actionsCreated: actionResults.map(r => r.actionId),
        phaseChanged,
        newPhase,
        metrics: {
          contextBuildTime,
          aiResponseTime,
          totalTime,
          tokensUsed: aiResponse.tokenUsage,
          contextSize: context.recentMessages.length
        }
      };

    } catch (error) {
      console.error('Error generating response:', error);
      
      // Emit error event
      realtimeService.emitError(request.conversationId, {
        type: 'ai_service_error',
        message: 'AI 回應生成失敗',
        details: (error as Error).message
      });
      
      // Return fallback response
      const fallbackResponse = await this.generateFallbackResponse(
        request.conversationId,
        request.phase,
        error as Error
      );

      return {
        response: fallbackResponse,
        messageId: '',
        actionsCreated: [],
        phaseChanged: false,
        metrics: {
          contextBuildTime,
          aiResponseTime,
          totalTime: Date.now() - startTime,
          tokensUsed: 0,
          contextSize: 0
        }
      };
    }
  }

  /**
   * Save AI response message to database
   */
  private async saveResponseMessage(
    conversationId: string,
    aiResponse: AIResponse,
    phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS'
  ) {
    const message = await prisma.message.create({
      data: {
        conversationId,
        role: 'AGENT',
        content: aiResponse.content,
        contentType: aiResponse.contentType,
        phase,
        tokenUsage: aiResponse.tokenUsage,
        responseTime: aiResponse.responseTime,
        metadata: JSON.stringify({
          confidence: aiResponse.confidence,
          suggestedActionsCount: aiResponse.suggestedActions?.length || 0,
          hasPhaseTransition: !!aiResponse.phaseTransition
        })
      }
    });

    // Update conversation stats
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        messageCount: { increment: 1 },
        tokenUsage: { increment: aiResponse.tokenUsage },
        lastMessageAt: new Date()
      }
    });

    return message;
  }

  /**
   * Execute suggested actions from AI response
   */
  private async executeActions(
    actions: AIAction[],
    projectId: string,
    messageId: string,
    conversationId: string
  ): Promise<ActionExecutionResult[]> {
    const results: ActionExecutionResult[] = [];

    for (const action of actions) {
      try {
        const actionRecord = await this.createActionRecord(messageId, action);
        
        // Emit action start event
        realtimeService.emitActionUpdate(conversationId, {
          actionId: actionRecord.id,
          type: action.type,
          status: 'PENDING'
        });

        const executionResult = await this.executeAction(action, projectId);
        
        // Update action record with result
        await prisma.messageAction.update({
          where: { id: actionRecord.id },
          data: {
            status: executionResult.status,
            result: JSON.stringify(executionResult.result),
            error: executionResult.error,
            executedAt: new Date()
          }
        });

        // Emit action completion event
        realtimeService.emitActionUpdate(conversationId, {
          actionId: actionRecord.id,
          type: action.type,
          status: executionResult.status,
          result: executionResult.result,
          error: executionResult.error
        });

        results.push({
          actionId: actionRecord.id,
          type: action.type,
          status: executionResult.status,
          result: executionResult.result,
          error: executionResult.error
        });

      } catch (error) {
        console.error(`Error executing action ${action.type}:`, error);
        const errorResult = {
          actionId: '',
          type: action.type,
          status: 'FAILED' as const,
          error: (error as Error).message
        };

        // Emit action error event
        realtimeService.emitActionUpdate(conversationId, errorResult);
        results.push(errorResult);
      }
    }

    return results;
  }

  /**
   * Create action record in database
   */
  private async createActionRecord(messageId: string, action: AIAction) {
    return await prisma.messageAction.create({
      data: {
        messageId,
        actionType: action.type,
        actionData: JSON.stringify(action.data),
        status: 'PENDING'
      }
    });
  }

  /**
   * Execute individual action
   */
  private async executeAction(
    action: AIAction,
    projectId: string
  ): Promise<{ status: 'SUCCESS' | 'FAILED' | 'PENDING'; result?: any; error?: string }> {
    try {
      switch (action.type) {
        case 'CREATE_EPIC':
          return await this.createEpic(projectId, action.data);
        
        case 'CREATE_STORY':
          return await this.createStory(projectId, action.data);
        
        case 'CREATE_TASK':
          return await this.createTask(projectId, action.data);
        
        case 'UPDATE_PHASE':
          return await this.updateProjectPhase(projectId, action.data);
        
        case 'SCHEDULE_MEETING':
          return await this.scheduleMeeting(projectId, action.data);
        
        case 'GENERATE_DOCS':
          return await this.generateDocumentation(projectId, action.data);
        
        case 'RUN_TESTS':
          return await this.runTests(projectId, action.data);

        case 'RUN_ATDD_CYCLE':
          return await this.runATDDCycle(projectId, action.data);

        case 'GENERATE_CODE':
          return await this.generateCode(projectId, action.data);
        
        default:
          return {
            status: 'FAILED',
            error: `Unknown action type: ${action.type}`
          };
      }
    } catch (error) {
      return {
        status: 'FAILED',
        error: (error as Error).message
      };
    }
  }

  /**
   * Create Epic action
   */
  private async createEpic(projectId: string, data: any): Promise<any> {
    try {
      const epic = await epicManager.createEpic(projectId, {
        title: data.title || 'New Epic',
        description: data.description,
        businessValue: data.businessValue || 'Provides value to users and business',
        acceptanceCriteria: data.acceptanceCriteria,
        priority: data.priority || 2, // Default to high priority
        phase: data.phase || 'REQUIREMENTS',
        estimatedEffort: data.estimatedEffort,
        createdBy: 'AI_AGENT'
      });

      return {
        status: 'SUCCESS' as const,
        result: {
          epicId: epic.id,
          title: epic.title,
          message: `Successfully created Epic: "${epic.title}"`,
          phase: epic.phase,
          priority: epic.priority
        }
      };
    } catch (error) {
      return {
        status: 'FAILED' as const,
        result: {
          message: `Failed to create Epic: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Create Story action
   */
  private async createStory(projectId: string, data: any): Promise<any> {
    try {
      if (!data.epicId) {
        throw new Error('Epic ID is required to create a story');
      }

      // Generate user story template if not provided
      let userStory = data.userStory;
      if (!userStory && data.userRole && data.feature && data.benefit) {
        const template = storyManager.generateUserStory(
          data.userRole,
          data.feature,
          data.benefit,
          data.additionalDetails
        );
        userStory = `As a ${template.role}, I want ${template.action} so that ${template.benefit}`;
        
        // Use suggested acceptance criteria if not provided
        if (!data.acceptanceCriteria && template.acceptanceCriteria.length > 0) {
          data.acceptanceCriteria = template.acceptanceCriteria.join('\n');
        }
      }

      const story = await storyManager.createStory(data.epicId, {
        title: data.title || 'New Story',
        userStory,
        description: data.description,
        acceptanceCriteria: data.acceptanceCriteria,
        priority: data.priority || 1,
        storyPoints: data.storyPoints || storyManager.estimateStoryPoints(
          data.complexity || 'moderate',
          data.uncertainty || 'medium',
          data.effort || 'medium'
        ),
        iteration: data.iteration
      });

      return {
        status: 'SUCCESS' as const,
        result: {
          storyId: story.id,
          title: story.title,
          userStory: story.userStory,
          storyPoints: story.storyPoints,
          message: `Successfully created Story: "${story.title}" (${story.storyPoints} points)`,
          epicTitle: story.epic.title
        }
      };
    } catch (error) {
      return {
        status: 'FAILED' as const,
        result: {
          message: `Failed to create Story: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Create Task action
   */
  private async createTask(projectId: string, data: any): Promise<any> {
    try {
      if (!data.storyId) {
        throw new Error('Story ID is required to create a task');
      }

      const task = await taskExecutor.createTask(data.storyId, {
        title: data.title || 'New Task',
        description: data.description,
        type: data.type || 'DEV',
        acceptanceCriteria: data.acceptanceCriteria,
        expectedOutcome: data.expectedOutcome || `Task "${data.title || 'New Task'}" completed successfully`,
        priority: data.priority || 1,
        estimatedTime: data.estimatedTime,
        assignedAgent: data.assignedAgent || 'GENERAL_AGENT',
        maxRetries: data.maxRetries || 3
      });

      // Add instructions if provided
      if (data.instructions && Array.isArray(data.instructions)) {
        await taskExecutor.addInstructions(task.id, data.instructions.map((instruction: any, index: number) => ({
          directive: instruction.directive || instruction,
          expectedOutcome: instruction.expectedOutcome || `Complete step ${index + 1}`,
          validationCriteria: instruction.validationCriteria,
          sequence: index + 1,
          metadata: instruction.metadata
        })));
      }

      return {
        status: 'SUCCESS' as const,
        result: {
          taskId: task.id,
          title: task.title,
          type: task.type,
          message: `Successfully created ${task.type} Task: "${task.title}"`,
          estimatedTime: task.estimatedTime,
          instructionCount: data.instructions?.length || 0
        }
      };
    } catch (error) {
      return {
        status: 'FAILED' as const,
        result: {
          message: `Failed to create Task: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Update project phase action
   */
  private async updateProjectPhase(projectId: string, data: any): Promise<any> {
    try {
      const fromPhase = data.fromPhase || 'REQUIREMENTS';
      const toPhase = data.toPhase || data.newPhase || 'MVP';
      const force = data.force || false;

      // Check phase readiness first
      const readiness = await phaseManager.checkPhaseReadiness(projectId, toPhase);
      
      if (!readiness.canTransition && !force) {
        return {
          status: 'FAILED' as const,
          result: {
            message: `Cannot transition to ${toPhase}: readiness score ${readiness.readinessScore}% (minimum 80%)`,
            readinessScore: readiness.readinessScore,
            blockers: readiness.details.failedConditions,
            recommendations: [`Improve readiness by addressing: ${readiness.details.failedConditions.join(', ')}`]
          }
        };
      }

      // Execute phase transition
      const transitionResult = await phaseManager.transitionPhase(projectId, fromPhase, toPhase, force);

      if (transitionResult.success) {
        return {
          status: 'SUCCESS' as const,
          result: {
            message: `Successfully transitioned from ${fromPhase} to ${toPhase}`,
            fromPhase: transitionResult.fromPhase,
            toPhase: transitionResult.toPhase,
            readinessScore: transitionResult.readinessScore,
            actionsCompleted: transitionResult.transitionActions.filter(a => a.status === 'COMPLETED').length,
            totalActions: transitionResult.transitionActions.length,
            recommendations: transitionResult.recommendations
          }
        };
      } else {
        return {
          status: 'FAILED' as const,
          result: {
            message: `Failed to transition to ${toPhase}`,
            blockers: transitionResult.blockers,
            failedConditions: transitionResult.failedConditions,
            recommendations: transitionResult.recommendations
          }
        };
      }
    } catch (error) {
      return {
        status: 'FAILED' as const,
        result: {
          message: `Error during phase transition: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Schedule meeting action
   */
  private async scheduleMeeting(projectId: string, data: any): Promise<any> {
    // TODO: Implement meeting scheduling
    return {
      status: 'PENDING' as const,
      result: { message: 'Meeting scheduling will be implemented later' }
    };
  }

  /**
   * Generate documentation action
   */
  private async generateDocumentation(projectId: string, data: any): Promise<any> {
    // TODO: Implement documentation generation
    return {
      status: 'PENDING' as const,
      result: { message: 'Documentation generation will be implemented later' }
    };
  }

  /**
   * Run tests action
   */
  private async runTests(projectId: string, data: any): Promise<any> {
    try {
      if (data.taskId) {
        // Execute specific task
        const results = await taskExecutor.executeTask(data.taskId);
        const successfulResults = results.filter(r => r.result.success);
        
        return {
          status: successfulResults.length === results.length ? 'SUCCESS' : 'FAILED',
          result: {
            taskId: data.taskId,
            totalInstructions: results.length,
            successfulInstructions: successfulResults.length,
            failedInstructions: results.length - successfulResults.length,
            executionTime: results.reduce((sum, r) => sum + r.result.executionTime, 0),
            message: `Executed ${successfulResults.length}/${results.length} instructions successfully`
          }
        };
      } else if (data.storyId) {
        // Execute all tasks in a story
        const tasks = await taskExecutor.getStoryTasks(data.storyId, { 
          status: 'PENDING', 
          includeInstructions: true 
        });
        
        let totalExecuted = 0;
        let totalSuccessful = 0;
        
        for (const task of tasks) {
          if (task.status === 'PENDING') {
            await taskExecutor.startTask(task.id);
            const results = await taskExecutor.executeTask(task.id);
            totalExecuted += results.length;
            totalSuccessful += results.filter(r => r.result.success).length;
          }
        }
        
        return {
          status: totalSuccessful === totalExecuted ? 'SUCCESS' : 'FAILED',
          result: {
            storyId: data.storyId,
            tasksProcessed: tasks.length,
            totalInstructions: totalExecuted,
            successfulInstructions: totalSuccessful,
            message: `Executed ${tasks.length} tasks with ${totalSuccessful}/${totalExecuted} successful instructions`
          }
        };
      } else {
        throw new Error('Either taskId or storyId is required for test execution');
      }
    } catch (error) {
      return {
        status: 'FAILED' as const,
        result: {
          message: `Failed to run tests: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Run ATDD cycle action
   */
  private async runATDDCycle(projectId: string, data: any): Promise<any> {
    try {
      if (!data.taskId) {
        throw new Error('Task ID is required for ATDD cycle execution');
      }

      // Get conversation ID for real-time updates
      const conversationId = data.conversationId;

      // Execute full ATDD cycle
      const cycleResult = await atddCycleManager.executeFullCycle(data.taskId, conversationId);

      const successfulPhases = cycleResult.phases.filter(p => p.status === 'COMPLETED');
      const failedPhases = cycleResult.phases.filter(p => p.status === 'FAILED');

      return {
        status: cycleResult.overallStatus === 'COMPLETED' ? 'SUCCESS' : 'FAILED',
        result: {
          taskId: data.taskId,
          cycleId: `atdd-${data.taskId}`,
          overallStatus: cycleResult.overallStatus,
          currentPhase: cycleResult.currentPhase,
          completedPhases: successfulPhases.length,
          failedPhases: failedPhases.length,
          totalTime: cycleResult.cycleMetrics.totalTime,
          iterationCount: cycleResult.cycleMetrics.iterationCount,
          validationPasses: cycleResult.cycleMetrics.validationPasses,
          validationFailures: cycleResult.cycleMetrics.validationFailures,
          message: `ATDD cycle ${cycleResult.overallStatus.toLowerCase()} - ${successfulPhases.length}/4 phases completed`,
          artifacts: cycleResult.phases.flatMap(p => p.artifacts).slice(0, 5), // Limit artifacts in response
          recommendations: cycleResult.overallStatus === 'FAILED' 
            ? ['Review failed phases and address validation issues', 'Consider retrying with refined acceptance criteria']
            : ['Continue with next story or epic', 'Review cycle metrics for process improvement']
        }
      };
    } catch (error) {
      return {
        status: 'FAILED' as const,
        result: {
          message: `Failed to run ATDD cycle: ${(error as Error).message}`
        }
      };
    }
  }

  /**
   * Handle phase transition
   */
  private async handlePhaseTransition(
    projectId: string,
    conversationId: string,
    transition: NonNullable<AIResponse['phaseTransition']>
  ): Promise<boolean> {
    try {
      // Update conversation phase
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { 
          phase: transition.to,
          summary: `Phase transition: ${transition.from} → ${transition.to}. Reason: ${transition.reason}`
        }
      });

      // Update project phase in project table
      await prisma.projectIndex.update({
        where: { id: projectId },
        data: { phase: transition.to }
      });

      // Create system message about phase transition
      await prisma.message.create({
        data: {
          conversationId,
          role: 'SYSTEM',
          content: `專案階段已從 ${transition.from} 轉換到 ${transition.to}。\n\n轉換原因：${transition.reason}`,
          contentType: 'TEXT',
          phase: transition.to
        }
      });

      // Emit phase change event
      realtimeService.emitPhaseChange(conversationId, {
        from: transition.from,
        to: transition.to,
        reason: transition.reason
      });

      return true;
    } catch (error) {
      console.error('Error handling phase transition:', error);
      
      realtimeService.emitError(conversationId, {
        type: 'system_error',
        message: '階段轉換失敗',
        details: (error as Error).message
      });
      
      return false;
    }
  }

  /**
   * Generate fallback response when AI service fails
   */
  private async generateFallbackResponse(
    conversationId: string,
    phase: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS',
    error: Error
  ): Promise<AIResponse> {
    const fallbackMessages = {
      REQUIREMENTS: '抱歉，AI 服務暫時無法使用。請繼續描述您的專案需求，我會記錄下來並在服務恢復後提供詳細回應。',
      MVP: '抱歉，AI 服務暫時無法使用。請告訴我當前的開發狀況或遇到的問題，我會在服務恢復後協助解決。',
      CONTINUOUS: '抱歉，AI 服務暫時無法使用。請描述需要改進或修復的功能，我會在服務恢復後提供建議。'
    };

    // Save fallback message to database
    await prisma.message.create({
      data: {
        conversationId,
        role: 'AGENT',
        content: fallbackMessages[phase],
        contentType: 'TEXT',
        phase,
        isError: true,
        errorDetails: error.message
      }
    });

    return {
      content: fallbackMessages[phase],
      contentType: 'TEXT',
      confidence: 0.1,
      tokenUsage: 0,
      responseTime: 0,
      suggestedActions: []
    };
  }

  /**
   * Update message content in database (for streaming updates)
   */
  private async updateMessageContent(
    messageId: string, 
    content: string, 
    tokenUsage: number,
    responseTime?: number
  ): Promise<void> {
    try {
      await prisma.message.update({
        where: { id: messageId },
        data: {
          content,
          tokenUsage,
          ...(responseTime && { responseTime })
        }
      });
    } catch (error) {
      console.error('Failed to update message content:', error);
    }
  }

  /**
   * Parse streamed response for actions and clean content
   */
  private parseStreamedResponse(content: string): {
    content: string;
    actions: AIAction[];
  } {
    const actions: AIAction[] = [];
    let cleanContent = content;

    // Extract actions from streamed content
    const actionPatterns = {
      CREATE_EPIC: /\[CREATE_EPIC:([^\]]+)\]/gi,
      CREATE_STORY: /\[CREATE_STORY:([^\]]+)\]/gi,
      CREATE_TASK: /\[CREATE_TASK:([^\]]+)\]/gi,
      UPDATE_PHASE: /\[UPDATE_PHASE:([^\]]+)\]/gi,
      RUN_TESTS: /\[RUN_TESTS:([^\]]+)\]/gi,
      RUN_ATDD_CYCLE: /\[RUN_ATDD_CYCLE:([^\]]+)\]/gi
    };

    for (const [actionType, pattern] of Object.entries(actionPatterns)) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        try {
          const actionData = JSON.parse(match[1]);
          actions.push({
            type: actionType as AIAction['type'],
            data: actionData,
            priority: actionData.priority || 'MEDIUM',
            description: actionData.description || `Execute ${actionType.toLowerCase()}`
          });
          
          // Remove action marker from content
          cleanContent = cleanContent.replace(match[0], '');
        } catch (error) {
          console.warn(`Failed to parse action ${actionType}:`, error);
        }
      }
    }

    return {
      content: cleanContent.trim(),
      actions
    };
  }

  /**
   * Build prompt for streaming API
   */
  private buildPromptForStreaming(request: GenerationRequest, context: any): string {
    // Get phase-specific system prompt
    const phasePrompt = (aiService as any).phasePrompts?.get(request.phase);
    
    // Build conversation history
    const conversationHistory = context.recentMessages
      .slice(-10)
      .map((msg: any) => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    if (!phasePrompt) {
      return `專案資訊：
- 專案ID: ${context.projectId}
- 目前階段: ${context.projectPhase}

最近對話紀錄：
${conversationHistory}

用戶訊息：
${request.userMessage}`;
    }

    return `${phasePrompt.systemPrompt}

執行規則：
${phasePrompt.behaviorRules.map((rule: string) => `- ${rule}`).join('\n')}

專案資訊：
- 專案ID: ${context.projectId}
- 目前階段: ${context.projectPhase}
- 框架: ${context.projectMetadata?.framework || '未指定'}
- 程式語言: ${context.projectMetadata?.language || '未指定'}

最近對話紀錄：
${conversationHistory}

用戶訊息：
${request.userMessage}

請提供專業、有幫助的回應，並遵循上述規則和當前專案階段的要求。`;
  }

  /**
   * Generate code action
   */
  private async generateCode(projectId: string, data: any): Promise<any> {
    try {
      if (!data.type || !data.framework || !data.language || !data.description) {
        throw new Error('Code generation requires type, framework, language, and description');
      }

      const codeRequest: CodeGenerationRequest = {
        type: data.type.toUpperCase(),
        framework: data.framework,
        language: data.language,
        description: data.description,
        specifications: {
          inputParameters: data.inputParameters,
          outputFormat: data.outputFormat,
          dependencies: data.dependencies || [],
          testingFramework: data.testingFramework,
          styleGuide: data.styleGuide
        },
        context: {
          existingCode: data.existingCode,
          projectStructure: data.projectStructure,
          conventions: data.conventions || []
        }
      };

      const result = await codeGenerator.generateCode(codeRequest);

      if (result.success && result.code) {
        return {
          status: 'SUCCESS' as const,
          result: {
            message: `Successfully generated ${result.code.files.length} code files`,
            files: result.code.files.map(file => ({
              path: file.path,
              language: file.language,
              description: file.description,
              lineCount: file.content.split('\n').length
            })),
            complexity: result.code.estimatedComplexity,
            dependencies: result.code.dependencies,
            instructions: result.code.instructions,
            testSuggestions: result.code.testSuggestions,
            tokensUsed: result.metadata.tokensUsed,
            generationTime: result.metadata.generationTime,
            confidence: result.metadata.confidence,
            fullCode: result.code // Include complete generated code
          }
        };
      } else {
        return {
          status: 'FAILED' as const,
          result: {
            message: `Code generation failed: ${result.error}`,
            error: result.error
          }
        };
      }
    } catch (error) {
      return {
        status: 'FAILED' as const,
        result: {
          message: `Error during code generation: ${(error as Error).message}`,
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * Get generation statistics
   */
  async getGenerationStats(projectId: string, timeRange: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    try {
      const since = new Date();
      switch (timeRange) {
        case 'day':
          since.setDate(since.getDate() - 1);
          break;
        case 'week':
          since.setDate(since.getDate() - 7);
          break;
        case 'month':
          since.setMonth(since.getMonth() - 1);
          break;
      }

      // Get conversation stats for project
      const conversations = await prisma.conversation.findMany({
        where: {
          projectId,
          updatedAt: { gte: since }
        },
        include: {
          messages: {
            where: {
              role: 'AGENT',
              createdAt: { gte: since }
            },
            select: {
              tokenUsage: true,
              responseTime: true,
              isError: true
            }
          }
        }
      });

      const allMessages = conversations.flatMap(c => c.messages);
      const successfulMessages = allMessages.filter(m => !m.isError);

      return {
        totalConversations: conversations.length,
        totalResponses: allMessages.length,
        successfulResponses: successfulMessages.length,
        errorRate: allMessages.length > 0 ? (allMessages.length - successfulMessages.length) / allMessages.length : 0,
        averageTokenUsage: successfulMessages.length > 0 
          ? successfulMessages.reduce((sum, m) => sum + (m.tokenUsage || 0), 0) / successfulMessages.length 
          : 0,
        averageResponseTime: successfulMessages.length > 0
          ? successfulMessages.reduce((sum, m) => sum + (m.responseTime || 0), 0) / successfulMessages.length
          : 0
      };

    } catch (error) {
      console.error('Error getting generation stats:', error);
      return {
        totalConversations: 0,
        totalResponses: 0,
        successfulResponses: 0,
        errorRate: 0,
        averageTokenUsage: 0,
        averageResponseTime: 0
      };
    }
  }
}

// Export singleton instance
export const responseGenerator = new ResponseGenerator();