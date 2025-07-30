# CodeHive 配置變更說明

## 概述

已將重要的應用程式配置從設定頁面移除，並改為通過配置文件和環境變數管理，以提供更好的安全性和部署靈活性。

## 變更內容

### 1. 移除的設定項目

從設定頁面移除的配置項目：

- **Claude Code 路徑** (`claudeCodePath`)
- **每分鐘請求限制** (`rateLimitPerMinute`)
- **應用程式 URL** (`appUrl`)
- **WebSocket URL** (`wsUrl`)
- **資料庫 URL** (`databaseUrl`)

### 2. 新的配置管理方式

#### 環境變數配置

在 `.env` 文件中設置：

```env
# Database Configuration
DATABASE_URL="file:./prisma/codehive.db"

# Node Environment
NODE_ENV=development

# Claude API Configuration
CLAUDE_CODE_PATH=claude
CLAUDE_RATE_LIMIT=50

# Application URLs
APP_URL=http://localhost:3000
WS_URL=ws://localhost:3000
```

#### 配置文件

創建了 `config/app.config.ts` 文件來管理應用程式配置：

```typescript
export interface AppConfig {
  claude: {
    codePath: string;
    rateLimitPerMinute: number;
  };
  app: {
    url: string;
    wsUrl: string;
  };
  database: {
    url: string;
  };
  environment: {
    nodeEnv: string;
    isProduction: boolean;
    isDevelopment: boolean;
  };
}
```

### 3. 設定頁面更新

設定頁面現在只包含：

- **全域限制設定**（Token 限制、警告閾值等）
- **自動管理設定**（自動恢復、警告時暫停）
- **專案預算分配**
- **配置資訊說明**

### 4. 代碼變更

#### lib/config/index.ts

- 更新 `fallbackConfig` 使用環境變數
- 移除對外部配置文件的依賴

#### lib/claude-code/index.ts

- 使用 `config.claudeCodePath` 而不是外部配置

#### app/settings/page.tsx

- 移除 Claude API 和應用程式配置的 UI 組件
- 移除相關的狀態管理和處理函數
- 添加配置資訊說明區塊

## 優勢

1. **安全性提升**：敏感配置不再暴露在 Web UI 中
2. **部署靈活性**：可以通過環境變數輕鬆配置不同環境
3. **版本控制友好**：配置文件可以安全地提交到版本控制
4. **運維簡化**：配置變更不需要重啟應用程式（除了資料庫 URL）

## 使用說明

### 開發環境

1. 複製 `.env.example` 到 `.env`
2. 根據需要修改環境變數
3. 啟動應用程式

### 生產環境

1. 設置相應的環境變數
2. 確保 `CLAUDE_CODE_PATH` 指向正確的 Claude Code 安裝路徑
3. 配置正確的資料庫連接字符串

### 配置變更

- **環境變數**：修改 `.env` 文件或系統環境變數
- **配置文件**：修改 `config/app.config.ts` 文件
- **資料庫配置**：需要重啟應用程式才能生效

## 注意事項

1. 資料庫 URL 變更需要重啟應用程式
2. Claude Code 路徑必須指向有效的安裝位置
3. 環境變數優先級高於配置文件
4. 設定頁面中的全域限制和自動管理設定仍然可以通過 UI 修改
