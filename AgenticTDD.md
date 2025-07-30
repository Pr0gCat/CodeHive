# Agentic Test Driven Development Project's Life Cycle

## 專案生命週期 (Project Life Cycle)

### 1. 需求獲取與用戶故事 (Requirements & User Stories)

- 收集用戶需求、功能規格和業務目標
- 將需求轉換為用戶故事格式
- 定義驗收標準和成功指標

### 2. 專案經理代理分析與提案 (Project Manager Agent Analysis)

- 專案經理代理分析需求並提出初步方案
- 通過用戶查詢系統向用戶展示提案
- 包含技術架構、開發計劃和時間估算

### 3. 用戶審查與反饋 (User Review & Feedback)

- 用戶審查專案經理代理的提案
- 提供修改意見和調整建議
- 迭代優化直到提案符合用戶期望

### 4. 專案啟動批准 (Project Approval)

- 用戶確認提案並按下批准按鈕
- 系統創建專案並初始化開發環境
- 專案經理代理開始執行開發計劃

### 5. 里程碑規劃 (Milestone Planning)

- 專案經理代理制定詳細的里程碑和目標
- 將大型功能分解為可管理的任務
- 向用戶展示里程碑計劃並獲得批准

### 6. Kanban 看板初始化 (Kanban Board Setup)

- 用戶批准後，專案經理代理將任務卡片添加到看板
- 設置任務優先級和依賴關係
- 分配適當的代理執行任務

## 開發生命週期 (Development Life Cycle)

### 1. TDD 週期啟動 (TDD Cycle Initiation)

- 從 Kanban 看板選擇待開發的功能
- 創建新的 TDD 週期 (Cycle)
- 定義功能標題、描述和驗收標準
- 初始化為 RED 階段
- **Git 操作**：
  - 從 `main` 分支創建功能分支：`feature/cycle-{cycleId}-{feature-name}`
  - 確保工作目錄乾淨，沒有未提交的更改
  - 記錄分支創建到週期日誌中

### 2. RED 階段：測試驅動 (RED Phase: Test-First)

- **目標**：根據驗收標準生成失敗的測試
- **代理執行**：TDD 開發代理分析驗收標準
- **輸出**：
  - 生成測試文件 (Test artifacts)
  - 創建測試代碼並設置測試框架
  - 確保所有測試初始狀態為 FAILING
- **完成條件**：所有驗收標準都有對應的測試用例
- **Git 操作**：
  - 在階段開始前創建檢查點分支：`checkpoint/red-phase-start`
  - 提交測試文件：`feat(tests): add failing tests for {feature-name}`
  - 運行測試確認所有測試失敗
  - 如果測試生成失敗，回滾到檢查點分支
  - 記錄測試覆蓋率和失敗測試列表

### 3. GREEN 階段：最小實現 (GREEN Phase: Minimal Implementation)

- **目標**：編寫最小代碼使所有測試通過
- **代理執行**：TDD 開發代理實現功能代碼
- **輸出**：
  - 生成實現文件 (Implementation artifacts)
  - 編寫最小可行代碼
  - 運行測試確保所有測試變為 PASSING
- **完成條件**：所有測試通過，功能基本可用
- **Git 操作**：
  - 在階段開始前創建檢查點分支：`checkpoint/green-phase-start`
  - 提交實現代碼：`feat(impl): implement minimal code to pass tests`
  - 運行測試套件確認所有測試通過
  - 如果實現失敗，回滾到檢查點分支並重試
  - 記錄代碼覆蓋率和測試執行時間

### 4. REFACTOR 階段：代碼優化 (REFACTOR Phase: Code Quality)

- **目標**：改善代碼質量同時保持測試綠色
- **代理執行**：代碼審查代理和 TDD 開發代理協作
- **輸出**：
  - 重構代碼以提高可讀性和可維護性
  - 優化性能並消除代碼異味
  - 更新文檔和註釋
- **完成條件**：代碼質量達標，測試仍然全部通過
- **Git 操作**：
  - 在階段開始前創建檢查點分支：`checkpoint/refactor-phase-start`
  - 提交重構更改：`refactor: improve code quality and maintainability`
  - 運行測試確認重構沒有破壞功能
  - 如果重構導致測試失敗，回滾到檢查點分支
  - 記錄代碼複雜度改善和性能提升

