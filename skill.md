# 匹克精靈系統架構速查手冊

## 快速導航

| 模塊 | 主路徑 | 檔案位置 | 說明 |
|------|--------|---------|------|
| **前台-訂場** | `/booking` | `src/app/booking/` | 日期選擇 + 時段矩陣 |
| **前台-購物車** | `/cart` | `src/app/cart/` | 商品管理與結帳入口 |
| **前台-結帳** | `/checkout` | `src/app/checkout/` | 付款流程 |
| **前台-我的預約** | `/bookings` | `src/app/bookings/` | 預約列表與詳情 |
| **前台-會員中心** | `/account` | `src/app/account/` | 個人資料與儲值 |
| **後台-登入** | `/admin/login` | `src/app/admin/login/` | 帳密認證 |
| **後台-訂單** | `/admin/bookings` | `src/app/admin/bookings/` | 訂單管理 |
| **後台-時段** | `/admin/schedule` | `src/app/admin/schedule/` | 場地時段鎖定 |
| **後台-會員** | `/admin/members` | `src/app/admin/members/` | 人員與黑名單 |
| **後台-財務** | `/admin/finance` | `src/app/admin/finance/` | 營收管理 |

---

## 前台架構速查

### 核心流程
```
首頁 → 訂場選日期 → 選場地×時段 → 加購物車 → 結帳 → 付款 → 預約完成
                                                           ↓
                                            我的預約 → 詳情/取消
```

### 主要檔案結構
```
src/app/
├── booking/               日期 + 時段矩陣
│   └── page.tsx
├── bookings/              我的預約
│   ├── page.tsx           預約列表
│   └── [id]/page.tsx      預約詳情
├── cart/                  購物車
│   └── page.tsx
├── checkout/              結帳
│   ├── page.tsx           訂單預覽 + 金流
│   ├── [id]/page.tsx      重新付款
│   └── result/page.tsx    結果頁

src/components/
├── booking/
│   ├── date-strip.tsx     日期條帶
│   ├── slot-matrix.tsx    時段矩陣
│   └── cart-bar.tsx       購物車條
├── checkout/
│   └── tappay-card-form.tsx   信用卡表單

src/lib/
├── availability.ts        時段可用性查詢
├── pricing.ts             費率計算 & 退款規則
├── time.ts                時區工具（UTC+8）
├── session.ts             Session & cartToken
├── payments/              金流抽象層
│   ├── types.ts
│   ├── mock.ts
│   ├── tappay.ts
│   ├── newebpay.ts
│   └── linepay.ts
└── line.ts                LINE 驗證 & 推播

src/server/
├── booking-service.ts     預約核心邏輯
└── actions.ts             顧客 Server Actions
```

### 關鍵函數

| 函數 | 位置 | 功能 |
|------|------|------|
| `getAvailability()` | pricing.ts | 取得時段可用性 + 價格 |
| `createHold()` | booking-service.ts | 暫扣時段（建 Reservation HELD） |
| `createBooking()` | booking-service.ts | 建立訂單（PENDING） |
| `markBookingPaid()` | booking-service.ts | 標記已付款（PAID → BOOKED），冪等 |
| `cancelBooking()` | booking-service.ts | 取消訂單，依規則退款 |
| `calculateRefund()` | pricing.ts | 計算退款比例 |
| `verifyLineIdToken()` | line.ts | 驗證 LINE id_token |
| `sendLineNotification()` | line.ts | 推播 Flex Message |

### 環境變數

```env
# LINE
NEXT_PUBLIC_LIFF_ID=<LIFF App ID>
LINE_LOGIN_CHANNEL_ID=<Channel ID>
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=<Token>

# 金流
PAYMENT_PROVIDER=mock|tappay|newebpay|linepay
TAPPAY_APP_ID=<id>
TAPPAY_APP_KEY=<key>
...

# 開發模式
NEXT_PUBLIC_DEV_LOGIN=1
```

---

## 後台架構速查

### 模塊分類

