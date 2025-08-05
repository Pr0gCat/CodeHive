import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSocket } from '@/lib/socket/client';
import { io, Socket } from 'socket.io-client';
import {
  TaskEvent,
  TaskStatus,
  PhaseStatus,
  TaskCompletedData,
  TaskErrorData,
  PhaseProgressData,
  PhaseStartData,
  PhaseCompleteData,
  SocketError,
} from '@/lib/socket/types';

// Mock socket.io-client
const mockSocket = {
  id: 'test-socket-id',
  connected: false,
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connect: jest.fn(),
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

const mockIo = io as jest.MockedFunction<typeof io>;

describe('useSocket Hook', () => {
  let eventHandlers: Record<string, (data: any) => void>;

  beforeEach(() => {
    jest.clearAllMocks();
    eventHandlers = {};
    
    // Mock socket event registration
    mockSocket.on.mockImplementation((event: string, handler: (data: any) => void) => {
      eventHandlers[event] = handler;
    });
    
    mockSocket.connected = false;
    mockIo.mockReturnValue(mockSocket as any);
  });

  describe('Socket Connection', () => {
    it('should initialize socket connection with correct configuration', () => {
      renderHook(() => useSocket());

      expect(mockIo).toHaveBeenCalledWith('/', {
        transports: ['polling', 'websocket'],
        timeout: 20000,
        forceNew: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    });

    it('should handle socket connection events', async () => {
      const { result } = renderHook(() => useSocket());

      expect(result.current.connected).toBe(false);

      // Simulate connect event
      act(() => {
        eventHandlers.connect();
      });

      expect(result.current.connected).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it('should handle disconnect events', async () => {
      const { result } = renderHook(() => useSocket());

      // First connect
      act(() => {
        eventHandlers.connect();
      });

      expect(result.current.connected).toBe(true);

      // Then disconnect
      act(() => {
        eventHandlers.disconnect('client namespace disconnect');
      });

      expect(result.current.connected).toBe(false);
    });

    it('should handle connection errors', async () => {
      const { result } = renderHook(() => useSocket());

      const error = new Error('Connection failed');

      act(() => {
        eventHandlers.connect_error(error);
      });

      expect(result.current.connected).toBe(false);
      expect(result.current.error).toBe('Connection failed');
    });

    it('should handle reconnection events', async () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        eventHandlers.reconnect(3);
      });

      expect(result.current.connected).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it('should handle reconnection failure', async () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        eventHandlers.reconnect_failed();
      });

      expect(result.current.connected).toBe(false);
      expect(result.current.error).toBe('Failed to reconnect after multiple attempts');
    });
  });

  describe('Task Subscription', () => {
    it('should subscribe to task when taskId is provided and connected', async () => {
      mockSocket.connected = true;
      const { result, rerender } = renderHook(({ taskId }) => useSocket(taskId), {
        initialProps: { taskId: undefined as string | undefined },
      });

      // Connect first
      act(() => {
        eventHandlers.connect();
      });

      // Then provide taskId
      rerender({ taskId: 'test-task-id' });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('subscribe_task', 'test-task-id');
      });
    });

    it('should not subscribe if already subscribed to task', async () => {
      mockSocket.connected = true;
      const { result, rerender } = renderHook(({ taskId }) => useSocket(taskId), {
        initialProps: { taskId: 'test-task-id' },
      });

      act(() => {
        eventHandlers.connect();
      });

      // Rerender with same taskId
      rerender({ taskId: 'test-task-id' });

      // Should only be called once
      expect(mockSocket.emit).toHaveBeenCalledTimes(1);
    });

    it('should provide manual subscription functions', async () => {
      mockSocket.connected = true;
      const { result } = renderHook(() => useSocket());

      act(() => {
        eventHandlers.connect();
      });

      act(() => {
        result.current.subscribeToTask('manual-task-id');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe_task', 'manual-task-id');
    });

    it('should provide manual unsubscription functions', async () => {
      mockSocket.connected = true;
      const { result } = renderHook(() => useSocket());

      act(() => {
        eventHandlers.connect();
      });

      // First subscribe
      act(() => {
        result.current.subscribeToTask('manual-task-id');
      });

      // Then unsubscribe
      act(() => {
        result.current.unsubscribeFromTask('manual-task-id');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe_task', 'manual-task-id');
    });
  });

  describe('Task Events', () => {
    it('should handle task status updates', async () => {
      const { result } = renderHook(() => useSocket());

      const taskStatus: TaskStatus = {
        task: {
          id: 'test-task-id',
          type: 'PROJECT_CREATE',
          status: 'IN_PROGRESS',
          projectId: 'test-project-id',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: new Date(),
          completedAt: null,
        },
      };

      act(() => {
        eventHandlers.task_status(taskStatus);
      });

      expect(result.current.taskStatus).toEqual(taskStatus.task);
    });

    it('should handle task events and add to events array', async () => {
      const { result } = renderHook(() => useSocket());

      const taskEvent: TaskEvent = {
        type: 'progress',
        taskId: 'test-task-id',
        timestamp: new Date().toISOString(),
        data: {
          phaseId: 'validation',
          progress: 50,
          message: 'Validation in progress',
        },
      };

      act(() => {
        eventHandlers.task_event(taskEvent);
      });

      expect(result.current.events).toContain(taskEvent);
    });

    it('should handle task completion events', async () => {
      const { result } = renderHook(() => useSocket());

      const completionData: TaskCompletedData = {
        taskId: 'test-task-id',
        result: { success: true, message: 'Task completed successfully' },
      };

      act(() => {
        eventHandlers.task_completed(completionData);
      });

      const completionEvent = result.current.events.find(
        e => e.type === 'task_completed'
      );
      expect(completionEvent).toBeDefined();
      expect(completionEvent?.data.result).toEqual(completionData.result);
    });

    it('should handle task error events', async () => {
      const { result } = renderHook(() => useSocket());

      const errorData: TaskErrorData = {
        taskId: 'test-task-id',
        error: 'Task execution failed',
      };

      act(() => {
        eventHandlers.task_error(errorData);
      });

      expect(result.current.error).toBe('Task execution failed');
      const errorEvent = result.current.events.find(e => e.type === 'task_error');
      expect(errorEvent).toBeDefined();
    });
  });

  describe('Phase Management', () => {
    it('should handle phase status updates', async () => {
      const { result } = renderHook(() => useSocket());

      const phaseStatus: PhaseStatus = {
        phase: {
          phaseId: 'validation',
          title: 'Validation Phase',
          description: 'Validating project inputs',
          status: 'IN_PROGRESS',
          progress: 75,
          details: JSON.stringify({ files: 10, validated: 7 }),
        },
      };

      act(() => {
        eventHandlers.phase_status(phaseStatus);
      });

      const validationPhase = result.current.phases.find(p => p.id === 'validation');
      expect(validationPhase).toBeDefined();
      expect(validationPhase?.progress).toBe(75);
      expect(validationPhase?.status).toBe('in_progress');
    });

    it('should handle phase progress updates', async () => {
      const { result } = renderHook(() => useSocket());

      // First set up phase
      const phaseStatus: PhaseStatus = {
        phase: {
          phaseId: 'analysis',
          title: 'Analysis Phase',
          description: 'Analyzing project structure',
          status: 'IN_PROGRESS',
          progress: 25,
          details: null,
        },
      };

      act(() => {
        eventHandlers.phase_status(phaseStatus);
      });

      // Then update progress
      const progressData: PhaseProgressData = {
        phaseId: 'analysis',
        progress: 60,
      };

      act(() => {
        eventHandlers.phase_progress(progressData);
      });

      const analysisPhase = result.current.phases.find(p => p.id === 'analysis');
      expect(analysisPhase?.progress).toBe(60);
    });

    it('should handle phase start events', async () => {
      const { result } = renderHook(() => useSocket());

      // Set up phase first
      const phaseStatus: PhaseStatus = {
        phase: {
          phaseId: 'setup',
          title: 'Setup Phase',
          description: 'Setting up project environment',
          status: 'PENDING',
          progress: 0,
          details: null,
        },
      };

      act(() => {
        eventHandlers.phase_status(phaseStatus);
      });

      // Then start phase
      const startData: PhaseStartData = {
        phaseId: 'setup',
      };

      act(() => {
        eventHandlers.phase_start(startData);
      });

      const setupPhase = result.current.phases.find(p => p.id === 'setup');
      expect(setupPhase?.status).toBe('active');
    });

    it('should handle phase completion events', async () => {
      const { result } = renderHook(() => useSocket());

      // Set up phase first
      const phaseStatus: PhaseStatus = {
        phase: {
          phaseId: 'completion',
          title: 'Completion Phase',
          description: 'Finalizing project setup',
          status: 'IN_PROGRESS',
          progress: 90,
          details: null,
        },
      };

      act(() => {
        eventHandlers.phase_status(phaseStatus);
      });

      // Then complete phase
      const completeData: PhaseCompleteData = {
        phaseId: 'completion',
      };

      act(() => {
        eventHandlers.phase_complete(completeData);
      });

      const completionPhase = result.current.phases.find(p => p.id === 'completion');
      expect(completionPhase?.status).toBe('completed');
      expect(completionPhase?.progress).toBe(100);
    });

    it('should sort phases in correct order', async () => {
      const { result } = renderHook(() => useSocket());

      const phases = [
        {
          phaseId: 'completion',
          title: 'Completion',
          description: 'Final phase',
          status: 'PENDING' as const,
          progress: 0,
          details: null,
        },
        {
          phaseId: 'validation',
          title: 'Validation',
          description: 'First phase',
          status: 'PENDING' as const,
          progress: 0,
          details: null,
        },
        {
          phaseId: 'analysis',
          title: 'Analysis',
          description: 'Third phase',
          status: 'PENDING' as const,
          progress: 0,
          details: null,
        },
      ];

      // Add phases in random order
      phases.forEach(phase => {
        act(() => {
          eventHandlers.phase_status({ phase });
        });
      });

      const phaseIds = result.current.phases.map(p => p.id);
      expect(phaseIds).toEqual(['validation', 'analysis', 'completion']);
    });
  });

  describe('Utility Functions', () => {
    it('should clear events when clearEvents is called', async () => {
      const { result } = renderHook(() => useSocket());

      // Add some events first
      const taskEvent: TaskEvent = {
        type: 'progress',
        taskId: 'test-task-id',
        timestamp: new Date().toISOString(),
        data: { message: 'Test event' },
      };

      act(() => {
        eventHandlers.task_event(taskEvent);
      });

      expect(result.current.events).toHaveLength(1);

      act(() => {
        result.current.clearEvents();
      });

      expect(result.current.events).toHaveLength(0);
    });

    it('should clear error when clearError is called', async () => {
      const { result } = renderHook(() => useSocket());

      // Set error first
      const error = new Error('Test error');
      act(() => {
        eventHandlers.connect_error(error);
      });

      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });

    it('should handle socket errors', async () => {
      const { result } = renderHook(() => useSocket());

      const socketError: SocketError = {
        message: 'Socket communication error',
        code: 'SOCKET_ERROR',
      };

      act(() => {
        eventHandlers.error(socketError);
      });

      expect(result.current.error).toBe('Socket communication error');
    });
  });

  describe('Cleanup', () => {
    it('should disconnect socket on unmount', () => {
      const { unmount } = renderHook(() => useSocket());

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should unsubscribe from tasks on unmount', async () => {
      mockSocket.connected = true;
      const { result, unmount } = renderHook(() => useSocket('test-task-id'));

      act(() => {
        eventHandlers.connect();
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('subscribe_task', 'test-task-id');
      });

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('Task Event Phase Updates', () => {
    it('should update phase status based on task events', async () => {
      const { result } = renderHook(() => useSocket());

      // Set up phase first
      const phaseStatus: PhaseStatus = {
        phase: {
          phaseId: 'test-phase',
          title: 'Test Phase',
          description: 'Test phase description',
          status: 'PENDING',
          progress: 0,
          details: null,
        },
      };

      act(() => {
        eventHandlers.phase_status(phaseStatus);
      });

      // Send phase_start event
      const phaseStartEvent: TaskEvent = {
        type: 'phase_start',
        taskId: 'test-task-id',
        timestamp: new Date().toISOString(),
        data: {
          phaseId: 'test-phase',
          progress: 10,
        },
      };

      act(() => {
        eventHandlers.task_event(phaseStartEvent);
      });

      let testPhase = result.current.phases.find(p => p.id === 'test-phase');
      expect(testPhase?.status).toBe('active');
      expect(testPhase?.progress).toBe(10);

      // Send phase_complete event
      const phaseCompleteEvent: TaskEvent = {
        type: 'phase_complete',
        taskId: 'test-task-id',
        timestamp: new Date().toISOString(),
        data: {
          phaseId: 'test-phase',
          progress: 100,
        },
      };

      act(() => {
        eventHandlers.task_event(phaseCompleteEvent);
      });

      testPhase = result.current.phases.find(p => p.id === 'test-phase');
      expect(testPhase?.status).toBe('completed');
      expect(testPhase?.progress).toBe(100);

      // Send error event
      const errorEvent: TaskEvent = {
        type: 'error',
        taskId: 'test-task-id',
        timestamp: new Date().toISOString(),
        data: {
          phaseId: 'test-phase',
          error: 'Phase failed',
        },
      };

      act(() => {
        eventHandlers.task_event(errorEvent);
      });

      testPhase = result.current.phases.find(p => p.id === 'test-phase');
      expect(testPhase?.status).toBe('error');
    });
  });
});
