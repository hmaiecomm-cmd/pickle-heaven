# 營運狀況報表開發計劃

**狀態：** 規劃階段  
**優先級：** P0 - 核心功能  
**預計工時：** 40-60 小時（分階段）

---

## 📋 任務清單

### 第一階段：基礎頁面架構（6-8 小時）

- [ ] 創建 `/admin/operations-report/page.tsx` 伺服器組件
- [ ] 創建 `/admin/operations-report/operations-client.tsx` 客戶端組件
- [ ] 更新 `src/app/admin/admin-nav.ts` 添加導航項目
- [ ] 實現日期篩選邏輯（最近 7/30/90 天 + 自訂日期）
- [ ] 實現 URL 參數同步
- [ ] 添加頁面標題和說明

**驗證：**
```bash
npm run typecheck
npm run build
# 訪問 http://localhost:3000/admin/operations-report
```

---

### 第二階段：統計卡片和基礎數據（8-10 小時）

**4 個主要統計卡片：**

- [ ] **預約完成率卡片**
  - 實現 `getBookingCompletionMetrics()`
  - 顯示：完成率、與上期對比、說明文字
  - 圖示：`calendar-check-2`

- [ ] **場地使用率卡片**
  - 實現 `getCourtUtilizationMetrics()`
  - 顯示：整體使用率、尖峰率、說明文字
  - 圖示：`clock-3`

- [ ] **進場人次卡片**
  - 實現 `getEntryMetrics()`
  - 顯示：總人次、平均每日、說明文字
  - 圖示：`users`

- [ ] **門禁開門成功率卡片**
  - 實現 `getDoorAccessMetrics()`
  - 顯示：成功率、成功/失敗次數、說明文字
  - 圖示：`door-open`
  - 未串接時顯示提示

**完成條件：** 卡片顯示，數據從數據庫取得

---

### 第三階段：主要圖表實現（15-20 小時）

**A. 每日營運趨勢圖** (使用 Recharts LineChart)
- [ ] 實現 `getDailyOperationTrends()`
- [ ] X軸：日期
- [ ] Y軸：數量/比例
- [ ] 多線條：預約量、進場人次、完成率
- [ ] Tooltip 顯示詳細數字
- [ ] 圖表下方說明文字（約 10-20 字）

**B. 時段使用分布圖** (BarChart)
- [ ] 實現 `getTimeSlotDistribution()`
- [ ] X軸：時段（09:00, 12:00, 15:00, 18:00, 20:00, 22:00）
- [ ] Y軸：使用率
- [ ] 顏色分級：低/一般/高/尖峰
- [ ] 說明：「18:00–22:00 為主要尖峰時段」

**C. 各場地使用率比較** (BarChart)
- [ ] 實現 `getCourtComparison()`
- [ ] 顯示：A場、B場、C場等
- [ ] 每場地：使用率、尖峰率、離峰率
- [ ] 顏色：綠（好）/ 黃（尚可）/ 紅（需注意）
- [ ] 說明：「B場使用率較低，建議檢查曝光、價格或設備」

**D. 平日假日比較** (BarChart)
- [ ] 實現 `getWeekdayComparison()`
- [ ] 顯示：平日 54% vs 假日 88%
- [ ] 差異計算和說明

**E. 預約狀態圓餅圖** (PieChart)
- [ ] 實現 `getBookingStatusDistribution()`
- [ ] 已完成、待付款、已取消、已過期、已退款
- [ ] 中央顯示總數
- [ ] 圖例顯示百分比和筆數

**F. 門禁與進出紀錄** (統計表或卡片組)
- [ ] 實現門禁數據聚合
- [ ] 顯示：解鎖成功/失敗、各類授權方式、進場人次
- [ ] 未串接時顯示清楚提示（不崩潰）

**完成條件：** 所有圖表可視化，數據正確，響應式設計

---

### 第四階段：異常提示與說明（6-8 小時）

**營運異常卡片（4 類）：**

- [ ] **離峰使用率偏低**
  - 圖示：`triangle-alert`
  - 顯示：9:00–17:00 平均 32.5%，建議檢查

- [ ] **門禁解鎖失敗增加**
  - 圖示：`door-closed-lock`
  - 顯示：本期 17 次，上期增加 5 次

