import { prisma } from '@/lib/db';
import {
    TaskEventData,
    taskEventEmitter,
} from '@/lib/events/task-event-emitter';
import { logger } from '@/lib/logging/structured-logger';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function initializeSocket(server: HttpServer) {
  if (io) {
    logger.info('🔌 Socket.IO server already initialized', { module: 'socket' });
    return io;
  }

  io = new SocketIOServer(server, {
    cors: {
      origin:
        process.env.NODE_ENV === 'production'
          ? process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['polling', 'websocket'], // 優先使用 polling 以確保相容性
  });

  // Create hierarchy manager instance
  const hierarchyManager = new HierarchyManager(prisma);

  io.on('connection', socket => {
    logger.socketEvent('connected', socket.id, undefined, { module: 'socket' });

    // 階層系統房間管理
    socket.on('join_project', async (projectId: string) => {
      logger.socketEvent('join_project', socket.id, undefined, { module: 'socket', projectId });
      socket.join(`project:${projectId}`);
      socket.emit('joined_project', { projectId });
      
      // 發送當前專案統計
      try {
        const stats = await hierarchyManager.getHierarchyStatistics(projectId);
        socket.emit('project_statistics', { projectId, stats });
      } catch (error) {
        logger.error('Failed to get project statistics', { socketId: socket.id, projectId }, error as Error);
      }
    });

    socket.on('leave_project', (projectId: string) => {
      logger.socketEvent('leave_project', socket.id, undefined, { module: 'socket', projectId });
      socket.leave(`project:${projectId}`);
      socket.emit('left_project', { projectId });
    });

    socket.on('join_epic', async (epicId: string) => {
      logger.socketEvent('join_epic', socket.id, undefined, { module: 'socket', epicId });
      socket.join(`epic:${epicId}`);
      socket.emit('joined_epic', { epicId });
      
      // 發送當前史詩進度
      try {
        const progress = await hierarchyManager.getHierarchyProgress(epicId);
        socket.emit('epic_progress', { epicId, progress });
      } catch (error) {
        logger.error('Failed to get epic progress', { socketId: socket.id, epicId }, error as Error);
      }
    });

    socket.on('leave_epic', (epicId: string) => {
      logger.socketEvent('leave_epic', socket.id, undefined, { module: 'socket', epicId });
      socket.leave(`epic:${epicId}`);
      socket.emit('left_epic', { epicId });
    });

    // 指令執行控制
    socket.on('execute_instruction', async (instructionId: string) => {
      logger.socketEvent('execute_instruction', socket.id, undefined, { module: 'socket', instructionId });
      
      try {
        // 廣播執行開始
        io.emit('instruction_executing', { instructionId, timestamp: new Date() });
        
        // 這裡會整合 HierarchyIntegration 進行實際執行
        // 目前先模擬執行過程
        setTimeout(() => {
          io.emit('instruction_completed', {
            instructionId,
            result: { success: true, output: '模擬執行成功' },
            timestamp: new Date()
          });
        }, 3000);
        
      } catch (error) {
        logger.error('Failed to execute instruction', { socketId: socket.id, instructionId }, error as Error);
        io.emit('instruction_failed', {
          instructionId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
      }
    });

    // Handle task progress subscription (保持原有功能)
    socket.on('subscribe_task', async (taskId: string) => {
      logger.socketEvent('subscribe_task', socket.id, taskId, { module: 'socket' });

      try {
        // Join room for this task
        socket.join(`task:${taskId}`);
        socket.emit('subscribed', { taskId });

        // Send current task state if exists
        const task = await prisma.taskExecution.findUnique({
          where: { taskId },
          include: {
            phases: { orderBy: { order: 'asc' } },
            events: {
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
          },
        });

        if (task) {
          // Send current task status
          socket.emit('task_status', {
            taskId,
            task: {
              ...task,
              events: undefined, // Don't include events in status
            },
          });

          // Send current phases
          for (const phase of task.phases) {
            socket.emit('phase_status', {
              taskId,
              phase,
            });
          }

          // If task is already completed, send completion message
          if (task.status === 'COMPLETED') {
            socket.emit('task_completed', {
              taskId,
              result: task.result ? JSON.parse(task.result) : null,
            });
          } else if (task.status === 'FAILED') {
            socket.emit('task_error', {
              taskId,
              error: task.error,
            });
          }
        }
      } catch (error) {
        logger.error('Failed to get initial task state', { socketId: socket.id, taskId }, error as Error);
        socket.emit('error', { message: 'Failed to get task status' });
      }
    });

    // Handle task progress unsubscription
    socket.on('unsubscribe_task', (taskId: string) => {
      logger.socketEvent('unsubscribe_task', socket.id, taskId, { module: 'socket' });
      socket.leave(`task:${taskId}`);
      socket.emit('unsubscribed', { taskId });
    });

    socket.on('disconnect', reason => {
      logger.socketEvent('disconnected', socket.id, undefined, { module: 'socket', reason });
    });

    socket.on('error', error => {
      logger.error(`❌ Socket error for client`, { socketId: socket.id }, error as Error);
    });
  });

  // Set up event-driven updates from task event emitter
  const broadcastEvent = (event: TaskEventData) => {
    if (!io) return;

    logger.socketEvent(`broadcasting_${event.type}`, undefined, event.taskId, { module: 'socket' });

    // Broadcast to all clients subscribed to this task
    io.to(`task:${event.taskId}`).emit('task_event', {
      type: event.type,
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: event.data,
    });

    // Send specific event types
    switch (event.type) {
      case 'task_completed':
        io.to(`task:${event.taskId}`).emit('task_completed', {
          taskId: event.taskId,
          result: event.data,
        });
        break;
      case 'task_failed':
        io.to(`task:${event.taskId}`).emit('task_error', {
          taskId: event.taskId,
          error: event.data,
        });
        break;
      case 'phase_updated':
        if (event.data && event.data.phaseId) {
          io.to(`task:${event.taskId}`).emit('phase_progress', {
            taskId: event.taskId,
            phaseId: event.data.phaseId,
            progress: event.data.progress,
            message: event.data.message,
          });
        }
        break;
    }
  };

  // Subscribe to all event types
  taskEventEmitter.on('task_created', broadcastEvent);
  taskEventEmitter.on('task_started', broadcastEvent);
  taskEventEmitter.on('task_completed', broadcastEvent);
  taskEventEmitter.on('task_failed', broadcastEvent);
  taskEventEmitter.on('phase_updated', broadcastEvent);
  taskEventEmitter.on('event_created', broadcastEvent);

  logger.info('Socket.IO server initialized', { module: 'socket' });
  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}

export function emitToTask(taskId: string, event: string, data: Record<string, unknown>) {
  if (!io) {
    logger.warn('🚨 Socket.IO not initialized, cannot emit event', { module: 'socket' });
    return;
  }

  logger.socketEvent(`emitting_${event}`, undefined, taskId, { module: 'socket' });
  io.to(`task:${taskId}`).emit(event, data);
}

/**
 * 階層系統即時廣播工具
 */
export class HierarchyBroadcaster {
  private static instance: HierarchyBroadcaster;
  
  static getInstance(): HierarchyBroadcaster {
    if (!HierarchyBroadcaster.instance) {
      HierarchyBroadcaster.instance = new HierarchyBroadcaster();
    }
    return HierarchyBroadcaster.instance;
  }
  
  // 廣播 Epic 更新
  broadcastEpicUpdate(epicId: string, epic: any, projectId?: string) {
    if (!io) return;
    
    logger.socketEvent('broadcasting_epic_update', undefined, undefined, { module: 'socket', epicId });
    
    const data = { epicId, epic, timestamp: new Date() };
    io.emit('epic_updated', data);
    
    if (projectId) {
      io.to(`project:${projectId}`).emit('epic_updated', data);
    }
  }
  
  // 廣播 Story 更新
  broadcastStoryUpdate(storyId: string, story: any, epicId?: string) {
    if (!io) return;
    
    logger.socketEvent('broadcasting_story_update', undefined, undefined, { module: 'socket', storyId });
    
    const data = { storyId, story, timestamp: new Date() };
    io.emit('story_updated', data);
    
    if (epicId) {
      io.to(`epic:${epicId}`).emit('story_updated', data);
    }
  }
  
  // 廣播 Task 更新
  broadcastTaskUpdate(taskId: string, task: any, storyId?: string) {
    if (!io) return;
    
    logger.socketEvent('broadcasting_task_update', undefined, undefined, { module: 'socket', taskId });
    
    const data = { taskId, task, timestamp: new Date() };
    io.emit('task_updated', data);
  }
  
  // 廣播 Instruction 更新
  broadcastInstructionUpdate(instructionId: string, instruction: any) {
    if (!io) return;
    
    logger.socketEvent('broadcasting_instruction_update', undefined, undefined, { module: 'socket', instructionId });
    
    const data = { instructionId, instruction, timestamp: new Date() };
    io.emit('instruction_updated', data);
  }
  
  // 廣播統計更新
  broadcastStatisticsUpdate(projectId: string, stats: any) {
    if (!io) return;
    
    logger.socketEvent('broadcasting_statistics_update', undefined, undefined, { module: 'socket', projectId });
    
    const data = { projectId, stats, timestamp: new Date() };
    io.to(`project:${projectId}`).emit('project_statistics', data);
  }
  
  // 廣播進度更新
  broadcastProgressUpdate(epicId: string, progress: any) {
    if (!io) return;
    
    logger.socketEvent('broadcasting_progress_update', undefined, undefined, { module: 'socket', epicId });
    
    const data = { epicId, progress, timestamp: new Date() };
    io.to(`epic:${epicId}`).emit('epic_progress', data);
  }
  
  // 發送系統通知
  sendSystemNotification(type: string, message: string, roomId?: string) {
    if (!io) return;
    
    logger.socketEvent('sending_system_notification', undefined, undefined, { module: 'socket', type, roomId });
    
    const data = { type, message, timestamp: new Date() };
    
    if (roomId) {
      io.to(roomId).emit('system_notification', data);
    } else {
      io.emit('system_notification', data);
    }
  }
  
  // 廣播指令執行狀態
  broadcastInstructionExecution(instructionId: string, status: 'executing' | 'completed' | 'failed', result?: any, error?: string) {
    if (!io) return;
    
    logger.socketEvent(`broadcasting_instruction_${status}`, undefined, undefined, { module: 'socket', instructionId });
    
    const data = { 
      instructionId, 
      status, 
      result, 
      error, 
      timestamp: new Date() 
    };
    
    io.emit(`instruction_${status}`, data);
  }
}

export const hierarchyBroadcaster = HierarchyBroadcaster.getInstance();