| 分類 | 路徑 | 功能 |
|------|------|------|
| **營運** | `/admin/bookings` | 訂單搜尋、取消、標記完成 |
| | `/admin/schedule` | 時段鎖定 |
| | `/admin/sessions` | 球敘與課程 |
| | `/admin/activities` | 活動管理 |
| **人員** | `/admin/members` | 會員搜尋、黑名單 |
| | `/admin/members/[id]` | 會員詳情 |
| | `/admin/members/points` | 點數帳本 |
| | `/admin/members/restrictions` | 黑名單管理 |
| **財務** | `/admin/finance` | 營收儀表板 |
| | `/admin/finance/payments` | 付款追蹤 |
| | `/admin/invoices` | 發票 |
| | `/admin/receipts` | 收據（OCR） |
| | `/admin/expenses` | 費用登錄 |
| | `/admin/refunds` | 退款 |
| **定價** | `/admin/pricing` | 定價規則 |
| | `/admin/topup` | 儲值方案 |
| | `/admin/bookings/products` | 訂場產品 |
| **行銷** | `/admin/marketing/campaigns` | 行銷活動 |
| | `/admin/marketing/vouchers` | 折價券 |
| **AI & 智慧** | `/admin/ai-assistant` | AI 助理 |
| | `/admin/ai-courts` | 智慧球場 |
| **設定** | `/admin/settings` | 場館設定 |
| | `/admin/settings/payments` | 金流設定 |
| | `/admin/settings/staff` | 員工管理 |
| | `/admin/audit` | 稽核紀錄 |

### 主要檔案結構

```
src/app/admin/
├── login/                登入頁
│   ├── page.tsx
│   └── login-form.tsx
├── page.tsx              首頁 / 儀表板
├── bookings/             訂單
│   ├── page.tsx
│   ├── order-drawer.tsx
│   └── products/
├── schedule/             時段管理
│   └── page.tsx
├── members/              會員
│   ├── page.tsx
│   ├── [id]/page.tsx
│   ├── points/page.tsx
│   └── restrictions/page.tsx
├── finance/              財務
│   ├── page.tsx
│   └── payments/page.tsx
├── invoices/, receipts/  發票、收據
├── expenses/             費用
├── pricing/              定價
├── marketing/            行銷
├── settings/             設定
└── audit/                稽核

src/components/admin/
├── admin-shell.tsx       外框 (側欄 + Header)
├── ai-chat.tsx           AI 對話
├── ai-context.tsx        AI 上下文
├── monitor-board.tsx     監控面板
├── page-bits.tsx         共用元件

src/server/
└── admin-actions.ts      管理員 Server Actions

src/app/api/admin/
├── members/              會員 API
├── courts/               球場 API
├── pricing/              定價 API
├── finance/              財務 API
├── payments/             付款 API
├── audit/                稽核 API
└── ...
```

### 認證與授權