### 5. REVIEW 階段：最終驗證 (REVIEW Phase: Final Validation)

- **目標**：全面驗證功能實現和代碼質量
- **代理執行**：集成代理和代碼審查代理
- **輸出**：
  - 端到端測試驗證
  - 代碼覆蓋率檢查
  - 性能和安全審查
  - 用戶體驗驗證
- **完成條件**：功能完全符合驗收標準，質量達標
- **Git 操作**：
  - 在階段開始前創建檢查點分支：`checkpoint/review-phase-start`
  - 提交最終驗證結果：`test(review): final validation and quality checks`
  - 創建拉取請求 (Pull Request) 到主分支
  - 添加詳細的變更說明和測試結果
  - 如果驗證失敗，回滾到檢查點分支

### 6. 決策點處理 (Decision Point Handling)

- **觸發條件**：AI 代理遇到需要人工決策的問題
- **查詢類型**：
  - **BLOCKING**：必須解決才能繼續開發
  - **ADVISORY**：建議性問題，可選擇性回答
- **處理流程**：
  1. 代理創建查詢並暫停開發
  2. 用戶在決策收件箱中查看查詢
  3. 用戶提供答案或選擇忽略
  4. 代理恢復開發並繼續執行
- **Git 操作**：
  - 在創建查詢前提交當前工作：`wip: pause for user decision - {query-title}`
  - 創建決策分支：`decision/{query-id}-{query-title}`
  - 記錄決策上下文和可能的選項
  - 決策完成後，合併決策分支並繼續開發

### 7. 週期完成與集成 (Cycle Completion & Integration)

- **目標**：完成功能開發並集成到主分支
- **代理執行**：集成代理和專案經理代理
- **輸出**：
  - 創建 Git 提交和拉取請求
  - 更新專案文檔和變更日誌
  - 更新 Kanban 卡片狀態為完成
  - 通知相關團隊成員
- **完成條件**：功能成功集成，文檔更新完成
- **Git 操作**：
  - 最終提交：`feat: complete {feature-name} implementation`
  - 創建合併請求 (Merge Request) 到主分支
  - 執行代碼審查和自動化測試
  - 合併到主分支並刪除功能分支
  - 創建版本標籤：`v{version}-{feature-name}`

## 單倉庫多分支工作流程 (Single Repository Multi-Branch Workflow)

### 1. 工作目錄管理策略

#### A. 共享工作目錄架構

```
/projects/{projectId}/
├── .git/                    # 單一 Git 倉庫
├── src/                     # 源代碼目錄
├── tests/                   # 測試目錄
├── docs/                    # 文檔目錄
├── .codehive/              # CodeHive 配置
│   ├── cycles/             # 週期狀態管理
│   │   ├── {cycleId}.json  # 週期元數據
│   │   └── active.json     # 當前活躍週期
│   ├── workspaces/         # 工作空間快照
│   │   ├── {cycleId}/      # 每個週期的文件快照
│   │   └── staging/        # 臨時工作區
│   └── locks/              # 分支鎖定狀態
└── .gitignore
```

#### B. 分支狀態管理

```typescript
interface BranchState {
  cycleId: string;
  branchName: string;
  currentPhase: CyclePhase;
  lastCommit: string;
  isActive: boolean;
  lastActivity: Date;
  workspaceSnapshot: string; // 指向 workspaces/{cycleId} 的快照
}

interface WorkspaceSnapshot {
  cycleId: string;
  branchName: string;
  phase: CyclePhase;
  files: {
    path: string;
    content: string;
    hash: string;
  }[];
  metadata: {
    tests: Test[];
    artifacts: Artifact[];
    queries: Query[];
  };
}
```

### 2. 分支切換與狀態保存

#### A. 智能分支切換

