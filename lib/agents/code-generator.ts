/**
 * Code Generation Service
 * 
 * Provides intelligent code generation capabilities for various frameworks,
 * languages, and development patterns using Claude AI.
 */

import { aiConfig } from './ai-config';
import { streamingService } from './streaming-service';

export interface CodeGenerationRequest {
  type: 'COMPONENT' | 'API_ENDPOINT' | 'DATABASE_SCHEMA' | 'TEST' | 'UTILITY' | 'FULL_FEATURE';
  framework: string;
  language: string;
  description: string;
  specifications?: {
    inputParameters?: any;
    outputFormat?: string;
    dependencies?: string[];
    testingFramework?: string;
    styleGuide?: string;
  };
  context?: {
    existingCode?: string;
    projectStructure?: string;
    conventions?: string[];
  };
}

export interface GeneratedCode {
  files: {
    path: string;
    content: string;
    language: string;
    description: string;
  }[];
  instructions: string[];
  dependencies: string[];
  testSuggestions: string[];
  documentation: string;
  estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface CodeGenerationResult {
  success: boolean;
  code?: GeneratedCode;
  error?: string;
  metadata: {
    tokensUsed: number;
    generationTime: number;
    confidence: number;
  };
}

export class CodeGenerator {
  
  /**
   * Generate code based on specifications
   */
  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    const startTime = Date.now();
    
    try {
      const prompt = this.buildCodeGenerationPrompt(request);
      const response = await this.callCodeGenerationAPI(prompt);
      
      const generatedCode = this.parseCodeResponse(response.content);
      const generationTime = Date.now() - startTime;

      return {
        success: true,
        code: generatedCode,
        metadata: {
          tokensUsed: response.usage?.total_tokens || 0,
          generationTime,
          confidence: this.calculateConfidence(response.content, request)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        metadata: {
          tokensUsed: 0,
          generationTime: Date.now() - startTime,
          confidence: 0
        }
      };
    }
  }

  /**
   * Generate code with streaming updates
   */
  async generateCodeStreaming(
    request: CodeGenerationRequest,
    callbacks: {
      onProgress?: (progress: { stage: string; percentage: number; message: string }) => void;
      onCodeChunk?: (chunk: { filePath: string; content: string; isComplete: boolean }) => void;
      onComplete?: (result: CodeGenerationResult) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      callbacks.onProgress?.({
        stage: 'preparation',
        percentage: 10,
        message: '正在準備程式碼生成...'
      });

      const prompt = this.buildCodeGenerationPrompt(request);
      
      callbacks.onProgress?.({
        stage: 'generation',
        percentage: 30,
        message: '正在生成程式碼...'
      });

      let accumulatedContent = '';
      let tokensUsed = 0;

      await streamingService.streamResponse(prompt, {
        onChunk: (chunk) => {
          accumulatedContent = chunk.content;
          tokensUsed = chunk.tokenCount;
          
          // Try to extract partial code
          const partialCode = this.extractPartialCode(chunk.content);
          if (partialCode) {
            callbacks.onCodeChunk?.(partialCode);
          }
          
          callbacks.onProgress?.({
            stage: 'generation',
            percentage: 50 + Math.min(chunk.tokenCount / 100, 40), // Progress based on tokens
            message: '程式碼生成中...'
          });
        },
        onComplete: (finalResponse) => {
          callbacks.onProgress?.({
            stage: 'processing',
            percentage: 90,
            message: '正在處理生成結果...'
          });

          try {
            const generatedCode = this.parseCodeResponse(finalResponse.content);
            const generationTime = Date.now() - startTime;

            const result: CodeGenerationResult = {
              success: true,
              code: generatedCode,
              metadata: {
                tokensUsed: finalResponse.tokenCount,
                generationTime,
                confidence: this.calculateConfidence(finalResponse.content, request)
              }
            };

            callbacks.onProgress?.({
              stage: 'complete',
              percentage: 100,
              message: '程式碼生成完成'
            });

            callbacks.onComplete?.(result);
          } catch (error) {
            callbacks.onError?.(error as Error);
          }
        },
        onError: (error) => {
          callbacks.onError?.(error);
        }
      });

    } catch (error) {
      callbacks.onError?.(error as Error);
    }
  }

