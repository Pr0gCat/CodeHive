import { promises as fs } from 'fs';
import { join, extname, basename } from 'path';
import { ProjectStructure, FileInfo } from '../project-manager';

export class ProjectAnalyzer {
  async analyzeStructure(projectPath: string): Promise<ProjectStructure> {
    try {
      const files = await this.walkDirectory(projectPath);

      const structure: ProjectStructure = {
        directories: [],
        files: files,
        packageFiles: [],
        configFiles: [],
        testFiles: [],
        sourceFiles: [],
      };

      // Categorize files
      for (const file of files) {
        const fileName = basename(file.path).toLowerCase();
        const ext = extname(file.path).toLowerCase();
        const relativePath = file.path
          .replace(projectPath, '')
          .replace(/\\/g, '/');

        // Package files
        if (
          [
            'package.json',
            'package-lock.json',
            'yarn.lock',
            'pnpm-lock.yaml',
            'bun.lockb',
          ].includes(fileName)
        ) {
          structure.packageFiles.push(relativePath);
        }

        // Config files
        if (this.isConfigFile(fileName, ext)) {
          structure.configFiles.push(relativePath);
        }

        // Test files
        if (this.isTestFile(fileName, relativePath)) {
          structure.testFiles.push(relativePath);
        }

        // Source files
        if (this.isSourceFile(ext)) {
          structure.sourceFiles.push(relativePath);
        }
      }

      // Get unique directories
      const dirSet = new Set(
        files
          .map(f => f.path.replace(projectPath, '').replace(/\\/g, '/'))
          .map(p => p.split('/').slice(0, -1).join('/'))
          .filter(d => d.length > 0)
      );
      structure.directories = Array.from(dirSet);

      return structure;
    } catch (error) {
      console.error('Error analyzing project structure:', error);
      return {
        directories: [],
        files: [],
        packageFiles: [],
        configFiles: [],
        testFiles: [],
        sourceFiles: [],
      };
    }
  }

  async detectFramework(projectPath: string): Promise<string | undefined> {
    try {
      // Check package.json for framework indicators
      const packageJsonPath = join(projectPath, 'package.json');
      try {
        const packageJson = JSON.parse(
          await fs.readFile(packageJsonPath, 'utf-8')
        );
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        // Framework detection order (most specific first)
        if (deps['next']) return 'Next.js';
        if (deps['react']) return 'React';
        if (deps['vue']) return 'Vue.js';
        if (deps['@angular/core']) return 'Angular';
        if (deps['svelte']) return 'Svelte';
        if (deps['express']) return 'Express.js';
        if (deps['fastify']) return 'Fastify';
        if (deps['nestjs']) return 'NestJS';
        if (deps['nuxt']) return 'Nuxt.js';
        if (deps['gatsby']) return 'Gatsby';
      } catch {
        // Package.json not found or invalid
      }

      // Check for framework-specific files
      const files = await fs.readdir(projectPath);
      if (files.includes('next.config.js') || files.includes('next.config.ts'))
        return 'Next.js';
      if (files.includes('vue.config.js')) return 'Vue.js';
      if (files.includes('angular.json')) return 'Angular';
      if (files.includes('svelte.config.js')) return 'Svelte';
      if (files.includes('gatsby-config.js')) return 'Gatsby';
      if (files.includes('nuxt.config.js') || files.includes('nuxt.config.ts'))
        return 'Nuxt.js';

      return undefined;
    } catch (error) {
      console.error('Error detecting framework:', error);
      return undefined;
    }
  }