```typescript
class BranchManager {
  private currentBranch: string;
  private activeCycles: Map<string, BranchState>;

  async switchToBranch(cycleId: string, branchName: string): Promise<void> {
    // 1. 保存當前工作狀態
    await this.saveCurrentWorkspace();

    // 2. 切換到目標分支
    await this.gitCheckout(branchName);

    // 3. 恢復分支特定狀態
    await this.restoreWorkspace(cycleId);

    // 4. 更新活躍狀態
    this.updateActiveCycle(cycleId, branchName);
  }

  private async saveCurrentWorkspace(): Promise<void> {
    const currentCycle = this.getCurrentActiveCycle();
    if (!currentCycle) return;

    const snapshot = await this.createWorkspaceSnapshot(currentCycle.cycleId);
    await this.saveSnapshot(snapshot);
  }

  private async restoreWorkspace(cycleId: string): Promise<void> {
    const snapshot = await this.loadSnapshot(cycleId);
    if (snapshot) {
      await this.applySnapshot(snapshot);
    }
  }
}
```

#### B. 工作空間快照機制

- **自動快照**：每次分支切換前自動保存當前狀態
- **增量快照**：只保存變更的文件，減少存儲開銷
- **元數據同步**：同步測試結果、構件和查詢狀態
- **衝突檢測**：檢測並處理文件衝突

### 3. 並行開發協調

#### A. 分支鎖定機制

```typescript
interface BranchLock {
  cycleId: string;
  branchName: string;
  lockedBy: string; // agent type
  lockedAt: Date;
  expiresAt: Date;
  reason: string;
}

class BranchLockManager {
  async acquireLock(
    cycleId: string,
    branchName: string,
    agentType: string
  ): Promise<boolean> {
    const lock: BranchLock = {
      cycleId,
      branchName,
      lockedBy: agentType,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      reason: 'Agent execution in progress',
    };

    return await this.createLock(lock);
  }

  async releaseLock(cycleId: string, branchName: string): Promise<void> {
    await this.removeLock(cycleId, branchName);
  }
}
```

#### B. 衝突解決策略

- **文件級衝突檢測**：檢測同一文件被多個週期修改
- **自動合併嘗試**：嘗試自動解決簡單衝突
- **用戶干預**：複雜衝突需要用戶手動解決
- **衝突通知**：實時通知相關代理和用戶

### 4. 資源優化策略

#### A. 智能文件管理

```typescript
class FileManager {
  // 只加載當前週期需要的文件
  async loadCycleFiles(cycleId: string): Promise<string[]> {
    const cycle = await this.getCycle(cycleId);
    const relevantFiles = await this.analyzeDependencies(cycle);
    return relevantFiles;
  }

  // 增量更新，只處理變更的文件
  async updateFiles(cycleId: string, changes: FileChange[]): Promise<void> {
    for (const change of changes) {
      if (change.type === 'MODIFY') {
        await this.updateFile(change.path, change.content);
      } else if (change.type === 'CREATE') {
        await this.createFile(change.path, change.content);
      } else if (change.type === 'DELETE') {
        await this.deleteFile(change.path);
      }
    }
  }
}
```

#### B. 內存管理

- **按需加載**：只加載當前活動週期需要的文件
- **緩存策略**：緩存常用文件和測試結果
- **垃圾回收**：定期清理未使用的快照和緩存
- **內存限制**：設置內存使用上限，防止系統過載

### 5. 狀態同步機制

#### A. 實時狀態同步

```typescript
class StateSynchronizer {
  // 同步週期狀態到數據庫
  async syncCycleState(cycleId: string): Promise<void> {
    const workspace = await this.getCurrentWorkspace(cycleId);
    const cycle = await this.getCycle(cycleId);

    await this.updateCycleInDatabase(cycleId, {
      phase: workspace.phase,
      lastActivity: new Date(),
      workspaceSnapshot: workspace.snapshotId,
    });
  }

  // 從數據庫恢復狀態
  async restoreFromDatabase(cycleId: string): Promise<void> {
    const cycle = await this.getCycleFromDatabase(cycleId);
    if (cycle.workspaceSnapshot) {
      await this.restoreWorkspace(cycle.workspaceSnapshot);
    }
  }
}
```

#### B. 事件驅動同步

