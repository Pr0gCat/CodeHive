/**
 * 指令執行器 - 負責執行由 ProjectAgent 生成的指令
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ModelStatus, type Instruction } from '../models/types';

/**
 * 執行結果
 */
export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  tokenUsage?: number;
  executionTime: number;
  exitCode?: number;
}

/**
 * 執行器配置
 */
export interface ExecutorConfig {
  workingDirectory: string;
  timeout: number; // milliseconds
  maxRetries: number;
  logExecution: boolean;
}

/**
 * 執行環境
 */
export interface ExecutionEnvironment {
  env: Record<string, string>;
  cwd: string;
  timeout: number;
}

/**
 * Claude Code 執行器 - 專門執行 Claude Code 指令
 */
export class ClaudeCodeExecutor extends EventEmitter {
  private config: ExecutorConfig;
  private activeExecutions: Map<string, ChildProcess> = new Map();
  private executionLogs: Map<string, string[]> = new Map();

  constructor(config: ExecutorConfig) {
    super();
    this.config = config;
  }

  /**
   * 執行單一指令
   */
  async executeInstruction(instruction: Instruction): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = `exec-${startTime}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.emit('execution:started', {
      instructionId: instruction.id,
      executionId,
      directive: instruction.directive
    });

    try {
      // 構建 Claude Code 指令
      const claudeCommand = this.buildClaudeCommand(instruction);
      
      // 執行指令
      const result = await this.executeClaudeCommand(
        executionId,
        claudeCommand,
        instruction
      );
      
      const executionTime = Date.now() - startTime;
      
      const executionResult: ExecutionResult = {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr,
        executionTime,
        exitCode: result.exitCode
      };

      this.emit('execution:completed', {
        instructionId: instruction.id,
        executionId,
        result: executionResult
      });

      return executionResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const executionResult: ExecutionResult = {
        success: false,
        error: errorMessage,
        executionTime
      };

      this.emit('execution:failed', {
        instructionId: instruction.id,
        executionId,
        error: errorMessage,
        result: executionResult
      });

      return executionResult;
    }
  }

  /**
   * 構建 Claude Code 指令
   */
  private buildClaudeCommand(instruction: Instruction): string {
    // 建立詳細的 prompt 給 Claude Code
    const prompt = `
執行以下任務：

${instruction.directive}

預期結果：
${instruction.expectedOutcome}

${instruction.validationCriteria ? `驗證標準：\n${instruction.validationCriteria}` : ''}

請按照以下步驟執行：
1. 分析任務需求
2. 執行必要的操作
3. 驗證結果是否符合預期
4. 提供執行摘要

請確保所有操作都是安全的，並且符合最佳實踐。
`;

    return prompt.trim();
  }

  /**
   * 執行 Claude Code 指令
   */
  private executeClaudeCommand(
    executionId: string,
    command: string,
    instruction: Instruction
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const env: ExecutionEnvironment = {
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
          CLAUDE_PROJECT_ID: instruction.taskId,
          CLAUDE_INSTRUCTION_ID: instruction.id
        },
        cwd: this.config.workingDirectory,
        timeout: this.config.timeout
      };

      // 使用 claude 指令執行
      const claudeProcess = spawn('claude', [command], {
        cwd: env.cwd,
        env: env.env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.activeExecutions.set(executionId, claudeProcess);
      
      let stdout = '';
      let stderr = '';
      const logs: string[] = [];

      // 設定超時處理
      const timeoutId = setTimeout(() => {
        claudeProcess.kill('SIGTERM');
        reject(new Error(`Execution timeout after ${this.config.timeout}ms`));
      }, env.timeout);

      claudeProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        logs.push(`[STDOUT] ${output}`);
        
        this.emit('execution:output', {
          executionId,
          instructionId: instruction.id,
          type: 'stdout',
          data: output
        });
      });

      claudeProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        logs.push(`[STDERR] ${output}`);
        
        this.emit('execution:output', {
          executionId,
          instructionId: instruction.id,
          type: 'stderr',
          data: output
        });
      });

      claudeProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        this.activeExecutions.delete(executionId);
        
        if (this.config.logExecution) {
          this.executionLogs.set(executionId, logs);
        }
        
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      claudeProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        this.activeExecutions.delete(executionId);
        reject(error);
      });

      // 寫入指令到 stdin
      claudeProcess.stdin?.write(command);
      claudeProcess.stdin?.end();
    });
  }

  /**
   * 取消執行中的指令
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const process = this.activeExecutions.get(executionId);
    
    if (!process) {
      return false;
    }

    try {
      process.kill('SIGTERM');
      
      // 等待一段時間，如果還沒結束就強制殺掉
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 5000);

      this.activeExecutions.delete(executionId);
      
      this.emit('execution:cancelled', { executionId });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 取得執行日誌
   */
  getExecutionLogs(executionId: string): string[] {
    return this.executionLogs.get(executionId) || [];
  }

  /**
   * 清理執行日誌
   */
  clearExecutionLogs(executionId?: string): void {
    if (executionId) {
      this.executionLogs.delete(executionId);
    } else {
      this.executionLogs.clear();
    }
  }

  /**
   * 取得活動執行的數量
   */
  getActiveExecutionsCount(): number {
    return this.activeExecutions.size;
  }

  /**
   * 取得所有活動執行 ID
   */
  getActiveExecutionIds(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  /**
   * 清理所有資源
   */
  async cleanup(): Promise<void> {
    // 取消所有執行中的指令
    const activeIds = this.getActiveExecutionIds();
    await Promise.all(
      activeIds.map(id => this.cancelExecution(id))
    );

    // 清理執行日誌
    this.clearExecutionLogs();
    
    this.removeAllListeners();
  }
}

/**
 * 指令執行管理器 - 協調多個執行器
 */
export class ExecutionManager extends EventEmitter {
  private prisma: PrismaClient;
  private claudeCodeExecutor: ClaudeCodeExecutor;
  private executionQueue: Map<string, Instruction> = new Map();
  private runningExecutions: Map<string, Promise<ExecutionResult>> = new Map();
  private maxConcurrentExecutions: number;

  constructor(
    prisma: PrismaClient,
    executorConfig: ExecutorConfig,
    maxConcurrentExecutions: number = 3
  ) {
    super();
    this.prisma = prisma;
    this.maxConcurrentExecutions = maxConcurrentExecutions;
    
    this.claudeCodeExecutor = new ClaudeCodeExecutor(executorConfig);
    
    // 轉發執行器事件
    this.claudeCodeExecutor.on('execution:started', (data) => {
      this.emit('execution:started', data);
    });
    
    this.claudeCodeExecutor.on('execution:output', (data) => {
      this.emit('execution:output', data);
    });
    
    this.claudeCodeExecutor.on('execution:completed', (data) => {
      this.emit('execution:completed', data);
    });
    
    this.claudeCodeExecutor.on('execution:failed', (data) => {
      this.emit('execution:failed', data);
    });
  }

  /**
   * 排隊執行指令
   */
  async queueInstruction(instruction: Instruction): Promise<ExecutionResult> {
    this.executionQueue.set(instruction.id, instruction);
    
    // 如果目前沒達到最大並發數，立即執行
    if (this.runningExecutions.size < this.maxConcurrentExecutions) {
      return await this.executeNextInQueue();
    }
    
    // 否則等待
    return new Promise((resolve, reject) => {
      const checkQueue = () => {
        if (this.runningExecutions.size < this.maxConcurrentExecutions) {
          this.executeNextInQueue()
            .then(resolve)
            .catch(reject);
        } else {
          // 繼續等待
          setTimeout(checkQueue, 1000);
        }
      };
      
      checkQueue();
    });
  }

  /**
   * 執行下一個排隊的指令
   */
  private async executeNextInQueue(): Promise<ExecutionResult> {
    const nextInstruction = this.executionQueue.values().next().value;
    
    if (!nextInstruction) {
      throw new Error('No instructions in queue');
    }

    this.executionQueue.delete(nextInstruction.id);
    
    // 更新資料庫狀態
    await this.prisma.instruction.update({
      where: { id: nextInstruction.id },
      data: { 
        status: ModelStatus.IN_PROGRESS,
        startedAt: new Date()
      }
    });

    const executionPromise = this.executeInstruction(nextInstruction);
    this.runningExecutions.set(nextInstruction.id, executionPromise);

    try {
      const result = await executionPromise;
      
      // 更新資料庫結果
      await this.prisma.instruction.update({
        where: { id: nextInstruction.id },
        data: {
          status: result.success ? ModelStatus.COMPLETED : ModelStatus.FAILED,
          output: result.output,
          error: result.error,
          tokenUsage: result.tokenUsage || 0,
          executionTime: result.executionTime,
          completedAt: new Date(),
          executedBy: 'ClaudeCodeExecutor'
        }
      });

      return result;
    } catch (error) {
      // 更新資料庫錯誤狀態
      await this.prisma.instruction.update({
        where: { id: nextInstruction.id },
        data: {
          status: ModelStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
          executionTime: Date.now() - (nextInstruction.createdAt?.getTime() || 0),
          executedBy: 'ClaudeCodeExecutor'
        }
      });

      throw error;
    } finally {
      this.runningExecutions.delete(nextInstruction.id);
    }
  }

  /**
   * 直接執行指令（不排隊）
   */
  async executeInstruction(instruction: Instruction): Promise<ExecutionResult> {
    return await this.claudeCodeExecutor.executeInstruction(instruction);
  }

  /**
   * 取消指令執行
   */
  async cancelInstruction(instructionId: string): Promise<boolean> {
    // 如果在排隊中，直接移除
    if (this.executionQueue.has(instructionId)) {
      this.executionQueue.delete(instructionId);
      
      // 更新資料庫狀態
      await this.prisma.instruction.update({
        where: { id: instructionId },
        data: { 
          status: ModelStatus.FAILED,
          error: 'Cancelled by user'
        }
      });
      
      return true;
    }

    // 如果正在執行中，嘗試取消
    if (this.runningExecutions.has(instructionId)) {
      // 這裡需要更複雜的取消機制
      // 暫時只更新資料庫狀態
      await this.prisma.instruction.update({
        where: { id: instructionId },
        data: { 
          status: ModelStatus.FAILED,
          error: 'Cancelled by user'
        }
      });
      
      return true;
    }

    return false;
  }

  /**
   * 取得排隊狀態
   */
  getQueueStatus(): {
    queueLength: number;
    runningCount: number;
    maxConcurrent: number;
  } {
    return {
      queueLength: this.executionQueue.size,
      runningCount: this.runningExecutions.size,
      maxConcurrent: this.maxConcurrentExecutions
    };
  }

  /**
   * 清理資源
   */
  async cleanup(): Promise<void> {
    await this.claudeCodeExecutor.cleanup();
    this.removeAllListeners();
  }
}