- [ ] **場地使用率落差過大**
  - 圖示：`chart-no-axes-combined`
  - 顯示：B場比A場低18%

- [ ] **設備資料未更新**
  - 圖示：`refresh-cw`
  - 顯示：無法取得最新門禁資料

**營運狀況說明區塊：**
- [ ] 實現 `generateOperationSummary()`
- [ ] 自動生成文字說明（3-5 句）
- [ ] 根據實際數據動態調整內容

**完成條件：** 異常正確顯示，說明內容准確，不誤導

---

### 第五階段：下載和列印功能（6-8 小時）

**下載報表：**
- [ ] 實現 PDF 生成（使用 jsPDF 或類似）
- [ ] 包含：卡片數值、圖表、異常提示、說明
- [ ] 檔名：`營運狀況報表_2026-11-01_2026-11-30.pdf`
- [ ] 適合 A4 紙張

**列印功能：**
- [ ] 創建列印樣式表 (`@media print`)
- [ ] 隱藏：側欄、按鈕、無關內容
- [ ] 保留：標題、日期、卡片、圖表、異常、說明
- [ ] 避免圖表被切斷或跨頁
- [ ] 測試 Chrome、Firefox、Safari

**完成條件：** 下載和列印都能正常工作，版面清晰

---

### 第六階段：權限與安全（4-6 小時）

- [ ] 在 `src/lib/admin-permissions.ts` 中確認 `finance` 權限適用
- [ ] 後端 API 檢查權限
- [ ] 高級管理者：完整報表
- [ ] 一般管理者：授權的統計
- [ ] 工程管理者：設備相關
- [ ] 測試權限限制

**完成條件：** 權限工作正常，無權限時無法訪問或查看

---

### 第七階段：測試與優化（4-6 小時）

- [ ] 單元測試：數據聚合函數
- [ ] 集成測試：頁面載入、日期篩選
- [ ] E2E 測試：完整流程
- [ ] 響應式設計測試（桌面、平板、手機）
- [ ] 性能測試：載入時間（目標 < 2 秒）
- [ ] 無 Hydration error
- [ ] 無 JavaScript runtime error

**測試命令：**
```bash
npm run typecheck
npm run build
npm run test -- operations-report
```

**瀏覽器測試：**
- Chrome 最新版
- Firefox 最新版
- Safari 最新版
- 手機版（iOS Safari、Chrome Mobile）

---

## 🔧 技術細節

### 數據獲取流程

```
頁面 (page.tsx)
  ↓
  獲取日期參數
  ↓
  調用 getOperationMetrics(from, to)
  ↓
  並行獲取 4 項指標
  ↓
  傳遞給客戶端組件
  ↓
  客戶端渲染圖表和卡片
```

### 文件結構

```
src/app/admin/operations-report/
├── page.tsx                 # 伺服器組件（頁面邏輯、數據獲取）
├── operations-client.tsx    # 客戶端組件（渲染、交互）
├── components/
│   ├── metrics-cards.tsx    # 4 個統計卡片
│   ├── daily-trends.tsx     # 每日趨勢圖
│   ├── time-slots.tsx       # 時段分布圖
│   ├── court-comparison.tsx # 場地比較圖
│   ├── weekday-compare.tsx  # 平日假日比較
│   ├── booking-status.tsx   # 預約狀態圖
│   ├── door-access.tsx      # 門禁紀錄
│   ├── alerts.tsx           # 異常提示
│   ├── summary.tsx          # 營運說明
│   └── toolbar.tsx          # 工具欄
└── utils/
    └── download.ts          # 下載和列印函數

src/server/
└── operation-metrics.ts     # 數據聚合層

src/lib/
└── admin-permissions.ts     # 權限檢查（已存在，可能需要擴展）
```

### 關鍵依賴

```json
{
  "recharts": "^2.x",        // 圖表庫（已有）
  "jspdf": "^2.x",           // PDF 生成（需新增）
  "html2canvas": "^1.x",     // 圖表轉圖片（PDF 用，需新增）
  "lucide-react": "^latest"  // 圖示（已有）
}
```

### 權限檢查示例

