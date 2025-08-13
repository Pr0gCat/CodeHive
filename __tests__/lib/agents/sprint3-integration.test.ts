import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { epicManager } from '@/lib/agents/epic-manager';
import { storyManager } from '@/lib/agents/story-manager';
import { taskExecutor } from '@/lib/agents/task-executor';
import { responseGenerator } from '@/lib/agents/response-generator';
import { phaseManager } from '@/lib/agents/phase-manager';

const prisma = new PrismaClient();

describe('Sprint 3: Project Action Capabilities Integration', () => {
  let testProjectId: string;

  beforeEach(async () => {
    testProjectId = 'test-project-sprint3';
    
    // Clean up before each test
    await prisma.messageAction.deleteMany();
    await prisma.instruction.deleteMany();
    await prisma.task.deleteMany();
    await prisma.story.deleteMany();
    await prisma.epic.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.messageAction.deleteMany();
    await prisma.instruction.deleteMany();
    await prisma.task.deleteMany();
    await prisma.story.deleteMany();
    await prisma.epic.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
  });

  describe('Complete Project Workflow', () => {
    it('should execute complete epic → story → task workflow', async () => {
      // 1. Create Epic
      const epic = await epicManager.createEpic(testProjectId, {
        title: 'User Authentication System',
        description: 'Complete user authentication with login, registration, and profile management',
        businessValue: 'Enable secure user access and personalization',
        acceptanceCriteria: 'Users can register, login, logout, and manage their profiles securely',
        priority: 3,
        phase: 'REQUIREMENTS',
        estimatedEffort: 13,
        createdBy: 'AI_AGENT'
      });

      expect(epic.id).toBeDefined();
      expect(epic.title).toBe('User Authentication System');
      expect(epic.status).toBe('PENDING');

      // 2. Create Story within Epic
      const story = await storyManager.createStory(epic.id, {
        title: 'User Registration',
        userStory: 'As a new user, I want to create an account so that I can access the platform',
        description: 'Implement user registration with email validation',
        acceptanceCriteria: 'Given a new user\nWhen they provide valid registration details\nThen they should receive a confirmation email',
        priority: 3,
        storyPoints: 5,
        iteration: 1
      });

      expect(story.id).toBeDefined();
      expect(story.title).toBe('User Registration');
      expect(story.epicId).toBe(epic.id);
      expect(story.storyPoints).toBe(5);

      // 3. Create Task within Story
      const task = await taskExecutor.createTask(story.id, {
        title: 'Implement Registration Backend',
        description: 'Create API endpoint for user registration',
        type: 'DEV',
        acceptanceCriteria: 'API endpoint accepts user data and creates account',
        expectedOutcome: 'Working registration API with validation',
        priority: 3,
        estimatedTime: 240, // 4 hours
        assignedAgent: 'BACKEND_DEVELOPER'
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Implement Registration Backend');
      expect(task.storyId).toBe(story.id);

      // 4. Add Instructions to Task
      const instructions = await taskExecutor.addInstructions(task.id, [
        {
          directive: 'Create user registration schema',
          expectedOutcome: 'Database schema for users created',
          sequence: 1
        },
        {
          directive: 'Implement registration API endpoint',
          expectedOutcome: 'POST /api/register endpoint working',
          sequence: 2
        },
        {
          directive: 'Add input validation',
          expectedOutcome: 'Email and password validation implemented',
          sequence: 3
        }
      ]);

      expect(instructions).toHaveLength(3);

      // 5. Execute Task
      await taskExecutor.startTask(task.id);
      const executionResults = await taskExecutor.executeTask(task.id);

      expect(executionResults).toHaveLength(3);
      expect(executionResults.every(r => r.result.success)).toBe(true);

      // 6. Verify Task Completion
      const completedTask = await taskExecutor.getTaskById(task.id);
      expect(completedTask.status).toBe('COMPLETED');

      // 7. Verify Story Progress
      const storyProgress = await storyManager.getStoryProgress(story.id);
      expect(storyProgress.overallProgress).toBeGreaterThan(0);

      // 8. Get Epic Summary
      const epicSummary = await epicManager.getEpicSummary(epic.id);
      expect(epicSummary.storyCount).toBe(1);
    });

    it('should handle AI-driven project action creation', async () => {
      // Test AI action execution for creating epics, stories, and tasks
      const epicResult = await responseGenerator.executeAction({
        type: 'CREATE_EPIC',
        data: {
          title: 'E-commerce Shopping Cart',
          description: 'Shopping cart functionality for online store',
          businessValue: 'Enable customers to purchase products',
          priority: 2,
          phase: 'MVP',
          estimatedEffort: 8
        },
        priority: 'HIGH',
        description: 'Create epic for shopping cart functionality'
      }, testProjectId);

      expect(epicResult.status).toBe('SUCCESS');
      expect(epicResult.result.epicId).toBeDefined();

      const epicId = epicResult.result.epicId;

      // Create story via AI action
      const storyResult = await responseGenerator.executeAction({
        type: 'CREATE_STORY',
        data: {
          epicId,
          title: 'Add to Cart',
          userRole: 'customer',
          feature: 'add products to shopping cart',
          benefit: 'I can purchase multiple items together',
          complexity: 'moderate',
          uncertainty: 'low',
          effort: 'medium'
        },
        priority: 'MEDIUM',
        description: 'Create story for add to cart functionality'
      }, testProjectId);

      expect(storyResult.status).toBe('SUCCESS');
      expect(storyResult.result.storyId).toBeDefined();

      const storyId = storyResult.result.storyId;

      // Create task via AI action
      const taskResult = await responseGenerator.executeAction({
        type: 'CREATE_TASK',
        data: {
          storyId,
          title: 'Implement Cart API',
          type: 'DEV',
          estimatedTime: 180,
          instructions: [
            'Create cart data model',
            'Implement add to cart endpoint',
            'Add cart persistence'
          ]
        },
        priority: 'HIGH',
        description: 'Create task for cart API implementation'
      }, testProjectId);

      expect(taskResult.status).toBe('SUCCESS');
      expect(taskResult.result.taskId).toBeDefined();
      expect(taskResult.result.instructionCount).toBe(3);
    });
  });

  describe('Phase Transition Integration', () => {
    it('should manage project phase transitions', async () => {
      // 1. Create initial project structure
      const epic = await epicManager.createEpic(testProjectId, {
        title: 'Core Platform Features',
        businessValue: 'Essential platform functionality',
        phase: 'REQUIREMENTS',
        priority: 3
      });

      const story = await storyManager.createStory(epic.id, {
        title: 'User Dashboard',
        acceptanceCriteria: 'Dashboard shows user information and navigation',
        storyPoints: 3
      });

      // Create conversation to establish requirements phase
      const conversation = await prisma.conversation.create({
        data: {
          projectId: testProjectId,
          phase: 'REQUIREMENTS',
          title: 'Requirements Discussion',
          messageCount: 5
        }
      });

      // Mark conversation as completed to meet transition criteria
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: 'COMPLETED' }
      });

      // 2. Check phase readiness
      const readiness = await phaseManager.checkPhaseReadiness(testProjectId, 'MVP');
      expect(readiness.readinessScore).toBeGreaterThan(0);

      // 3. Get project phase status
      const phaseStatus = await phaseManager.getProjectPhaseStatus(testProjectId);
      expect(phaseStatus.currentPhase).toBe('REQUIREMENTS');
      expect(phaseStatus.readinessForNext.nextPhase).toBe('MVP');

      // 4. Execute phase transition if ready
      if (readiness.canTransition) {
        const transitionResult = await phaseManager.transitionPhase(
          testProjectId,
          'REQUIREMENTS',
          'MVP'
        );

        expect(transitionResult.success).toBe(true);
        expect(transitionResult.fromPhase).toBe('REQUIREMENTS');
        expect(transitionResult.toPhase).toBe('MVP');
      }

      // 5. Verify epic was started during transition
      const updatedEpic = await epicManager.getEpicById(epic.id);
      if (readiness.canTransition) {
        expect(updatedEpic.status).toBe('IN_PROGRESS');
        expect(updatedEpic.phase).toBe('MVP');
      }
    });

    it('should handle phase transition through AI actions', async () => {
      // Set up project for phase transition
      await epicManager.createEpic(testProjectId, {
        title: 'MVP Features',
        businessValue: 'Core MVP functionality',
        acceptanceCriteria: 'Essential features for product launch'
      });

      const conversation = await prisma.conversation.create({
        data: {
          projectId: testProjectId,
          phase: 'REQUIREMENTS',
          status: 'COMPLETED',
          messageCount: 10
        }
      });

      // Execute phase transition via AI action
      const phaseTransitionResult = await responseGenerator.executeAction({
        type: 'UPDATE_PHASE',
        data: {
          fromPhase: 'REQUIREMENTS',
          toPhase: 'MVP',
          force: false
        },
        priority: 'HIGH',
        description: 'Transition project to MVP phase'
      }, testProjectId);

      if (phaseTransitionResult.status === 'SUCCESS') {
        expect(phaseTransitionResult.result.fromPhase).toBe('REQUIREMENTS');
        expect(phaseTransitionResult.result.toPhase).toBe('MVP');
        expect(phaseTransitionResult.result.readinessScore).toBeGreaterThanOrEqual(0);
      } else {
        // If transition failed, should provide clear feedback
        expect(phaseTransitionResult.result.blockers).toBeDefined();
        expect(phaseTransitionResult.result.recommendations).toBeDefined();
      }
    });
  });

  describe('ATDD Cycle Integration', () => {
    it('should execute complete ATDD cycle', async () => {
      // 1. Set up project structure
      const epic = await epicManager.createEpic(testProjectId, {
        title: 'API Development',
        businessValue: 'Reliable API for client applications'
      });

      const story = await storyManager.createStory(epic.id, {
        title: 'User API Endpoint',
        acceptanceCriteria: 'API returns user data in JSON format'
      });

      const task = await taskExecutor.createTask(story.id, {
        title: 'Build User API',
        type: 'DEV',
        acceptanceCriteria: 'GET /api/users returns valid JSON response'
      });

      await taskExecutor.addInstructions(task.id, [
        {
          directive: 'Create API route',
          expectedOutcome: 'Route handles GET /api/users',
          sequence: 1
        },
        {
          directive: 'Implement data fetching',
          expectedOutcome: 'Retrieves user data from database',
          sequence: 2
        }
      ]);

      // 2. Execute ATDD cycle through AI action
      const atddResult = await responseGenerator.executeAction({
        type: 'RUN_ATDD_CYCLE',
        data: {
          taskId: task.id,
          conversationId: 'test-conversation'
        },
        priority: 'HIGH',
        description: 'Execute ATDD cycle for user API task'
      }, testProjectId);

      expect(atddResult.status).toBeDefined();
      expect(atddResult.result.taskId).toBe(task.id);
      expect(atddResult.result.cycleId).toBe(`atdd-${task.id}`);
      
      if (atddResult.status === 'SUCCESS') {
        expect(atddResult.result.completedPhases).toBeGreaterThan(0);
        expect(atddResult.result.overallStatus).toBeDefined();
      }

      // 3. Verify task execution
      const updatedTask = await taskExecutor.getTaskById(task.id);
      expect(updatedTask.status).toBe('COMPLETED');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle creation failures gracefully', async () => {
      // Test epic creation with invalid data
      await expect(epicManager.createEpic('invalid-project-id', {
        title: '', // Invalid: empty title
        businessValue: 'Test value'
      })).rejects.toThrow();

      // Test story creation without epic
      await expect(storyManager.createStory('invalid-epic-id', {
        title: 'Test Story'
      })).rejects.toThrow();

      // Test task creation without story
      await expect(taskExecutor.createTask('invalid-story-id', {
        title: 'Test Task',
        type: 'DEV'
      })).rejects.toThrow();
    });

    it('should handle dependency violations', async () => {
      const epic = await epicManager.createEpic(testProjectId, {
        title: 'Test Epic',
        businessValue: 'Test value'
      });

      const story = await storyManager.createStory(epic.id, {
        title: 'Test Story'
      });

      const task1 = await taskExecutor.createTask(story.id, {
        title: 'Task 1',
        type: 'DEV'
      });

      const task2 = await taskExecutor.createTask(story.id, {
        title: 'Task 2',
        type: 'TEST'
      });

      // Create dependency: task2 depends on task1
      await taskExecutor.createTaskDependency(task2.id, task1.id);

      // Try to start task2 without completing task1 - should fail
      await expect(taskExecutor.startTask(task2.id)).rejects.toThrow();

      // Complete task1 first
      await taskExecutor.startTask(task1.id);
      await taskExecutor.executeTask(task1.id);

      // Now task2 should be startable
      await expect(taskExecutor.startTask(task2.id)).resolves.toBeDefined();
    });
  });

  describe('Performance and Metrics', () => {
    it('should track project metrics correctly', async () => {
      // Create comprehensive project structure
      const epic1 = await epicManager.createEpic(testProjectId, {
        title: 'Feature Set A',
        businessValue: 'Core features'
      });

      const epic2 = await epicManager.createEpic(testProjectId, {
        title: 'Feature Set B',
        businessValue: 'Additional features'
      });

      // Create stories
      const story1 = await storyManager.createStory(epic1.id, {
        title: 'Story 1',
        storyPoints: 5
      });

      const story2 = await storyManager.createStory(epic1.id, {
        title: 'Story 2',
        storyPoints: 3
      });

      const story3 = await storyManager.createStory(epic2.id, {
        title: 'Story 3',
        storyPoints: 8
      });

      // Complete story1
      await storyManager.updateStory(story1.id, { status: 'COMPLETED' });

      // Get project metrics
      const metrics = await epicManager.getProjectEpicMetrics(testProjectId);

      expect(metrics.totalEpics).toBe(2);
      expect(metrics.totalStoryPoints).toBe(16); // 5 + 3 + 8
      expect(metrics.completedStoryPoints).toBe(5); // only story1
      expect(metrics.progressPercentage).toBeCloseTo(31, 0); // 5/16 ≈ 31%

      // Test epic summary
      const epic1Summary = await epicManager.getEpicSummary(epic1.id);
      expect(epic1Summary.storyCount).toBe(2);
      expect(epic1Summary.completedStories).toBe(1);
      expect(epic1Summary.progressPercentage).toBe(50); // 1/2 stories completed
    });
  });
});