- **文件變更事件**：監聽文件系統變更
- **Git 事件**：監聽 Git 操作（提交、分支切換等）
- **代理事件**：監聽代理執行狀態變化
- **用戶事件**：監聽用戶操作（批准、拒絕等）

### 6. 性能優化

#### A. 延遲加載

- 只在需要時加載文件內容
- 使用文件指針而不是完整內容
- 實現虛擬文件系統

#### B. 並行處理

- 多個週期可以並行執行（在不同分支）
- 使用工作線程處理文件操作
- 異步處理 Git 操作

#### C. 智能預取

- 預測下一個可能需要的文件
- 在後台預加載相關依賴
- 緩存常用操作結果

## Git 工作流程策略 (Git Workflow Strategy)

### 1. 分支管理策略

```
main (主分支)
├── feature/cycle-{id}-{name} (功能分支)
│   ├── checkpoint/red-phase-start
│   ├── checkpoint/green-phase-start
│   ├── checkpoint/refactor-phase-start
│   ├── checkpoint/review-phase-start
│   └── decision/{query-id}-{title}
└── hotfix/urgent-fixes (緊急修復)
```

### 2. 提交訊息規範

- **格式**：`type(scope): description`
- **類型**：
  - `feat`: 新功能
  - `fix`: 錯誤修復
  - `refactor`: 代碼重構
  - `test`: 測試相關
  - `docs`: 文檔更新
  - `wip`: 進行中的工作
- **示例**：
  - `feat(tests): add user authentication test suite`
  - `feat(impl): implement login functionality`
  - `refactor(auth): improve password validation logic`
  - `test(review): add integration tests for auth flow`

### 3. 回滾策略

- **自動回滾**：當測試失敗時自動回滾到最近的檢查點
- **手動回滾**：用戶可以選擇回滾到任何檢查點分支
- **回滾記錄**：記錄所有回滾操作和原因
- **恢復機制**：提供從回滾點恢復開發的選項

### 4. 衝突解決

- **自動合併**：嘗試自動解決簡單的合併衝突
- **用戶干預**：複雜衝突需要用戶手動解決
- **衝突檢測**：在每個階段開始前檢查潛在衝突
- **分支同步**：定期與主分支同步以避免衝突

## 代理協作模式 (Agent Collaboration Patterns)

### 1. 順序執行 (Sequential Execution)

- 適用於有依賴關係的任務
- 代理按順序執行，前一個代理的輸出作為下一個代理的輸入
- 例如：專案經理 → 架構師 → TDD 開發者 → 代碼審查者

### 2. 並行執行 (Parallel Execution)

- 適用於獨立的任務
- 多個代理同時執行不同的功能模塊
- 提高開發效率，縮短交付時間

### 3. 條件執行 (Conditional Execution)

- 根據項目狀態動態選擇執行路徑
- 例如：根據是否需要架構設計決定是否調用架構師代理

## 質量保證機制 (Quality Assurance Mechanisms)

### 1. 測試覆蓋率要求

- 代碼覆蓋率必須達到 80% 以上
- 關鍵業務邏輯需要 100% 覆蓋
- 自動化測試必須包含單元測試、集成測試和端到端測試

### 2. 代碼質量檢查

- 靜態代碼分析 (ESLint, TypeScript 檢查)
- 代碼複雜度控制
- 安全漏洞掃描
- 性能基準測試

### 3. 人工審查點

- 架構決策需要人工確認
- 重大功能變更需要用戶批准
- 安全相關變更需要額外審查

## 監控與優化 (Monitoring & Optimization)

### 1. 性能指標追蹤

- 開發速度：從需求到交付的時間
- 代碼質量：測試通過率、覆蓋率、缺陷密度
- 用戶滿意度：功能符合度、使用體驗
- AI 代理效率：成功率、執行時間、Token 使用量

### 2. 持續改進

- 收集代理執行數據和失敗模式
- 優化提示詞和代理行為
- 更新測試策略和質量標準
- 改進決策點處理流程

### 3. 學習與適應

- 代理從成功和失敗中學習
- 動態調整代理行為和策略
- 根據項目特點優化工作流程
- 持續更新最佳實踐和指導原則
