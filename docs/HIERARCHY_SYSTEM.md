# CodeHive 階層系統 - 技術文檔

## 概述

CodeHive 階層系統是一個 AI 驅動的專案開發管理系統，採用四級階層結構：Epic → Story → Task → Instruction。這個系統提供了完整的專案管理功能，從高層業務需求到具體的 AI 執行指令。

## 系統架構

### 核心組件

```
┌─────────────────────────────────────────────┐
│              UI Components                   │
│  EpicDashboard | StoryManagement           │
│  TaskTracking  | InstructionExecution      │
├─────────────────────────────────────────────┤
│              API Endpoints                   │
│  /api/hierarchy/{epics,stories,tasks,...}   │
├─────────────────────────────────────────────┤
│             Business Logic                   │
│  HierarchyManager | HierarchyIntegration    │
├─────────────────────────────────────────────┤
│              Database                        │
│  SQLite + Prisma (Epic, Story, Task,...)    │
└─────────────────────────────────────────────┘
```

### 階層結構

1. **Epic (史詩)**
   - 代表主要功能或業務目標
   - 包含多個相關的用戶故事
   - 具有業務價值和接受標準

2. **Story (用戶故事)**
   - 代表具體的用戶需求
   - 遵循 "作為...我想要...以便..." 格式
   - 包含估點和接受標準

3. **Task (任務)**
   - 將故事分解為具體的開發任務
   - 包含類型（DEV, TEST, REVIEW等）
   - 具有預估時間和完成標準

4. **Instruction (指令)**
   - 可執行的 AI 指令
   - 包含具體執行步驟和期望結果
   - 支持自動執行和結果驗證

## 數據模型

### Epic 模型
```typescript
interface Epic {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  businessValue?: string;
  acceptanceCriteria?: string;
  priority: number;
  status: ModelStatus;
  phase?: string;
  estimatedEffort?: number;
  actualEffort?: number;
  tokenUsage: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  stories: Story[];
  dependencies: EpicDependency[];
}
```

### Story 模型
```typescript
interface Story {
  id: string;
  epicId: string;
  title: string;
  userStory?: string;
  description?: string;
  acceptanceCriteria?: string;
  storyPoints?: number;
  priority: number;
  status: ModelStatus;
  tokenUsage: number;
  iteration?: number;
  
  // Relations
  epic: Epic;
  tasks: Task[];
}
```

### Task 模型
```typescript
interface Task {
  id: string;
  storyId: string;
  title: string;
  description?: string;
  type: string; // DEV, TEST, REVIEW, DEPLOY, DOCUMENT
  acceptanceCriteria?: string;
  expectedOutcome?: string;
  priority: number;
  status: ModelStatus;
  estimatedTime?: number; // 分鐘
  actualTime?: number;
  assignedAgent?: string;
  retryCount: number;
  maxRetries: number;
  
  // Relations
  story: Story;
  instructions: Instruction[];
}
```

### Instruction 模型
```typescript
interface Instruction {
  id: string;
  taskId: string;
  directive: string; // 具體指令
  expectedOutcome: string; // 預期成果
  validationCriteria?: string;
  sequence: number; // 執行順序
  status: ModelStatus;
  output?: string;
  error?: string;
  tokenUsage: number;
  executionTime?: number; // 毫秒
  retryCount: number;
  executedBy?: string;
  
  // Relations
  task: Task;
}
```

## API 端點

### Epic 管理
- `GET /api/hierarchy/epics` - 獲取史詩列表
- `POST /api/hierarchy/epics` - 創建史詩
- `GET /api/hierarchy/epics/[id]` - 獲取史詩詳情
- `PUT /api/hierarchy/epics/[id]` - 更新史詩
- `DELETE /api/hierarchy/epics/[id]` - 刪除史詩

### Story 管理
- `GET /api/hierarchy/stories` - 獲取故事列表
- `POST /api/hierarchy/stories` - 創建故事
- `GET /api/hierarchy/stories/[id]` - 獲取故事詳情
- `PUT /api/hierarchy/stories/[id]` - 更新故事
- `DELETE /api/hierarchy/stories/[id]` - 刪除故事

### Task 管理
- `GET /api/hierarchy/tasks` - 獲取任務列表
- `POST /api/hierarchy/tasks` - 創建任務
- `GET /api/hierarchy/tasks/[id]` - 獲取任務詳情
- `PUT /api/hierarchy/tasks/[id]` - 更新任務
- `DELETE /api/hierarchy/tasks/[id]` - 刪除任務