  /**
   * Build prompt for code generation
   */
  private buildCodeGenerationPrompt(request: CodeGenerationRequest): string {
    const systemPrompt = this.getSystemPromptForCodeGeneration(request.framework, request.language);
    
    return `${systemPrompt}

程式碼生成需求：
- 類型: ${request.type}
- 框架: ${request.framework}
- 程式語言: ${request.language}
- 描述: ${request.description}

${request.specifications ? `
規格要求：
- 輸入參數: ${JSON.stringify(request.specifications.inputParameters || '無')}
- 輸出格式: ${request.specifications.outputFormat || '標準格式'}
- 相依套件: ${request.specifications.dependencies?.join(', ') || '無'}
- 測試框架: ${request.specifications.testingFramework || '無'}
- 程式碼風格: ${request.specifications.styleGuide || '標準風格'}
` : ''}

${request.context ? `
專案上下文：
- 現有程式碼: ${request.context.existingCode ? '有' : '無'}
- 專案結構: ${request.context.projectStructure || '標準結構'}
- 開發慣例: ${request.context.conventions?.join(', ') || '標準慣例'}
` : ''}

請生成完整、可運行的程式碼，包含：
1. 主要程式碼檔案（使用 \`\`\`[language] 程式碼區塊）
2. 相關測試檔案
3. 安裝和使用說明
4. 程式碼註解和文件

輸出格式請使用以下結構：
## 檔案: [檔案路徑]
\`\`\`[語言]
[程式碼內容]
\`\`\`

## 安裝說明
[安裝步驟]

## 使用說明
[使用方式]

## 測試建議
[測試方法]`;
  }

  /**
   * Get system prompt for specific framework and language
   */
  private getSystemPromptForCodeGeneration(framework: string, language: string): string {
    const frameworkPrompts = {
      'next.js': `你是一位專精 Next.js 的全端開發專家，熟悉 App Router、Server Components、TypeScript 和現代最佳實踐。`,
      'react': `你是一位 React 開發專家，精通函式元件、Hooks、TypeScript 和現代 React 生態系統。`,
      'vue': `你是一位 Vue.js 開發專家，熟悉 Composition API、TypeScript 和 Vue 生態系統。`,
      'express': `你是一位 Node.js 和 Express.js 後端開發專家，精通 RESTful API 設計和最佳實踐。`,
      'fastapi': `你是一位 Python FastAPI 開發專家，熟悉非同步程式設計和 API 最佳實踐。`,
      'spring': `你是一位 Java Spring 框架專家，精通 Spring Boot、Spring Security 和微服務架構。`,
      'default': `你是一位資深軟體開發工程師，精通多種程式語言和開發框架。`
    };

    return frameworkPrompts[framework.toLowerCase()] || frameworkPrompts.default;
  }

  /**
   * Call AI API for code generation
   */
  private async callCodeGenerationAPI(prompt: string): Promise<any> {
    const config = aiConfig.getConfig();
    
    if (!config.claudeApiKey) {
      return this.generateMockCodeResponse(prompt);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.claudeApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: Math.min(config.maxTokens * 2, 8192), // Allow more tokens for code
        temperature: 0.3, // Lower temperature for more consistent code
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Code generation API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.content?.[0]?.text || '',
      usage: {
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0
      }
    };
  }