  async detectLanguage(projectPath: string): Promise<string | undefined> {
    try {
      const files = await this.walkDirectory(projectPath);
      const extensions = files.map(f => extname(f.path).toLowerCase());
      const extCounts = extensions.reduce(
        (acc, ext) => {
          acc[ext] = (acc[ext] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Sort by count
      const sortedExts = Object.entries(extCounts).sort(
        ([, a], [, b]) => b - a
      );

      // Language detection
      for (const [ext] of sortedExts) {
        switch (ext) {
          case '.ts':
          case '.tsx':
            return 'typescript';
          case '.js':
          case '.jsx':
            return 'javascript';
          case '.py':
            return 'python';
          case '.java':
            return 'java';
          case '.go':
            return 'go';
          case '.rs':
            return 'rust';
          case '.cpp':
          case '.cc':
          case '.cxx':
            return 'cpp';
          case '.c':
            return 'c';
          case '.cs':
            return 'csharp';
          case '.php':
            return 'php';
          case '.rb':
            return 'ruby';
        }
      }

      return undefined;
    } catch (error) {
      console.error('Error detecting language:', error);
      return undefined;
    }
  }

  async extractDependencies(projectPath: string): Promise<string[]> {
    try {
      const dependencies: string[] = [];

      // Node.js dependencies
      try {
        const packageJsonPath = join(projectPath, 'package.json');
        const packageJson = JSON.parse(
          await fs.readFile(packageJsonPath, 'utf-8')
        );
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };
        dependencies.push(...Object.keys(deps));
      } catch {
        // No package.json
      }

      // Python dependencies
      try {
        const requirementsPath = join(projectPath, 'requirements.txt');
        const requirements = await fs.readFile(requirementsPath, 'utf-8');
        const pythonDeps = requirements
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'))
          .map(line =>
            line.split('==')[0].split('>=')[0].split('<=')[0].trim()
          );
        dependencies.push(...pythonDeps);
      } catch {
        // No requirements.txt
      }

      // Java dependencies (basic Maven)
      try {
        const pomPath = join(projectPath, 'pom.xml');
        const pomContent = await fs.readFile(pomPath, 'utf-8');
        // Simple regex to extract artifactId from dependencies
        const matches =
          pomContent.match(/<artifactId>([^<]+)<\/artifactId>/g) || [];
        const javaDeps = matches.map(match =>
          match.replace(/<\/?artifactId>/g, '')
        );
        dependencies.push(...javaDeps);
      } catch {
        // No pom.xml
      }

      return Array.from(new Set(dependencies)); // Remove duplicates
    } catch (error) {
      console.error('Error extracting dependencies:', error);
      return [];
    }
  }

  private async walkDirectory(
    dirPath: string,
    files: FileInfo[] = []
  ): Promise<FileInfo[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        // Skip common directories that shouldn't be analyzed
        if (entry.isDirectory() && this.shouldSkipDirectory(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.walkDirectory(fullPath, files);
        } else {
          try {
            const stats = await fs.stat(fullPath);
            files.push({
              path: fullPath,
              type: extname(entry.name).slice(1) || 'file',
              size: stats.size,
              lastModified: stats.mtime,
            });
          } catch {
            // Skip files that can't be accessed
          }
        }
      }

      return files;
    } catch (error) {
      console.error(`Error walking directory ${dirPath}:`, error);
      return files;
    }
  }

  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      'coverage',
      '.nyc_output',
      'vendor',
      '__pycache__',
      '.pytest_cache',
      'target', // Java/Rust
      'bin',
      'obj',
      '.vscode',
      '.idea',
      'tmp',
      'temp',
      'logs',
      '.DS_Store',
    ];

    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  private isConfigFile(fileName: string, ext: string): boolean {
    const configFiles = [
      'tsconfig.json',
      'jsconfig.json',
      'webpack.config.js',
      'vite.config.js',
      'rollup.config.js',
      'babel.config.js',
      '.babelrc',
      'eslint.config.js',
      '.eslintrc.js',
      '.eslintrc.json',
      'prettier.config.js',
      '.prettierrc',
      'tailwind.config.js',
      'postcss.config.js',
      'jest.config.js',
      'vitest.config.js',
      'cypress.config.js',
      'playwright.config.js',
      'docker-compose.yml',
      'dockerfile',
      '.env',
      '.env.local',
      '.env.example',
      'makefile',
      'cargo.toml',
      'go.mod',
      'pom.xml',
      'build.gradle',
      'requirements.txt',
      'pipfile',
      'poetry.lock',
      'pyproject.toml',
    ];

    return (
      configFiles.includes(fileName) ||
      ['.json', '.yml', '.yaml', '.toml', '.ini', '.conf'].includes(ext)
    );
  }

  private isTestFile(fileName: string, relativePath: string): boolean {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /_test\./,
      /_spec\./,
      /test_/,
      /spec_/,
    ];

    const testDirs = ['/test/', '/tests/', '/__tests__/', '/spec/', '/specs/'];

    return (
      testPatterns.some(pattern => pattern.test(fileName)) ||
      testDirs.some(dir => relativePath.includes(dir))
    );
  }

  private isSourceFile(ext: string): boolean {
    const sourceExts = [
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.py',
      '.java',
      '.go',
      '.rs',
      '.cpp',
      '.cc',
      '.cxx',
      '.c',
      '.cs',
      '.php',
      '.rb',
      '.swift',
      '.kt',
      '.scala',
      '.clj',
      '.elm',
      '.vue',
      '.svelte',
    ];

    return sourceExts.includes(ext);
  }
}
