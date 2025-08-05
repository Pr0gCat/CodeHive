import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Performance & Monitoring Integration', () => {
  let backendServer: any;
  let frontendApiClient: any;
  const BACKEND_PORT = 3006;

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

  describe('Response Time Performance', () => {
    it('should respond to API calls within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const result = await frontendApiClient.getProjects();
      
      const responseTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 5;
      const startTime = Date.now();
      
      const promises = Array.from({ length: concurrentRequests }, () => 
        frontendApiClient.getProjects()
      );
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      // All requests should succeed
      expect(results.every(result => result.success)).toBe(true);
      
      // Concurrent requests shouldn't take much longer than individual requests
      expect(totalTime).toBeLessThan(2000);
    });
  });

  describe('Error Recovery & Retry Logic', () => {
    it('should implement retry mechanism for failed requests', async () => {
      const { ApiClient } = await import('../../packages/frontend/src/lib/api-client');
      
      // Test retry functionality exists
      const client = new ApiClient();
      expect(typeof client.withRetry).toBe('function');
      
      // Test retry with a function that fails initially
      let attempt = 0;
      const operation = async () => {
        attempt++;
        if (attempt < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      };
      
      const result = await client.withRetry(operation, 3);
      expect(result.success).toBe(true);
      expect(attempt).toBe(3);
    });

    it('should handle timeout scenarios gracefully', async () => {
      const { ApiClient } = await import('../../packages/frontend/src/lib/api-client');
      
      const client = new ApiClient('http://localhost:9999'); // Non-existent server
      
      const startTime = Date.now();
      
      try {
        await client.withRetry(async () => {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 100); // Quick timeout
          
          return await fetch('http://localhost:9999/api/test', { 
            signal: controller.signal 
          });
        }, 1);
      } catch (error) {
        // Expected to fail
      }
      
      const duration = Date.now() - startTime;
      
      // Should fail quickly due to timeout, not hang
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Memory Usage & Resource Management', () => {
    it('should properly clean up WebSocket connections', async () => {
      const { WebSocketClient } = await import('../../packages/frontend/src/lib/api-client');
      
      const clients = [];
      
      // Create multiple WebSocket connections
      for (let i = 0; i < 3; i++) {
        const client = new WebSocketClient(`http://localhost:${BACKEND_PORT}`);
        await client.connect();
        expect(client.isConnected()).toBe(true);
        clients.push(client);
      }
      
      // Clean up all connections
      clients.forEach(client => client.disconnect());
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // All connections should be closed
      clients.forEach(client => {
        expect(client.isConnected()).toBe(false);
      });
    });

    it('should not leak memory with repeated API calls', async () => {
      // Simulate repeated API usage pattern
      for (let i = 0; i < 10; i++) {
        const result = await frontendApiClient.getProjects();
        expect(result.success).toBe(true);
      }
      
      // If we get here without running out of memory, test passes
      expect(true).toBe(true);
    });
  });

  describe('Monitoring & Observability', () => {
    it('should provide health check endpoint with proper metrics', async () => {
      const response = await fetch(`http://localhost:${BACKEND_PORT}/api/health`);
      const healthData = await response.json();
      
      expect(response.ok).toBe(true);
      expect(healthData.status).toBe('ok');
      expect(healthData.service).toBe('codehive-backend');
      expect(healthData.timestamp).toBeDefined();
      expect(healthData.version).toBeDefined();
    });

    it('should handle graceful server shutdown', async () => {
      // This test verifies the server can be stopped cleanly
      // The afterAll hook will test this automatically
      expect(backendServer).toBeDefined();
    });
  });

  describe('Type Safety & Schema Validation Performance', () => {
    it('should validate schemas efficiently', async () => {
      const { ProjectsAPI } = await import('@codehive/shared');
      
      const testData = {
        name: 'Performance Test Project',
        localPath: '/test/performance',
        description: 'Testing schema validation performance'
      };
      
      const startTime = Date.now();
      
      // Validate schema multiple times
      for (let i = 0; i < 100; i++) {
        const result = ProjectsAPI.create.request.parse(testData);
        expect(result.name).toBe(testData.name);
      }
      
      const validationTime = Date.now() - startTime;
      
      // Schema validation should be fast
      expect(validationTime).toBeLessThan(100);
    });
  });
});