  /**
   * Generate mock code response for development
   */
  private generateMockCodeResponse(prompt: string): any {
    const promptLower = prompt.toLowerCase();
    
    let mockContent = '';
    
    if (promptLower.includes('component') && promptLower.includes('react')) {
      mockContent = `## 檔案: components/UserProfile.tsx
\`\`\`typescript
import React from 'react';

interface UserProfileProps {
  name: string;
  email: string;
  avatar?: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ name, email, avatar }) => {
  return (
    <div className="user-profile">
      {avatar && (
        <img 
          src={avatar} 
          alt={name} 
          className="user-avatar"
        />
      )}
      <div className="user-info">
        <h3>{name}</h3>
        <p>{email}</p>
      </div>
    </div>
  );
};

export default UserProfile;
\`\`\`

## 檔案: components/UserProfile.test.tsx
\`\`\`typescript
import { render, screen } from '@testing-library/react';
import { UserProfile } from './UserProfile';

describe('UserProfile', () => {
  it('renders user information correctly', () => {
    render(
      <UserProfile 
        name="張三" 
        email="zhang@example.com" 
      />
    );
    
    expect(screen.getByText('張三')).toBeInTheDocument();
    expect(screen.getByText('zhang@example.com')).toBeInTheDocument();
  });
});
\`\`\`

## 安裝說明
此元件需要 React 和 TypeScript。確保專案已安裝相關依賴。

## 使用說明
\`\`\`tsx
import { UserProfile } from './components/UserProfile';

<UserProfile 
  name="使用者姓名"
  email="user@example.com"
  avatar="https://example.com/avatar.jpg"
/>
\`\`\`

## 測試建議
- 測試必要 props 的顯示
- 測試可選 props 的條件渲染
- 測試樣式類名的正確套用`;
    } else if (promptLower.includes('api') && promptLower.includes('endpoint')) {
      mockContent = `## 檔案: api/users/route.ts
\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server';

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// GET /api/users
export async function GET(request: NextRequest) {
  try {
    // 模擬從資料庫取得使用者資料
    const users: User[] = [
      {
        id: '1',
        name: '張三',
        email: 'zhang@example.com',
        createdAt: new Date()
      }
    ];

    return NextResponse.json({
      success: true,
      data: users
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/users
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email } = body;

    // 驗證輸入
    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // 模擬建立使用者
    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      createdAt: new Date()
    };

    return NextResponse.json({
      success: true,
      data: newUser
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
\`\`\`

## 檔案: __tests__/api/users.test.ts
\`\`\`typescript
import { GET, POST } from '@/app/api/users/route';
import { NextRequest } from 'next/server';

describe('/api/users', () => {
  it('should return users list', async () => {
    const request = new NextRequest('http://localhost:3000/api/users');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('should create new user', async () => {
    const request = new NextRequest('http://localhost:3000/api/users', {
      method: 'POST',
      body: JSON.stringify({
        name: '李四',
        email: 'li@example.com'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('李四');
  });
});
\`\`\`

## 安裝說明
此 API 端點使用 Next.js App Router，無需額外安裝。

## 使用說明
\`\`\`javascript
// GET 請求
const response = await fetch('/api/users');
const { data } = await response.json();

// POST 請求
const response = await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '新使用者', email: 'new@example.com' })
});
\`\`\`

## 測試建議
- 測試 GET 端點回傳正確格式
- 測試 POST 端點資料驗證
- 測試錯誤處理機制`;
    } else {
      mockContent = `## 檔案: utils/helper.ts
\`\`\`typescript
/**
 * 通用工具函式
 */

export function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-TW');
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export default {
  formatDate,
  validateEmail,
  generateId
};
\`\`\`

## 檔案: __tests__/utils/helper.test.ts
\`\`\`typescript
import { formatDate, validateEmail, generateId } from '@/utils/helper';

describe('Helper Utils', () => {
  test('formatDate formats date correctly', () => {
    const date = new Date('2024-01-01');
    const formatted = formatDate(date);
    expect(formatted).toBe('2024/1/1');
  });

  test('validateEmail validates correctly', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('invalid-email')).toBe(false);
  });

  test('generateId creates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThan(0);
  });
});
\`\`\`

## 安裝說明
此工具模組無需額外依賴，可直接使用。

## 使用說明
\`\`\`typescript
import { formatDate, validateEmail, generateId } from '@/utils/helper';

const formattedDate = formatDate(new Date());
const isValid = validateEmail('user@example.com');
const uniqueId = generateId();
\`\`\`

## 測試建議
- 測試各函式的正確輸出
- 測試邊界條件
- 確保工具函式的穩定性`;
    }

    return {
      content: mockContent,
      usage: {
        total_tokens: Math.ceil(mockContent.length / 4),
        input_tokens: Math.ceil(promptLower.length / 4),
        output_tokens: Math.ceil(mockContent.length / 4)
      }
    };
  }

