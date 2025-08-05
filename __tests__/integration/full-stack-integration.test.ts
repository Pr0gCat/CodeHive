import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Full Stack Integration Testing', () => {
  let backendServer: any;
  let frontendApiClient: any;
  const BACKEND_PORT = 3005;

  beforeAll(async () => {
    // Start backend server
    const { createServerWithSocket } = await import('../../packages/backend/src/server');
    backendServer = createServerWithSocket();
    await new Promise<void>((resolve) => {
      backendServer.listen(BACKEND_PORT, () => resolve());
    });

    // Initialize frontend API client
    const { ProjectsApiClient } = await import('../../packages/frontend/src/lib/api-client');
    frontendApiClient = new ProjectsApiClient(`http://localhost:${BACKEND_PORT}`);
  });

  afterAll(async () => {
    if (backendServer) {
      await new Promise<void>((resolve) => {
        backendServer.close(() => resolve());
      });
    }
  });

  describe('Project Management Flow', () => {
    it('should complete full project lifecycle: create -> list -> get -> update -> delete', async () => {
      // 1. Create project via frontend API client
      const createResult = await frontendApiClient.createProject({
        name: 'Integration Test Project',
        description: 'A test project for integration testing',
        localPath: '/test/integration-project'
      });

      expect(createResult.success).toBe(true);
      expect(createResult.data).toBeDefined();
      expect(createResult.data.name).toBe('Integration Test Project');
      
      const projectId = createResult.data.id;

      // 2. List projects and verify creation
      const listResult = await frontendApiClient.getProjects();
      expect(listResult.success).toBe(true);
      expect(Array.isArray(listResult.data)).toBe(true);
      
      const createdProject = listResult.data.find((p: any) => p.id === projectId);
      expect(createdProject).toBeDefined();

      // 3. Get specific project
      const getResult = await frontendApiClient.getProject(projectId);
      expect(getResult.success).toBe(true);
      expect(getResult.data.id).toBe(projectId);
      expect(getResult.data.name).toBe('Integration Test Project');

      // 4. Update project
      const updateResult = await frontendApiClient.updateProject(projectId, {
        name: 'Updated Integration Test Project',
        description: 'Updated description'
      });
      expect(updateResult.success).toBe(true);
      expect(updateResult.data.name).toBe('Updated Integration Test Project');

      // 5. Delete project
      const deleteResult = await frontendApiClient.deleteProject(projectId);
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.data.deleted).toBe(true);
    });

    it('should handle API validation errors properly', async () => {
      // Test invalid project creation
      const invalidResult = await frontendApiClient.createProject({
        name: '', // Invalid: empty name
        localPath: '/invalid/path'
      });

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toBeDefined();
      expect(invalidResult.error).toContain('Name is required');
    });

    it('should handle network errors gracefully', async () => {
      // Create client pointing to non-existent server
      const { ProjectsApiClient } = await import('../../packages/frontend/src/lib/api-client');
      const invalidClient = new ProjectsApiClient('http://localhost:9999');

      const result = await invalidClient.getProjects();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Real-time Integration', () => {
    it('should establish WebSocket connection and handle events', async () => {
      const { WebSocketClient } = await import('../../packages/frontend/src/lib/api-client');
      const wsClient = new WebSocketClient(`http://localhost:${BACKEND_PORT}`);

      // Test connection
      const connected = await wsClient.connect();
      expect(connected).toBe(true);
      expect(wsClient.isConnected()).toBe(true);

      // Test event handling
      let receivedProgress = false;
      wsClient.on('task:progress', (data) => {
        receivedProgress = true;
        expect(data.taskId).toBe('test-task');
        expect(typeof data.progress).toBe('number');
      });

      // Emit test event
      wsClient.emit('task:progress', {
        taskId: 'test-task',
        progress: 75,
        phase: 'TESTING',
        message: 'Integration test in progress'
      });

      // Wait for event to be received
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(receivedProgress).toBe(true);

      // Clean up
      wsClient.disconnect();
      expect(wsClient.isConnected()).toBe(false);
    });
  });

  describe('Type Safety Integration', () => {
    it('should use shared schemas for validation across frontend and backend', async () => {
      const { ProjectsAPI } = await import('@codehive/shared');
      
      // Test valid data passes validation
      const validProjectData = {
        name: 'Valid Project',
        description: 'Valid description',
        localPath: '/valid/path'
      };

      expect(() => ProjectsAPI.create.request.parse(validProjectData)).not.toThrow();

      // Test invalid data fails validation
      const invalidProjectData = {
        name: '', // Invalid: empty name
        localPath: '/valid/path'
      };

      expect(() => ProjectsAPI.create.request.parse(invalidProjectData)).toThrow();
    });

    it('should maintain API contract compatibility', async () => {
      // Create a project and verify response format matches schema
      const createResult = await frontendApiClient.createProject({
        name: 'Schema Test Project',
        localPath: '/schema/test'
      });

      expect(createResult.success).toBe(true);
      
      // Verify response matches shared schema
      const { ProjectsAPI } = await import('@codehive/shared');
      expect(() => ProjectsAPI.create.response.parse(createResult)).not.toThrow();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle server errors consistently across all API methods', async () => {
      // Test 404 error scenario
      const result = await frontendApiClient.getProject('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error).toContain('404');
    });
  });
});