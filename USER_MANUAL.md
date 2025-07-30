# CodeHive 使用者手冊

## 目錄

1. [系統概述](#系統概述)
2. [環境需求與安裝](#環境需求與安裝)
3. [首次使用設定](#首次使用設定)
4. [基本操作指南](#基本操作指南)
5. [專案管理](#專案管理)
6. [AI-Native TDD 開發系統](#ai-native-tdd-開發系統)
7. [Agent 代理系統](#agent-代理系統)
8. [Token 管理與監控](#token-管理與監控)
9. [專案設定與自訂](#專案設定與自訂)
10. [查詢與決策系統](#查詢與決策系統)  
11. [故障排除](#故障排除)
12. [進階功能](#進階功能)

## 系統概述

CodeHive 是一個以 Claude Code 為核心的多 Agent 軟體開發平台，採用測試驅動開發（TDD）原則，能夠同時管理多個軟體專案的開發流程。

### 核心特色

- **多專案同步管理**：支援同時管理多個軟體專案
- **AI-Native TDD 開發**：AI 驅動的測試驅動開發流程
- **智能 Agent 協調**：多個專業化 Agent 分工合作
- **視覺化專案控制**：看板式專案管理介面
- **即時進度追蹤**：WebSocket 即時更新
- **Token 使用監控**：智能 API 使用量管理
- **語言無關支援**：支援任何程式語言和框架

### 技術架構

- **前端**：Next.js 14 + TypeScript + Tailwind CSS
- **後端**：Next.js API 路由
- **資料庫**：SQLite + Prisma ORM
- **套件管理器**：Bun
- **Agent 運行時**：Claude Code CLI
- **版本控制**：Git 整合

## 環境需求與安裝

### 系統需求

- **Node.js**: 18.0 或更高版本
- **Bun**: 最新版本套件管理器
- **Claude Code CLI**: 已安裝並設定完成
- **Git**: 版本控制系統
- **作業系統**: macOS、Linux 或 Windows

### 安裝步驟

1. **複製專案**
   ```bash
   git clone https://github.com/yourusername/codehive.git
   cd codehive
   ```

2. **安裝相依套件**
   ```bash
   bun install
   ```

3. **設定環境變數**
   
   建立 `.env` 檔案：
   ```env
   # 資料庫設定
   DATABASE_URL="file:./codehive.db"

   # Claude Code 設定
   CLAUDE_CODE_PATH="claude"
   CLAUDE_DAILY_TOKEN_LIMIT="10000000"
   CLAUDE_RATE_LIMIT_PER_MINUTE="50"

   # 應用程式 URL
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   NEXT_PUBLIC_WS_URL="ws://localhost:3000"

   # 環境設定
   NODE_ENV="development"
   ```

4. **初始化資料庫**
   ```bash
   bun run db:setup
   ```

5. **啟動開發伺服器**
   ```bash
   bun run dev
   ```

6. **驗證安裝**
   
   開啟瀏覽器造訪 `http://localhost:3000`，應該會看到 CodeHive 歡迎頁面。

## 首次使用設定

### 1. 系統健康檢查

首次啟動後，系統會自動檢查：
- Claude Code CLI 可用性
- 資料庫連線狀態
- API 端點回應

### 2. Token 限制設定

前往 **設定頁面**（`/settings`）進行初始設定：

- **每日 Token 限制**：設定全域每日 Token 使用上限
- **預警閾值**：設定警告和危險狀態的觸發點
- **自動管理**：設定是否啟用自動暫停和恢復功能

### 3. 建立第一個專案

點擊 **「建立專案」** 或使用 **「從 Git 匯入」** 建立第一個專案。

## 基本操作指南

### 主要頁面導覽

#### 1. 首頁 (`/`)
- **Token 監控面板**：即時顯示 Token 使用狀況
- **Token 統計資料**：歷史使用趨勢和分析
- **專案進度儀表板**：所有專案的整體進度概覽

#### 2. 專案列表 (`/projects`)
- **專案總覽**：以卡片形式顯示所有專案
- **快速操作**：建立新專案或從 Git 匯入
- **專案狀態**：顯示每個專案的進度和最後更新時間

#### 3. 專案詳細頁面 (`/projects/{id}`)
- **看板管理**：拖放式任務管理
- **TDD 儀表板**：測試驅動開發進度追蹤
- **Agent 調用面板**：手動執行 Agent 任務
- **專案日誌**：即時開發日誌追蹤

#### 4. 設定頁面 (`/settings`)
- **全域限制設定**：Token 使用限制管理
- **預算分配**：專案間 Token 預算分配
- **自動管理**：系統自動化行為設定

### 基本操作流程

1. **建立專案** → 2. **設定專案資訊** → 3. **開始開發** → 4. **監控進度** → 5. **完成交付**

## 專案管理

### 建立新專案

1. **點擊「建立專案」按鈕**
2. **填寫專案資訊**：
   - 專案名稱
   - 描述
   - 本地路徑（如果是現有專案）
   - 技術棧設定
3. **選擇開發模式**：
   - 標準開發模式
   - AI-Native TDD 模式
4. **確認建立**

### 從 Git 匯入專案

1. **點擊「從 Git 匯入」按鈕**
2. **輸入 Git 倉庫資訊**：
   - 倉庫 URL
   - 分支名稱（可選）
   - 本地路徑
3. **自動分析專案結構**
4. **確認匯入**

### 看板管理

#### 看板欄位

- **待辦 (Todo)**：待處理的任務
- **進行中 (In Progress)**：正在執行的任務
- **審查中 (Review)**：等待代碼審查的任務
- **完成 (Done)**：已完成的任務

#### 卡片操作

- **拖放移動**：在不同欄位間移動卡片
- **編輯卡片**：點擊卡片編輯標題和描述
- **分配 Agent**：指定特定 Agent 處理任務
- **設定優先級**：標記任務重要性

### 專案設定

#### 技術棧設定

在專案設定中可以自訂：
- **程式語言**：Python、JavaScript、Go、Rust 等
- **框架**：Django、React、Next.js、Spring Boot 等
- **套件管理器**：npm、pip、cargo、maven 等
- **測試框架**：Jest、pytest、go test 等
- **建置工具**：Webpack、Vite、Make 等

#### 分支管理

- **主要分支**：指定主要開發分支
- **目標分支**：設定卡片完成後的合併目標
- **自動合併**：設定是否啟用自動合併

## AI-Native TDD 開發系統

### TDD 循環階段

CodeHive 實現完整的 TDD 開發循環：

#### 1. RED 階段（紅燈）
- **AI 生成失敗測試**：根據需求自動生成測試案例
- **測試驗證**：確保測試確實失敗
- **需求確認**：驗證測試符合業務需求

#### 2. GREEN 階段（綠燈）
- **最小實作**：AI 撰寫最少程式碼讓測試通過
- **測試執行**：驗證所有測試通過
- **功能驗證**：確保功能正確實作

#### 3. REFACTOR 階段（重構）
- **程式碼改善**：優化程式碼品質和結構
- **效能調整**：改善執行效率
- **維護性提升**：增強程式碼可讀性

#### 4. REVIEW 階段（審查）
- **最終驗證**：確保所有需求都已實現
- **品質檢查**：執行程式碼品質檢查
- **文件更新**：更新相關文件

### TDD 儀表板操作

#### 建立新 TDD 循環

1. **點擊「新增 TDD 循環」**
2. **輸入功能需求**：
   - 功能描述
   - 驗收標準
   - 技術限制
3. **AI 分析需求**：系統分析並建立開發計畫
4. **開始執行**：自動進入 RED 階段

#### 監控執行進度

- **階段指示器**：視覺化顯示當前階段
- **測試狀態**：即時顯示測試執行結果
- **程式碼生成**：查看 AI 生成的程式碼
- **執行日誌**：詳細的執行過程記錄

### 手動干預與控制

#### 決策點系統

當 AI 遇到需要人工決策的情況時：

1. **接收查詢通知**：系統顯示待處理查詢
2. **查看查詢詳情**：了解 AI 的疑問和選項
3. **提供決策**：選擇處理方式
4. **繼續執行**：AI 根據決策繼續工作

#### 查詢類型

- **阻塞性查詢**：需要立即回應才能繼續
- **建議性查詢**：可以使用預設值繼續執行

## Agent 代理系統

### 專業化 Agent

CodeHive 包含多個專業化 Agent：

#### 1. 程式分析 Agent (Code Analyzer)
- **靜態程式分析**：檢查程式碼品質
- **安全漏洞掃描**：識別安全風險
- **程式碼風格檢查**：確保編程規範
- **檔案操作**：透過 Claude Code 進行檔案管理

#### 2. 測試執行 Agent (Test Runner)
- **多框架測試**：支援各種測試框架
- **覆蓋率分析**：程式碼覆蓋率報告
- **CI/CD 整合**：持續整合和部署

#### 3. Git 操作 Agent (Git Operations)
- **版本控制**：Git 操作自動化
- **分支管理**：智能分支策略
- **倉庫健康監控**：監控倉庫狀態

#### 4. 文件生成 Agent (Documentation)
- **README 生成**：自動生成專案文件
- **API 文件**：生成 API 參考文件
- **程式碼註解**：智能註解生成

#### 5. 專案管理 Agent (Project Manager)
- **專案協調**：統籌其他 Agent 工作
- **智能描述生成**：使用 Claude Code 分析專案結構
- **任務分配**：智能任務分派

### Agent 調用介面

#### 手動執行 Agent

1. **選擇 Agent 類型**：從下拉選單選擇
2. **輸入執行指令**：指定要執行的任務
3. **設定參數**：配置執行參數
4. **開始執行**：監控執行狀態

#### 自動執行模式

- **觸發條件**：設定自動執行的條件
- **排程執行**：定時執行特定任務
- **事件驅動**：基於特定事件自動執行

### Agent 狀態監控

#### 執行狀態

- **閒置 (Idle)**：等待任務指派
- **執行中 (Active)**：正在處理任務
- **暫停 (Paused)**：因限制而暫停
- **錯誤 (Error)**：執行遇到錯誤

#### 效能監控

- **執行時間**：任務執行耗時統計
- **成功率**：任務成功完成率
- **Token 使用量**：各 Agent 的 Token 消耗

## Token 管理與監控

### Token 使用監控

#### 即時監控面板

- **當前使用量**：今日已使用的 Token 數量
- **使用率**：相對於每日限制的百分比
- **剩餘量**：今日剩餘可用 Token
- **預計耗盡時間**：基於當前使用率的預測

#### 使用趨勢分析

- **每日使用圖表**：過去 7 天的使用趨勢
- **專案分布**：各專案的 Token 使用分布
- **Agent 使用統計**：各 Agent 的使用量比較

### Token 限制設定

#### 全域限制

1. **前往設定頁面** (`/settings`)
2. **調整每日 Token 限制**：使用滑桿設定
3. **設定預警閾值**：
   - 警告閾值（建議 75%）
   - 危險閾值（建議 90%）
4. **儲存設定**

#### 專案預算分配

1. **在設定頁面的預算分配區域**
2. **調整各專案的分配百分比**
3. **查看分配結果**：
   - 每日預算額度
   - 已使用量
   - 使用率
4. **自動儲存變更**

#### 自動管理機制

- **自動暫停**：達到危險閾值時暫停 Agent 執行
- **自動恢復**：使用量降低時自動恢復執行
- **警告通知**：達到警告閾值時發送通知

### 使用量最佳化建議

#### 有效的 Token 使用策略

1. **合理設定每日限制**：根據實際需求設定
2. **平衡專案分配**：活躍專案分配更多預算
3. **監控使用趨勢**：定期檢查使用模式
4. **優化 Agent 使用**：避免重複執行相同任務

#### 節省 Token 的技巧

- **使用具體明確的指令**：減少 AI 猜測和重試
- **合併相關任務**：批次處理提高效率
- **適當設定上下文**：提供充足但不冗餘的資訊
- **善用暫停功能**：在不需要時暫停自動執行

## 專案設定與自訂

### 技術棧配置

CodeHive 支援語言無關的專案管理，您可以為任何專案自訂技術棧：

#### 全域預設設定

在設定頁面配置全域預設值：
- **程式語言**：TypeScript、Python、Go、Rust、Java 等
- **框架**：Next.js、Django、Spring Boot、Express 等
- **套件管理器**：npm、pip、cargo、maven 等
- **測試框架**：Jest、pytest、JUnit 等
- **代碼檢查工具**：ESLint、Pylint、Clippy 等
- **建置工具**：Webpack、Vite、Make、Gradle 等

#### 專案特定設定

每個專案可以覆寫全域設定：
1. **進入專案詳細頁面**
2. **點擊「專案設定」**
3. **自訂技術棧選項**
4. **儲存變更**

### 開發指令配置

#### 標準指令模式

根據專案類型，Agent 會自動使用適當的指令：

**Node.js 專案**：
```bash
npm install        # 安裝依賴
npm run dev       # 啟動開發伺服器
npm test          # 執行測試
npm run lint      # 程式碼檢查
```

**Python 專案**：
```bash
pip install -r requirements.txt    # 安裝依賴
python manage.py runserver         # Django 開發伺服器
python -m pytest                  # 執行測試
pylint src/                        # 程式碼檢查
```

**Go 專案**：
```bash
go mod tidy       # 整理依賴
go run main.go    # 執行程式
go test ./...     # 執行測試
```

#### 自訂指令

您可以為專案設定自訂指令：
1. **編輯專案設定**
2. **指定自訂指令**：
   - 安裝指令
   - 啟動指令
   - 測試指令
   - 建置指令
3. **驗證設定**

### 環境變數管理

#### 專案層級環境變數

在專案根目錄建立 `.env` 檔案：
```env
DATABASE_URL=postgresql://localhost/myapp
API_KEY=your-api-key
DEBUG=true
```

#### 安全最佳實踐

- **不要提交機密資訊**：使用 `.gitignore` 排除 `.env` 檔案
- **使用環境變數模板**：提供 `.env.example` 檔案
- **分離開發和生產設定**：使用不同的環境變數檔案

## 查詢與決策系統

### 查詢機制

當 AI Agent 遇到需要人工介入的情況時，會建立查詢請求：

#### 查詢類型

1. **阻塞性查詢 (Blocking)**：
   - 需要立即回應才能繼續執行
   - 例如：架構選擇、重要技術決策
   
2. **建議性查詢 (Advisory)**：
   - 可以使用預設值繼續執行
   - 例如：程式命名建議、最佳化選項

### 查詢收件匣

#### 存取查詢列表

1. **在專案詳細頁面**
2. **點擊「使用者查詢」標籤**
3. **查看待處理查詢清單**

#### 查詢資訊

每個查詢包含：
- **查詢標題**：簡潔描述問題
- **詳細描述**：完整的上下文資訊
- **查詢類型**：阻塞性或建議性
- **建立時間**：查詢建立的時間
- **相關專案**：關聯的專案和循環

### 回應查詢

#### 回答查詢

1. **點擊查詢項目**
2. **閱讀查詢詳情**
3. **輸入回應**：
   - 文字回應
   - 選擇建議選項
   - 提供額外指示
4. **提交回應**

#### 忽略查詢

對於建議性查詢：
1. **點擊「忽略」按鈕**
2. **確認忽略**：AI 將使用預設值繼續

### 查詢最佳實踐

#### 有效回應策略

- **提供明確指示**：清楚說明您的期望
- **考慮長期影響**：決策對專案整體的影響
- **保持一致性**：與之前的決策保持一致
- **文件化決策**：重要決策應記錄在專案文件中

#### 減少查詢頻率

- **完善專案設定**：詳細配置技術棧和偏好
- **提供清晰的需求**：在建立循環時提供詳細描述
- **建立專案慣例**：在專案文件中記錄開發慣例

## 故障排除

### 常見問題

#### 1. Claude Code 連線問題

**症狀**：Agent 執行失敗，顯示 "Claude Code not found"

**解決方法**：
1. 確認 Claude Code CLI 已正確安裝
2. 檢查 `CLAUDE_CODE_PATH` 環境變數
3. 測試 Claude Code 指令：`claude --version`

**範例設定**：
```env
CLAUDE_CODE_PATH="/usr/local/bin/claude"
```

#### 2. 資料庫連線問題

**症狀**：應用程式無法啟動，顯示資料庫錯誤

**解決方法**：
1. 檢查 `DATABASE_URL` 設定
2. 重新初始化資料庫：`bun run db:setup`
3. 檢查檔案權限

#### 3. Token 限制問題

**症狀**：Agent 執行被阻止，顯示 Token 限制警告

**解決方法**：
1. 檢查當前 Token 使用量
2. 調整每日限制或等待次日重置
3. 優化 Agent 使用策略

#### 4. 專案匯入失敗

**症狀**：Git 匯入失敗或專案無法識別

**解決方法**：
1. 確認 Git 倉庫可存取
2. 檢查本地路徑權限
3. 手動複製專案後使用「建立專案」

### 日誌和偵錯

#### 應用程式日誌

查看開發日誌：
```bash
bun run dev
```

#### 資料庫偵錯

使用 Prisma Studio 檢查資料庫：
```bash
bunx prisma studio
```

#### Agent 執行日誌

在專案詳細頁面查看：
1. **點擊「專案日誌」**
2. **查看 Agent 執行記錄**
3. **分析錯誤訊息**

### 效能最佳化

#### 資料庫最佳化

定期清理舊資料：
```bash
# 清理 30 天前的日誌
bunx prisma db execute --file=scripts/cleanup-logs.sql
```

#### 記憶體使用最佳化

- **限制並行 Agent 數量**：避免同時執行太多 Agent
- **定期重啟應用程式**：清理記憶體累積
- **監控資源使用**：使用系統監控工具

## 進階功能

### 批次操作

#### 批次專案管理

1. **在專案列表頁面**
2. **選擇多個專案**（使用 Ctrl/Cmd + 點擊）
3. **執行批次操作**：
   - 批次更新設定
   - 批次執行 Agent 任務
   - 批次匯出資料

#### 批次 Agent 執行

建立執行腳本：
```javascript
// batch-agent-execution.js
const agents = ['code-analyzer', 'test-runner'];
const projects = ['project-1', 'project-2'];

for (const project of projects) {
  for (const agent of agents) {
    await executeAgent(agent, project);
  }
}
```

### API 整合

#### RESTful API

CodeHive 提供完整的 REST API：

**專案管理**：
```bash
# 取得專案列表
GET /api/projects

# 建立新專案
POST /api/projects
Content-Type: application/json
{
  "name": "My Project",
  "description": "Project description",
  "localPath": "/path/to/project"
}

# 更新專案
PUT /api/projects/{id}
```

**Agent 執行**：
```bash
# 執行 Agent 任務
POST /api/agents/execute
Content-Type: application/json
{
  "agentId": "code-analyzer",
  "projectId": "project-id",
  "command": "analyze",
  "parameters": {}
}
```

#### WebSocket 整合

即時通訊：
```javascript
const ws = new WebSocket('ws://localhost:3000/api/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('即時更新:', data);
};
```

### 自訂 Agent 開發

#### Agent 基本結構

```typescript
interface CustomAgent extends BaseAgent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  
  execute(command: string, parameters: any): Promise<AgentResult>;
  validate(command: string): boolean;
}
```

#### 建立自訂 Agent

1. **建立 Agent 檔案**：`lib/agents/executors/custom-agent.ts`
2. **實作 Agent 介面**：
   ```typescript
   export class CustomAgent extends BaseAgent {
     async execute(command: string, parameters: any) {
       // 實作 Agent 邏輯
       return {
         success: true,
         output: "執行完成",
         artifacts: []
       };
     }
   }
   ```
3. **註冊 Agent**：在 `lib/agents/agent-factory.ts` 中註冊
4. **測試 Agent**：撰寫單元測試

### 專案模板系統

#### 建立專案模板

1. **建立模板目錄**：`templates/my-template/`
2. **設定模板配置**：
   ```json
   {
     "name": "My Template",
     "description": "Template description",
     "language": "typescript",
     "framework": "nextjs",
     "files": [
       "package.json",
       "tsconfig.json",
       "README.md"
     ]
   }
   ```
3. **註冊模板**：在系統中註冊新模板

#### 使用專案模板

1. **建立新專案時選擇模板**
2. **自動應用模板設定**
3. **自訂模板參數**

### 監控和分析

#### 效能監控

使用內建監控面板：
- **回應時間**：API 端點回應時間
- **Agent 效能**：各 Agent 的執行統計
- **資源使用**：CPU 和記憶體使用率

#### 使用分析

- **專案活躍度**：追蹤專案使用頻率
- **Agent 使用模式**：分析 Agent 使用習慣
- **Token 使用趨勢**：長期使用趨勢分析

### 備份與還原

#### 資料庫備份

```bash
# 建立備份
cp codehive.db codehive.db.backup

# 使用時間戳記
cp codehive.db "codehive.db.$(date +%Y%m%d_%H%M%S)"
```

#### 專案資料備份

```bash
# 備份整個 repos 目錄
tar -czf repos-backup.tar.gz repos/

# 備份特定專案
tar -czf project-backup.tar.gz repos/my-project/
```

#### 還原資料

```bash
# 還原資料庫
cp codehive.db.backup codehive.db

# 重新初始化（如果需要）
bun run db:setup
```

---

## 技術支援

如需技術支援或回報問題：

- **問題回報**：[GitHub Issues](https://github.com/anthropics/claude-code/issues)
- **文件**：查閱 `docs/` 目錄中的詳細技術文件
- **社群支援**：參與開發者社群討論

---

**版本資訊**：本手冊適用於 CodeHive v1.0+  
**最後更新**：2025-07-30