### Instruction 管理
- `GET /api/hierarchy/instructions` - 獲取指令列表
- `POST /api/hierarchy/instructions` - 創建指令
- `GET /api/hierarchy/instructions/[id]` - 獲取指令詳情
- `PUT /api/hierarchy/instructions/[id]` - 更新指令
- `DELETE /api/hierarchy/instructions/[id]` - 刪除指令
- `POST /api/hierarchy/instructions/[id]/execute` - 執行指令

### 統計和協調
- `GET /api/hierarchy/statistics` - 獲取階層統計
- `POST /api/hierarchy/agent/coordinate` - 協調 ProjectAgent

## UI 組件

### EpicDashboard
史詩總覽頁面，顯示：
- 專案的所有史詩
- 完成狀態統計
- 進度指標
- 優先級和狀態標籤

### StoryManagement
用戶故事管理，包含：
- 故事列表顯示
- 創建故事表單
- 故事點估算
- 接受標準管理

### TaskTracking
任務追蹤界面，提供：
- 任務進度監控
- 執行狀態顯示
- 預估時間管理
- 指令生成功能

### InstructionExecution
指令執行界面，支持：
- 實時執行監控
- 結果展示
- 錯誤處理
- 重試機制

## 使用流程

### 1. 創建 Epic
```typescript
const epic = await hierarchyManager.createEpic({
  projectId: 'project-123',
  title: '用戶認證系統',
  description: '實現完整的用戶認證和授權系統',
  businessValue: '提高系統安全性',
  priority: Priority.HIGH
});
```

### 2. 生成 Stories
```typescript
const stories = await hierarchyIntegration.generateStoriesFromConversation(
  epic.id,
  conversationHistory
);
```

### 3. 創建 Tasks
```typescript
const task = await hierarchyManager.createTask({
  storyId: story.id,
  title: '實現用戶登入API',
  type: 'DEV',
  description: '創建用戶登入的RESTful API端點',
  priority: Priority.MEDIUM
});
```

### 4. 生成和執行 Instructions
```typescript
// 生成指令
const instructions = await hierarchyIntegration.generateInstructionsForTask(task.id);

// 執行指令
const result = await hierarchyIntegration.executeInstruction(instruction.id);
```

## 狀態管理

### ModelStatus 枚舉
```typescript
enum ModelStatus {
  PENDING = 'PENDING',      // 待開始
  IN_PROGRESS = 'IN_PROGRESS', // 進行中
  COMPLETED = 'COMPLETED',     // 已完成
  FAILED = 'FAILED'           // 失敗
}
```

### Priority 枚舉
```typescript
enum Priority {
  LOW = 0,      // 低優先級
  MEDIUM = 1,   // 中優先級
  HIGH = 2,     // 高優先級
  CRITICAL = 3  // 重要
}
```

## 事件系統

HierarchyManager 使用 EventEmitter 提供實時事件通知：

```typescript
hierarchyManager.on('epic:created', (epic) => {
  console.log('新史詩已創建:', epic.title);
});

hierarchyManager.on('instruction:executed', (result) => {
  console.log('指令執行完成:', result);
});
```

## 統計和報告

### 階層統計
```typescript
const stats = await hierarchyManager.getHierarchyStatistics(projectId);
// 返回：totalEpics, totalStories, totalTasks, totalInstructions, etc.
```

### 進度追蹤
```typescript
const progress = await hierarchyManager.getHierarchyProgress(epicId);
// 返回：詳細的進度分解和階段統計
```

## 錯誤處理

系統提供了完整的錯誤處理機制：
- API 層面的參數驗證
- 業務邏輯層的狀態檢查
- 數據庫操作的異常處理
- 指令執行的超時和重試

## 性能優化

- 使用 Prisma 的連接池管理
- 實現了查詢優化和關聯載入
- 支持分頁和過濾
- 緩存常用的統計數據

## 測試覆蓋

- 單元測試：核心業務邏輯
- 整合測試：API 端點和數據庫操作
- 組件測試：UI 組件的功能驗證
- 端到端測試：完整工作流程

## 部署和維護

### 數據庫遷移
```bash
bun run db:migrate
```

### 生成 Prisma Client
```bash
npx prisma generate
```

### 執行測試
```bash
bun test __tests__/hierarchy/
```

## 擴展性

系統設計支持：
- 新的任務類型添加
- 自定義指令執行器
- 插件式的代理整合
- 多租戶支持（通過 projectId 隔離）

## 安全性

- API 端點的參數驗證
- 數據庫級別的軟刪除
- 執行權限控制
- 敏感數據的加密存儲

這個階層系統為 CodeHive 提供了強大的專案管理能力，支持從需求分析到代碼實現的完整開發流程。