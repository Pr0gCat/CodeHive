import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { setupWebSocketServer, broadcastTaskProgress, broadcastProjectUpdate } from '@/lib/socket/server';
import { TaskProgressEvent, ProjectUpdateEvent } from '@/lib/socket/types';

jest.mock('socket.io', () => {
  const mockSocket = {
    id: 'test-socket-id',
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    disconnect: jest.fn(),
  };

  const mockIo = {
    on: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    sockets: {
      sockets: new Map([['test-socket-id', mockSocket]]),
    },
  };

  return {
    Server: jest.fn().mockImplementation(() => mockIo),
  };
});

describe('WebSocket Server', () => {
  let mockHttpServer: HttpServer;
  let mockIo: SocketIOServer;
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHttpServer = {} as HttpServer;
    mockIo = new SocketIOServer(mockHttpServer);
    mockSocket = {
      id: 'test-socket-id',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn(),
    };
  });

  describe('setupWebSocketServer', () => {
    it('should create Socket.IO server with correct configuration', () => {
      const io = setupWebSocketServer(mockHttpServer);

      expect(SocketIOServer).toHaveBeenCalledWith(mockHttpServer, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
        },
        transports: ['websocket', 'polling'],
      });

      expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should handle socket connection events', () => {
      const io = setupWebSocketServer(mockHttpServer);
      const connectionHandler = (io.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];

      connectionHandler(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith('join-project', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('leave-project', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should handle join-project events', () => {
      const io = setupWebSocketServer(mockHttpServer);
      const connectionHandler = (io.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];

      connectionHandler(mockSocket);

      const joinProjectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'join-project'
      )[1];

      joinProjectHandler('test-project-id');

      expect(mockSocket.join).toHaveBeenCalledWith('project:test-project-id');
    });

    it('should handle leave-project events', () => {
      const io = setupWebSocketServer(mockHttpServer);
      const connectionHandler = (io.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];

      connectionHandler(mockSocket);

      const leaveProjectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'leave-project'
      )[1];

      leaveProjectHandler('test-project-id');

      expect(mockSocket.leave).toHaveBeenCalledWith('project:test-project-id');
    });
  });

  describe('broadcastTaskProgress', () => {
    it('should broadcast task progress to project room', () => {
      const event: TaskProgressEvent = {
        taskId: 'test-task-id',
        projectId: 'test-project-id',
        phase: 'EXECUTION',
        progress: 50,
        message: 'Task in progress',
        timestamp: new Date().toISOString(),
      };

      broadcastTaskProgress(mockIo, event);

      expect(mockIo.to).toHaveBeenCalledWith('project:test-project-id');
      expect(mockIo.emit).toHaveBeenCalledWith('task-progress', event);
    });

    it('should handle missing projectId gracefully', () => {
      const event: TaskProgressEvent = {
        taskId: 'test-task-id',
        projectId: '',
        phase: 'EXECUTION',
        progress: 50,
        message: 'Task in progress',
        timestamp: new Date().toISOString(),
      };

      expect(() => broadcastTaskProgress(mockIo, event)).not.toThrow();
    });
  });

  describe('broadcastProjectUpdate', () => {
    it('should broadcast project update to project room', () => {
      const event: ProjectUpdateEvent = {
        projectId: 'test-project-id',
        type: 'STATUS_CHANGE',
        data: {
          status: 'ACTIVE',
          message: 'Project activated',
        },
        timestamp: new Date().toISOString(),
      };

      broadcastProjectUpdate(mockIo, event);

      expect(mockIo.to).toHaveBeenCalledWith('project:test-project-id');
      expect(mockIo.emit).toHaveBeenCalledWith('project-update', event);
    });

    it('should handle different project update types', () => {
      const events: ProjectUpdateEvent[] = [
        {
          projectId: 'test-project-id',
          type: 'CYCLE_CREATED',
          data: { cycleId: 'new-cycle-id' },
          timestamp: new Date().toISOString(),
        },
        {
          projectId: 'test-project-id',
          type: 'TEST_UPDATED',
          data: { testId: 'test-id', status: 'PASSING' },
          timestamp: new Date().toISOString(),
        },
        {
          projectId: 'test-project-id',
          type: 'ARTIFACT_GENERATED',
          data: { artifactId: 'artifact-id', type: 'CODE' },
          timestamp: new Date().toISOString(),
        },
      ];

      events.forEach(event => {
        broadcastProjectUpdate(mockIo, event);
        expect(mockIo.to).toHaveBeenCalledWith('project:test-project-id');
        expect(mockIo.emit).toHaveBeenCalledWith('project-update', event);
      });
    });

    it('should handle missing projectId gracefully', () => {
      const event: ProjectUpdateEvent = {
        projectId: '',
        type: 'STATUS_CHANGE',
        data: { status: 'ACTIVE' },
        timestamp: new Date().toISOString(),
      };

      expect(() => broadcastProjectUpdate(mockIo, event)).not.toThrow();
    });
  });

  describe('socket room management', () => {
    it('should properly manage socket rooms for projects', () => {
      const io = setupWebSocketServer(mockHttpServer);
      const connectionHandler = (io.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];

      connectionHandler(mockSocket);

      const joinProjectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'join-project'
      )[1];
      const leaveProjectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'leave-project'
      )[1];

      // Join multiple projects
      joinProjectHandler('project-1');
      joinProjectHandler('project-2');

      expect(mockSocket.join).toHaveBeenCalledWith('project:project-1');
      expect(mockSocket.join).toHaveBeenCalledWith('project:project-2');

      // Leave one project
      leaveProjectHandler('project-1');

      expect(mockSocket.leave).toHaveBeenCalledWith('project:project-1');
    });

    it('should handle disconnect events', () => {
      const io = setupWebSocketServer(mockHttpServer);
      const connectionHandler = (io.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];

      connectionHandler(mockSocket);

      const disconnectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'disconnect'
      )[1];

      expect(() => disconnectHandler()).not.toThrow();
    });
  });
});
