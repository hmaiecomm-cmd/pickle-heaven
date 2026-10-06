# 匹克精靈 Pickle Heaven — 匹克球場地預約系統

台灣匹克球場館的線上預約平台，主要以 **LINE MINI App（LIFF）** 形式在 LINE 內使用，同時支援桌機瀏覽器。

顧客旅程：

```
LINE 官方帳號 → 圖文選單 → LINE MINI App → 選擇日期 → 選擇場地與時段
→ 加入購物車 → 結帳 → 信用卡付款 → 預約完成 → LINE 通知 → 我的預約
```

---

## 目錄

- [技術架構](#技術架構)
- [快速開始](#快速開始)
- [環境變數](#環境變數)
- [資料模型](#資料模型)
- [核心機制](#核心機制)
- [金流串接](#金流串接)
- [LINE MINI App 設定](#line-mini-app-設定)
- [後台管理](#後台管理)
- [部署到 Vercel](#部署到-vercel)
- [目錄結構](#目錄結構)
- [已驗證項目](#已驗證項目)
- [疑難排解](#疑難排解)

---

## 技術架構

| 層級 | 技術 |
| --- | --- |
| 前端 | Next.js 15（App Router）、React 19、TypeScript、Tailwind CSS |
| UI | shadcn/ui 風格元件（Radix UI + CVA），行動優先、支援深色模式 |
| 後端 | Next.js Server Actions + Route Handlers |
| 資料庫 | Turso（libSQL / SQLite）+ Prisma ORM（driver adapter）|
| 顧客身分 | LINE Login / LIFF id_token（伺服器端驗證）+ HttpOnly JWT session |
| 管理者身分 | 帳號／密碼（scrypt 雜湊）+ HttpOnly JWT Cookie |
| 通知 | LINE Messaging API（Flex Message）／MINI App 服務訊息 |
| 金流 | PaymentProvider 抽象層：Mock／TapPay／藍新 NewebPay／LINE Pay |
| 部署 | Vercel（含 Cron Job） |

---

## 快速開始

### 1. 安裝

```bash
npm install
```

### 2. 準備資料庫

1. 到 [turso.tech](https://turso.tech) 註冊並登入（可用 GitHub / Google 帳號）。
2. Dashboard → **Create Database**，地區建議選 `Tokyo (nrt)` 或 `Singapore (sin)`。
3. 進入該資料庫 → **Connect**，取得兩個值填入 `.env`：
   - `TURSO_DATABASE_URL`：形如 `libsql://<db>-<account>.aws-ap-northeast-1.turso.io`
   - `TURSO_AUTH_TOKEN`：按 **Create Token** 產生

> Turso 屬 SQLite（libSQL）家族，`schema.prisma` 的 `provider` 為 `"sqlite"`。
> 該檔 `datasource.url` 只是佔位符（SQLite connector 規定必須 `file:` 開頭），
> 實際連線由 `src/lib/db.ts`、`prisma/seed.ts`、`prisma.config.ts` 內的
> `PrismaLibSQL` adapter 建立。

### 3. 建立環境變數

```bash
cp .env.example .env
# 至少要填 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN / SESSION_SECRET
```

### 4. 建表與種子資料

```bash
npm run setup      # 建表到 Turso + 灌種子資料
```

### 5. 啟動

```bash
npm run dev        # http://localhost:3000（本機 3000 被佔用時改用 -p 3100）
```

預設 `NEXT_PUBLIC_DEV_LOGIN=1`，可在沒有 LINE 環境的情況下按「LINE 登入」以測試帳號登入，
金流則使用 `PAYMENT_PROVIDER=mock` 的模擬付款頁，**完整流程無需任何外部帳號即可跑通**。

### 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 開發模式 |
| `npm run build` | 正式建置（含 prisma generate） |
| `npm run typecheck` | TypeScript 檢查 |
| `npm run db:push` | 同步 schema 到資料庫 |
| `npm run db:seed` | 重建示範資料 |
| `npm run db:reset` | 清空並重建 |
| `npm run db:studio` | Prisma Studio |

---

## 環境變數

完整清單見 `.env.example`。關鍵項目：

| 變數 | 必要 | 說明 |
| --- | :--: | --- |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | ✅ | Turso 資料庫網址與存取金鑰 |
| `SESSION_SECRET` | ✅ | 顧客 session JWT 簽章金鑰（≥32 字元亂數） |
| `NEXT_PUBLIC_APP_URL` | ✅ | 對外網址，金流回呼與 LINE 連結會用到 |
| `NEXT_PUBLIC_LIFF_ID` | LINE | LIFF App ID |
| `LINE_LOGIN_CHANNEL_ID` | LINE | 驗證 id_token 用 |
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | LINE | 推播預約通知 |
| `PAYMENT_PROVIDER` | ✅ | `mock` / `tappay` / `newebpay` / `linepay` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` | 後台 | 管理員帳號與密碼雜湊（見「後台管理」） |
| `CRON_SECRET` | 建議 | 保護 `/api/cron/*` |

> ⚠️ 正式環境務必移除 `DEV_LOGIN` 與 `NEXT_PUBLIC_DEV_LOGIN`，否則任何人都能以測試帳號登入。

---

## 資料模型

```
Venue ──< Court ──< Reservation ─── Booking ──< BookingItem
  │                                    │  └──< Payment
  └──< PriceRule                       └──── Voucher
User ──< Booking / Voucher
```

- **Reservation** 是「場地是否被佔用」的**唯一真實來源**，狀態為 `HELD`（購物車暫扣）／`BOOKED`（已成立）／`BLOCKED`（維護鎖定）。
- **BookingItem** 是下單當下的**快照**（場地名稱、時間、價格、費率），即使日後場地改名或調價也不會變動。
- 取消訂單時會刪除 `Reservation` 以釋放時段，歷史仍保留在 `BookingItem`。

---

## 核心機制

### 防止超賣

`Reservation` 上有 `@@unique([courtId, startsAt])`。兩位使用者同時點同一格時，
**只有一筆 INSERT 會成功**，另一位會收到 `SLOT_TAKEN` 並立即看到該格變為「他人暫扣」。
併發控制交給資料庫唯一索引，而非應用層鎖定。

### 購物車暫扣（他人暫扣）

- 點選時段即建立 `HELD` 列，附帶 `holdExpiresAt`（預設 10 分鐘）與 `cartToken`（HttpOnly Cookie）。
- 同一個 `cartToken` 看到的是「已選取」，其他人看到「他人暫扣」。
- 逾時的暫扣在每次讀取可用性前會被清除，另有 Cron 定期清理。

### 付款狀態流轉

```
建立訂單 (PENDING, 15 分鐘付款期限)
   ├── 金流回呼成功 → PAID → Reservation 轉為 BOOKED → LINE 通知
   ├── 金流回呼失敗 → 仍為 PENDING，可於「我的預約」重試付款
   └── 逾時未付款   → EXPIRED → 釋放時段、退回點數、歸還折價券
```

`markBookingPaid()` **具冪等性**，金流商重送通知不會產生重複扣款或重複通知。
訂單成立的權威來源是 **NotifyURL（server-to-server）**，使用者中途關閉頁面也不影響訂單成立。

### 金額計算

所有金額一律在**伺服器端**依 `PriceRule` 重新計算，不信任前端傳入的價格。
折價券以 `Voucher.bookingId` 的唯一鍵鎖定，避免同一張被重複使用。

### 時區

台灣為 UTC+8 且無日光節約時間，因此以固定位移換算（`src/lib/time.ts`），
不依賴伺服器所在時區，也不需引入時區資料庫。資料庫一律存 UTC。

### 取消與退款

| 取消時間 | 退款比例 |
| --- | --- |
| 開打前 72 小時以上 | 100% |
| 開打前 48–72 小時 | 80% |
| 開打前 24–48 小時 | 50% |
| 開打前 24 小時內 | 不予退款 |

退款以**點數**回補（1 點 = NT$1），同時嘗試向金流商申請退款；
金流退款失敗僅記錄，不影響已回補的點數。

---

## 金流串接

所有金流實作同一個 `PaymentProvider` 介面（`src/lib/payments/types.ts`），
切換只需修改 `PAYMENT_PROVIDER` 環境變數。

| Provider | 收單方式 | 狀態 |
| --- | --- | --- |
| `mock` | 站內模擬付款頁 | ✅ 完整可用（開發預設） |
| `tappay` | 前端 TapPay Fields → prime → 後端請款 | ✅ 已實作，需填入金鑰 |
| `newebpay` | 導向藍新代管付款頁（AES 加密 TradeInfo） | ✅ 已實作，需填入金鑰 |
| `linepay` | LINE Pay v3 Request → Confirm | ✅ 已實作，需填入金鑰 |

### 安全性

本系統**絕不接收、傳遞或儲存**完整卡號、有效期限或 CVV：

- **TapPay**：卡號欄位由 TapPay 以獨立 iframe 代管，前端只取得一次性 `prime`。
- **藍新／LINE Pay**：使用者在金流商的代管頁面輸入卡號。
- 資料庫只保存交易序號、金額、狀態，以及金流商回傳的**遮罩末四碼**與卡別。
- 回呼原始資料在寫入前會經過 `scrubSensitive()` 濾除敏感欄位。
- 藍新回呼會驗證 `TradeSha` 簽章；所有回呼都會比對金額與訂單金額是否一致。

### 回呼網址

| 用途 | 路徑 |
| --- | --- |
| 金流通知（NotifyURL） | `/api/payments/{provider}/notify` |
| TapPay 請款 | `/api/payments/tappay/prime` |
| 付款結果導回 | `/checkout/result?booking={id}` |

---

## LINE MINI App 設定

### 1. LINE Developers 建立 Channel

1. 建立 **Provider**。
2. 建立 **LINE Login** channel → 取得 `Channel ID`（填入 `LINE_LOGIN_CHANNEL_ID`）。
3. 建立 **Messaging API** channel → 取得長期存取權杖（填入 `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`）。

### 2. 建立 LIFF App

在 LINE Login channel 下新增 LIFF：

| 項目 | 設定值 |
| --- | --- |
| Endpoint URL | `https://你的網域/booking` |
| Size | `Full` |
| Scope | `profile`、`openid` |
| Bot link feature | `On (Aggressive)` — 讓使用者登入時同時加入官方帳號好友，才收得到通知 |

把取得的 LIFF ID 填入 `NEXT_PUBLIC_LIFF_ID`。

### 3. 官方帳號圖文選單

建議六格選單，連結指向 LIFF 深連結：

| 按鈕 | 連結 |
| --- | --- |
| 立即訂場 | `https://liff.line.me/{LIFF_ID}/booking` |
| 我的預約 | `https://liff.line.me/{LIFF_ID}/bookings` |
| 購物車 | `https://liff.line.me/{LIFF_ID}/cart` |
| 我的帳戶 | `https://liff.line.me/{LIFF_ID}/account` |
| 場館資訊 | 一般網址或訊息 |
| 聯絡客服 | 一般訊息 |

### 4. 通知機制

- **預設**：以 Messaging API 推播 Flex Message（需使用者已加官方帳號好友）。
- **服務訊息**：`sendServiceMessage()` 已備妥，需先在 LINE Developers 註冊訊息模板並通過 MINI App 審核；
  未設定時會自動退回 Messaging API 推播，流程不受影響。

### 5. 登入流程

前端 LIFF 取得 `id_token` → 送到 Server Action → **伺服器向 LINE 驗證** → 建立本站 session。
**不信任前端直接傳來的 userId**。

---

## 後台管理

路徑 `/admin`，以帳號／密碼登入。登入後會取得一組有效期 12 小時的 HttpOnly Cookie。

整個 `/admin` 由 `src/middleware.ts` 驗證 cookie 保護，未登入一律導向登入頁。
側欄分為總覽、營運、財務、AI 與智慧場館、管理五組；標示 **mock** 的頁面資料來自 `src/lib/mock-data`，尚未接資料庫。

| 頁面 | 資料 | 功能 |
| --- | --- | --- |
| `/admin` | 資料庫 | 今日營收、訂單數、場地使用率、待付款、今日預約列表 |
| `/admin/bookings` | 資料庫 | 訂單搜尋／篩選、代客取消（全額回補點數）、標記完成 |
| `/admin/schedule` | 資料庫 | 場地時段矩陣，點擊即可鎖定／解除維護時段 |
| `/admin/sessions`、`/admin/templates` | 資料庫 | 球敘與週期性範本 |
| `/admin/ai-courts` | mock | AI 智慧球場：球場狀態、裝置控制、QR 門禁 |
| `/admin/events` | mock | 活動與教練 |
| `/admin/members`、`/admin/courts`、`/admin/pricing` | mock | 會員、球場、定價 |
| `/admin/finance`、`/admin/finance/payments` | mock | 營收與財務儀表板、付款狀態 |
| `/admin/invoices`、`/admin/receipts`、`/admin/expenses` | mock | 發票、收據（含 OCR 模擬）、費用 |
| `/admin/reports` | mock | 五種報表即時彙整與 CSV 匯出 |
| `/admin/ai-assistant` | mock | AI 管理助理，高風險操作只做預覽 |
| `/admin/settings` | mock | 場館、規則、金流、API 連線狀態、稽核紀錄 |

舊的 `/owner/*` 網址會永久轉址到對應的 `/admin/*`。驗收與 Phase 2 規格見 `docs/PHASE_1_ACCEPTANCE.md`、`docs/PHASE_2_API_SPEC.md`。

帳號設定於 `.env`：

| 變數 | 說明 |
| --- | --- |
| `ADMIN_USERNAME` | 管理員帳號 |
| `ADMIN_PASSWORD_HASH` | 密碼的 scrypt 雜湊，格式 `scrypt$salt$hash` |

修改密碼：

```bash
npm run admin:password -- 新密碼
```

此指令會重新計算雜湊並寫回 `.env`，**明文密碼不會存在於任何檔案中**。改完需重啟伺服器。

> 未設定 `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` 時會**拒絕所有**後台存取，避免誤開放。
> 後台 session 以 `SESSION_SECRET` 簽章，該值變更後所有管理員都需重新登入。

---

## 部署到 Vercel

1. 匯入 Git repository。
2. 在 Vercel 設定所有環境變數（`.env.example` 清單），`NEXT_PUBLIC_APP_URL` 填正式網域。
3. Build Command 使用預設 `npm run build`（已包含 `prisma generate`）。
4. 首次部署前，在本機對正式庫建表（暫時指定正式庫連線，`.env` 的開發庫設定不受影響）：

```powershell
$env:TURSO_DATABASE_URL='libsql://正式庫'; $env:TURSO_AUTH_TOKEN='正式庫token'; npm run db:turso:init
```

   之後 schema 有變動時，不要重跑建表；把差異 SQL 放進 `prisma/migrations-manual/`，
   再以 `node scripts/apply-sql.mjs <檔案>` 同樣指定正式庫連線套用。

5. `vercel.json` 已設定 Cron，每 5 分鐘呼叫 `/api/cron/expire-bookings`
   （釋放逾時暫扣、標記逾時訂單、標記已完成訂單）。請一併設定 `CRON_SECRET`。
6. 到 LINE Developers 把 LIFF Endpoint URL 改成正式網域。
7. 到金流商後台設定 NotifyURL 為 `https://你的網域/api/payments/{provider}/notify`。

健康檢查：`GET /api/health`

---

## 目錄結構

```
prisma/
  schema.prisma            資料模型（SQLite / libSQL）
  seed.ts                  示範場館／場地／費率／折價券
src/
  app/
    booking/               ① 日期 + 場地×時段矩陣
    cart/                  ② 購物車
    checkout/              ③ 結帳（含 [id] 重新付款、simulator 模擬金流、result 結果輪詢）
    bookings/              ④ 我的預約 + 預約詳情
    account/               會員中心
    admin/                 後台（總覽／訂單／時段）
    api/
      payments/            金流回呼與 TapPay 請款
      bookings/[id]/status 付款狀態輪詢（含 LINE Pay confirm）
      cron/                定期維護作業
      health/              健康檢查
  components/
    booking/               date-strip / slot-matrix / cart-bar
    checkout/              tappay-card-form
    ui/                    shadcn 風格元件
    liff-provider.tsx      LIFF 初始化與登入
    app-shell.tsx          共用外框與導覽
  lib/
    time.ts                台北時區工具（固定 UTC+8）
    availability.ts        可用性矩陣與購物車查詢
    pricing.ts             費率與退款規則
    payments/              金流抽象層與各家實作
    line.ts                LINE 驗證、推播、Flex Message
    session.ts             顧客 session 與 cartToken
    admin-auth.ts          後台權限
  server/
    booking-service.ts     預約核心邏輯（暫扣／建單／付款／取消／逾時）
    actions.ts             顧客端 Server Actions
    admin-actions.ts       後台 Server Actions
```

---

## 已驗證項目

以下流程已以瀏覽器實際操作驗證通過（原先在 PostgreSQL，2026-09-22 起改為 Turso）：

- ✅ 日期切換、場地×時段矩陣渲染（尖峰／離峰價格、已預約／維護中）
- ✅ 點選時段建立暫扣、倒數計時、重新整理後仍保留
- ✅ 購物車增刪、小計計算
- ✅ 結帳：折價券（`WELCOME100` 折 100）＋ 點數折抵 200 → 應付 NT$700
- ✅ 模擬金流付款 → 回呼 → 訂單成立 → 預約詳情頁
- ✅ 訂單成立後購物車自動清空、該時段在矩陣上變為「已預約」
- ✅ 我的預約列表與詳情（顯示遮罩卡號末四碼）
- ✅ 取消預約：依政策計算退款比例、釋放時段
- ✅ 後台：今日營收／使用率統計、鎖定維護時段並即時反映到前台
- ✅ 手機（430px）與桌機（1280px）版型
- ✅ `npm run build` 與 `npm run typecheck` 皆通過，無 console 錯誤

---

## 疑難排解

### 專案放在 Dropbox / OneDrive 資料夾

同步軟體會鎖住 `.next` 內的建置檔，導致開發伺服器出現
`UNKNOWN: unknown error, open ...\.next\serverpp\...` 而頁面 500。

本專案的 `.next` 與 `node_modules` 已加上 Dropbox 的忽略標記。
若日後重建資料夾需重新設定，於 PowerShell 執行：

```powershell
Set-Content -Path ".next" -Stream com.dropbox.ignored -Value 1
Set-Content -Path "node_modules" -Stream com.dropbox.ignored -Value 1
```

（OneDrive 則可對資料夾按右鍵選「一律保留在此裝置上」以外的設定，或將專案移出同步資料夾。）

**不要刪除 `.next` 資料夾本身。** 資料夾一旦刪除重建，Dropbox 的雲端檔案引擎可能搶先接管它（變成 reparse point），dev server 會以 `EINVAL readlink` 起不來，忽略標記也會消失。要清快取請用 `npm run dev:clean`，它只清空內容、保留資料夾與標記。若已經發生，於 PowerShell 執行：

```powershell
cmd /c "rmdir /s /q .next"; New-Item -ItemType Directory .next | Out-Null; Set-Content -Path .next -Stream com.dropbox.ignored -Value 1
```

（把 `.next` 做成指向 Dropbox 外的 junction 行不通：編譯輸出會找不到 `node_modules`。）

### 種子資料連不上資料庫

Prisma CLI 只會讀取 `.env`（不會讀 `.env.local`），請確認 `.env` 內的
`DATABASE_URL` 正確。

---

### 尚未接上真實服務的部分

這些需要申請對應帳號後填入環境變數即可啟用，程式碼已完成：

- LINE 登入與 Flex Message 推播（需 LINE Channel）
- TapPay／藍新／LINE Pay 實際請款（需金流商帳號）
- MINI App 服務訊息（需通過 LINE 審核並註冊模板）
