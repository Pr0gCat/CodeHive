import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export interface WorkspaceSnapshot {
  cycleId: string;
  branchName: string;
  phase: string;
  snapshotId: string;
  files: FileSnapshot[];
  metadata: {
    tests: any[];
    artifacts: any[];
    queries: any[];
  };
  createdAt: Date;
}

export interface FileSnapshot {
  path: string;
  content: string;
  hash: string;
  lastModified: Date;
}

export interface FileChange {
  type: 'CREATE' | 'MODIFY' | 'DELETE';
  path: string;
  content?: string;
  oldContent?: string;
}

export class WorkspaceManager {
  private projectPath: string;
  private snapshotPath: string;
  private fileCache: Map<string, string> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.snapshotPath = path.join(projectPath, '.codehive', 'workspaces');
  }

  /**
   * 初始化工作空間管理器
   */
  async initialize(): Promise<void> {
    // 創建 .codehive 目錄結構
    const dirs = [
      path.join(this.projectPath, '.codehive'),
      path.join(this.projectPath, '.codehive', 'cycles'),
      path.join(this.projectPath, '.codehive', 'workspaces'),
      path.join(this.projectPath, '.codehive', 'locks'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // 確保 .gitignore 包含 .codehive
    await this.updateGitignore();
  }

  /**
   * 創建工作空間快照
   */
  async createSnapshot(
    cycleId: string,
    branchName: string,
    phase: string
  ): Promise<WorkspaceSnapshot> {
    const snapshotId = `snapshot-${cycleId}-${Date.now()}`;
    const snapshotDir = path.join(this.snapshotPath, snapshotId);

    await fs.mkdir(snapshotDir, { recursive: true });

    // 獲取所有需要快照的檔案
    const files = await this.getRelevantFiles(cycleId);
    const fileSnapshots: FileSnapshot[] = [];

    for (const filePath of files) {
      const snapshot = await this.snapshotFile(filePath, snapshotDir);
      if (snapshot) {
        fileSnapshots.push(snapshot);
      }
    }

    // 從資料庫獲取元數據
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        tests: true,
        artifacts: true,
        queries: { where: { status: 'PENDING' } },
      },
    });

    const workspaceSnapshot: WorkspaceSnapshot = {
      cycleId,
      branchName,
      phase,
      snapshotId,
      files: fileSnapshots,
      metadata: {
        tests: cycle?.tests || [],
        artifacts: cycle?.artifacts || [],
        queries: cycle?.queries || [],
      },
      createdAt: new Date(),
    };

    // 保存快照元數據
    await this.saveSnapshotMetadata(workspaceSnapshot);

    return workspaceSnapshot;
  }

  /**
   * 恢復工作空間快照
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snapshot = await this.loadSnapshotMetadata(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    const snapshotDir = path.join(this.snapshotPath, snapshotId);

    // 恢復所有檔案
    for (const file of snapshot.files) {
      await this.restoreFile(file, snapshotDir);
    }

    // 清理快取
    this.fileCache.clear();
  }

  /**
   * 分析檔案變更
   */
  async analyzeChanges(
    cycleId: string,
    previousSnapshotId?: string
  ): Promise<FileChange[]> {
    const changes: FileChange[] = [];

    if (!previousSnapshotId) {
      return changes;
    }

    const previousSnapshot =
      await this.loadSnapshotMetadata(previousSnapshotId);
    if (!previousSnapshot) {
      return changes;
    }

    const currentFiles = await this.getRelevantFiles(cycleId);
    const previousFiles = new Map(previousSnapshot.files.map(f => [f.path, f]));

    // 檢查新增和修改的檔案
    for (const filePath of currentFiles) {
      const currentContent = await this.readFile(filePath);
      const currentHash = this.calculateHash(currentContent);
      const previousFile = previousFiles.get(filePath);

      if (!previousFile) {
        changes.push({
          type: 'CREATE',
          path: filePath,
          content: currentContent,
        });
      } else if (previousFile.hash !== currentHash) {
        changes.push({
          type: 'MODIFY',
          path: filePath,
          content: currentContent,
          oldContent: previousFile.content,
        });
      }

      previousFiles.delete(filePath);
    }

    // 檢查刪除的檔案
    for (const [filePath, file] of Array.from(previousFiles)) {
      changes.push({
        type: 'DELETE',
        path: filePath,
        oldContent: file.content,
      });
    }

    return changes;
  }

  /**
   * 檢測檔案衝突
   */
  async detectConflicts(cycleId1: string, cycleId2: string): Promise<string[]> {
    const conflicts: string[] = [];

    const files1 = await this.getRelevantFiles(cycleId1);
    const files2 = await this.getRelevantFiles(cycleId2);

    const commonFiles = files1.filter(f => files2.includes(f));

    for (const filePath of commonFiles) {
      const isModified1 = await this.isFileModified(filePath, cycleId1);
      const isModified2 = await this.isFileModified(filePath, cycleId2);

      if (isModified1 && isModified2) {
        conflicts.push(filePath);
      }
    }

    return conflicts;
  }

  /**
   * 清理舊快照
   */
  async cleanupOldSnapshots(daysToKeep: number = 7): Promise<void> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const snapshots = await fs.readdir(this.snapshotPath);

    for (const snapshotId of snapshots) {
      const metadata = await this.loadSnapshotMetadata(snapshotId);
      if (metadata && metadata.createdAt < cutoffDate) {
        const snapshotDir = path.join(this.snapshotPath, snapshotId);
        await fs.rm(snapshotDir, { recursive: true, force: true });
      }
    }
  }

  // 輔助方法

  private async getRelevantFiles(cycleId: string): Promise<string[]> {
    // 獲取週期相關的檔案
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      include: { artifacts: true },
    });

    if (!cycle) {
      return [];
    }

    const files: string[] = [];

    // 從 artifacts 中提取檔案路徑
    for (const artifact of cycle.artifacts) {
      if (artifact.path) {
        files.push(artifact.path);
      }
    }

    // 添加測試檔案
    const testFiles = await this.findTestFiles();
    files.push(...testFiles);

    // 添加源代碼檔案
    const sourceFiles = await this.findSourceFiles();
    files.push(...sourceFiles);

    return Array.from(new Set(files)); // 去重
  }

  private async findTestFiles(): Promise<string[]> {
    const testDirs = ['tests', 'test', '__tests__', 'spec'];
    const files: string[] = [];

    for (const dir of testDirs) {
      const dirPath = path.join(this.projectPath, dir);
      try {
        await fs.access(dirPath);
        const testFiles = await this.findFilesRecursive(
          dirPath,
          /\.(test|spec)\.(ts|js|tsx|jsx)$/
        );
        files.push(...testFiles);
      } catch {
        // 目錄不存在，跳過
      }
    }

    return files;
  }

  private async findSourceFiles(): Promise<string[]> {
    const sourceDirs = ['src', 'app', 'lib'];
    const files: string[] = [];

    for (const dir of sourceDirs) {
      const dirPath = path.join(this.projectPath, dir);
      try {
        await fs.access(dirPath);
        const sourceFiles = await this.findFilesRecursive(
          dirPath,
          /\.(ts|js|tsx|jsx)$/
        );
        files.push(...sourceFiles);
      } catch {
        // 目錄不存在，跳過
      }
    }

    return files;
  }

  private async findFilesRecursive(
    dir: string,
    pattern: RegExp
  ): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules'
      ) {
        const subFiles = await this.findFilesRecursive(fullPath, pattern);
        files.push(...subFiles);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        const relativePath = path.relative(this.projectPath, fullPath);
        files.push(relativePath);
      }
    }

    return files;
  }

  private async snapshotFile(
    filePath: string,
    snapshotDir: string
  ): Promise<FileSnapshot | null> {
    try {
      const fullPath = path.join(this.projectPath, filePath);
      const content = await this.readFile(filePath);
      const hash = this.calculateHash(content);
      const stats = await fs.stat(fullPath);

      // 保存檔案內容到快照目錄
      const snapshotFilePath = path.join(snapshotDir, filePath);
      await fs.mkdir(path.dirname(snapshotFilePath), { recursive: true });
      await fs.writeFile(snapshotFilePath, content);

      return {
        path: filePath,
        content,
        hash,
        lastModified: stats.mtime,
      };
    } catch (error) {
      console.error(`Failed to snapshot file ${filePath}:`, error);
      return null;
    }
  }

  private async restoreFile(
    file: FileSnapshot,
    snapshotDir: string
  ): Promise<void> {
    const fullPath = path.join(this.projectPath, file.path);
    const snapshotFilePath = path.join(snapshotDir, file.path);

    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.copyFile(snapshotFilePath, fullPath);
    } catch (error) {
      console.error(`Failed to restore file ${file.path}:`, error);
    }
  }

  private async readFile(filePath: string): Promise<string> {
    const fullPath = path.join(this.projectPath, filePath);

    // 使用快取
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    this.fileCache.set(filePath, content);

    return content;
  }

  private calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async isFileModified(
    filePath: string,
    cycleId: string
  ): Promise<boolean> {
    // 簡化版本 - 實際應該比較與基準分支的差異
    try {
      await fs.access(path.join(this.projectPath, filePath));
      return true;
    } catch {
      return false;
    }
  }

  private async saveSnapshotMetadata(
    snapshot: WorkspaceSnapshot
  ): Promise<void> {
    const metadataPath = path.join(
      this.snapshotPath,
      snapshot.snapshotId,
      'metadata.json'
    );
    await fs.writeFile(metadataPath, JSON.stringify(snapshot, null, 2));
  }

  private async loadSnapshotMetadata(
    snapshotId: string
  ): Promise<WorkspaceSnapshot | null> {
    try {
      const metadataPath = path.join(
        this.snapshotPath,
        snapshotId,
        'metadata.json'
      );
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async updateGitignore(): Promise<void> {
    const gitignorePath = path.join(this.projectPath, '.gitignore');

    try {
      let content = await fs.readFile(gitignorePath, 'utf-8');

      if (!content.includes('.codehive')) {
        content += '\n# CodeHive\n.codehive/\n';
        await fs.writeFile(gitignorePath, content);
      }
    } catch {
      // 如果 .gitignore 不存在，創建它
      await fs.writeFile(gitignorePath, '# CodeHive\n.codehive/\n');
    }
  }
}