  /**
   * Parse code response into structured format
   */
  private parseCodeResponse(content: string): GeneratedCode {
    const files: GeneratedCode['files'] = [];
    const instructions: string[] = [];
    const dependencies: string[] = [];
    const testSuggestions: string[] = [];
    let documentation = '';

    // Extract files from markdown code blocks
    const fileMatches = content.matchAll(/## 檔案: (.+?)\n```(\w+)\n([\s\S]*?)```/g);
    for (const match of fileMatches) {
      const [, path, language, code] = match;
      files.push({
        path: path.trim(),
        content: code.trim(),
        language: language.toLowerCase(),
        description: this.generateFileDescription(path, code)
      });
    }

    // Extract installation instructions
    const installMatch = content.match(/## 安裝說明\n([\s\S]*?)(?=##|$)/);
    if (installMatch) {
      instructions.push(...installMatch[1].trim().split('\n').filter(line => line.trim()));
    }

    // Extract dependencies from package.json or requirements
    const dependencyPatterns = [
      /npm install ([\w\-@\/\s]+)/g,
      /pip install ([\w\-\s]+)/g,
      /gem install ([\w\-\s]+)/g
    ];

    for (const pattern of dependencyPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        dependencies.push(...match[1].split(' ').filter(dep => dep.trim()));
      }
    }

    // Extract test suggestions
    const testMatch = content.match(/## 測試建議\n([\s\S]*?)(?=##|$)/);
    if (testMatch) {
      testSuggestions.push(...testMatch[1].trim().split('\n')
        .filter(line => line.trim() && line.startsWith('-'))
        .map(line => line.replace(/^-\s*/, '')));
    }

    // Extract documentation
    const docSections = ['使用說明', '說明文件', 'Documentation'];
    for (const section of docSections) {
      const docMatch = content.match(new RegExp(`## ${section}\\n([\\s\\S]*?)(?=##|$)`));
      if (docMatch) {
        documentation += docMatch[1].trim() + '\n\n';
      }
    }

    return {
      files,
      instructions,
      dependencies: [...new Set(dependencies)], // Remove duplicates
      testSuggestions,
      documentation: documentation.trim(),
      estimatedComplexity: this.estimateComplexity(files)
    };
  }

  /**
   * Generate file description based on path and content
   */
  private generateFileDescription(path: string, content: string): string {
    const fileName = path.split('/').pop() || '';
    
    if (fileName.includes('test') || fileName.includes('spec')) {
      return `測試檔案：${fileName}`;
    }
    
    if (fileName.includes('component') || fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
      return `React 元件：${fileName}`;
    }
    
    if (fileName.includes('api') || fileName.includes('route')) {
      return `API 路由：${fileName}`;
    }
    
    if (fileName.includes('util') || fileName.includes('helper')) {
      return `工具函式：${fileName}`;
    }
    
    return `程式檔案：${fileName}`;
  }

  /**
   * Extract partial code during streaming
   */
  private extractPartialCode(content: string): { filePath: string; content: string; isComplete: boolean } | null {
    const fileMatch = content.match(/## 檔案: (.+?)\n```\w+\n([\s\S]*?)(?:```|$)/);
    if (fileMatch) {
      const [, path, code] = fileMatch;
      return {
        filePath: path.trim(),
        content: code,
        isComplete: content.includes('```\n\n') || content.endsWith('```')
      };
    }
    
    return null;
  }

  /**
   * Calculate confidence score for generated code
   */
  private calculateConfidence(content: string, request: CodeGenerationRequest): number {
    let confidence = 0.7; // Base confidence
    
    // Check for code blocks
    if (content.includes('```')) confidence += 0.1;
    
    // Check for tests
    if (content.includes('test') || content.includes('spec')) confidence += 0.1;
    
    // Check for documentation
    if (content.includes('## 使用說明') || content.includes('## 安裝說明')) confidence += 0.05;
    
    // Check for framework-specific patterns
    if (request.framework.toLowerCase() === 'react' && content.includes('React.FC')) confidence += 0.05;
    if (request.framework.toLowerCase() === 'next.js' && content.includes('NextResponse')) confidence += 0.05;
    
    return Math.min(confidence, 0.95);
  }

  /**
   * Estimate code complexity
   */
  private estimateComplexity(files: GeneratedCode['files']): 'LOW' | 'MEDIUM' | 'HIGH' {
    const totalLines = files.reduce((sum, file) => sum + file.content.split('\n').length, 0);
    const fileCount = files.length;
    
    if (totalLines < 50 && fileCount <= 2) return 'LOW';
    if (totalLines < 200 && fileCount <= 5) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Get supported frameworks
   */
  getSupportedFrameworks(): string[] {
    return [
      'Next.js',
      'React',
      'Vue.js',
      'Express.js',
      'FastAPI',
      'Spring Boot',
      'Django',
      'Flutter',
      'React Native'
    ];
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return [
      'TypeScript',
      'JavaScript',
      'Python',
      'Java',
      'C#',
      'Go',
      'Rust',
      'Swift',
      'Kotlin',
      'Dart'
    ];
  }
}

// Export singleton instance
export const codeGenerator = new CodeGenerator();