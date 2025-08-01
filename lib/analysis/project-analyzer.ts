import { promises as fs } from 'fs';
import { join, extname, relative } from 'path';
import { taskManager } from '@/lib/tasks/task-manager';

export interface FileAnalysis {
  path: string;
  size: number;
  extension: string;
  type: 'code' | 'config' | 'documentation' | 'asset' | 'other';
  language?: string;
}

export interface ProjectAnalysisResult {
  totalFiles: number;
  totalSize: number;
  filesByType: Record<string, number>;
  filesByLanguage: Record<string, number>;
  detectedFramework?: string;
  detectedLanguage?: string;
  detectedPackageManager?: string;
  detectedTestFramework?: string;
  packageJsonContent?: any;
  readmeContent?: string;
  gitignorePatterns?: string[];
  dependencies?: string[];
  devDependencies?: string[];
}

export class ProjectAnalyzer {
  private static readonly FILE_TYPE_MAP: Record<
    string,
    { type: string; language?: string }
  > = {
    // JavaScript/TypeScript
    '.js': { type: 'code', language: 'javascript' },
    '.jsx': { type: 'code', language: 'javascript' },
    '.ts': { type: 'code', language: 'typescript' },
    '.tsx': { type: 'code', language: 'typescript' },
    '.mjs': { type: 'code', language: 'javascript' },
    '.cjs': { type: 'code', language: 'javascript' },

    // Python
    '.py': { type: 'code', language: 'python' },
    '.pyw': { type: 'code', language: 'python' },
    '.pyx': { type: 'code', language: 'python' },

    // Java
    '.java': { type: 'code', language: 'java' },
    '.class': { type: 'code', language: 'java' },
    '.jar': { type: 'code', language: 'java' },

    // C/C++
    '.c': { type: 'code', language: 'c' },
    '.cpp': { type: 'code', language: 'cpp' },
    '.cc': { type: 'code', language: 'cpp' },
    '.cxx': { type: 'code', language: 'cpp' },
    '.h': { type: 'code', language: 'c' },
    '.hpp': { type: 'code', language: 'cpp' },

    // Go
    '.go': { type: 'code', language: 'go' },

    // Rust
    '.rs': { type: 'code', language: 'rust' },

    // PHP
    '.php': { type: 'code', language: 'php' },
    '.phtml': { type: 'code', language: 'php' },

    // Ruby
    '.rb': { type: 'code', language: 'ruby' },
    '.rbw': { type: 'code', language: 'ruby' },

    // Web
    '.html': { type: 'code', language: 'html' },
    '.htm': { type: 'code', language: 'html' },
    '.css': { type: 'code', language: 'css' },
    '.scss': { type: 'code', language: 'scss' },
    '.sass': { type: 'code', language: 'sass' },
    '.less': { type: 'code', language: 'less' },
    '.vue': { type: 'code', language: 'vue' },
    '.svelte': { type: 'code', language: 'svelte' },

    // Config files
    '.json': { type: 'config' },
    '.yaml': { type: 'config' },
    '.yml': { type: 'config' },
    '.toml': { type: 'config' },
    '.ini': { type: 'config' },
    '.cfg': { type: 'config' },
    '.conf': { type: 'config' },
    '.env': { type: 'config' },
    '.config': { type: 'config' },

    // Documentation
    '.md': { type: 'documentation' },
    '.txt': { type: 'documentation' },
    '.rst': { type: 'documentation' },
    '.doc': { type: 'documentation' },
    '.docx': { type: 'documentation' },
    '.pdf': { type: 'documentation' },

    // Assets
    '.png': { type: 'asset' },
    '.jpg': { type: 'asset' },
    '.jpeg': { type: 'asset' },
    '.gif': { type: 'asset' },
    '.svg': { type: 'asset' },
    '.ico': { type: 'asset' },
    '.webp': { type: 'asset' },
    '.mp4': { type: 'asset' },
    '.webm': { type: 'asset' },
    '.mp3': { type: 'asset' },
    '.wav': { type: 'asset' },
    '.ttf': { type: 'asset' },
    '.woff': { type: 'asset' },
    '.woff2': { type: 'asset' },
    '.eot': { type: 'asset' },
  };

