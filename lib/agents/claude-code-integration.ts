import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Instruction } from './project-agent';

/**
 * Claude Code執行配置
 */
export interface ClaudeCodeConfig {
  command?: string;           // Claude Code執行指令
  workingDirectory: string;   // 工作目錄
  apiKey?: string;            // API金鑰
  model?: string;             // 模型名稱
  maxTokens?: number;         // 最大代幣數
  timeout?: number;           // 逾時時間（毫秒）
}

/**
 * Claude Code執行結果
 */
export interface ClaudeCodeResult {
  success: boolean;
  output: string;
  error?: string;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  duration: number;
}

/**
 * Claude Code執行狀態
 */
export enum ExecutionStatus {
  IDLE = 'idle',
  STARTING = 'starting',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}

/**
 * Claude Code整合層 - 處理與Claude Code的所有互動
 */
export class ClaudeCodeIntegration extends EventEmitter {
  private config: ClaudeCodeConfig;
  private process: ChildProcess | null = null;
  private status: ExecutionStatus = ExecutionStatus.IDLE;
  private outputBuffer: string = '';
  private errorBuffer: string = '';

  constructor(config: ClaudeCodeConfig) {
    super();
    this.config = {
      command: 'claude',  // 預設指令
      timeout: 300000,    // 預設5分鐘逾時
      ...config
    };
  }

