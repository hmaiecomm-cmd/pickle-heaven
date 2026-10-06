# Phase 2 API 整合規格

目標：把 `src/lib/api-service.ts` 的 mock 函式逐一換成真實資料來源，前端頁面不改介面。
原則：**保留 `ApiResponse<T>` 回傳形狀**（`success / data / meta / error`），頁面只需改資料來源，不改元件。

## 現有資料表可直接承接的功能

這些功能已有 Prisma 模型，Phase 2 以 server action 或 route handler 讀寫即可。

| mock 函式 | 承接方式 | 備註 |
| --- | --- | --- |
| `getReservations` | 已由 `/admin/bookings`（`Booking` / `BookingItem` / `Reservation`）承接 | mock 預約頁已移除 |
| `getEvents` | 建議重用 `Session` / `SessionTemplate` | 球敘本質即週期性活動；若需比賽／課程分類，在 `Session` 加 `kind` 欄位 |
| `getCourts` | `Court`（含 `active`） | 設備狀態欄位需新增，見下節 |
| `getRevenue` / `getFinancialSummary` | 由 `Booking`（`status in PAID, COMPLETED`、`paidAt`、`total`）彙整 | 今日總覽頁已有同樣查詢可參考 |
| `getPayments` | `Payment` | 金流商回呼已寫入 |
| `getMembers` | `User` + `Booking` 彙整 `totalSpent`、`lastVisit` | 會員等級需新增 `User.membershipLevel` |

## 需要新增的資料表

| 模型 | 欄位（摘要） | 對應頁面 |
| --- | --- | --- |
| `Coach` | name, phone, email, status, specialties(JSON), hourlyRate | 活動與教練 |
| `CoachAvailability` | coachId, dayOfWeek, startMinute, endMinute | 活動與教練 |
| `Invoice` | invoiceNumber, userId, bookingId, issueDate, dueDate, amount, status, items(JSON) | 發票 |
| `Receipt` | receiptNumber, paymentId?, amount, issueDate, paymentMethod, vendorName, ocrStatus, ocrFields(JSON), ocrConfidence, imageUrl | 收據 |
| `Expense` | expenseNumber, category, amount, status, description, submittedAt, approvedAt, approvedBy, receiptId? | 費用 |
| `PricingRule` | kind(TIME/MEMBER), label, multiplier 或 discountPct, weekdays, startMinute, endMinute, active | 定價 |
| `Device` | courtId, type, name, status, lastSeen, lastAction | 球場、智慧球場 |
| `VenueSetting` | key, value(JSON) | 設定 |
| `AiConversation` / `AiMessage` | userId, role, text, meta(JSON), actionPreview(JSON), confirmedAt | AI 助理 |

`AuditLog` 已存在，設定頁的稽核紀錄直接讀取；所有狀態變更（審核、作廢、確認）都應寫入。

## 端點清單

以 Next.js route handler 實作，全部位於 `/api/admin/*`，由 `src/middleware.ts` 保護。

| 方法 | 路徑 | 取代的 mock | 說明 |
| --- | --- | --- | --- |
| GET | `/api/admin/events` | `getEvents` | 查詢參數 `status`、`type` |
| PATCH | `/api/admin/events/:id/status` | 頁面本機狀態 | `DRAFT→PUBLISHED→ONGOING→COMPLETED`，`CANCELLED` 僅限前兩者 |
| GET | `/api/admin/coaches` | `getCoaches` | 含 availability |
| GET | `/api/admin/courts` | `getCourts` | 含 devices |
| PATCH | `/api/admin/courts/:id/status` | 頁面本機狀態 | `ACTIVE / MAINTENANCE / INACTIVE`，寫 AuditLog |
| GET | `/api/admin/finance/summary?range=` | `getFinancialSummary` | 回傳 `FinancialSummary`，`expenses` 欄位名稱保持一致 |
| GET | `/api/admin/finance/revenue?range=` | `getRevenue` | |
| GET | `/api/admin/payments` | `getPayments` | |
| POST | `/api/admin/payments/:id/retry` | 重試佔位 | 呼叫金流商；回傳新交易編號 |
| GET | `/api/admin/invoices` | `getInvoices` | |
| PATCH | `/api/admin/invoices/:id/status` | 頁面本機狀態 | `ISSUED` 時串接電子發票 |
| GET | `/api/admin/receipts` | `getReceipts` | |
| POST | `/api/admin/receipts/ocr` | `postOCRScan` | multipart 上傳；回傳 `ocrStatus: DRAFT` 與欄位；**絕不自動建立 Expense** |
| PATCH | `/api/admin/receipts/:id/confirm` | 頁面本機狀態 | 標記 `ocrStatus: CONFIRMED`，寫 AuditLog |
| GET | `/api/admin/expenses` | `getExpenses` | |
| POST | `/api/admin/expenses` | 手動登錄 | |
| PATCH | `/api/admin/expenses/:id/status` | 頁面本機狀態 | `SUBMITTED→APPROVED/REJECTED`，記錄 approvedBy |
| GET | `/api/admin/members` | `getMembers` | 彙整欄位用 SQL 子查詢 |
| GET | `/api/admin/pricing` | 頁內常數 | 回傳 `PricingRule[]` |
| PUT | `/api/admin/pricing` | 編輯佔位 | 整組覆寫，寫 AuditLog |
| GET | `/api/admin/reports/:type?from=&to=` | 頁面即時彙整 | 回傳 `{ header, rows }`，與 `reports-client.tsx` 的 `Report` 相同 |
| GET / PUT | `/api/admin/settings` | 頁內常數 | `VenueSetting` key-value |
| POST | `/api/admin/ai/chat` | `postAIChat` | 見下節 |
| POST | `/api/admin/ai/actions/:id/confirm` | 頁面本機狀態 | 寫入 `confirmedAt` 與 AuditLog；Phase 2 初期仍不執行實際操作 |

## AI 助理整合要點

- 伺服器端呼叫 Claude API，以 tool use 提供唯讀查詢工具（營收、使用率、訂單、發票、活動），模型回傳的結構包含 `text`、`period`、`sources`、`notes`，與 `ai-assistant-client.tsx` 的 `Message.meta` 一致。
- 高風險意圖偵測從前端移到伺服器端；模型只能回傳 `actionPreview`，不得呼叫任何寫入工具。
- 確認流程兩段式：`POST /ai/actions/:id/confirm` 只記錄確認，實際執行由另一個明確的管理端點負責，並要求再次輸入密碼。

## 遷移順序建議

1. 財務三支（summary / revenue / payments）：資料已存在，頁面已完整，先做能最快拿掉 mock 標示。
2. 球場與裝置：新增 `Device` 表，讓球場頁與智慧球場共用。
3. 費用、收據、發票：新增三張表與 OCR 上傳。
4. 會員彙整與定價規則。
5. 活動與教練（決定是否重用 Session）。
6. AI 助理。

每完成一項，移除 `src/app/admin/layout.tsx` 中該項目的 `mock: true`，並更新設定頁的 `API_STATUS`。
