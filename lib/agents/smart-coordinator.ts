/**
 * 智能代理協調器
 * 提供更智能的 AI 代理管理和任務分配
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { HierarchyManager } from '@/lib/models/hierarchy-manager';
import { HierarchyIntegration } from '@/lib/agents/hierarchy-integration';
import { ProjectAgent, ProjectPhase } from '@/lib/agents/project-agent';
import { hierarchyBroadcaster } from '@/lib/socket/server';
import { ModelStatus, Priority } from '@/lib/models/types';

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  taskTypes: string[]; // DEV, TEST, REVIEW, DEPLOY, DOCUMENT
  maxConcurrentTasks: number;
  avgExecutionTime: number; // 毫秒
  successRate: number; // 0-1
  specializations: string[]; // Frontend, Backend, Testing, DevOps
}

export interface AgentInstance {
  id: string;
  capabilityId: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTaskId?: string;
  currentInstructionId?: string;
  startedAt?: Date;
  lastHeartbeat: Date;
  performance: {
    tasksCompleted: number;
    taskssFailed: number;
    avgExecutionTime: number;
    totalTokenUsage: number;
  };
}

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: Date;
  estimatedCompletion: Date;
  priority: Priority;
  status: 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
}

export interface CoordinationStrategy {
  name: string;
  description: string;
  execute: (context: CoordinationContext) => Promise<CoordinationResult>;
}

export interface CoordinationContext {
  projectId: string;
  epicId?: string;
  availableAgents: AgentInstance[];
  pendingTasks: any[];
  currentLoad: Record<string, number>; // agentId -> current task count
  projectRequirements: {
    urgency: 'low' | 'medium' | 'high' | 'critical';
    skillsRequired: string[];
    deadline?: Date;
    budget?: {
      maxTokens: number;
      costPerToken: number;
    };
  };
}

export interface CoordinationResult {
  assignments: TaskAssignment[];
  estimatedCompletion: Date;
  estimatedCost: number;
  confidence: number; // 0-1
  recommendations: string[];
  warnings: string[];
}

export class SmartCoordinator extends EventEmitter {
  private agents: Map<string, AgentInstance> = new Map();
  private capabilities: Map<string, AgentCapability> = new Map();
  private assignments: Map<string, TaskAssignment> = new Map();
  private strategies: Map<string, CoordinationStrategy> = new Map();

  constructor(
    private prisma: PrismaClient,
    private hierarchyManager: HierarchyManager
  ) {
    super();
    this.initializeDefaultCapabilities();
    this.initializeStrategies();
    this.startHealthMonitoring();
  }

  /**
   * 初始化預設代理能力
   */
  private initializeDefaultCapabilities() {
    const defaultCapabilities: AgentCapability[] = [
      {
        id: 'claude-frontend',
        name: 'Claude Frontend Developer',
        description: 'Expert in React, TypeScript, and modern frontend technologies',
        taskTypes: ['DEV', 'REVIEW', 'DOCUMENT'],
        maxConcurrentTasks: 3,
        avgExecutionTime: 120000, // 2 分鐘
        successRate: 0.85,
        specializations: ['Frontend', 'React', 'TypeScript', 'UI/UX']
      },
      {
        id: 'claude-backend',
        name: 'Claude Backend Developer',
        description: 'Expert in Node.js, databases, and API development',
        taskTypes: ['DEV', 'REVIEW', 'TEST'],
        maxConcurrentTasks: 2,
        avgExecutionTime: 180000, // 3 分鐘
        successRate: 0.88,
        specializations: ['Backend', 'API', 'Database', 'Node.js']
      },
      {
        id: 'claude-tester',
        name: 'Claude Test Engineer',
        description: 'Specialized in writing and running tests',
        taskTypes: ['TEST', 'REVIEW'],
        maxConcurrentTasks: 4,
        avgExecutionTime: 90000, // 1.5 分鐘
        successRate: 0.92,
        specializations: ['Testing', 'QA', 'Automation']
      },
      {
        id: 'claude-devops',
        name: 'Claude DevOps Engineer',
        description: 'Expert in deployment and infrastructure',
        taskTypes: ['DEPLOY', 'REVIEW'],
        maxConcurrentTasks: 2,
        avgExecutionTime: 240000, // 4 分鐘
        successRate: 0.82,
        specializations: ['DevOps', 'CI/CD', 'Infrastructure']
      }
    ];

    defaultCapabilities.forEach(cap => {
      this.capabilities.set(cap.id, cap);
    });
  }

  /**
   * 初始化協調策略
   */
  private initializeStrategies() {
    // 負載平衡策略
    this.strategies.set('load-balanced', {
      name: 'Load Balanced',
      description: '根據當前負載平衡分配任務',
      execute: async (context) => this.executeLoadBalancedStrategy(context)
    });

    // 技能匹配策略
    this.strategies.set('skill-matched', {
      name: 'Skill Matched',
      description: '根據技能需求匹配最適合的代理',
      execute: async (context) => this.executeSkillMatchedStrategy(context)
    });

    // 緊急優先策略
    this.strategies.set('priority-first', {
      name: 'Priority First',
      description: '優先處理高優先級任務',
      execute: async (context) => this.executePriorityFirstStrategy(context)
    });

    // 成本最優策略
    this.strategies.set('cost-optimized', {
      name: 'Cost Optimized',
      description: '在預算限制下最優化任務分配',
      execute: async (context) => this.executeCostOptimizedStrategy(context)
    });
  }

  /**
   * 啟動健康監控
   */
  private startHealthMonitoring() {
    setInterval(() => {
      this.monitorAgentHealth();
    }, 30000); // 每30秒檢查一次
  }

  /**
   * 監控代理健康狀態
   */
  private monitorAgentHealth() {
    const now = new Date();
    
    this.agents.forEach((agent, agentId) => {
      const timeSinceHeartbeat = now.getTime() - agent.lastHeartbeat.getTime();
      
      // 超過 2 分鐘沒有心跳，標記為離線
      if (timeSinceHeartbeat > 120000) {
        agent.status = 'offline';
        this.emit('agent:offline', { agentId, agent });
        
        // 廣播代理狀態變更
        hierarchyBroadcaster.sendSystemNotification(
          'warning',
          `代理 ${agentId} 離線`,
          `project:${agent.currentTaskId ? 'unknown' : 'system'}`
        );
      }
    });
  }

  /**
   * 註冊新代理實例
   */
  async registerAgent(capabilityId: string): Promise<string> {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      throw new Error(`Unknown capability: ${capabilityId}`);
    }

    const agentId = `${capabilityId}-${Date.now()}`;
    const agent: AgentInstance = {
      id: agentId,
      capabilityId,
      status: 'idle',
      lastHeartbeat: new Date(),
      performance: {
        tasksCompleted: 0,
        taskssFailed: 0,
        avgExecutionTime: capability.avgExecutionTime,
        totalTokenUsage: 0
      }
    };

    this.agents.set(agentId, agent);
    this.emit('agent:registered', { agentId, agent });

    return agentId;
  }

  /**
   * 代理心跳
   */
  updateAgentHeartbeat(agentId: string, status?: 'idle' | 'busy' | 'error') {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = new Date();
      if (status) {
        agent.status = status;
      }
    }
  }

  /**
   * 協調任務執行
   */
  async coordinateExecution(
    projectId: string,
    strategy: string = 'skill-matched',
    options: {
      epicId?: string;
      maxParallelTasks?: number;
      urgency?: 'low' | 'medium' | 'high' | 'critical';
      budget?: { maxTokens: number; costPerToken: number };
    } = {}
  ): Promise<CoordinationResult> {
    
    // 1. 獲取待執行任務
    const pendingTasks = await this.getPendingTasks(projectId, options.epicId);
    
    // 2. 獲取可用代理
    const availableAgents = Array.from(this.agents.values()).filter(
      agent => agent.status === 'idle' || 
      (agent.status === 'busy' && this.canAcceptMoreTasks(agent))
    );

    // 3. 構建協調上下文
    const context: CoordinationContext = {
      projectId,
      epicId: options.epicId,
      availableAgents,
      pendingTasks,
      currentLoad: this.calculateCurrentLoad(),
      projectRequirements: {
        urgency: options.urgency || 'medium',
        skillsRequired: this.extractRequiredSkills(pendingTasks),
        budget: options.budget
      }
    };

    // 4. 執行協調策略
    const strategyExecutor = this.strategies.get(strategy);
    if (!strategyExecutor) {
      throw new Error(`Unknown strategy: ${strategy}`);
    }

    const result = await strategyExecutor.execute(context);

    // 5. 應用分配結果
    await this.applyAssignments(result.assignments);

    // 6. 發送通知
    this.emit('coordination:completed', { projectId, result });
    hierarchyBroadcaster.sendSystemNotification(
      'info',
      `任務協調完成，分配了 ${result.assignments.length} 個任務`,
      `project:${projectId}`
    );

    return result;
  }

  /**
   * 獲取待執行任務
   */
  private async getPendingTasks(projectId: string, epicId?: string) {
    const filter: any = {
      status: ModelStatus.PENDING
    };

    if (epicId) {
      // 獲取特定 Epic 下的任務
      return await this.hierarchyManager.listTasks({
        story: {
          epicId
        }
      });
    } else {
      // 獲取整個專案的任務
      const epics = await this.hierarchyManager.listEpics({ projectId });
      const allTasks = [];
      
      for (const epic of epics) {
        const stories = await this.hierarchyManager.listStories({ epicId: epic.id });
        for (const story of stories) {
          const tasks = await this.hierarchyManager.listTasks({ storyId: story.id });
          allTasks.push(...tasks.filter(task => task.status === ModelStatus.PENDING));
        }
      }
      
      return allTasks;
    }
  }

  /**
   * 檢查代理是否可以接受更多任務
   */
  private canAcceptMoreTasks(agent: AgentInstance): boolean {
    const capability = this.capabilities.get(agent.capabilityId);
    if (!capability) return false;

    const currentTaskCount = this.getCurrentTaskCount(agent.id);
    return currentTaskCount < capability.maxConcurrentTasks;
  }

  /**
   * 獲取代理當前任務數量
   */
  private getCurrentTaskCount(agentId: string): number {
    return Array.from(this.assignments.values()).filter(
      assignment => assignment.agentId === agentId && 
      ['assigned', 'in_progress'].includes(assignment.status)
    ).length;
  }

  /**
   * 計算當前負載
   */
  private calculateCurrentLoad(): Record<string, number> {
    const load: Record<string, number> = {};
    
    this.agents.forEach((agent, agentId) => {
      load[agentId] = this.getCurrentTaskCount(agentId);
    });

    return load;
  }

  /**
   * 提取所需技能
   */
  private extractRequiredSkills(tasks: any[]): string[] {
    const skills = new Set<string>();
    
    tasks.forEach(task => {
      // 根據任務類型推斷需要的技能
      switch (task.type) {
        case 'DEV':
          skills.add('Development');
          break;
        case 'TEST':
          skills.add('Testing');
          break;
        case 'REVIEW':
          skills.add('Code Review');
          break;
        case 'DEPLOY':
          skills.add('DevOps');
          break;
        case 'DOCUMENT':
          skills.add('Documentation');
          break;
      }
    });

    return Array.from(skills);
  }

  /**
   * 執行負載平衡策略
   */
  private async executeLoadBalancedStrategy(context: CoordinationContext): Promise<CoordinationResult> {
    const assignments: TaskAssignment[] = [];
    const warnings: string[] = [];
    
    // 按負載排序代理
    const sortedAgents = context.availableAgents.sort(
      (a, b) => context.currentLoad[a.id] - context.currentLoad[b.id]
    );

    for (const task of context.pendingTasks) {
      const suitableAgent = sortedAgents.find(agent => {
        const capability = this.capabilities.get(agent.capabilityId);
        return capability?.taskTypes.includes(task.type) && this.canAcceptMoreTasks(agent);
      });

      if (suitableAgent) {
        const capability = this.capabilities.get(suitableAgent.capabilityId)!;
        const assignment: TaskAssignment = {
          taskId: task.id,
          agentId: suitableAgent.id,
          assignedAt: new Date(),
          estimatedCompletion: new Date(Date.now() + capability.avgExecutionTime),
          priority: task.priority,
          status: 'assigned'
        };

        assignments.push(assignment);
        context.currentLoad[suitableAgent.id]++;
      } else {
        warnings.push(`無法為任務 ${task.id} 找到合適的代理`);
      }
    }

    return {
      assignments,
      estimatedCompletion: this.calculateOverallCompletion(assignments),
      estimatedCost: this.calculateEstimatedCost(assignments),
      confidence: assignments.length / context.pendingTasks.length,
      recommendations: ['考慮增加更多代理實例以提高處理能力'],
      warnings
    };
  }

  /**
   * 執行技能匹配策略
   */
  private async executeSkillMatchedStrategy(context: CoordinationContext): Promise<CoordinationResult> {
    const assignments: TaskAssignment[] = [];
    const warnings: string[] = [];

    for (const task of context.pendingTasks) {
      // 找出最適合的代理
      const suitableAgents = context.availableAgents.filter(agent => {
        const capability = this.capabilities.get(agent.capabilityId);
        return capability?.taskTypes.includes(task.type) && this.canAcceptMoreTasks(agent);
      });

      // 按成功率和平均執行時間排序
      const bestAgent = suitableAgents.sort((a, b) => {
        const capA = this.capabilities.get(a.capabilityId)!;
        const capB = this.capabilities.get(b.capabilityId)!;
        
        // 綜合評分：成功率權重 0.7，速度權重 0.3
        const scoreA = capA.successRate * 0.7 + (1 - capA.avgExecutionTime / 300000) * 0.3;
        const scoreB = capB.successRate * 0.7 + (1 - capB.avgExecutionTime / 300000) * 0.3;
        
        return scoreB - scoreA;
      })[0];

      if (bestAgent) {
        const capability = this.capabilities.get(bestAgent.capabilityId)!;
        const assignment: TaskAssignment = {
          taskId: task.id,
          agentId: bestAgent.id,
          assignedAt: new Date(),
          estimatedCompletion: new Date(Date.now() + capability.avgExecutionTime),
          priority: task.priority,
          status: 'assigned'
        };

        assignments.push(assignment);
        context.currentLoad[bestAgent.id]++;
      } else {
        warnings.push(`無法為任務 ${task.id} (類型: ${task.type}) 找到合適的代理`);
      }
    }

    return {
      assignments,
      estimatedCompletion: this.calculateOverallCompletion(assignments),
      estimatedCost: this.calculateEstimatedCost(assignments),
      confidence: assignments.length / context.pendingTasks.length,
      recommendations: this.generateSkillMatchRecommendations(context, assignments),
      warnings
    };
  }

  /**
   * 執行優先級策略
   */
  private async executePriorityFirstStrategy(context: CoordinationContext): Promise<CoordinationResult> {
    const assignments: TaskAssignment[] = [];
    const warnings: string[] = [];

    // 按優先級排序任務
    const sortedTasks = context.pendingTasks.sort((a, b) => b.priority - a.priority);

    for (const task of sortedTasks) {
      const suitableAgents = context.availableAgents.filter(agent => {
        const capability = this.capabilities.get(agent.capabilityId);
        return capability?.taskTypes.includes(task.type) && this.canAcceptMoreTasks(agent);
      });

      if (suitableAgents.length > 0) {
        // 對於高優先級任務，選擇最好的代理
        const bestAgent = task.priority >= Priority.HIGH 
          ? this.selectBestAgent(suitableAgents)
          : suitableAgents[0];

        const capability = this.capabilities.get(bestAgent.capabilityId)!;
        const assignment: TaskAssignment = {
          taskId: task.id,
          agentId: bestAgent.id,
          assignedAt: new Date(),
          estimatedCompletion: new Date(Date.now() + capability.avgExecutionTime),
          priority: task.priority,
          status: 'assigned'
        };

        assignments.push(assignment);
        context.currentLoad[bestAgent.id]++;
      } else {
        warnings.push(`高優先級任務 ${task.id} 無法分配`);
      }
    }

    return {
      assignments,
      estimatedCompletion: this.calculateOverallCompletion(assignments),
      estimatedCost: this.calculateEstimatedCost(assignments),
      confidence: assignments.length / context.pendingTasks.length,
      recommendations: ['高優先級任務已優先分配'],
      warnings
    };
  }

  /**
   * 執行成本最優策略
   */
  private async executeCostOptimizedStrategy(context: CoordinationContext): Promise<CoordinationResult> {
    const assignments: TaskAssignment[] = [];
    const warnings: string[] = [];
    let totalCost = 0;

    const budget = context.projectRequirements.budget;
    if (!budget) {
      return this.executeLoadBalancedStrategy(context);
    }

    for (const task of context.pendingTasks) {
      const suitableAgents = context.availableAgents.filter(agent => {
        const capability = this.capabilities.get(agent.capabilityId);
        return capability?.taskTypes.includes(task.type) && this.canAcceptMoreTasks(agent);
      });

      // 按成本效益排序（成功率 / 平均執行時間）
      const costEffectiveAgent = suitableAgents.sort((a, b) => {
        const capA = this.capabilities.get(a.capabilityId)!;
        const capB = this.capabilities.get(b.capabilityId)!;
        
        const costEffectivenessA = capA.successRate / (capA.avgExecutionTime / 1000);
        const costEffectivenessB = capB.successRate / (capB.avgExecutionTime / 1000);
        
        return costEffectivenessB - costEffectivenessA;
      })[0];

      if (costEffectiveAgent) {
        const capability = this.capabilities.get(costEffectiveAgent.capabilityId)!;
        const estimatedTokens = capability.avgExecutionTime / 1000 * 10; // 估計每秒10個token
        const taskCost = estimatedTokens * budget.costPerToken;

        if (totalCost + taskCost <= budget.maxTokens * budget.costPerToken) {
          const assignment: TaskAssignment = {
            taskId: task.id,
            agentId: costEffectiveAgent.id,
            assignedAt: new Date(),
            estimatedCompletion: new Date(Date.now() + capability.avgExecutionTime),
            priority: task.priority,
            status: 'assigned'
          };

          assignments.push(assignment);
          totalCost += taskCost;
          context.currentLoad[costEffectiveAgent.id]++;
        } else {
          warnings.push(`任務 ${task.id} 超出預算限制`);
        }
      }
    }

    return {
      assignments,
      estimatedCompletion: this.calculateOverallCompletion(assignments),
      estimatedCost: totalCost,
      confidence: assignments.length / context.pendingTasks.length,
      recommendations: [`預算使用: ${(totalCost / (budget.maxTokens * budget.costPerToken) * 100).toFixed(1)}%`],
      warnings
    };
  }

  /**
   * 選擇最佳代理
   */
  private selectBestAgent(agents: AgentInstance[]): AgentInstance {
    return agents.sort((a, b) => {
      const capA = this.capabilities.get(a.capabilityId)!;
      const capB = this.capabilities.get(b.capabilityId)!;
      
      // 綜合評分
      const scoreA = capA.successRate * 0.6 + 
                     (1 - capA.avgExecutionTime / 300000) * 0.4;
      const scoreB = capB.successRate * 0.6 + 
                     (1 - capB.avgExecutionTime / 300000) * 0.4;
      
      return scoreB - scoreA;
    })[0];
  }

  /**
   * 計算總體完成時間
   */
  private calculateOverallCompletion(assignments: TaskAssignment[]): Date {
    if (assignments.length === 0) {
      return new Date();
    }

    const completionTimes = assignments.map(a => a.estimatedCompletion.getTime());
    return new Date(Math.max(...completionTimes));
  }

  /**
   * 計算估計成本
   */
  private calculateEstimatedCost(assignments: TaskAssignment[]): number {
    return assignments.reduce((total, assignment) => {
      const agent = this.agents.get(assignment.agentId);
      if (agent) {
        const capability = this.capabilities.get(agent.capabilityId);
        if (capability) {
          // 簡單的成本計算：執行時間 * 基礎費率
          return total + (capability.avgExecutionTime / 1000) * 0.01;
        }
      }
      return total;
    }, 0);
  }

  /**
   * 生成技能匹配建議
   */
  private generateSkillMatchRecommendations(
    context: CoordinationContext, 
    assignments: TaskAssignment[]
  ): string[] {
    const recommendations: string[] = [];
    
    const unassignedTasks = context.pendingTasks.length - assignments.length;
    if (unassignedTasks > 0) {
      recommendations.push(`有 ${unassignedTasks} 個任務無法分配，考慮增加相應技能的代理`);
    }

    // 分析任務類型分佈
    const taskTypeCount: Record<string, number> = {};
    context.pendingTasks.forEach(task => {
      taskTypeCount[task.type] = (taskTypeCount[task.type] || 0) + 1;
    });

    Object.entries(taskTypeCount).forEach(([type, count]) => {
      const availableAgents = context.availableAgents.filter(agent => {
        const capability = this.capabilities.get(agent.capabilityId);
        return capability?.taskTypes.includes(type);
      }).length;

      if (count > availableAgents * 2) {
        recommendations.push(`${type} 類型任務較多，建議增加相應代理`);
      }
    });

    return recommendations;
  }

  /**
   * 應用任務分配
   */
  private async applyAssignments(assignments: TaskAssignment[]) {
    for (const assignment of assignments) {
      this.assignments.set(assignment.taskId, assignment);
      
      // 更新代理狀態
      const agent = this.agents.get(assignment.agentId);
      if (agent) {
        agent.status = 'busy';
        agent.currentTaskId = assignment.taskId;
      }

      // 開始執行任務
      this.executeAssignment(assignment);
    }
  }

  /**
   * 執行任務分配
   */
  private async executeAssignment(assignment: TaskAssignment) {
    try {
      assignment.status = 'in_progress';
      this.emit('assignment:started', assignment);

      // 這裡會整合實際的任務執行邏輯
      // 目前先模擬執行過程
      
      const agent = this.agents.get(assignment.agentId)!;
      const capability = this.capabilities.get(agent.capabilityId)!;
      
      // 模擬執行時間
      setTimeout(async () => {
        // 模擬成功/失敗
        const success = Math.random() < capability.successRate;
        
        if (success) {
          assignment.status = 'completed';
          agent.performance.tasksCompleted++;
          this.emit('assignment:completed', assignment);
          
          // 更新任務狀態
          await this.hierarchyManager.updateTask(assignment.taskId, {
            status: ModelStatus.COMPLETED
          });
        } else {
          assignment.status = 'failed';
          agent.performance.taskssFailed++;
          this.emit('assignment:failed', assignment);
          
          // 更新任務狀態
          await this.hierarchyManager.updateTask(assignment.taskId, {
            status: ModelStatus.FAILED
          });
        }
        
        // 釋放代理
        agent.status = 'idle';
        agent.currentTaskId = undefined;
        
      }, capability.avgExecutionTime);
      
    } catch (error) {
      assignment.status = 'failed';
      this.emit('assignment:error', { assignment, error });
    }
  }

  /**
   * 獲取協調統計
   */
  getCoordinationStats(): {
    totalAgents: number;
    activeAgents: number;
    totalAssignments: number;
    completedAssignments: number;
    failedAssignments: number;
    avgExecutionTime: number;
  } {
    const activeAgents = Array.from(this.agents.values()).filter(
      agent => agent.status !== 'offline'
    ).length;

    const assignments = Array.from(this.assignments.values());
    const completedAssignments = assignments.filter(a => a.status === 'completed').length;
    const failedAssignments = assignments.filter(a => a.status === 'failed').length;

    const totalExecutionTime = Array.from(this.agents.values()).reduce(
      (total, agent) => total + agent.performance.avgExecutionTime, 0
    );
    const avgExecutionTime = this.agents.size > 0 ? totalExecutionTime / this.agents.size : 0;

    return {
      totalAgents: this.agents.size,
      activeAgents,
      totalAssignments: assignments.length,
      completedAssignments,
      failedAssignments,
      avgExecutionTime
    };
  }
}