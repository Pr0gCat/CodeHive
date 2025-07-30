# 代理查詢集成指南 (Agent Query Integration Guide)

## 概述

當 Kanban 卡片上的任務正在等待用戶查詢時，卡片會顯示特殊的視覺指示器和行為。這個功能確保了 AI 代理在遇到需要人工決策的問題時能夠暫停開發並等待用戶的指導。

## 卡片等待查詢時的視覺指示

### 1. 視覺變化
- **透明度降低**：卡片變為 75% 透明度
- **虛線邊框**：添加黃色虛線邊框
- **鼠標樣式**：變為 `cursor-not-allowed`
- **動畫指示器**：黃色脈衝動畫點

### 2. 功能限制
- **禁用拖拽**：無法移動卡片到其他列
- **禁用代理執行**：隱藏 "Run agent" 按鈕
- **保持編輯功能**：仍然可以編輯卡片內容

### 3. 查詢信息顯示
- **查詢列表**：顯示所有待處理的查詢
- **緊急程度標識**：阻塞性查詢用紅色，建議性查詢用藍色
- **查詢類型**：顯示查詢的類型（架構、業務邏輯等）
- **快速訪問**：點擊 "查看查詢詳情" 直接跳轉到查詢面板

## 代理如何使用查詢系統

### 1. 創建阻塞性查詢
```typescript
import { createBlockingQuery } from '@/lib/agents/query-helper';

// 當代理遇到需要用戶決策的問題時
const query = await createBlockingQuery(
  projectId,
  cardId,
  '用戶認證方式選擇',
  '請選擇用戶認證的實現方式：1) JWT Token 2) Session-based 3) OAuth2',
  {
    feature: 'user authentication',
    codeContext: 'auth/login.ts',
    options: ['JWT', 'Session', 'OAuth2']
  }
);

// 等待用戶回答
const hasAnswer = await waitForQueryResponse(query.id);
if (hasAnswer) {
  const answer = await getQueryAnswer(query.id);
  // 根據用戶回答繼續開發
}
```

### 2. 創建建議性查詢
```typescript
import { createAdvisoryQuery } from '@/lib/agents/query-helper';

// 當代理有建議但不需要阻塞開發時
await createAdvisoryQuery(
  projectId,
  cardId,
  '代碼風格建議',
  '建議使用 TypeScript 的嚴格模式來提高代碼質量',
  {
    feature: 'code quality',
    suggestion: 'Enable strict mode in tsconfig.json'
  }
);
```

### 3. 檢查查詢狀態
```typescript
import { hasBlockingQueries, getCardQueries } from '@/lib/agents/query-helper';

// 檢查卡片是否有阻塞性查詢
const hasBlocking = await hasBlockingQueries(projectId, cardId);
if (hasBlocking) {
  console.log('Card is waiting for user decision');
  return; // 暫停開發
}

// 獲取卡片的所有查詢
const queries = await getCardQueries(projectId, cardId);
console.log(`Card has ${queries.length} pending queries`);
```

## 查詢類型和使用場景

### 1. 架構查詢 (ARCHITECTURE)
**使用場景**：系統設計決策
```typescript
await createQuery({
  projectId,
  type: 'ARCHITECTURE',
  title: '數據庫選擇',
  question: '選擇主數據庫：PostgreSQL vs MySQL vs SQLite',
  context: { cardId, feature: 'database setup' },
  urgency: 'BLOCKING',
  priority: 'HIGH'
});
```

### 2. 業務邏輯查詢 (BUSINESS_LOGIC)
**使用場景**：業務規則和流程
```typescript
await createQuery({
  projectId,
  type: 'BUSINESS_LOGIC',
  title: '訂單狀態流程',
  question: '訂單狀態轉換規則：待付款 -> 已付款 -> 已發貨 -> 已完成？',
  context: { cardId, feature: 'order management' },
  urgency: 'BLOCKING',
  priority: 'HIGH'
});
```

### 3. 用戶界面查詢 (UI_UX)
**使用場景**：用戶體驗設計
```typescript
await createQuery({
  projectId,
  type: 'UI_UX',
  title: '登錄頁面設計',
  question: '登錄頁面佈局：1) 簡潔單頁 2) 分步驟引導 3) 社交登錄優先？',
  context: { cardId, feature: 'login page' },
  urgency: 'ADVISORY',
  priority: 'MEDIUM'
});
```

### 4. 集成查詢 (INTEGRATION)
**使用場景**：第三方服務集成
```typescript
await createQuery({
  projectId,
  type: 'INTEGRATION',
  title: '支付服務選擇',
  question: '選擇支付服務：Stripe vs PayPal vs 本地支付？',
  context: { cardId, feature: 'payment integration' },
  urgency: 'BLOCKING',
  priority: 'HIGH'
});
```

### 5. 澄清查詢 (CLARIFICATION)
**使用場景**：需求澄清
```typescript
await createQuery({
  projectId,
  type: 'CLARIFICATION',
  title: '用戶權限範圍',
  question: '管理員可以刪除其他用戶的內容嗎？',
  context: { cardId, feature: 'user permissions' },
  urgency: 'BLOCKING',
  priority: 'HIGH'
});
```

## 最佳實踐

### 1. 查詢創建
- **清晰的標題**：簡潔描述問題核心
- **具體的問題**：提供足夠的上下文和選項
- **正確的緊急程度**：只有真正阻塞開發的問題才設為 BLOCKING
- **相關的上下文**：包含代碼位置、功能描述等

### 2. 查詢處理
- **及時回應**：盡快回答阻塞性查詢
- **詳細回答**：提供完整的決策理由
- **使用評論**：在需要討論時使用評論功能
- **記錄決策**：在回答中記錄決策原因

### 3. 開發流程
- **檢查查詢狀態**：在開始開發前檢查是否有阻塞性查詢
- **等待用戶回應**：使用 `waitForQueryResponse` 等待用戶回答
- **根據回答調整**：根據用戶回答調整開發方向
- **更新卡片狀態**：查詢解決後更新卡片狀態

## 錯誤處理

### 1. 查詢超時
```typescript
try {
  const hasAnswer = await waitForQueryResponse(queryId, 300000); // 5分鐘超時
  if (hasAnswer) {
    // 處理用戶回答
  }
} catch (error) {
  if (error.message.includes('timed out')) {
    console.log('Query timed out, proceeding with default approach');
    // 使用默認方案繼續開發
  }
}
```

### 2. 查詢創建失敗
```typescript
try {
  const query = await createBlockingQuery(projectId, cardId, title, question);
} catch (error) {
  console.error('Failed to create query:', error);
  // 記錄錯誤並繼續開發，或使用備用方案
}
```

## 監控和調試

### 1. 查詢狀態監控
```typescript
// 定期檢查查詢狀態
setInterval(async () => {
  const queries = await getCardQueries(projectId, cardId);
  const blockingQueries = queries.filter(q => q.urgency === 'BLOCKING');
  
  if (blockingQueries.length > 0) {
    console.log(`Card ${cardId} has ${blockingQueries.length} blocking queries`);
  }
}, 60000); // 每分鐘檢查一次
```

### 2. 查詢統計
```typescript
// 獲取項目查詢統計
const queryStats = await prisma.query.groupBy({
  by: ['status', 'urgency'],
  where: { projectId },
  _count: true
});

console.log('Query statistics:', queryStats);
```

這個集成系統確保了 AI 代理和用戶之間的有效協作，讓開發過程更加順暢和可控。 