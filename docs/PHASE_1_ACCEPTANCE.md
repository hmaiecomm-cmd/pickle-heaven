# Phase 1 驗收文件

日期：2026-10-06
範圍：後台（`/admin`）MVP。原 `/owner` 後台已併入 `/admin`，舊網址永久轉址。

## 驗收摘要

| 項目 | 結果 |
| --- | --- |
| `npx tsc --noEmit` | 0 錯誤 |
| `npm run build` | 46 條路由全部編譯通過 |
| 正式站 | https://pickle-heaven.vercel.app，`/api/health` 回 `db: up` |
| 後台存取保護 | `src/middleware.ts` 以 `ph_admin` JWT cookie 保護整個 `/admin`，未登入與無效 cookie 導向登入頁 |
| 手機版型（375px） | 18 個後台頁面皆無水平溢出；側欄預設收合，漢堡選單開合 |
| 互動回饋 | 所有 mock 狀態變更都有 toast，並標示「mock，未寫入資料庫」 |

## 頁面清單與資料來源

「資料庫」表示讀寫 Turso；「mock」表示讀 `src/lib/mock-data`，寫入只改畫面。

| 路徑 | 頁面 | 資料 | 已驗收功能 |
| --- | --- | --- | --- |
| `/admin` | 今日總覽 | 資料庫 | 今日營收、訂單、使用率、待付款、今日預約 |
| `/admin/bookings` | 訂單管理 | 資料庫 | 搜尋篩選、代客取消、標記完成 |
| `/admin/schedule` | 場地時段 | 資料庫 | 時段矩陣、鎖定維護 |
| `/admin/sessions` | 球敘 | 資料庫 | 列表、名單管理、軟刪除 |
| `/admin/templates` | 球敘範本 | 資料庫 | 多天 weekdays、立即產生 |
| `/admin/ai-courts` | AI 智慧球場 | mock | 球場狀態、裝置控制、QR 門禁 |
| `/admin/events` | 活動與教練 | mock | 活動／教練分頁、KPI、篩選、詳情、狀態操作 |
| `/admin/members` | 會員 | mock | KPI、等級篩選、排序、搜尋、匯出、預約紀錄 |
| `/admin/courts` | 球場 | mock | 狀態卡、設備燈號、營運／維護／停用 |
| `/admin/pricing` | 定價 | mock | 時租 × 時段倍率、活動、教練、會員折扣 |
| `/admin/finance` | 營收與財務 | mock | 五項 KPI、三張趨勢圖、占比、付款摘要、明細表 |
| `/admin/finance/payments` | 付款狀態 | mock | KPI、篩選、搜尋、詳情、重試佔位 |
| `/admin/invoices` | 發票 | mock | KPI、逾期判定、明細、開立／付款／作廢、匯出 |
| `/admin/receipts` | 收據 | mock | OCR 模擬（上傳→辨識→完成→草稿→人工確認）、匯出 |
| `/admin/expenses` | 費用 | mock | KPI、篩選、草稿標示、審核流程、手動登錄、匯出 |
| `/admin/reports` | 報表與分析 | mock | 五種報表即時彙整、期間、匯出 CSV |
| `/admin/ai-assistant` | AI 管理助理 | mock | 對話、建議問題、資料期間／來源／計算說明、高風險操作預覽與擁有者確認 |
| `/admin/settings` | 設定 | mock | 場館、球場、定價、金流、規則、API 狀態、稽核紀錄 |

## 設計原則（已落實）

- **mock 可辨識**：側欄標示 mock 小標；設定頁列出每個功能的連線狀態；AI 回覆標示 Mock。
- **高風險操作不執行**：AI 助理對批次取消、退款、群發只產生操作預覽，確認後也不執行。
- **OCR 不自動入帳**：辨識結果一律草稿，人工確認後仍需在費用頁另建分錄。
- **圖表無第三方相依**：`src/components/common/charts.tsx` 純 SVG，配色經 dataviz 驗證腳本亮暗模式皆通過。
- **匯出為真實功能**：`src/lib/csv.ts` 產生含 BOM 的 CSV。

## 已知限制

- mock 頁面的狀態變更重新整理後會還原。
- 定價頁的時段倍率與會員折扣為頁內常數。
- 設定頁全部唯讀。
- 智慧球場（`/admin/ai-courts`）裝置控制為 mock API（`src/app/api/ai/*`）。
- 手機版型以 DOM 量測無溢出為準，視覺細節建議人工再看一輪。

## 部署流程（已驗證）

1. schema 有變動時先對正式庫套用 `prisma/migrations-manual/*.sql`（`node scripts/apply-sql.mjs <檔案>`，指定正式庫連線）。
2. `npm run build` 本機確認。
3. `vercel --prod`。
4. 驗證 `/api/health`、`/sessions`、`/admin`。

2026-10-06 曾因步驟順序顛倒（先部署、後補欄位）導致 `/sessions` 500 約 20 分鐘，已修正並寫入 README。
