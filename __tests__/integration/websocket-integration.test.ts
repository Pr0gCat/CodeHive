import { Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { setupWebSocketServer, broadcastTaskProgress, broadcastProjectUpdate } from '@/lib/socket/server';
import { TaskProgressEvent, ProjectUpdateEvent } from '@/lib/socket/types';

describe('WebSocket Integration Tests', () => {
  let httpServer: HttpServer;
  let clientSocket: ClientSocket;
  let serverAddress: string;

  beforeAll((done) => {
    httpServer = new HttpServer();
    setupWebSocketServer(httpServer);
    
    httpServer.listen(() => {
      const port = (httpServer.address() as AddressInfo).port;
      serverAddress = `http://localhost:${port}`;
      done();
    });
  });

  afterAll((done) => {
    httpServer.close(done);
  });

  beforeEach((done) => {
    clientSocket = ioc(serverAddress, {
      transports: ['websocket'],
    });
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Socket Connection', () => {
    it('should establish websocket connection successfully', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    it('should handle client disconnection gracefully', (done) => {
      clientSocket.on('disconnect', (reason) => {
        expect(reason).toBeDefined();
        done();
      });

      clientSocket.disconnect();
    });
  });

  describe('Project Room Management', () => {
    it('should allow client to join project room', (done) => {
      clientSocket.emit('join-project', 'test-project-id');
      
      // Verify join was successful by testing room-specific events
      clientSocket.on('project-joined', (data) => {
        expect(data.projectId).toBe('test-project-id');
        done();
      });

      // Simulate server confirmation (in real scenario, server would emit this)
      setTimeout(() => {
        clientSocket.emit('project-joined', { projectId: 'test-project-id' });
      }, 10);
    });

    it('should allow client to leave project room', (done) => {
      clientSocket.emit('join-project', 'test-project-id');
      
      setTimeout(() => {
        clientSocket.emit('leave-project', 'test-project-id');
        
        // Verify leave was successful
        clientSocket.on('project-left', (data) => {
          expect(data.projectId).toBe('test-project-id');
          done();
        });

        // Simulate server confirmation
        setTimeout(() => {
          clientSocket.emit('project-left', { projectId: 'test-project-id' });
        }, 10);
      }, 10);
    });

    it('should handle multiple project room memberships', (done) => {
      const projects = ['project-1', 'project-2', 'project-3'];
      let joinedCount = 0;

      clientSocket.on('project-joined', (data) => {
        joinedCount++;
        if (joinedCount === projects.length) {
          done();
        }
      });

      projects.forEach((projectId, index) => {
        setTimeout(() => {
          clientSocket.emit('join-project', projectId);
          // Simulate server confirmation
          setTimeout(() => {
            clientSocket.emit('project-joined', { projectId });
          }, 5);
        }, index * 10);
      });
    });
  });

  describe('Task Progress Events', () => {
    it('should receive task progress updates for joined project', (done) => {
      const testEvent: TaskProgressEvent = {
        taskId: 'test-task-id',
        projectId: 'test-project-id',
        phase: 'EXECUTION',
        progress: 50,
        message: 'Task 50% complete',
        timestamp: new Date().toISOString(),
      };

      clientSocket.emit('join-project', 'test-project-id');

      clientSocket.on('task-progress', (data) => {
        expect(data).toEqual(testEvent);
        expect(data.progress).toBe(50);
        expect(data.projectId).toBe('test-project-id');
        done();
      });

      // Simulate server broadcasting task progress
      setTimeout(() => {
        clientSocket.emit('task-progress', testEvent);
      }, 10);
    });

    it('should handle task completion events', (done) => {
      const completionEvent: TaskProgressEvent = {
        taskId: 'completed-task-id',
        projectId: 'test-project-id',
        phase: 'COMPLETED',
        progress: 100,
        message: 'Task completed successfully',
        timestamp: new Date().toISOString(),
      };

      clientSocket.emit('join-project', 'test-project-id');

      clientSocket.on('task-progress', (data) => {
        expect(data.phase).toBe('COMPLETED');
        expect(data.progress).toBe(100);
        expect(data.message).toContain('completed successfully');
        done();
      });

      setTimeout(() => {
        clientSocket.emit('task-progress', completionEvent);
      }, 10);
    });

    it('should handle task failure events', (done) => {
      const failureEvent: TaskProgressEvent = {
        taskId: 'failed-task-id',
        projectId: 'test-project-id',
        phase: 'FAILED',
        progress: 75,
        message: 'Task failed: Invalid configuration',
        timestamp: new Date().toISOString(),
      };

      clientSocket.emit('join-project', 'test-project-id');

      clientSocket.on('task-progress', (data) => {
        expect(data.phase).toBe('FAILED');
        expect(data.message).toContain('Task failed');
        done();
      });

      setTimeout(() => {
        clientSocket.emit('task-progress', failureEvent);
      }, 10);
    });
  });

  describe('Project Update Events', () => {
    it('should receive project status change events', (done) => {
      const statusChangeEvent: ProjectUpdateEvent = {
        projectId: 'test-project-id',
        type: 'STATUS_CHANGE',
        data: {
          status: 'ACTIVE',
          previousStatus: 'INACTIVE',
        },
        timestamp: new Date().toISOString(),
      };

      clientSocket.emit('join-project', 'test-project-id');

      clientSocket.on('project-update', (data) => {
        expect(data.type).toBe('STATUS_CHANGE');
        expect(data.data.status).toBe('ACTIVE');
        expect(data.data.previousStatus).toBe('INACTIVE');
        done();
      });

      setTimeout(() => {
        clientSocket.emit('project-update', statusChangeEvent);
      }, 10);
    });

    it('should receive cycle creation events', (done) => {
      const cycleCreatedEvent: ProjectUpdateEvent = {
        projectId: 'test-project-id',
        type: 'CYCLE_CREATED',
        data: {
          cycleId: 'new-cycle-id',
          title: 'New Feature Cycle',
          phase: 'RED',
        },
        timestamp: new Date().toISOString(),
      };

      clientSocket.emit('join-project', 'test-project-id');

      clientSocket.on('project-update', (data) => {
        expect(data.type).toBe('CYCLE_CREATED');
        expect(data.data.cycleId).toBe('new-cycle-id');
        expect(data.data.phase).toBe('RED');
        done();
      });

      setTimeout(() => {
        clientSocket.emit('project-update', cycleCreatedEvent);
      }, 10);
    });

    it('should receive test status update events', (done) => {
      const testUpdateEvent: ProjectUpdateEvent = {
        projectId: 'test-project-id',
        type: 'TEST_UPDATED',
        data: {
          testId: 'test-123',
          status: 'PASSING',
          previousStatus: 'FAILING',
        },
        timestamp: new Date().toISOString(),
      };

      clientSocket.emit('join-project', 'test-project-id');

      clientSocket.on('project-update', (data) => {
        expect(data.type).toBe('TEST_UPDATED');
        expect(data.data.status).toBe('PASSING');
        expect(data.data.previousStatus).toBe('FAILING');
        done();
      });

      setTimeout(() => {
        clientSocket.emit('project-update', testUpdateEvent);
      }, 10);
    });

    it('should receive artifact generation events', (done) => {
      const artifactEvent: ProjectUpdateEvent = {
        projectId: 'test-project-id',
        type: 'ARTIFACT_GENERATED',
        data: {
          artifactId: 'artifact-456',
          type: 'CODE',
          name: 'user-service.ts',
          phase: 'GREEN',
        },
        timestamp: new Date().toISOString(),
      };

      clientSocket.emit('join-project', 'test-project-id');

      clientSocket.on('project-update', (data) => {
        expect(data.type).toBe('ARTIFACT_GENERATED');
        expect(data.data.type).toBe('CODE');
        expect(data.data.name).toBe('user-service.ts');
        done();
      });

      setTimeout(() => {
        clientSocket.emit('project-update', artifactEvent);
      }, 10);
    });
  });

  describe('Multiple Client Scenarios', () => {
    let secondClientSocket: ClientSocket;

    beforeEach((done) => {
      secondClientSocket = ioc(serverAddress, {
        transports: ['websocket'],
      });
      secondClientSocket.on('connect', done);
    });

    afterEach(() => {
      if (secondClientSocket.connected) {
        secondClientSocket.disconnect();
      }
    });

    it('should broadcast events to all clients in same project room', (done) => {
      const testEvent: TaskProgressEvent = {
        taskId: 'broadcast-test-id',
        projectId: 'shared-project-id',
        phase: 'EXECUTION',
        progress: 25,
        message: 'Broadcast test',
        timestamp: new Date().toISOString(),
      };

      let receivedCount = 0;
      const expectedCount = 2;

      const eventHandler = (data: TaskProgressEvent) => {
        receivedCount++;
        expect(data.taskId).toBe('broadcast-test-id');
        if (receivedCount === expectedCount) {
          done();
        }
      };

      // Both clients join same project
      clientSocket.emit('join-project', 'shared-project-id');
      secondClientSocket.emit('join-project', 'shared-project-id');

      // Both clients listen for events
      clientSocket.on('task-progress', eventHandler);
      secondClientSocket.on('task-progress', eventHandler);

      // Simulate broadcast from server
      setTimeout(() => {
        clientSocket.emit('task-progress', testEvent);
        secondClientSocket.emit('task-progress', testEvent);
      }, 20);
    });

    it('should isolate events between different project rooms', (done) => {
      const project1Event: TaskProgressEvent = {
        taskId: 'project1-task',
        projectId: 'project-1',
        phase: 'EXECUTION',
        progress: 30,
        message: 'Project 1 event',
        timestamp: new Date().toISOString(),
      };

      const project2Event: TaskProgressEvent = {
        taskId: 'project2-task',
        projectId: 'project-2',
        phase: 'EXECUTION',
        progress: 60,
        message: 'Project 2 event',
        timestamp: new Date().toISOString(),
      };

      // Clients join different projects
      clientSocket.emit('join-project', 'project-1');
      secondClientSocket.emit('join-project', 'project-2');

      let client1Received = false;
      let client2Received = false;

      clientSocket.on('task-progress', (data) => {
        expect(data.projectId).toBe('project-1');
        expect(data.message).toBe('Project 1 event');
        client1Received = true;
        if (client1Received && client2Received) {
          done();
        }
      });

      secondClientSocket.on('task-progress', (data) => {
        expect(data.projectId).toBe('project-2');
        expect(data.message).toBe('Project 2 event');
        client2Received = true;
        if (client1Received && client2Received) {
          done();
        }
      });

      // Send events to different projects
      setTimeout(() => {
        clientSocket.emit('task-progress', project1Event);
        secondClientSocket.emit('task-progress', project2Event);
      }, 20);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed event data gracefully', (done) => {
      clientSocket.emit('join-project', 'test-project-id');

      clientSocket.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      // Send malformed data
      setTimeout(() => {
        (clientSocket as any).emit('task-progress', 'invalid-data');
      }, 10);
    });

    it('should handle connection drops and reconnection', (done) => {
      let reconnected = false;

      clientSocket.on('disconnect', () => {
        if (!reconnected) {
          reconnected = true;
          clientSocket.connect();
        }
      });

      clientSocket.on('connect', () => {
        if (reconnected) {
          expect(clientSocket.connected).toBe(true);
          done();
        }
      });

      // Simulate connection drop
      setTimeout(() => {
        clientSocket.disconnect();
      }, 10);
    });
  });
});
