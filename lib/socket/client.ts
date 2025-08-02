'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  TaskEvent,
  TaskStatus,
  PhaseStatus,
  SocketState,
  TaskExecutionStatus,
  UIPhase,
  TaskSubscriptionData,
  TaskCompletedData,
  TaskErrorData,
  PhaseProgressData,
  PhaseStartData,
  PhaseCompleteData,
  SocketError,
} from './types';

export function useSocket(taskId?: string) {
  const [state, setState] = useState<SocketState>({
    connected: false,
    error: null,
    events: [],
  });

  const socketRef = useRef<Socket | null>(null);
  const subscribedTasksRef = useRef<Set<string>>(new Set());
  const [taskStatus, setTaskStatus] = useState<TaskExecutionStatus | null>(null);
  const [phases, setPhases] = useState<UIPhase[]>([]);

  useEffect(() => {
    // Initialize socket connection
    if (!socketRef.current) {
      const socket = io('/', {
        transports: ['polling', 'websocket'], // 優先使用 polling，避免 WebSocket 連接問題
        timeout: 20000,
        forceNew: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('🔗 Socket.IO connected:', socket.id);
        setState(prev => ({ ...prev, connected: true, error: null }));
      });

      socket.on('disconnect', (reason: string) => {
        console.log('🔌 Socket.IO disconnected:', reason);
        setState(prev => ({ ...prev, connected: false }));
      });

      socket.on('connect_error', (error: Error) => {
        console.error('❌ Socket.IO connection error:', error);
        setState(prev => ({
          ...prev,
          connected: false,
          error: error.message,
        }));
      });

      socket.on('reconnect', (attemptNumber: number) => {
        console.log(
          '🔄 Socket.IO reconnected after',
          attemptNumber,
          'attempts'
        );
        setState(prev => ({ ...prev, connected: true, error: null }));
      });

      socket.on('reconnect_attempt', (attemptNumber: number) => {
        console.log('🔄 Socket.IO reconnect attempt:', attemptNumber);
      });

      socket.on('reconnect_error', (error: Error) => {
        console.error('❌ Socket.IO reconnect error:', error);
      });

      socket.on('reconnect_failed', () => {
        console.error('❌ Socket.IO reconnect failed');
        setState(prev => ({
          ...prev,
          connected: false,
          error: 'Failed to reconnect after multiple attempts',
        }));
      });

      // Task-specific event listeners
      socket.on('subscribed', (data: TaskSubscriptionData) => {
        console.log('Subscribed to task:', data.taskId);
      });

      socket.on('unsubscribed', (data: TaskSubscriptionData) => {
        console.log('❌ Unsubscribed from task:', data.taskId);
      });

      socket.on('task_status', (data: TaskStatus) => {
        console.log('Received task status:', data);
        setTaskStatus(data.task);
      });

      socket.on('phase_status', (data: PhaseStatus) => {
        console.log('🔄 Received phase status:', data);
        const phase = data.phase;

        setPhases(prevPhases => {
          const phaseIndex = prevPhases.findIndex(p => p.id === phase.phaseId);

          const phaseData: UIPhase = {
            id: phase.phaseId,
            title: phase.title,
            description: phase.description,
            status: phase.status.toLowerCase(),
            progress: phase.progress || 0,
            details: phase.details
              ? typeof phase.details === 'string'
                ? JSON.parse(phase.details)
                : phase.details
              : [],
          };

          if (phaseIndex >= 0) {
            const updatedPhases = [...prevPhases];
            updatedPhases[phaseIndex] = phaseData;
            return updatedPhases;
          } else {
            const newPhases = [...prevPhases, phaseData];
            return newPhases.sort((a, b) => {
              const phaseOrder: Record<string, number> = {
                validation: 0,
                git_clone: 1,
                analysis: 2,
                setup: 3,
                completion: 4,
              };
              return (phaseOrder[a.id] || 999) - (phaseOrder[b.id] || 999);
            });
          }
        });
      });

      socket.on('task_event', (event: TaskEvent) => {
        console.log('Received task event:', event);
        setState(prev => ({
          ...prev,
          events: [...prev.events, event],
        }));

        // Update phase progress based on event
        if (event.data?.phaseId) {
          setPhases(prevPhases => {
            return prevPhases.map(phase => {
              if (phase.id === event.data.phaseId) {
                return {
                  ...phase,
                  progress: event.data.progress || phase.progress,
                  status:
                    event.type === 'phase_start'
                      ? 'active'
                      : event.type === 'phase_complete'
                        ? 'completed'
                        : event.type === 'error'
                          ? 'error'
                          : phase.status,
                };
              }
              return phase;
            });
          });
        }
      });

      socket.on('task_completed', (data: TaskCompletedData) => {
        console.log('🎉 Task completed:', data);
        setState(prev => ({
          ...prev,
          events: [
            ...prev.events,
            {
              type: 'task_completed',
              taskId: data.taskId,
              timestamp: new Date().toISOString(),
              data: { result: data.result },
            },
          ],
        }));
      });

      socket.on('task_error', (data: TaskErrorData) => {
        console.error('❌ Task failed:', data);
        setState(prev => ({
          ...prev,
          error: data.error,
          events: [
            ...prev.events,
            {
              type: 'task_error',
              taskId: data.taskId,
              timestamp: new Date().toISOString(),
              data: { error: data.error },
            },
          ],
        }));
      });

      socket.on('phase_progress', (data: PhaseProgressData) => {
        console.log('📈 Phase progress:', data);
        setPhases(prevPhases => {
          return prevPhases.map(phase => {
            if (phase.id === data.phaseId) {
              return {
                ...phase,
                progress: data.progress,
              };
            }
            return phase;
          });
        });
      });

      socket.on('phase_start', (data: PhaseStartData) => {
        console.log('🚀 Phase started:', data);
        setPhases(prevPhases => {
          return prevPhases.map(phase => {
            if (phase.id === data.phaseId) {
              return {
                ...phase,
                status: 'active',
              };
            }
            return phase;
          });
        });
      });

      socket.on('phase_complete', (data: PhaseCompleteData) => {
        console.log('Phase completed:', data);
        setPhases(prevPhases => {
          return prevPhases.map(phase => {
            if (phase.id === data.phaseId) {
              return {
                ...phase,
                status: 'completed',
                progress: 100,
              };
            }
            return phase;
          });
        });
      });

      socket.on('error', (error: SocketError) => {
        console.error('❌ Socket error:', error);
        setState(prev => ({ ...prev, error: error.message }));
      });
    }

    return () => {
      if (socketRef.current) {
        console.log('🔌 Cleaning up socket connection');
        socketRef.current.disconnect();
        socketRef.current = null;
        subscribedTasksRef.current.clear();
      }
    };
  }, []);

  // Subscribe to task when taskId changes
  useEffect(() => {
    if (
      socketRef.current &&
      taskId &&
      state.connected &&
      !subscribedTasksRef.current.has(taskId)
    ) {
      console.log(`Subscribing to task: ${taskId}`);
      socketRef.current.emit('subscribe_task', taskId);
      subscribedTasksRef.current.add(taskId);

      return () => {
        if (
          socketRef.current &&
          socketRef.current.connected &&
          subscribedTasksRef.current.has(taskId)
        ) {
          console.log(`Unsubscribing from task: ${taskId}`);
          socketRef.current.emit('unsubscribe_task', taskId);
          subscribedTasksRef.current.delete(taskId);
        }
      };
    }
  }, [taskId, state.connected]);

  const subscribeToTask = (id: string) => {
    if (
      socketRef.current &&
      state.connected &&
      !subscribedTasksRef.current.has(id)
    ) {
      console.log(`Manual subscribe to task: ${id}`);
      socketRef.current.emit('subscribe_task', id);
      subscribedTasksRef.current.add(id);
    }
  };

  const unsubscribeFromTask = (id: string) => {
    if (socketRef.current && subscribedTasksRef.current.has(id)) {
      console.log(`Manual unsubscribe from task: ${id}`);
      socketRef.current.emit('unsubscribe_task', id);
      subscribedTasksRef.current.delete(id);
    }
  };

  const clearEvents = () => {
    setState(prev => ({ ...prev, events: [] }));
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  return {
    ...state,
    taskStatus,
    phases,
    subscribeToTask,
    unsubscribeFromTask,
    clearEvents,
    clearError,
  };
}

// Re-export types for convenience
export type { TaskEvent, TaskStatus, PhaseStatus, SocketState } from './types';