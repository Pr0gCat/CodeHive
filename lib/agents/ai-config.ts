/**
 * AI Service Configuration Manager
 * 
 * Manages API keys, model settings, and configuration for AI services,
 * including secure storage and environment variable handling.
 */

export interface AIConfiguration {
  claudeApiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  retryAttempts: number;
  fallbackToMock: boolean;
}

export class AIConfigManager {
  private static instance: AIConfigManager;
  private config: AIConfiguration;

  private constructor() {
    this.config = this.loadDefaultConfig();
    this.loadFromEnvironment();
  }

  static getInstance(): AIConfigManager {
    if (!AIConfigManager.instance) {
      AIConfigManager.instance = new AIConfigManager();
    }
    return AIConfigManager.instance;
  }

  /**
   * Load default configuration
   */
  private loadDefaultConfig(): AIConfiguration {
    return {
      model: 'claude-3-sonnet-20240229',
      maxTokens: 4096,
      temperature: 0.7,
      timeoutMs: 30000, // 30 seconds
      retryAttempts: 3,
      fallbackToMock: true
    };
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    if (typeof process !== 'undefined' && process.env) {
      // Claude API Key
      if (process.env.CLAUDE_API_KEY) {
        this.config.claudeApiKey = process.env.CLAUDE_API_KEY;
      }
      
      if (process.env.ANTHROPIC_API_KEY) {
        this.config.claudeApiKey = process.env.ANTHROPIC_API_KEY;
      }

      // Model configuration
      if (process.env.AI_MODEL) {
        this.config.model = process.env.AI_MODEL;
      }

      if (process.env.AI_MAX_TOKENS) {
        this.config.maxTokens = parseInt(process.env.AI_MAX_TOKENS, 10);
      }

      if (process.env.AI_TEMPERATURE) {
        this.config.temperature = parseFloat(process.env.AI_TEMPERATURE);
      }

      if (process.env.AI_TIMEOUT_MS) {
        this.config.timeoutMs = parseInt(process.env.AI_TIMEOUT_MS, 10);
      }

      if (process.env.AI_FALLBACK_TO_MOCK === 'false') {
        this.config.fallbackToMock = false;
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AIConfiguration {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AIConfiguration>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Set Claude API key
   */
  setClaudeApiKey(apiKey: string): void {
    this.config.claudeApiKey = apiKey;
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return !!this.config.claudeApiKey;
  }

  /**
   * Get sanitized configuration for logging (without API keys)
   */
  getSafeConfig(): Omit<AIConfiguration, 'claudeApiKey'> {
    const { claudeApiKey, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.claudeApiKey && !this.config.fallbackToMock) {
      errors.push('Claude API key is required when mock fallback is disabled');
    }

    if (this.config.maxTokens <= 0) {
      errors.push('maxTokens must be greater than 0');
    }

    if (this.config.temperature < 0 || this.config.temperature > 2) {
      errors.push('temperature must be between 0 and 2');
    }

    if (this.config.timeoutMs <= 0) {
      errors.push('timeoutMs must be greater than 0');
    }

    if (this.config.retryAttempts < 0) {
      errors.push('retryAttempts must be 0 or greater');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Load configuration from file (for settings persistence)
   */
  async loadFromFile(filePath: string): Promise<void> {
    try {
      // TODO: Implement secure file-based config loading
      console.log(`Loading AI config from: ${filePath}`);
    } catch (error) {
      console.error('Failed to load AI config from file:', error);
    }
  }

  /**
   * Save configuration to file
   */
  async saveToFile(filePath: string): Promise<void> {
    try {
      // TODO: Implement secure file-based config saving (encrypt API keys)
      console.log(`Saving AI config to: ${filePath}`);
    } catch (error) {
      console.error('Failed to save AI config to file:', error);
    }
  }

  /**
   * Get model capabilities and limits
   */
  getModelInfo(): {
    model: string;
    contextLimit: number;
    outputLimit: number;
    supportedFormats: string[];
  } {
    const modelInfo = {
      'claude-3-opus-20240229': {
        contextLimit: 200000,
        outputLimit: 4096,
        supportedFormats: ['text', 'markdown', 'json']
      },
      'claude-3-sonnet-20240229': {
        contextLimit: 200000,
        outputLimit: 4096,
        supportedFormats: ['text', 'markdown', 'json']
      },
      'claude-3-haiku-20240307': {
        contextLimit: 200000,
        outputLimit: 4096,
        supportedFormats: ['text', 'markdown', 'json']
      }
    };

    const info = modelInfo[this.config.model as keyof typeof modelInfo] || modelInfo['claude-3-sonnet-20240229'];

    return {
      model: this.config.model,
      contextLimit: info.contextLimit,
      outputLimit: info.outputLimit,
      supportedFormats: info.supportedFormats
    };
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults(): void {
    const apiKey = this.config.claudeApiKey; // Preserve API key
    this.config = this.loadDefaultConfig();
    if (apiKey) {
      this.config.claudeApiKey = apiKey;
    }
    this.loadFromEnvironment();
  }

  /**
   * Test configuration with a simple API call
   */
  async testConfiguration(): Promise<{ success: boolean; error?: string; responseTime?: number }> {
    if (!this.hasApiKey()) {
      return {
        success: this.config.fallbackToMock,
        error: this.config.fallbackToMock ? 'Using mock responses (no API key)' : 'No API key configured'
      };
    }

    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.claudeApiKey!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 50, // Minimal test
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return { success: true, responseTime };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`,
          responseTime
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${(error as Error).message}`,
        responseTime: Date.now() - startTime
      };
    }
  }
}

// Export singleton instance
export const aiConfig = AIConfigManager.getInstance();