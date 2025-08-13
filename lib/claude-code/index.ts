/**
 * Claude Code integration module
 * Provides interface for executing commands via Claude Code CLI with --print option
 */

import { config } from '@/lib/config';
import { projectLogger } from '@/lib/logging/project-logger';
import { spawn } from 'child_process';

export interface StreamEvent {
  type: 'system' | 'assistant' | 'result';
  subtype?: string;
  data: any;
}

export interface SystemEvent extends StreamEvent {
  type: 'system';
  subtype: 'init';
  data: {
    cwd: string;
    session_id: string;
    tools: string[];
    mcp_servers: any[];
    model: string;
    permissionMode: string;
    apiKeySource: string;
  };
}

export interface AssistantEvent extends StreamEvent {
  type: 'assistant';
  data: {
    message: {
      id: string;
      content: Array<{type: string; text: string}>;
      usage: {
        input_tokens: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
        output_tokens: number;
        service_tier?: string;
      };
    };
    session_id: string;
  };
}

export interface ResultEvent extends StreamEvent {
  type: 'result';
  subtype: 'success' | 'error';
  data: {
    is_error: boolean;
    duration_ms: number;
    duration_api_ms?: number;
    num_turns: number;
    result?: string;
    error?: string;
    session_id: string;
    total_cost_usd: number;
    usage: {
      input_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      output_tokens: number;
      server_tool_use?: {
        web_search_requests: number;
      };
      service_tier?: string;
    };
  };
}

export interface ClaudeCodeOptions {
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout?: number;
  outputFormat?: 'text' | 'json' | 'stream-json';
  projectId?: string; // For logging purposes
  onProgress?: (event: StreamEvent) => void; // For stream-json mode
  systemPrompt?: string; // System prompt to append to the default
  debugMode?: boolean; // Enable debug output (default: false for clean responses)
}

export interface ClaudeCodeResult {
  success: boolean;
  output?: string;
  error?: string;
  tokensUsed?: number;
  tokenDetails?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
  };
  sessionId?: string;
  costUsd?: number;
  durationMs?: number;
}


class ClaudeCode {
  private claudePath: string;

  constructor() {
    this.claudePath = config.claudeCodePath;
  }

  async execute(
    prompt: string, 
    options: ClaudeCodeOptions = {}
  ): Promise<ClaudeCodeResult> {
    const { workingDirectory, environment, timeout = 120000, outputFormat = 'stream-json', projectId, onProgress, systemPrompt, debugMode = false } = options; // Default to stream-json for real-time progress
    
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let hasCompleted = false;
      
      // Use -p/--print option to avoid interactive mode, with JSON output for token info
      const args = ['-p'];
      if (outputFormat === 'json') {
        args.push('--output-format', 'json');
        // Don't use debug in JSON mode as it pollutes stdout
      } else if (outputFormat === 'stream-json') {
        args.push('--output-format', 'stream-json', '--verbose');
        // stream-json requires --verbose
      } else {
        // Only add debug mode when explicitly requested
        if (debugMode) {
          args.push('--debug');
        }
      }
      
      // Add system prompt if provided
      if (systemPrompt) {
        args.push('--append-system-prompt', systemPrompt);
      }
      
      args.push(prompt);
      
      const nodeProcess = process; // Save reference to avoid scoping issues
      const childProcess = spawn(this.claudePath, args, {
        cwd: workingDirectory || nodeProcess.cwd(),
        env: { ...nodeProcess.env, ...environment },
        stdio: ['ignore', 'pipe', 'pipe'], // Ignore stdin to prevent interaction
        detached: false // Keep attached to parent
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!hasCompleted) {
          hasCompleted = true;
          childProcess.kill('SIGTERM');
          resolve({
            success: false,
            error: `Command timed out after ${timeout}ms`,
            tokensUsed: this.estimateTokens(prompt),
          });
        }
      }, timeout);

      // Handle stdout
      childProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // For stream-json mode, parse events in real-time
        if (outputFormat === 'stream-json' && onProgress) {
          this.parseStreamChunk(chunk, onProgress);
        }
        
