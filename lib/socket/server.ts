import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { taskEventEmitter, TaskEventData } from '@/lib/events/task-event-emitter';
import { prisma } from '@/lib/db';

let io: SocketIOServer | null = null;

export function initializeSocket(server: HttpServer) {
  if (io) {
    console.log('🔌 Socket.IO server already initialized');
    return io;
  }

  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['polling', 'websocket'], // 優先使用 polling 以確保相容性
  });

  io.on('connection', (socket) => {
    console.log(`🔗 Client connected: ${socket.id}`);

    // Handle task progress subscription
    socket.on('subscribe_task', async (taskId: string) => {
      console.log(`📡 Client ${socket.id} subscribing to task: ${taskId}`);
      
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
        console.error('Failed to get initial task state:', error);
        socket.emit('error', { message: 'Failed to get task status' });
      }
    });

    // Handle task progress unsubscription
    socket.on('unsubscribe_task', (taskId: string) => {
      console.log(`📡 Client ${socket.id} unsubscribing from task: ${taskId}`);
      socket.leave(`task:${taskId}`);
      socket.emit('unsubscribed', { taskId });
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    socket.on('error', (error) => {
      console.error(`❌ Socket error for client ${socket.id}:`, error);
    });
  });

  // Set up event-driven updates from task event emitter
  const broadcastEvent = (event: TaskEventData) => {
    if (!io) return;

    console.log(`📡 Broadcasting event for task ${event.taskId}:`, event.type);
    
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

  console.log('✅ Socket.IO server initialized');
  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}

export function emitToTask(taskId: string, event: string, data: any) {
  if (!io) {
    console.warn('🚨 Socket.IO not initialized, cannot emit event');
    return;
  }
  
  console.log(`📡 Emitting to task ${taskId}:`, event);
  io.to(`task:${taskId}`).emit(event, data);
}