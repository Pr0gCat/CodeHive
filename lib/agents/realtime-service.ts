/**
 * Real-time Service for AI Response Generation
 * 
 * Provides WebSocket-based real-time updates during AI conversation processing,
 * including typing indicators, progress updates, and immediate response delivery.
 */

import { io } from '@/lib/socket/server';

export interface RealtimeEvent {
  type: 'typing_start' | 'typing_stop' | 'response_partial' | 'response_complete' | 'action_executed' | 'phase_changed' | 'error';
  conversationId: string;
  data?: any;
  timestamp: Date;
}

export interface TypingIndicator {
  conversationId: string;
  isTyping: boolean;
  estimatedTime?: number;
}

export interface ResponseProgress {
  conversationId: string;
  stage: 'context_building' | 'ai_processing' | 'action_execution' | 'complete';
  progress: number; // 0-100
  message?: string;
}

export interface StreamedResponse {
  conversationId: string;
  messageId: string;
  content: string;
  isComplete: boolean;
  tokenCount?: number;
}

export class RealtimeService {
  private activeConnections: Map<string, Set<string>> = new Map(); // conversationId -> Set of socketIds
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initialize realtime service
   */
  initialize() {
    if (!io) {
      console.warn('Socket.IO server not available');
      return;
    }

    io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Handle conversation subscription
      socket.on('subscribe_conversation', (conversationId: string) => {
        this.subscribeToConversation(socket.id, conversationId);
        socket.join(`conversation:${conversationId}`);
        
        socket.emit('subscribed', { conversationId });
        console.log(`Client ${socket.id} subscribed to conversation ${conversationId}`);
      });

      // Handle conversation unsubscription
      socket.on('unsubscribe_conversation', (conversationId: string) => {
        this.unsubscribeFromConversation(socket.id, conversationId);
        socket.leave(`conversation:${conversationId}`);
        
        socket.emit('unsubscribed', { conversationId });
      });

      // Handle typing indicators
      socket.on('user_typing', (data: { conversationId: string; isTyping: boolean }) => {
        this.broadcastTypingIndicator(data.conversationId, {
          conversationId: data.conversationId,
          isTyping: data.isTyping,
          estimatedTime: data.isTyping ? 3000 : undefined
        }, socket.id);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.handleClientDisconnect(socket.id);
      });
    });
  }

  /**
   * Subscribe client to conversation updates
   */
  private subscribeToConversation(socketId: string, conversationId: string) {
    if (!this.activeConnections.has(conversationId)) {
      this.activeConnections.set(conversationId, new Set());
    }
    this.activeConnections.get(conversationId)!.add(socketId);
  }

  /**
   * Unsubscribe client from conversation updates
   */
  private unsubscribeFromConversation(socketId: string, conversationId: string) {
    const connections = this.activeConnections.get(conversationId);
    if (connections) {
      connections.delete(socketId);
      if (connections.size === 0) {
        this.activeConnections.delete(conversationId);
      }
    }
  }

  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(socketId: string) {
    // Remove from all conversations
    for (const [conversationId, connections] of this.activeConnections) {
      connections.delete(socketId);
      if (connections.size === 0) {
        this.activeConnections.delete(conversationId);
      }
    }
  }

  /**
   * Emit event to all subscribers of a conversation
   */
  private emitToConversation(conversationId: string, event: string, data: any, excludeSocketId?: string) {
    if (!io) return;

    const room = `conversation:${conversationId}`;
    if (excludeSocketId) {
      io.to(room).except(excludeSocketId).emit(event, data);
    } else {
      io.to(room).emit(event, data);
    }
  }

  /**
   * Start typing indicator for AI agent
   */
  startAgentTyping(conversationId: string, estimatedTime: number = 5000): void {
    // Clear existing timeout
    const existingTimeout = this.typingTimeouts.get(conversationId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Emit typing start
    this.emitToConversation(conversationId, 'agent_typing', {
      conversationId,
      isTyping: true,
      estimatedTime,
      timestamp: new Date()
    });

    // Set timeout to auto-stop typing
    const timeout = setTimeout(() => {
      this.stopAgentTyping(conversationId);
    }, estimatedTime);
    
    this.typingTimeouts.set(conversationId, timeout);
  }

  /**
   * Stop typing indicator for AI agent
   */
  stopAgentTyping(conversationId: string): void {
    // Clear timeout
    const timeout = this.typingTimeouts.get(conversationId);
    if (timeout) {
      clearTimeout(timeout);
      this.typingTimeouts.delete(conversationId);
    }

    // Emit typing stop
    this.emitToConversation(conversationId, 'agent_typing', {
      conversationId,
      isTyping: false,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast user typing indicator
   */
  private broadcastTypingIndicator(conversationId: string, indicator: TypingIndicator, excludeSocketId: string): void {
    this.emitToConversation(conversationId, 'user_typing', {
      ...indicator,
      timestamp: new Date()
    }, excludeSocketId);
  }

  /**
   * Emit response generation progress
   */
  emitProgress(conversationId: string, progress: ResponseProgress): void {
    this.emitToConversation(conversationId, 'response_progress', {
      ...progress,
      timestamp: new Date()
    });
  }

  /**
   * Stream AI response content in real-time
   */
  streamResponse(conversationId: string, response: StreamedResponse): void {
    this.emitToConversation(conversationId, 'response_stream', {
      ...response,
      timestamp: new Date()
    });
  }

  /**
   * Emit complete response
   */
  emitResponseComplete(conversationId: string, data: {
    messageId: string;
    content: string;
    tokenUsage: number;
    responseTime: number;
    actionsCreated: string[];
    phaseChanged?: boolean;
  }): void {
    this.stopAgentTyping(conversationId);
    
    this.emitToConversation(conversationId, 'response_complete', {
      conversationId,
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Emit action execution update
   */
  emitActionUpdate(conversationId: string, data: {
    actionId: string;
    type: string;
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    result?: any;
    error?: string;
  }): void {
    this.emitToConversation(conversationId, 'action_update', {
      conversationId,
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Emit phase change notification
   */
  emitPhaseChange(conversationId: string, data: {
    from: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
    to: 'REQUIREMENTS' | 'MVP' | 'CONTINUOUS';
    reason: string;
  }): void {
    this.emitToConversation(conversationId, 'phase_changed', {
      conversationId,
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * Emit error notification
   */
  emitError(conversationId: string, error: {
    type: 'ai_service_error' | 'context_error' | 'action_error' | 'system_error';
    message: string;
    details?: any;
  }): void {
    this.stopAgentTyping(conversationId);
    
    this.emitToConversation(conversationId, 'error', {
      conversationId,
      ...error,
      timestamp: new Date()
    });
  }

  /**
   * Get active connections count for conversation
   */
  getActiveConnectionsCount(conversationId: string): number {
    const connections = this.activeConnections.get(conversationId);
    return connections ? connections.size : 0;
  }

  /**
   * Get all active conversations
   */
  getActiveConversations(): string[] {
    return Array.from(this.activeConnections.keys());
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    // Clear all timeouts
    for (const timeout of this.typingTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.typingTimeouts.clear();
    this.activeConnections.clear();
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();