        // Log stdout to project logs if projectId is provided
        if (projectId) {
          projectLogger.debug(projectId, 'claude-code-stdout', 'Claude Code stdout chunk', {
            chunkLength: chunk.length,
            chunkPreview: chunk.substring(0, 500),
            promptPreview: prompt.substring(0, 100)
          });
        }
      });

      // Handle stderr
      childProcess.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        
        // Log stderr to project logs if projectId is provided
        if (projectId) {
          projectLogger.debug(projectId, 'claude-code-stderr', 'Claude Code stderr chunk', {
            chunkLength: chunk.length,
            chunkPreview: chunk.substring(0, 500),
            promptPreview: prompt.substring(0, 100)
          });
        }
      });

      // Handle process exit
      childProcess.on('exit', (exitCode) => {
        if (!hasCompleted) {
          hasCompleted = true;
          clearTimeout(timeoutId);
          
          // Log final stdout and stderr to project logs
          if (projectId) {
            if (stdout.trim()) {
              projectLogger.info(projectId, 'claude-code-output', 'Claude Code stdout complete', {
                exitCode,
                outputLength: stdout.length,
                outputPreview: stdout.substring(0, 1000),
                promptPreview: prompt.substring(0, 100),
                outputFormat
              });
            }
            
            if (stderr.trim()) {
              const logLevel = exitCode === 0 ? 'debug' : 'warn';
              projectLogger[logLevel](projectId, 'claude-code-error', 'Claude Code stderr complete', {
                exitCode,
                errorLength: stderr.length,
                errorPreview: stderr.substring(0, 1000),
                promptPreview: prompt.substring(0, 100),
                outputFormat
              });
            }
          }
          
          if (exitCode === 0) {
            try {
              if (outputFormat === 'json') {
                const jsonResult = this.parseJsonOutput(stdout);
                resolve(jsonResult);
              } else if (outputFormat === 'stream-json') {
                const streamResult = this.parseStreamJsonOutput(stdout);
                resolve(streamResult);
              } else {
                const cleanOutput = this.cleanOutput(stdout);
                resolve({
                  success: true,
                  output: cleanOutput,
                  tokensUsed: this.parseTokenUsage(cleanOutput) || this.estimateTokens(prompt, cleanOutput),
                });
              }
            } catch (error) {
              resolve({
                success: false,
                error: `Failed to parse output: ${error instanceof Error ? error.message : 'Unknown error'}`,
                tokensUsed: this.estimateTokens(prompt),
              });
            }
          } else {
            resolve({
              success: false,
              error: stderr || `Process exited with code ${exitCode}`,
              tokensUsed: this.estimateTokens(prompt),
            });
          }
        }
      });

      childProcess.on('error', (error) => {
        if (!hasCompleted) {
          hasCompleted = true;
          clearTimeout(timeoutId);
          
          // Log process error to project logs
          if (projectId) {
            projectLogger.error(projectId, 'claude-code-process', 'Claude Code process error', {
              error: error.message,
              promptPreview: prompt.substring(0, 100),
              outputFormat,
              workingDirectory
            });
          }
          
          resolve({
            success: false,
            error: `Failed to start Claude Code: ${error.message}`,
            tokensUsed: 0,
          });
        }
      });
    });
  }

  private parseStreamChunk(chunk: string, onProgress: (event: StreamEvent) => void): void {
    // Split chunk by lines since each JSON event is on its own line
    const lines = chunk.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        onProgress({
          type: event.type,
          subtype: event.subtype,
          data: event
        });
      } catch (error) {
        // Ignore parsing errors for incomplete lines
      }
    }
  }

  private parseStreamJsonOutput(streamOutput: string): ClaudeCodeResult {
    // Parse the final result from stream-json output
    const lines = streamOutput.split('\n').filter(line => line.trim());
    let resultEvent: any = null;
    const assistantMessages: string[] = [];
    
    // Find the final result event and collect assistant messages
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.type === 'result') {
          resultEvent = event.data || event;
        } else if (event.type === 'assistant' && event.data?.message?.content) {
          // Collect assistant messages for output
          const content = event.data.message.content;
          const textContent = content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('');
          if (textContent.trim()) {
            assistantMessages.push(textContent);
          }
        }
      } catch (error) {
        // Continue parsing other lines
      }
    }
    
    if (!resultEvent) {
      return {
        success: false,
        error: 'No result event found in stream output',
        tokensUsed: 0,
      };
    }
    
    if (resultEvent.subtype === 'success' && !resultEvent.is_error) {
      const usage = resultEvent.usage || {};
      const inputTokens = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0);
      const outputTokens = usage.output_tokens || 0;
      const totalTokens = inputTokens + outputTokens;
      
      // Use assistant messages as output, fallback to result field
      const output = assistantMessages.length > 0 ? assistantMessages.join('\n') : (resultEvent.result || '');
      
      return {
        success: true,
        output,
        tokensUsed: totalTokens,
        tokenDetails: {
          inputTokens,
          outputTokens,
          cacheCreationTokens: usage.cache_creation_input_tokens,
          cacheReadTokens: usage.cache_read_input_tokens,
        },
        sessionId: resultEvent.session_id,
        costUsd: resultEvent.total_cost_usd,
        durationMs: resultEvent.duration_ms,
      };
    } else {
      return {
        success: false,
        error: resultEvent.error || 'Unknown error from Claude Code stream',
        tokensUsed: 0,
      };
    }
  }

  private parseJsonOutput(jsonOutput: string): ClaudeCodeResult {
    const data = JSON.parse(jsonOutput);
    
    if (data.type === 'result' && data.subtype === 'success' && !data.is_error) {
      const usage = data.usage || {};
      const inputTokens = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0);
      const outputTokens = usage.output_tokens || 0;
      const totalTokens = inputTokens + outputTokens;
      
      return {
        success: true,
        output: data.result || '',
        tokensUsed: totalTokens,
        tokenDetails: {
          inputTokens,
          outputTokens,
          cacheCreationTokens: usage.cache_creation_input_tokens,
          cacheReadTokens: usage.cache_read_input_tokens,
        },
        sessionId: data.session_id,
        costUsd: data.total_cost_usd,
        durationMs: data.duration_ms,
      };
    } else {
      return {
        success: false,
        error: data.error || 'Unknown error from Claude Code',
        tokensUsed: 0,
      };
    }
  }

  private cleanOutput(rawOutput: string): string {
    // Filter out debug messages and clean output
    const lines = rawOutput.split('\n');
    const cleanedLines = lines.filter(line => {
      // Remove debug messages
      if (line.trim().startsWith('[DEBUG]')) return false;
      // Remove verbose/info messages that aren't part of the response
      if (line.trim().startsWith('[INFO]')) return false;
      if (line.trim().startsWith('[WARN]')) return false;
      // Remove progress indicators and status messages
      if (line.trim().match(/^(Creating|Writing|Preserving|Applied|Renaming|File|Shell|Executing|Found|Matched|Cleaned|Getting|Summarizing|Stream started)/)) return false;
      return true;
    });
    
    const filteredOutput = cleanedLines.join('\n');
    
    // With --print option, output should be clean, but still remove any ANSI codes
    return filteredOutput
      .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI escape sequences
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // Remove control characters (keep \t \n)
      .trim();
  }


  async executeWithFileOperations(
    prompt: string,
    workingDirectory: string,
    options: ClaudeCodeOptions = {}
  ): Promise<ClaudeCodeResult> {
    return this.execute(prompt, { ...options, workingDirectory });
  }

  async executeVersion(): Promise<ClaudeCodeResult> {
    // Use -v/--version flag directly instead of as prompt
    return new Promise((resolve) => {
      const childProcess = spawn(this.claudePath, ['-v'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      
      childProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('exit', (exitCode) => {
        if (exitCode === 0) {
          resolve({
            success: true,
            output: stdout.trim(),
            tokensUsed: 0,
          });
        } else {
          resolve({
            success: false,
            error: stderr || `Process exited with code ${exitCode}`,
            tokensUsed: 0,
          });
        }
      });

      childProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to get version: ${error.message}`,
          tokensUsed: 0,
        });
      });
    });
  }

  async checkHealth(): Promise<boolean> {
    try {
      const result = await this.execute('Hello, are you working?', { timeout: 30000 });
      return result.success && (result.output?.length ?? 0) > 0;
    } catch {
      return false;
    }
  }

  private parseTokenUsage(output: string): number | null {
    // Try to extract token usage from Claude Code output
    // Claude Code might output token information in its response
    const tokenMatch = output.match(/(?:tokens?[\s:]*)(\d+)/i);
    if (tokenMatch) {
      return parseInt(tokenMatch[1]);
    }
    return null;
  }

  private estimateTokens(text: string, additionalText?: string): number {
    const totalText = text + (additionalText || '');
    // Rough estimation: ~4 characters per token
    return Math.ceil(totalText.length / 4);
  }
}

export const claudeCode = new ClaudeCode();