| 項目 | 說明 |
|------|------|
| **登入方式** | 帳號 / 密碼（scrypt 雜湊） |
| **存儲** | HttpOnly Cookie（12 小時有效期） |
| **簽章** | SESSION_SECRET |
| **中間件** | src/middleware.ts（驗證 /admin/*） |
| **環境變數** | ADMIN_USERNAME, ADMIN_PASSWORD_HASH |
| **改密碼** | `npm run admin:password -- 新密碼` |

### 關鍵函數

| 函數 | 位置 | 功能 |
|------|------|------|
| `getAdminSession()` | admin-auth.ts | 驗證 Admin Session |
| `requireAdminAuth()` | middleware.ts | 中間件保護 |
| `cancelBookingAsAdmin()` | admin-actions.ts | 代客取消（全額回補） |
| `lockTimeSlot()` | admin-actions.ts | 鎖定時段 |
| `addPointsManually()` | admin-actions.ts | 手動加點 |
| `addToBlacklist()` | admin-actions.ts | 加入黑名單 |
| `generateAuditLog()` | admin-actions.ts | 記錄稽核 |

---

## 共享核心架構

### 資料庫

**提供者**：Turso（libSQL / SQLite）
**ORM**：Prisma + libSQL driver adapter
**連線**：src/lib/db.ts

**主要表單**：
- `User` → 顧客與管理員
- `Venue` → 場館
- `Court` → 場地
- `Reservation` → 時段預約（HELD/BOOKED/BLOCKED/EVENT）
- `Booking` → 訂單
- `BookingItem` → 訂單項目（快照）
- `Payment` → 付款記錄
- `Voucher` → 折價券
- `TopupTransaction` → 儲值
- `PointLedger` → 點數帳本
- `PriceRule` → 定價規則
- `Session` → 球敘
- `Activity` → 活動 / 課程
- `Expense` → 費用
- `Receipt` → 收據
- `Invoice` → 發票
- `Device` → 設備
- `Coach` → 教練
- `AuditLog` → 稽核紀錄

### API 端點

**顧客端**：
- `GET /api/bookings` → 我的訂單
- `POST /api/bookings` → 建立訂單
- `GET /api/bookings/[id]` → 訂單詳情
- `POST /api/bookings/[id]/cancel` → 取消訂單
- `GET /api/bookings/[id]/status` → 付款狀態
- `POST /api/topup` → 儲值

**金流**：
- `POST /api/payments/{provider}/notify` → 金流通知（NotifyURL）
- `POST /api/payments/tappay/prime` → TapPay 請款

**後台**：
- `GET/POST /api/admin/members` → 會員 CRUD
- `GET/POST /api/admin/courts` → 球場 CRUD
- `GET/POST /api/admin/pricing` → 定價 CRUD
- `GET/POST /api/admin/finance` → 財務查詢
- 等等...

**定期任務**：
- `GET /api/cron/expire-bookings` → 清理逾時（Vercel Cron 每 5 分鐘）
- `GET /api/cron/sessions` → 球敘處理

**系統**：
- `GET /api/health` → 健康檢查

### 安全性

| 項目 | 措施 |
|------|------|
| **卡號** | 不落地（TapPay iframe / 金流商代管） |
| **金額** | 伺服器端重新計算（不信任前端） |
| **取消訂單** | 伺服器端驗證幣種與金額 |
| **Cron** | 需要 CRON_SECRET 參數 |
| **黑名單** | 全面攔截（舊 session / 付款 / 後台） |
| **購物車** | cartToken HttpOnly Cookie 綁定 |
| **Session** | JWT 簽章（SESSION_SECRET） |
| **Admin** | 密碼 scrypt 雜湊，12 小時 Cookie |

### 時區

**設置**：UTC+8（台灣固定位移，無日光節約）
**工具**：`src/lib/time.ts`
- `getThailandDate()` → 今日台灣日期
- `convertToTaiwanTime()` → 轉換到台灣時間

**資料庫**：所有時間存 UTC，應用層轉換

### 金流流程

```
前端選商品 → 建立訂單 (PENDING) → 導至金流表單
    ↓
使用者在金流頁面輸入卡號
    ↓
金流商回呼 NotifyURL → markBookingPaid() (冪等)
    ↓
Reservation 轉為 BOOKED → 推播 LINE 通知
    ↓
使用者看到預約成立
```

**金流商選項**：
- `mock` - 開發用模擬
- `tappay` - TapPay（台灣）
- `newebpay` - 藍新（台灣）
- `linepay` - LINE Pay（東亞）

### 部署

**平台**：Vercel（代碼 + Cron 排程）
**資料庫**：Turso（Cloud SQLite）

**第一次部署**：
```bash
npm run db:turso:init      # 建表
npm run db:seed            # 種子資料
```

**修改 Schema**：
```bash
# 將差異 SQL 放進 prisma/migrations-manual/
node scripts/apply-sql.mjs <檔案>
```

**環境變數**：Vercel Dashboard 設定

**Cron**：vercel.json 已設置 `/api/cron/expire-bookings` 每 5 分鐘執行

---

## 常見工作流

### 新增時段定價
1. 編輯 `prisma/schema.prisma` → `PriceRule`
2. `npm run db:turso:init` 
3. 在 `/admin/pricing` 新增規則
4. 重啟開發伺服器

### 新增後台頁面
1. 建立 `src/app/admin/newpage/page.tsx`
2. 在 `src/components/admin/admin-shell.tsx` 更新側欄
3. 編寫對應 Server Actions（`src/server/admin-actions.ts`）
4. 編寫 API（`src/app/api/admin/newpage/`）

### 修改訂場流程
1. 編輯 `src/app/booking/page.tsx` 與元件
2. 修改 `src/lib/availability.ts` 可用性邏輯
3. 修改 `src/server/booking-service.ts` 預約邏輯
4. 測試：`npm run dev` → 訂場流程驗證

### 新增會員功能
1. 編輯 `prisma/schema.prisma` → 新增欄位
2. 修改 `/admin/members` 頁面
3. 新增 API 端點 `/api/admin/members/`
4. 新增 Server Action
5. 更新 `/account` 前台顯示

### 部署到正式環境
1. 修改代碼並 commit
2. `npm run build && npm run typecheck` 本機驗證
3. 推送到 GitHub
4. Vercel 自動部署
5. 首次模式需手動初始化資料庫：
   ```bash
   TURSO_DATABASE_URL=正式庫 TURSO_AUTH_TOKEN=正式key npm run db:turso:init
   ```

---

## 疑難排解

| 問題 | 原因 | 解決 |
|------|------|------|
| `.next` 資料夾被 Dropbox 鎖住 | Dropbox 同步軟體 | `npm run dev:clean`（只清內容不刪資料夾） |
| Prisma seed 連不上DB | `.env` 未設定正確 | 檢查 `.env` 的 TURSO_* 變數 |
| 訂場時段加不到購物車 | cartToken 過期或缺失 | 重新整理頁面，檢查 Cookie 設定 |
| 付款後訂單未成立 | 金流通知未回覆 | 檢查 NotifyURL，手動測試 `/checkout/[id]/retry` |
| 後台無法登入 | 環境變數未設定 | 檢查 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD_HASH` |
| 定期任務未執行 | `CRON_SECRET` 缺失或不符 | vercel.json 與環境變數中設定 |

---

## 快速參考命令

```bash
# 開發
npm run dev                    # 啟動開發伺服器（:3000）
npm run dev:clean             # 清快取啟動

# 檢查
npm run typecheck             # TypeScript 檢查
npm run build                 # 生產建置

# 資料庫
npm run db:seed               # 灌種子資料
npm run db:reset              # 清空 + 重建
npm run db:studio             # Prisma Studio（視覺化）

# 管理員
npm run admin:password        # 設定管理員密碼

# 驗證
npm run verify:activities     # 驗證活動系統
npm run verify:permissions    # 驗證權限系統
npm run verify:session        # 驗證 session 邏輯
npm run verify:topup          # 驗證儲值系統
npm run verify:expenses       # 驗證費用系統

# AI
npm run verify:ai-guide       # 驗證 AI 導遊
```

---

## 檔案位置速查

| 功能 | 檔案 |
|------|------|
| 訂場時段查詢 | `src/lib/availability.ts` |
| 費率計算 | `src/lib/pricing.ts` |
| 預約核心 | `src/server/booking-service.ts` |
| 後台認證 | `src/lib/admin-auth.ts` |
| LINE 整合 | `src/lib/line.ts` |
| 金流抽象層 | `src/lib/payments/types.ts` |
| 時區工具 | `src/lib/time.ts` |
| 資料庫連線 | `src/lib/db.ts` |
| 中間件 | `src/middleware.ts` |
| 資料模型 | `prisma/schema.prisma` |
| 環境範本 | `.env.example` |
| Vercel 設定 | `vercel.json` |

---

**最後更新**：2026-10-08  
**版本**：1.0.0  
**項目**：匹克精靈 (Pickle Heaven)
