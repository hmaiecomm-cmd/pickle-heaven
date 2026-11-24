# 營運狀況報表性能優化指南

## 數據庫查詢優化

### 1. 索引建議

```sql
-- 預約表索引
CREATE INDEX idx_booking_created_status ON booking(createdAt, status);
CREATE INDEX idx_booking_paidAt_status ON booking(paidAt, status);

-- 預留表索引
CREATE INDEX idx_reservation_startsAt_status ON reservation(startsAt, status);
CREATE INDEX idx_reservation_courtId_startsAt ON reservation(courtId, startsAt);

-- 門禁日誌索引
CREATE INDEX idx_accessLog_attemptAt ON accessLog(attemptAt);
CREATE INDEX idx_accessLog_venueId_attemptAt ON accessLog(venueId, attemptAt);
```

### 2. 查詢優化策略

- **批量查詢**: 使用 `Promise.all()` 並行執行獨立查詢
- **選擇性查詢**: 只查詢必要的欄位，不查詢整行
- **分頁**: 大量數據時使用游標分頁
- **緩存**: 實現 Redis 緩存以減少重複查詢

### 3. 預期性能指標

| 操作 | 目標時間 | 當前 |
|------|---------|------|
| 7天報表 | < 500ms | - |
| 30天報表 | < 1500ms | - |
| 90天報表 | < 3000ms | - |

## 前端性能優化

### 1. 組件代碼分割

```typescript
// 動態導入重型圖表組件
const DailyTrends = dynamic(() => import('./components/daily-trends'), {
  loading: () => <div>加載中...</div>,
  ssr: false,
})
```

### 2. 圖表優化

- 使用 Recharts 的 ResponsiveContainer 自動調整大小
- 為大數據集使用虛擬化列表
- 在移動設備上減少動畫幀數

### 3. 狀態管理

- 使用 React Query 進行服務器狀態管理
- 實現請求去重和自動重試
- 設置適當的緩存時間 (TTL)

## 導出性能

### PDF 導出

```typescript
// 優化建議
- 使用流式處理大型 PDF
- 在 Worker 中進行 HTML 轉換
- 壓縮圖像以減小文件大小
```

### CSV 導出

```typescript
// 優化建議
- 使用流式寫入大型 CSV 文件
- 實現進度顯示
- 支持分塊下載
```

## 監控和測試

### 1. 性能監控

```typescript
// 添加性能跟蹤
const startTime = performance.now()
const data = await getOperationMetrics(fromDate, toDate)
const duration = performance.now() - startTime
console.log(`Data fetching took ${duration}ms`)
```

### 2. 負載測試

```bash
# 使用 k6 進行負載測試
k6 run operations-report-load-test.js
```

### 3. 核心指標

- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

## 緩存策略

### 1. 服務器端緩存

```typescript
// 實現 ISR (Incremental Static Regeneration)
export const revalidate = 3600 // 1 小時重新驗證

// 或使用 Redis 緩存
const cached = await redis.get(`operations-report:${fromDate}:${toDate}`)
if (cached) return JSON.parse(cached)
```

### 2. 客戶端緩存

```typescript
// 使用 SWR 進行客戶端緩存
const { data } = useSWR(
  `/api/operations-report?from=${fromDate}&to=${toDate}`,
  fetcher,
  { dedupingInterval: 60000 } // 60 秒內去重
)
```

## 部署優化

### 1. 環境變數

```env
# 為大型數據集增加超時
NEXT_PUBLIC_API_TIMEOUT=30000

# 啟用數據壓縮
NEXT_PUBLIC_ENABLE_GZIP=true
```

### 2. Edge Caching

- 在 Vercel 上配置 Edge Caching
- 設置適當的 Cache-Control 頭
- 使用地理位置重定向優化延遲

## 故障排除

### 常見問題

1. **查詢超時**
   - 增加數據庫連接池大小
   - 優化查詢語句
   - 考慮分頁或時間窗口限制

2. **內存溢出**
   - 減少批量查詢的大小
   - 使用流式處理
   - 實現垃圾收集優化

3. **圖表渲染遲鈍**
   - 減少數據點數量
   - 使用虛擬化列表
   - 禁用不必要的動畫

## 監控儀表板

推薦集成以下監控服務：

- **Vercel Analytics**: 實時性能監控
- **Sentry**: 錯誤跟蹤和性能監控
- **DataDog**: 應用性能管理 (APM)
- **New Relic**: 完整的應用可觀測性

## 最佳實踐

1. ✅ 使用 Server Components 減少 JavaScript
2. ✅ 實現 Suspense 邊界以改進加載狀態
3. ✅ 優化圖像資源
4. ✅ 定期進行性能審計
5. ✅ 設置 CI/CD 性能預算