// Additional integration test for response generation workflow
describe('AI Response Integration', () => {
  let testProjectId: string;
  let testConversationId: string;

  beforeEach(async () => {
    testProjectId = 'test-project-ai-integration';
    
    await prisma.messageAction.deleteMany();
    await prisma.instruction.deleteMany();
    await prisma.task.deleteMany();
    await prisma.story.deleteMany();
    await prisma.epic.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();

    const conversation = await prisma.conversation.create({
      data: {
        projectId: testProjectId,
        phase: 'REQUIREMENTS',
        title: 'AI Integration Test'
      }
    });
    testConversationId = conversation.id;
  });

  afterEach(async () => {
    await prisma.messageAction.deleteMany();
    await prisma.instruction.deleteMany();
    await prisma.task.deleteMany();
    await prisma.story.deleteMany();
    await prisma.epic.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
  });

  it('should generate complete project structure through AI', async () => {
    // Simulate AI generating a complete project response
    const generationResult = await responseGenerator.generateResponse({
      projectId: testProjectId,
      conversationId: testConversationId,
      userMessage: '我想創建一個任務管理應用程式',
      phase: 'REQUIREMENTS'
    });

    expect(generationResult.response).toBeDefined();
    expect(generationResult.messageId).toBeDefined();
    expect(generationResult.metrics.totalTime).toBeGreaterThan(0);

    // Verify message was saved
    const savedMessage = await prisma.message.findUnique({
      where: { id: generationResult.messageId }
    });

    expect(savedMessage).toBeDefined();
    expect(savedMessage?.role).toBe('AGENT');
    expect(savedMessage?.conversationId).toBe(testConversationId);
  });
});