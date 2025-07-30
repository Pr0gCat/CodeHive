# 用戶查詢功能 (User Queries Feature)

## 概述

用戶查詢功能允許 AI 代理在開發過程中向用戶提出問題，並讓用戶能夠回答、評論或忽略這些查詢。這個功能確保了 AI 代理在遇到需要人工決策的問題時能夠暫停開發並等待用戶的指導。

## 功能特點

### 1. 查詢類型

- **架構查詢 (ARCHITECTURE)**：關於系統架構和設計決策
- **業務邏輯查詢 (BUSINESS_LOGIC)**：關於業務規則和邏輯
- **用戶界面查詢 (UI_UX)**：關於用戶體驗和界面設計
- **集成查詢 (INTEGRATION)**：關於系統集成和 API 設計
- **澄清查詢 (CLARIFICATION)**：需要澄清需求或規格

### 2. 緊急程度

- **阻塞 (BLOCKING)**：必須解決才能繼續開發
- **建議 (ADVISORY)**：建議性問題，可選擇性回答

### 3. 優先級

- **高 (HIGH)**：高優先級問題
- **中 (MEDIUM)**：中等優先級問題
- **低 (LOW)**：低優先級問題

## 用戶界面

### 查詢面板

- 顯示所有代理生成的查詢
- 按狀態和緊急程度過濾
- 顯示查詢詳情、評論和回答

### 查詢操作

- **回答查詢**：提供詳細回答並標記為已回答
- **添加評論**：為查詢添加評論或討論
- **忽略查詢**：標記為已忽略（僅適用於建議性查詢）

### 狀態管理

- **待處理 (PENDING)**：等待用戶回答
- **已回答 (ANSWERED)**：用戶已回答
- **已忽略 (DISMISSED)**：用戶選擇忽略

## Kanban 卡片目標分支

### 功能說明

- 每個 Kanban 卡片可以指定目標 Git 分支
- 顯示在卡片上，幫助開發者了解工作分支
- 支持在創建卡片時設置目標分支

### 使用方式

1. 創建新卡片時，在 "Target branch" 字段輸入分支名稱
2. 分支名稱會顯示在卡片上，格式為：`目標分支：feature/user-auth`
3. 支持任何有效的 Git 分支命名格式

## API 端點

### 獲取項目查詢

```
GET /api/projects/{projectId}/queries
```

查詢參數：

- `status`：過濾查詢狀態 (PENDING, ANSWERED, DISMISSED)
- `urgency`：過濾緊急程度 (BLOCKING, ADVISORY)
- `cycleId`：過濾特定週期的查詢

### 創建查詢

```
POST /api/projects/{projectId}/queries
```

請求體：

```json
{
  "type": "ARCHITECTURE",
  "title": "查詢標題",
  "question": "詳細問題描述",
  "context": "相關上下文信息",
  "urgency": "BLOCKING",
  "priority": "HIGH",
  "cycleId": "可選的週期ID"
}
```

### 更新查詢

```
PUT /api/queries/{queryId}
```

請求體：

```json
{
  "answer": "用戶回答",
  "status": "ANSWERED"
}
```

### 添加評論

```
POST /api/queries/{queryId}/comments
```

請求體：

```json
{
  "content": "評論內容",
  "author": "評論者（可選，默認為 'user'）"
}
```

## 數據庫結構

### Query 模型

```sql
CREATE TABLE queries (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  cycleId TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  context TEXT,
  urgency TEXT DEFAULT 'ADVISORY',
  priority TEXT DEFAULT 'MEDIUM',
  status TEXT DEFAULT 'PENDING',
  answer TEXT,
  answeredAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### QueryComment 模型

```sql
CREATE TABLE query_comments (
  id TEXT PRIMARY KEY,
  queryId TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT DEFAULT 'user',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### KanbanCard 模型更新

```sql
ALTER TABLE kanban_cards ADD COLUMN targetBranch TEXT;
```

## 工作流程

### 1. 代理生成查詢

- AI 代理在開發過程中遇到需要決策的問題
- 創建查詢並設置適當的類型和緊急程度
- 開發過程暫停，等待用戶回應

### 2. 用戶處理查詢

- 用戶在查詢面板中查看待處理的查詢
- 根據查詢類型和緊急程度決定處理方式
- 提供回答、添加評論或忽略查詢

### 3. 開發恢復

- 對於阻塞性查詢，用戶回答後開發自動恢復
- 對於建議性查詢，代理可以選擇是否採納建議
- 查詢狀態更新為已回答或已忽略

## 最佳實踐

### 查詢創建

- 使用清晰的標題描述問題
- 提供足夠的上下文信息
- 正確設置緊急程度和優先級
- 關聯到相關的開發週期

### 查詢回答

- 提供詳細和具體的回答
- 考慮長期影響和維護性
- 記錄決策原因和考慮因素
- 使用評論功能進行討論

### 分支管理

- 使用描述性的分支名稱
- 遵循團隊的分支命名規範
- 定期清理已完成的分支
- 確保分支名稱與功能相關

## 故障排除

### 常見問題

1. **查詢不顯示**：檢查過濾器設置和查詢狀態
2. **無法回答查詢**：確保查詢狀態為 PENDING
3. **分支名稱不顯示**：檢查卡片是否有 targetBranch 字段

### 調試技巧

- 檢查瀏覽器開發者工具中的網絡請求
- 查看服務器日誌中的錯誤信息
- 驗證數據庫中的查詢記錄
- 確認 API 端點的正確性