```typescript
// page.tsx
export default async function OperationsReportPage() {
  await pagePermission('finance')  // 使用既有權限檢查
  
  // 獲取指標...
}

// 後端 API（如需新增）
export async function getOperationMetrics(from, to) {
  const user = await currentUser()
  if (!user || !hasPermission(user, 'finance.view')) {
    throw new Error('Unauthorized')
  }
  
  // 返回數據...
}
```

---

## 📊 預期成果

### 完成後的功能

✅ 實時營運狀況一目了然  
✅ 7 個主要圖表，可切換日期範圍  
✅ 自動異常檢測與提示  
✅ 自動生成營運說明  
✅ 下載 PDF 報表  
✅ 列印友善版面  
✅ 權限檢查  
✅ 完整測試覆蓋  

### 頁面的流暢性

- **載入時間：** < 2 秒
- **交互響應：** < 200ms
- **圖表渲染：** 順暢，無卡頓
- **列印品質：** 清晰，無切斷

---

## 🎯 優先級和分支策略

### 建議分支名稱
```
feature/operations-report-phase1  # 基礎頁面
feature/operations-report-phase2  # 卡片和數據
feature/operations-report-phase3  # 圖表
feature/operations-report-phase4  # 異常和說明
feature/operations-report-complete # 最終合併
```

### 開發順序

**MVP（最小可用產品，2-3 天）：**
1. 基礎頁面和日期篩選
2. 4 個統計卡片
3. 1-2 個關鍵圖表（趨勢、場地比較）

**完整版（1-2 週）：**
1. 所有 6 個圖表
2. 異常提示
3. 下載和列印
4. 完整測試

---

## ⚠️ 需要澄清的事項

### 1. 數據來源確認

以下數據需要確認來自哪些表：

- **進場人次**：是否有 Entry/Check-in 表？還是從 Booking 推算？
- **門禁數據**：是否已串接設備？數據存在哪個表？
- **場地使用率**：如何計算？預約數 / 總時段？
- **異常定義**：具體的臨界值是多少？

### 2. 設備串接狀態

- 目前門禁、電力、設備監控的數據是否已保存到數據庫？
- 未串接時如何處理？（提示用戶 / 顯示測試數據）

### 3. 時區和日期

- 所有統計都使用台北時區（Asia/Taipei）？
- 「今天」是指台北時間的 00:00–23:59？

### 4. 自訂日期的性能

- 允許最大查詢跨度是多少？（90 天 / 1 年）
- 超大查詢時是否分頁或聚合？

---

## 📝 實施注意事項

### 代碼規範

```typescript
// ✅ 好的做法
const metric = await getMetric(from, to)
if (!metric) {
  return <EmptyState reason="no-data" />
}

// ❌ 避免
const metric = await getMetric(from, to)
// 假設總是有數據，可能導致崩潰
```

### 無資料狀態

```typescript
// 顯示清楚的空狀態，不要讓頁面崩潰
<EmptyState
  icon="inbox"
  title="沒有資料"
  description="選定日期範圍內無相關數據，請嘗試其他日期。"
/>
```

### 設備尚未串接

```typescript
// 明確標示測試資料或未串接狀態
<Alert type="warning">
  <AlertTitle>門禁資料尚未更新</AlertTitle>
  <AlertDescription>
    目前無法取得最新門禁資料，請確認設備串接狀態。
  </AlertDescription>
</Alert>
```

---

## ✅ 完成檢查清單

開發完成後，請確認：

- [ ] TypeScript 無錯誤：`npm run typecheck` ✓
- [ ] 編譯成功：`npm run build` ✓
- [ ] 無 hydration error
- [ ] 無 JavaScript runtime error
- [ ] 桌面版顯示正常
- [ ] 手機版不會溢出
- [ ] 日期篩選工作正常
- [ ] 所有圖表顯示數據
- [ ] 下載報表可用
- [ ] 列印版面清晰
- [ ] 權限檢查正常
- [ ] 無資料時顯示空狀態
- [ ] 設備未串接時有提示

---

## 📞 後續

完成各階段後，請提供：

1. **修改的文件清單**
2. **新增的圖表數量和類型**
3. **使用的數據查詢**
4. **空狀態或提示的位置**
5. **下載和列印的運作方式**
6. **測試結果和覆蓋率**
7. **桌面和手機版本的驗證結果**

---

**預計開始日期：** 2026-11-24  
**預計完成日期：** 2026-12-08（全部階段）
