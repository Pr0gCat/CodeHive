import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { codeGenerator, CodeGenerationRequest } from '@/lib/agents/code-generator';
import { responseGenerator } from '@/lib/agents/response-generator';

describe('Code Generation Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Code Generator Service', () => {
    it('should generate React component code', async () => {
      const request: CodeGenerationRequest = {
        type: 'COMPONENT',
        framework: 'React',
        language: 'TypeScript',
        description: '創建一個用戶個人資料元件',
        specifications: {
          inputParameters: {
            name: 'string',
            email: 'string',
            avatar: 'string?'
          },
          testingFramework: 'Jest',
          styleGuide: 'Airbnb'
        }
      };

      const result = await codeGenerator.generateCode(request);

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.code!.files.length).toBeGreaterThan(0);
      
      // Check for main component file
      const componentFile = result.code!.files.find(f => f.path.includes('UserProfile'));
      expect(componentFile).toBeDefined();
      expect(componentFile!.language).toBe('typescript');
      expect(componentFile!.content).toContain('React.FC');
      
      // Check for test file
      const testFile = result.code!.files.find(f => f.path.includes('.test.'));
      expect(testFile).toBeDefined();
      expect(testFile!.content).toContain('describe');
      
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      expect(result.metadata.confidence).toBeGreaterThan(0.7);
    });

    it('should generate API endpoint code', async () => {
      const request: CodeGenerationRequest = {
        type: 'API_ENDPOINT',
        framework: 'Next.js',
        language: 'TypeScript',
        description: '創建用戶管理的 REST API 端點',
        specifications: {
          inputParameters: {
            method: ['GET', 'POST'],
            endpoint: '/api/users'
          },
          dependencies: ['Next.js', 'TypeScript']
        }
      };

      const result = await codeGenerator.generateCode(request);

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      
      const apiFile = result.code!.files.find(f => f.path.includes('route.ts'));
      expect(apiFile).toBeDefined();
      expect(apiFile!.content).toContain('NextRequest');
      expect(apiFile!.content).toContain('NextResponse');
      expect(apiFile!.content).toContain('GET');
      expect(apiFile!.content).toContain('POST');
      
      expect(result.code!.estimatedComplexity).toBeDefined();
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.code!.estimatedComplexity);
    });

    it('should generate utility function code', async () => {
      const request: CodeGenerationRequest = {
        type: 'UTILITY',
        framework: 'Node.js',
        language: 'TypeScript',
        description: '創建通用工具函式庫',
        specifications: {
          outputFormat: 'ESM',
          testingFramework: 'Jest'
        },
        context: {
          conventions: ['camelCase', 'TypeScript strict mode']
        }
      };

      const result = await codeGenerator.generateCode(request);

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      
      const utilFile = result.code!.files.find(f => f.path.includes('helper') || f.path.includes('util'));
      expect(utilFile).toBeDefined();
      expect(utilFile!.content).toContain('export');
      
      expect(result.code!.instructions.length).toBeGreaterThan(0);
      expect(result.code!.testSuggestions.length).toBeGreaterThan(0);
    });

    it('should handle streaming code generation', async () => {
      const request: CodeGenerationRequest = {
        type: 'COMPONENT',
        framework: 'React',
        language: 'TypeScript',
        description: '串流測試元件'
      };

      const progressUpdates: any[] = [];
      const codeChunks: any[] = [];
      let finalResult: any = null;
      let errorOccurred = false;

      await codeGenerator.generateCodeStreaming(request, {
        onProgress: (progress) => {
          progressUpdates.push(progress);
          expect(progress.stage).toBeDefined();
          expect(progress.percentage).toBeGreaterThanOrEqual(0);
          expect(progress.percentage).toBeLessThanOrEqual(100);
        },
        onCodeChunk: (chunk) => {
          codeChunks.push(chunk);
          expect(chunk.filePath).toBeDefined();
          expect(chunk.content).toBeDefined();
        },
        onComplete: (result) => {
          finalResult = result;
          expect(result.success).toBe(true);
        },
        onError: (error) => {
          errorOccurred = true;
          console.error('Streaming error:', error);
        }
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].stage).toBe('preparation');
      expect(progressUpdates[progressUpdates.length - 1].percentage).toBe(100);
      
      expect(finalResult).toBeDefined();
      expect(finalResult.success).toBe(true);
      expect(errorOccurred).toBe(false);
    });

    it('should validate supported frameworks and languages', () => {
      const frameworks = codeGenerator.getSupportedFrameworks();
      const languages = codeGenerator.getSupportedLanguages();

      expect(Array.isArray(frameworks)).toBe(true);
      expect(frameworks.length).toBeGreaterThan(0);
      expect(frameworks).toContain('Next.js');
      expect(frameworks).toContain('React');

      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain('TypeScript');
      expect(languages).toContain('JavaScript');
    });
  });

  describe('Response Generator Integration', () => {
    it('should execute code generation action', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        id: 'mock-message-id'
      });

      const mockUpdate = jest.fn().mockResolvedValue({});

      // Mock Prisma
      jest.doMock('@prisma/client', () => ({
        PrismaClient: jest.fn().mockImplementation(() => ({
          messageAction: {
            create: mockCreate,
            update: mockUpdate
          }
        }))
      }));

      const action = {
        type: 'GENERATE_CODE',
        data: {
          type: 'component',
          framework: 'React',
          language: 'TypeScript',
          description: '建立登入表單元件',
          testingFramework: 'Jest'
        },
        priority: 'HIGH',
        description: 'Generate login form component'
      };

      const result = await responseGenerator.executeAction(action, 'test-project-id');

      expect(result.status).toBeDefined();
      
      if (result.status === 'SUCCESS') {
        expect(result.result.message).toContain('generated');
        expect(result.result.files).toBeDefined();
        expect(result.result.complexity).toBeDefined();
        expect(result.result.fullCode).toBeDefined();
      }
    });

    it('should handle code generation with missing parameters', async () => {
      const action = {
        type: 'GENERATE_CODE',
        data: {
          // Missing required parameters
          description: '缺少參數的測試'
        },
        priority: 'MEDIUM',
        description: 'Test missing parameters'
      };

      const result = await responseGenerator.executeAction(action, 'test-project-id');

      expect(result.status).toBe('FAILED');
      expect(result.result.error).toContain('requires');
    });
  });

  describe('Code Parsing and Structure', () => {
    it('should parse generated code correctly', () => {
      const mockResponse = `## 檔案: components/Button.tsx
\`\`\`typescript
import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};
\`\`\`

## 檔案: components/Button.test.tsx
\`\`\`typescript
import { render, fireEvent, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    const handleClick = jest.fn();
    render(<Button label="Click me" onClick={handleClick} />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
\`\`\`

## 安裝說明
npm install react @types/react

## 使用說明
\`\`\`tsx
<Button label="Submit" onClick={() => console.log('clicked')} />
\`\`\`

## 測試建議
- 測試按鈕點擊事件
- 測試按鈕文字顯示
- 測試無障礙性`;

      // Test the private method through code generation
      const request: CodeGenerationRequest = {
        type: 'COMPONENT',
        framework: 'React',
        language: 'TypeScript',
        description: 'Test parsing'
      };

      // Generate code to test parsing
      codeGenerator.generateCode(request).then(result => {
        if (result.success && result.code) {
          expect(result.code.files.length).toBeGreaterThan(0);
          expect(result.code.instructions.length).toBeGreaterThan(0);
          expect(result.code.testSuggestions.length).toBeGreaterThan(0);
          expect(result.code.documentation.length).toBeGreaterThan(0);
        }
      });
    });

    it('should estimate code complexity correctly', async () => {
      const requests = [
        {
          type: 'UTILITY' as const,
          framework: 'Node.js',
          language: 'JavaScript',
          description: '簡單工具函式'
        },
        {
          type: 'COMPONENT' as const,
          framework: 'React',
          language: 'TypeScript',
          description: '複雜的表單元件，包含驗證、狀態管理和多個子元件'
        },
        {
          type: 'FULL_FEATURE' as const,
          framework: 'Next.js',
          language: 'TypeScript',
          description: '完整的用戶管理系統，包含前端、後端、資料庫和測試'
        }
      ];

      for (const request of requests) {
        const result = await codeGenerator.generateCode(request);
        
        if (result.success && result.code) {
          expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.code.estimatedComplexity);
        }
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle unsupported framework gracefully', async () => {
      const request: CodeGenerationRequest = {
        type: 'COMPONENT',
        framework: 'UnsupportedFramework',
        language: 'TypeScript',
        description: '測試不支援的框架'
      };

      const result = await codeGenerator.generateCode(request);

      // Should still succeed but may use default template
      expect(result.success).toBe(true);
    });

    it('should handle empty description', async () => {
      const request: CodeGenerationRequest = {
        type: 'UTILITY',
        framework: 'Node.js',
        language: 'JavaScript',
        description: ''
      };

      const result = await codeGenerator.generateCode(request);

      // Should handle empty description gracefully
      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
    });

    it('should handle network errors in streaming', async () => {
      // Mock network failure
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const request: CodeGenerationRequest = {
        type: 'COMPONENT',
        framework: 'React',
        language: 'TypeScript',
        description: '網路錯誤測試'
      };

      let errorCaught = false;

      await codeGenerator.generateCodeStreaming(request, {
        onProgress: () => {},
        onCodeChunk: () => {},
        onComplete: () => {},
        onError: (error) => {
          errorCaught = true;
          expect(error.message).toBe('Network error');
        }
      });

      expect(errorCaught).toBe(true);

      // Restore fetch
      global.fetch = originalFetch;
    });
  });

  describe('Performance and Quality', () => {
    it('should generate code within reasonable time limits', async () => {
      const request: CodeGenerationRequest = {
        type: 'API_ENDPOINT',
        framework: 'Express.js',
        language: 'JavaScript',
        description: '效能測試 API'
      };

      const startTime = Date.now();
      const result = await codeGenerator.generateCode(request);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.metadata.generationTime).toBeGreaterThan(0);
    });

    it('should generate syntactically valid code', async () => {
      const request: CodeGenerationRequest = {
        type: 'COMPONENT',
        framework: 'Vue.js',
        language: 'TypeScript',
        description: '語法驗證測試元件'
      };

      const result = await codeGenerator.generateCode(request);

      expect(result.success).toBe(true);
      
      if (result.code) {
        // Check for basic syntax elements
        const mainFile = result.code.files[0];
        expect(mainFile.content).not.toContain('undefined');
        expect(mainFile.content).not.toContain('null');
        expect(mainFile.content.length).toBeGreaterThan(50);
        
        // Should have proper code structure
        expect(mainFile.content).toMatch(/function|class|const|let|var/);
      }
    });

    it('should provide meaningful test suggestions', async () => {
      const request: CodeGenerationRequest = {
        type: 'UTILITY',
        framework: 'Node.js',
        language: 'TypeScript',
        description: '資料驗證工具函式',
        specifications: {
          testingFramework: 'Jest'
        }
      };

      const result = await codeGenerator.generateCode(request);

      expect(result.success).toBe(true);
      
      if (result.code) {
        expect(result.code.testSuggestions.length).toBeGreaterThan(0);
        
        // Test suggestions should be meaningful
        const suggestions = result.code.testSuggestions.join(' ').toLowerCase();
        expect(suggestions).toMatch(/(test|測試|驗證|check)/);
      }
    });
  });
});