  /**
   * 執行指令
   */
  async executeInstruction(instruction: Instruction): Promise<ClaudeCodeResult> {
    this.status = ExecutionStatus.STARTING;
    this.emit('execution:starting', { instruction });
    
    const startTime = Date.now();
    
    try {
      // 準備提示詞
      const prompt = this.preparePrompt(instruction);
      
      // 啟動Claude Code子程序
      const result = await this.runClaudeCode(prompt);
      
      // 解析結果
      const processedResult = this.processResult(result, instruction);
      
      this.status = ExecutionStatus.COMPLETED;
      this.emit('execution:completed', processedResult);
      
      return {
        ...processedResult,
        duration: Date.now() - startTime
      };
    } catch (error) {
      this.status = ExecutionStatus.FAILED;
      const errorResult: ClaudeCodeResult = {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
      
      this.emit('execution:failed', errorResult);
      return errorResult;
    }
  }

  /**
   * 驗證任務輸出
   */
  async validateOutput(
    output: string,
    criteria: string
  ): Promise<boolean> {
    const validationPrompt = `
請驗證以下輸出是否滿足指定的標準。

輸出：
${output}

驗證標準：
${criteria}

請回答"通過"或"失敗"，並簡短說明原因。
`;

    try {
      const result = await this.runClaudeCode(validationPrompt);
      return result.includes('通過');
    } catch {
      return false;
    }
  }

  /**
   * 準備提示詞
   */
  private preparePrompt(instruction: Instruction): string {
    const timestamp = new Date().toISOString();
    return `
# CodeHive 專案代理任務執行

執行時間: ${timestamp}
任務ID: ${instruction.id}
工作目錄: ${this.config.workingDirectory}

## 任務描述

### 指令
${instruction.directive}

### 預期成果
${instruction.expectedOutcome}

### 驗證標準
${instruction.criteria}

## 執行要求

你是一個專業的軟體開發者，請按照以下要求執行任務：

1. **仔細分析任務需求**
   - 理解指令的具體要求
   - 明確預期成果
   - 確認驗證標準

2. **執行開發工作**
   - 建立和修改檔案
   - 執行必要的指令
   - 安裝所需套件
   - 運行測試驗證

3. **提供完整報告**
   請在執行完成後提供以下資訊：
   - 執行步驟的詳細摘要
   - 產生的具體結果
   - 是否完全滿足驗證標準
   - 如有問題，說明具體原因

4. **格式要求**
   在回應最後以下列格式提供執行狀態：
   \`\`\`
   EXECUTION_STATUS: [SUCCESS/FAILURE]
   CRITERIA_MET: [YES/NO/PARTIAL]
   SUMMARY: [簡短摘要]
   \`\`\`

現在開始執行任務：
`;
  }

  /**
   * 執行Claude Code
   */
  private runClaudeCode(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.outputBuffer = '';
      this.errorBuffer = '';
      
      // 準備環境變數
      const env = {
        ...process.env,
        ANTHROPIC_API_KEY: this.config.apiKey
      };
      
      // 準備指令參數
      const args = [
        '--prompt', prompt,
        '--working-dir', this.config.workingDirectory
      ];
      
      if (this.config.model) {
        args.push('--model', this.config.model);
      }
      
      if (this.config.maxTokens) {
        args.push('--max-tokens', String(this.config.maxTokens));
      }
      
      // 啟動子程序
      this.process = spawn(this.config.command!, args, {
        cwd: this.config.workingDirectory,
        env
      });
      
      this.status = ExecutionStatus.RUNNING;
      
      // 設定逾時
      const timeout = setTimeout(() => {
        if (this.process) {
          this.process.kill();
          this.status = ExecutionStatus.TIMEOUT;
          reject(new Error('Execution timeout'));
        }
      }, this.config.timeout);
      
      // 處理輸出
      this.process.stdout?.on('data', (data) => {
        const output = data.toString();
        this.outputBuffer += output;
        this.emit('output', output);
      });
      
      // 處理錯誤
      this.process.stderr?.on('data', (data) => {
        const error = data.toString();
        this.errorBuffer += error;
        this.emit('error', error);
      });
      
      // 處理結束
      this.process.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          resolve(this.outputBuffer);
        } else {
          reject(new Error(`Process exited with code ${code}: ${this.errorBuffer}`));
        }
        
        this.process = null;
      });
      
      // 處理錯誤
      this.process.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
        this.process = null;
      });
    });
  }

  /**
   * 處理執行結果
   */
  private processResult(
    output: string,
    instruction: Instruction
  ): ClaudeCodeResult {
    // 嘗試提取代幣使用資訊
    const tokenUsage = this.extractTokenUsage(output);
    
    // 提取執行狀態資訊
    const statusInfo = this.extractExecutionStatus(output);
    
    // 判斷是否成功
    const success = this.checkSuccess(output, instruction, statusInfo);
    
    return {
      success,
      output,
      tokenUsage,
      duration: 0,  // 將在外層設定
      error: success ? undefined : this.extractErrorMessage(output, statusInfo)
    };
  }

  /**
   * 提取代幣使用資訊
   */
  private extractTokenUsage(output: string): ClaudeCodeResult['tokenUsage'] {
    // 嘗試從輸出中提取代幣使用資訊
    // 格式可能類似：Token usage: input=100, output=200, total=300
    const match = output.match(/Token usage:.*input=(\d+).*output=(\d+).*total=(\d+)/i);
    
    if (match) {
      return {
        input: parseInt(match[1], 10),
        output: parseInt(match[2], 10),
        total: parseInt(match[3], 10)
      };
    }
    
    return undefined;
  }

  /**
   * 提取執行狀態資訊
   */
  private extractExecutionStatus(output: string): {
    status?: 'SUCCESS' | 'FAILURE';
    criteriaMet?: 'YES' | 'NO' | 'PARTIAL';
    summary?: string;
  } {
    const statusMatch = output.match(/EXECUTION_STATUS:\s*(SUCCESS|FAILURE)/i);
    const criteriaMatch = output.match(/CRITERIA_MET:\s*(YES|NO|PARTIAL)/i);
    const summaryMatch = output.match(/SUMMARY:\s*(.+?)(?:\n|$)/i);

    return {
      status: statusMatch?.[1] as any,
      criteriaMet: criteriaMatch?.[1] as any,
      summary: summaryMatch?.[1]?.trim()
    };
  }

  /**
   * 檢查執行是否成功
   */
  private checkSuccess(
    output: string, 
    instruction: Instruction, 
    statusInfo: any
  ): boolean {
    // 優先使用結構化狀態資訊
    if (statusInfo.status) {
      return statusInfo.status === 'SUCCESS' && 
             (statusInfo.criteriaMet === 'YES' || statusInfo.criteriaMet === 'PARTIAL');
    }

    // 回退到原有的啟發式檢查
    const successIndicators = [
      '成功', '完成', 'success', 'completed', 'done', '✓', '✔'
    ];
    
    const failureIndicators = [
      '失敗', '錯誤', 'failed', 'error', '✗', '✘'
    ];
    
    const outputLower = output.toLowerCase();
    
    // 檢查失敗指標
    if (failureIndicators.some(indicator => outputLower.includes(indicator))) {
      return false;
    }
    
    // 檢查成功指標
    if (successIndicators.some(indicator => outputLower.includes(indicator))) {
      return true;
    }
    
    // 檢查是否包含預期成果的關鍵字
    const expectedKeywords = instruction.expectedOutcome
      .split(/[\s,，。、]/)
      .filter(word => word.length > 2);
    
    const matchedKeywords = expectedKeywords.filter(keyword =>
      outputLower.includes(keyword.toLowerCase())
    );
    
    // 如果匹配超過一半的關鍵字，認為成功
    return matchedKeywords.length > expectedKeywords.length * 0.5;
  }

  /**
   * 提取錯誤訊息
   */
  private extractErrorMessage(output: string, statusInfo: any): string {
    if (statusInfo.summary && statusInfo.status === 'FAILURE') {
      return statusInfo.summary;
    }

    // 嘗試從輸出中提取錯誤訊息
    const errorPatterns = [
      /Error:\s*(.+?)(?:\n|$)/i,
      /錯誤[:：]\s*(.+?)(?:\n|$)/i,
      /Failed:\s*(.+?)(?:\n|$)/i,
      /失敗[:：]\s*(.+?)(?:\n|$)/i
    ];

    for (const pattern of errorPatterns) {
      const match = output.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return 'Unknown error occurred during execution';
  }

  /**
   * 停止執行
   */
  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.status = ExecutionStatus.IDLE;
      this.emit('execution:stopped');
    }
  }

  /**
   * 取得當前狀態
   */
  getStatus(): ExecutionStatus {
    return this.status;
  }

  /**
   * 是否正在執行
   */
  isRunning(): boolean {
    return this.status === ExecutionStatus.RUNNING;
  }

  /**
   * 清理資源
   */
  cleanup(): void {
    this.stop();
    this.removeAllListeners();
  }
}