  private static readonly IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    '.next',
    '.nuxt',
    'dist',
    'build',
    'out',
    'target',
    'bin',
    'obj',
    '.DS_Store',
    'Thumbs.db',
    '*.log',
    '.env.local',
    '.env.production',
    'coverage',
    '.nyc_output',
    '.pytest_cache',
    '__pycache__',
    '*.pyc',
    '.vscode',
    '.idea',
    '.venv',
    'venv',
    '.cache',
  ];

  /**
   * Analyze a project directory with real progress tracking
   */
  async analyzeProject(
    projectPath: string,
    taskId?: string,
    phaseId?: string
  ): Promise<ProjectAnalysisResult> {
    const startTime = Date.now();

    // Initialize result
    const result: ProjectAnalysisResult = {
      totalFiles: 0,
      totalSize: 0,
      filesByType: {},
      filesByLanguage: {},
    };

    try {
      // Phase 1: Scan directory structure
      await this.updateProgress(taskId, phaseId, 5, '掃描專案目錄結構...');

      const files = await this.scanDirectory(projectPath, taskId, phaseId);
      result.totalFiles = files.length;

      await this.updateProgress(
        taskId,
        phaseId,
        20,
        `發現 ${files.length} 個檔案`
      );

      // Phase 2: Analyze files
      let processedFiles = 0;
      const fileAnalyses: FileAnalysis[] = [];

      for (const filePath of files) {
        try {
          const analysis = await this.analyzeFile(projectPath, filePath);
          fileAnalyses.push(analysis);

          // Update counters
          result.totalSize += analysis.size;
          result.filesByType[analysis.type] =
            (result.filesByType[analysis.type] || 0) + 1;

          if (analysis.language) {
            result.filesByLanguage[analysis.language] =
              (result.filesByLanguage[analysis.language] || 0) + 1;
          }

          processedFiles++;

          // Update progress every 10 files or on last file
          if (processedFiles % 10 === 0 || processedFiles === files.length) {
            const progress = 20 + (processedFiles / files.length) * 50; // 20-70%
            await this.updateProgress(
              taskId,
              phaseId,
              progress,
              `分析檔案中... (${processedFiles}/${files.length})`
            );
          }
        } catch (error) {
          console.warn(`Failed to analyze file ${filePath}:`, error);
        }
      }

      // Phase 3: Detect project characteristics
      await this.updateProgress(taskId, phaseId, 75, '檢測專案框架和技術棧...');

      const projectCharacteristics = await this.detectProjectCharacteristics(
        projectPath,
        fileAnalyses
      );
      Object.assign(result, projectCharacteristics);

      // Phase 4: Generate summary
      await this.updateProgress(taskId, phaseId, 90, '生成專案摘要...');

      const duration = Date.now() - startTime;
      const metrics = {
        analysisTime: duration,
        filesPerSecond: result.totalFiles / (duration / 1000),
        averageFileSize: result.totalSize / result.totalFiles,
      };

      await this.updateProgress(taskId, phaseId, 100, '專案分析完成', metrics);

      console.log(
        `📊 Project analysis completed in ${duration}ms: ${result.totalFiles} files, ${(result.totalSize / 1024 / 1024).toFixed(2)}MB`
      );

      return result;
    } catch (error) {
      console.error('Project analysis failed:', error);
      throw error;
    }
  }

  /**
   * Recursively scan directory for files
   */
  private async scanDirectory(
    projectPath: string,
    taskId?: string,
    phaseId?: string,
    relativePath: string = ''
  ): Promise<string[]> {
    const files: string[] = [];
    const currentPath = join(projectPath, relativePath);

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = join(relativePath, entry.name);

        // Check if should ignore
        if (this.shouldIgnore(entry.name, entryPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Recursively scan subdirectory
          const subFiles = await this.scanDirectory(
            projectPath,
            taskId,
            phaseId,
            entryPath
          );
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(entryPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${currentPath}:`, error);
    }

    return files;
  }

  /**
   * Analyze individual file
   */
  private async analyzeFile(
    projectPath: string,
    relativePath: string
  ): Promise<FileAnalysis> {
    const fullPath = join(projectPath, relativePath);
    const ext = extname(relativePath).toLowerCase();
    const stats = await fs.stat(fullPath);

    const typeInfo = ProjectAnalyzer.FILE_TYPE_MAP[ext] || { type: 'other' };

    return {
      path: relativePath,
      size: stats.size,
      extension: ext,
      type: typeInfo.type as any,
      language: typeInfo.language,
    };
  }

  /**
   * Detect project framework and characteristics
   */
  private async detectProjectCharacteristics(
    projectPath: string,
    files: FileAnalysis[]
  ): Promise<Partial<ProjectAnalysisResult>> {
    const result: Partial<ProjectAnalysisResult> = {};

    // Check for package.json (Node.js projects)
    const packageJsonPath = join(projectPath, 'package.json');
    if (await this.fileExists(packageJsonPath)) {
      try {
        const packageJsonContent = JSON.parse(
          await fs.readFile(packageJsonPath, 'utf-8')
        );
        result.packageJsonContent = packageJsonContent;
        result.dependencies = Object.keys(
          packageJsonContent.dependencies || {}
        );
        result.devDependencies = Object.keys(
          packageJsonContent.devDependencies || {}
        );

        // Detect framework from dependencies
        if (
          packageJsonContent.dependencies?.next ||
          packageJsonContent.devDependencies?.next
        ) {
          result.detectedFramework = 'Next.js';
        } else if (
          packageJsonContent.dependencies?.react ||
          packageJsonContent.devDependencies?.react
        ) {
          result.detectedFramework = 'React';
        } else if (
          packageJsonContent.dependencies?.vue ||
          packageJsonContent.devDependencies?.vue
        ) {
          result.detectedFramework = 'Vue.js';
        } else if (packageJsonContent.dependencies?.['@angular/core']) {
          result.detectedFramework = 'Angular';
        } else if (packageJsonContent.dependencies?.express) {
          result.detectedFramework = 'Express.js';
        }

        // Detect package manager
        if (await this.fileExists(join(projectPath, 'yarn.lock'))) {
          result.detectedPackageManager = 'yarn';
        } else if (await this.fileExists(join(projectPath, 'pnpm-lock.yaml'))) {
          result.detectedPackageManager = 'pnpm';
        } else if (await this.fileExists(join(projectPath, 'bun.lockb'))) {
          result.detectedPackageManager = 'bun';
        } else {
          result.detectedPackageManager = 'npm';
        }

        // Detect test framework
        if (packageJsonContent.devDependencies?.jest) {
          result.detectedTestFramework = 'jest';
        } else if (packageJsonContent.devDependencies?.vitest) {
          result.detectedTestFramework = 'vitest';
        } else if (packageJsonContent.devDependencies?.cypress) {
          result.detectedTestFramework = 'cypress';
        }
      } catch (error) {
        console.warn('Failed to parse package.json:', error);
      }
    }

    // Check for Python projects
    if (
      (await this.fileExists(join(projectPath, 'requirements.txt'))) ||
      (await this.fileExists(join(projectPath, 'pyproject.toml'))) ||
      (await this.fileExists(join(projectPath, 'setup.py')))
    ) {
      result.detectedLanguage = 'python';

      if (await this.fileExists(join(projectPath, 'manage.py'))) {
        result.detectedFramework = 'Django';
      } else if (
        files.some(f => f.path.includes('app.py') || f.path.includes('main.py'))
      ) {
        result.detectedFramework = 'Flask/FastAPI';
      }
    }

    // Check for Go projects
    if (await this.fileExists(join(projectPath, 'go.mod'))) {
      result.detectedLanguage = 'go';
    }

    // Check for Rust projects
    if (await this.fileExists(join(projectPath, 'Cargo.toml'))) {
      result.detectedLanguage = 'rust';
    }

    // Check for Java projects
    if (await this.fileExists(join(projectPath, 'pom.xml'))) {
      result.detectedLanguage = 'java';
      result.detectedFramework = 'Maven';
    } else if (await this.fileExists(join(projectPath, 'build.gradle'))) {
      result.detectedLanguage = 'java';
      result.detectedFramework = 'Gradle';
    }

    // Read README if exists
    const readmePaths = ['README.md', 'README.txt', 'README.rst', 'readme.md'];
    for (const readmePath of readmePaths) {
      if (await this.fileExists(join(projectPath, readmePath))) {
        try {
          result.readmeContent = await fs.readFile(
            join(projectPath, readmePath),
            'utf-8'
          );
          break;
        } catch (error) {
          console.warn(`Failed to read ${readmePath}:`, error);
        }
      }
    }

    // Detect primary language from file counts
    if (
      !result.detectedLanguage &&
      Object.keys(result.filesByLanguage || {}).length > 0
    ) {
      const languageCounts = result.filesByLanguage || {};
      result.detectedLanguage = Object.keys(languageCounts).reduce((a, b) =>
        languageCounts[a] > languageCounts[b] ? a : b
      );
    }

    return result;
  }

  /**
   * Check if file should be ignored
   */
  private shouldIgnore(fileName: string, filePath: string): boolean {
    return ProjectAnalyzer.IGNORE_PATTERNS.some(pattern => {
      if (pattern.includes('*')) {
        // Simple glob pattern matching
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(fileName) || regex.test(filePath);
      } else {
        return fileName === pattern || filePath.includes(pattern);
      }
    });
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update progress if task tracking is enabled
   */
  private async updateProgress(
    taskId?: string,
    phaseId?: string,
    progress?: number,
    message?: string,
    details?: any
  ) {
    if (taskId && phaseId && progress !== undefined && message) {
      await taskManager.updatePhaseProgress(taskId, phaseId, progress, {
        type: 'PHASE_PROGRESS',
        message,
        details,
      });
    }
  }
}

export const projectAnalyzer = new ProjectAnalyzer();
