================================================================================
                   匹克精靈 Pickle Heaven - 系統架構文檔
                   Pickleball Court Booking Platform - Taiwan
================================================================================

項目名稱：匹克精靈（Pickle Heaven）
描述：台灣匹克球場館的線上預約平台，主要以 LINE MINI App（LIFF）形式在 LINE 內使用
版本：1.0.0
最後更新：2026-10-08

================================================================================
                              技術堆棧
================================================================================

前端框架：
  - Next.js 15（App Router）
  - React 19
  - TypeScript
  - Tailwind CSS
  - shadcn/ui 風格元件（Radix UI + CVA）
  - 支援：行動優先設計、深色模式

後端框架：
  - Next.js Server Actions（主要業務邏輯）
  - Next.js Route Handlers（API）
  - TypeScript

資料庫：
  - Turso（libSQL / SQLite）
  - Prisma ORM（含 libSQL driver adapter）
  - 時區：UTC+8（台灣，固定位移，無日光節約時間）

身分認證：
  - 顧客：LINE Login + LIFF id_token（伺服器端驗證）+ HttpOnly JWT session
  - 管理者：帳號／密碼（scrypt 雜湊）+ HttpOnly JWT Cookie

通知系統：
  - LINE Messaging API（Flex Message）
  - MINI App 服務訊息（需審核）

金流系統（抽象層）：
  - Mock（開發用）
  - TapPay（前端 Fields + 後端請款）
  - 藍新 NewebPay（代管付款頁）
  - LINE Pay（v3 Request → Confirm）

部署平台：
  - Vercel（主機 + Cron Job）
  - Turso Cloud（資料庫）

================================================================================
                            前台架構（Customer）
================================================================================

路由結構：
  /                          首頁
  /booking                   訂場：日期選擇 + 場地×時段矩陣
  /bookings                  我的預約列表
  /bookings/[id]             預約詳情（含取消、退款狀態）
  /cart                      購物車
  /checkout                  結帳流程
  /checkout/[id]             重新付款（訂單未付款時）
  /checkout/result           付款結果頁
  /account                   會員中心（多分頁）
  /account/topup             儲值點數流程
  /sessions                  球敘列表
  /privacy                   隱私政策
  /terms                     使用條款

主要功能模組：

1. 訂場流程（Booking Flow）
   - 日期條帶選擇（Date Strip）
   - 時段矩陣（Slot Matrix）
     * 顯示尖峰/離峰時段與價格
     * 標示已預約/他人暫扣/維護中
     * 實時更新可用性
   - 購物車暫扣機制（10 分鐘倒數）
   - 檔案：
     * src/app/booking/page.tsx
     * src/components/booking/date-strip.tsx
     * src/components/booking/slot-matrix.tsx

2. 購物車（Shopping Cart）
   - Zustand 狀態管理
   - 購物車條（Cart Bar）：小計 + 結帳按鈕
   - 增刪項目、數量調整
   - 文件：src/store/cart.tsx, src/components/booking/cart-bar.tsx

3. 結帳（Checkout）
   - 訂單預覽
   - 折價券應用（唯一鍵鎖定防重複使用）
   - 點數折抵
   - 金額計算（伺服器端重新算，不信任前端）
   - 金流表單（TapPay / 藍新 / LINE Pay / Mock）
   - 文件：src/app/checkout/page.tsx, src/components/checkout/tappay-card-form.tsx

4. 我的預約（My Bookings）
   - 預約列表與篩選
   - 預約詳情頁
     * 顯示遮罩卡號末四碼
     * 取消與退款計算
     * 退款政策：72h(100%) → 48h(80%) → 24h(50%) → 不予(0%)
   - 文件：src/app/bookings/, src/app/bookings/[id]/

5. 會員中心（Account）
   - 個人資料編輯
   - 點數帳本（防重複、不負數）
   - 儲值方案選擇與付款
   - 使用券管理
   - 黑名單狀態檢查
   - 文件：src/app/account/

核心庫文件：
  - src/lib/availability.ts          可用性矩陣與購物車查詢
  - src/lib/pricing.ts               費率與退款規則
  - src/lib/time.ts                  台北時區工具（UTC+8）
  - src/lib/session.ts               顧客 session 與 cartToken
  - src/lib/payments/types.ts        金流抽象層介面
  - src/lib/payments/*/               各金流實作
  - src/lib/line.ts                  LINE 驗證、推播、Flex Message

顧客端 Server Actions：
  - src/server/actions.ts            預約、購物車、支付等核心業務邏輯

================================================================================
                            後台架構（Admin）
================================================================================

訪問路徑：
  /admin/login                       管理員登入
  /admin                             首頁（總覽）

總覽（Overview）：
  /admin                             儀表板
     * 今日營收
     * 訂單數
     * 場地使用率
     * 待付款訂單
     * 今日預約列表

營運管理：
  /admin/bookings                    訂單管理
     * 搜尋、篩選、排序
     * 代客取消（全額回補點數）
     * 標記完成狀態

  /admin/schedule                    場地時段管理
     * 場地×時段矩陣
     * 點擊鎖定/解除維護時段
     * 實時反映到前台

  /admin/sessions                    球敘與場次管理
     * 球敘列表
     * 週期性範本管理
     * 場次預約狀態

  /admin/activities                  活動與課程管理
     * 創建/編輯活動
     * 上傳活動封面
     * 教練分配

人員管理：
  /admin/members                     會員管理
     * 全部會員/教練/工作人員/黑名單分頁
     * 會員詳情（六分頁）
     * 點數帳本查詢
     * 使用券發放/撤銷
     * 黑名單管理（全面攔截）

  /admin/members/[id]                會員詳情頁
  /admin/members/points              點數帳本
  /admin/members/restrictions        黑名單管理

財務管理：
  /admin/finance                     財務儀表板（模擬）
     * 營收統計
     * 成本分析
     * 利潤報告

  /admin/finance/payments            付款狀態追蹤
     * 訂單付款狀況
     * 重新付款觸發
     * 退款申請

  /admin/invoices                    發票管理
  /admin/receipts                    收據管理
     * OCR 辨識結果（需人工確認）
     * 收據上傳與驗證

  /admin/expenses                    費用登錄
     * 拍照上傳/手動登錄/選檔上傳
     * 費用分類（維護/物資/公用/人力/其他）
     * 申請與審核流程

  /admin/refunds                     退款管理

定價與產品：
  /admin/pricing                     定價管理（模擬）
     * 尖峰/離峰時段定價
     * 團體折扣

  /admin/bookings/products           訂場產品管理
     * 產品設定與庫存

  /admin/topup                       儲值方案管理
     * 創建/編輯方案
     * 售價、點數、贈點、效期設定

行銷與活動：
  /admin/marketing/campaigns         行銷活動
  /admin/marketing/vouchers          折價券管理
     * 創建折價券
     * 使用狀況追蹤

  /admin/marketing/products          行銷產品

AI 與智慧場館：
  /admin/ai-assistant                AI 管理助理
     * 高風險操作預覽確認
     * 數據分析建議

  /admin/ai-courts                   智慧球場管理（模擬）
     * 球場狀態監控
     * 裝置控制（燈光/空調/攝像機）
     * QR 門禁管理

事件與異常：
  /admin/events                      事件管理（模擬）
  /admin/incidents                   異常事件處理
  /admin/automation                  自動化規則管理
  /admin/control                     應急控制

維護：
  /admin/maintenance                 維護管理
     * 系統狀態檢查
     * 資料一致性檢查

場地與設備：
  /admin/courts                      球場管理（模擬）
     * 場地資訊
     * 營業時間

  /admin/settings/devices            設備管理
     * 連接狀態監控
     * 設備日誌

報表：
  /admin/reports                     報表中心（五種）
     * 活動報表
     * 會員報表
     * 利用率報表
     * 實時彙整
     * CSV 匯出

設定與稽核：
  /admin/settings                    系統設定
     * 場館資訊
     * 營業規則
     * 金流設定
     * API 連線狀態

  /admin/settings/site               場館設定
  /admin/settings/payments           金流設定
  /admin/settings/staff              員工管理
     * 首次登入改密碼
     * 授權場館
     * 角色指派
     * 停用與降權即時失效

  /admin/settings/topup              儲值設定
  /admin/audit                       稽核紀錄
     * 操作日誌
     * 異常事件

管理員認證：
  - 帳號：ADMIN_USERNAME
  - 密碼雜湊：ADMIN_PASSWORD_HASH（scrypt 格式）
  - Session：有效期 12 小時
  - 中間件保護：src/middleware.ts（驗證 /admin/* 存取）

後台 Server Actions：
  - src/server/admin-actions.ts      管理員專用業務邏輯

後台 API：
  - src/app/api/admin/*/             各功能對應 API

角色與權限：
  - ADMIN：擁有者（最高權限）
  - STAFF：工作人員（受限功能）
  - USER：一般用戶（顧客）

================================================================================
                            共享核心架構
================================================================================

資料模型（Prisma Schema）：
  - Venue（場館）
    └─ Court（場地）
       └─ Reservation（時段預約：HELD/BOOKED/BLOCKED/EVENT）

  - User（用戶）
    ├─ Booking（訂單）
    │  ├─ BookingItem（訂單項目快照）
    │  └─ Payment（付款記錄）
    ├─ Voucher（折價券）
    ├─ TopupTransaction（儲值記錄）
    └─ PointLedger（點數帳本）

  - PriceRule（定價規則：尖峰/離峰）
  - Session（球敘）
  - Activity（活動/課程）
  - Expense（費用）
  - Receipt（收據）
  - Invoice（發票）
  - Device（設備）
  - Coach（教練）

關鍵特性：

1. 防止超賣
   - Reservation 上 @@unique([courtId, startsAt])
   - 資料庫唯一索引確保只有一筆 INSERT 成功
   - 另一位用戶立即看到「他人暫扣」

2. 購物車暫扣機制
   - HELD 狀態，holdExpiresAt（預設 10 分鐘）
   - cartToken（HttpOnly Cookie）綁定
   - 逾時自動清理 + Cron 定期清理

3. 付款狀態流轉
   - PENDING → PAID → BOOKED → LINE 通知
   - markBookingPaid() 具冪等性
   - NotifyURL（server-to-server）為權威來源

4. 金額安全性
   - 所有金額伺服器端重新計算（src/lib/pricing.ts）
   - 不信任前端傳入的價格
   - 敏感資料濾除（scrubSensitive()）
   - 卡號不落地（TapPay iframe / 金流商代管）

5. 資料隔離與權限
   - 租戶隔離（當前單租戶 + Demo 專用 Turso DB）
   - API 權限檢查（財務/場地/設備分別驗證）
   - 訂單金額伺服器端遮罩
   - 費用與收據本人限定
   - 黑名單全面攔截（舊 session/付款/後台）

伺服器端核心文件：
  - src/server/booking-service.ts    預約核心（暫扣/建單/付款/取消/逾時）
  - src/server/actions.ts            顧客 Server Actions
  - src/server/admin-actions.ts      管理員 Server Actions
  - src/server/ai-assistant.ts       AI 助理邏輯
  - src/server/ai-guide.ts           AI 導遊邏輯

API 端點：

顧客端 API：
  - GET/POST  /api/bookings/          訂單查詢與建立
  - GET/POST  /api/bookings/[id]/     訂單詳情與修改
  - GET/POST  /api/bookings/[id]/status 付款狀態輪詢
  - GET/POST  /api/topup/             儲值查詢
  - GET/POST  /api/topup/[id]/        儲值詳情

金流 API：
  - POST      /api/payments/{provider}/notify    金流通知（NotifyURL）
  - POST      /api/payments/tappay/prime         TapPay 請款

定期任務：
  - GET       /api/cron/expire-bookings         清理逾時暫扣、過期訂單、完成標記
  - GET       /api/cron/sessions/                球敘後續處理

管理員 API：
  - /api/admin/members/                會員 CRUD
  - /api/admin/courts/                 球場 CRUD
  - /api/admin/pricing/                定價 CRUD
  - /api/admin/finance/                財務查詢
  - /api/admin/ai/                     AI API
  - /api/admin/payments/               付款管理
  - /api/admin/audit/                  稽核
  - 等等...

健康檢查：
  - GET       /api/health              系統狀態

================================================================================
                            開發環境設置
================================================================================

必要環境變數（.env）：
  TURSO_DATABASE_URL          Turso 資料庫 URL
  TURSO_AUTH_TOKEN            Turso 存取金鑰
  SESSION_SECRET              顧客 session JWT 簽章金鑰（≥32 字元）
  NEXT_PUBLIC_APP_URL         對外網址
  PAYMENT_PROVIDER            mock / tappay / newebpay / linepay
  ADMIN_USERNAME              管理員帳號
  ADMIN_PASSWORD_HASH         密碼雜湊（scrypt$salt$hash）
  CRON_SECRET                 Cron 保護金鑰

LINE 相關（可選）：
  NEXT_PUBLIC_LIFF_ID         LIFF App ID
  LINE_LOGIN_CHANNEL_ID       LINE 登入 Channel ID
  LINE_MESSAGING_CHANNEL_ACCESS_TOKEN    推播權杖

金流相關（可選）：
  TAPPAY_APP_ID, TAPPAY_APP_KEY, TAPPAY_MERCHANT_ID
  NEWEBPAY_MERCHANT_ID, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV
  LINEPAY_CHANNEL_ID, LINEPAY_CHANNEL_SECRET

開發模式：
  NEXT_PUBLIC_DEV_LOGIN=1            開發用 LINE 登入模擬
  PAYMENT_PROVIDER=mock              使用模擬金流

常用指令：
  npm run dev                  開發模式
  npm run build                生產建置
  npm run typecheck            型別檢查
  npm run db:seed             種子資料
  npm run db:studio           Prisma Studio
  npm run admin:password      設定管理員密碼
  npm run verify:activities   驗證活動系統
  npm run verify:permissions  驗證權限系統

================================================================================
                              部署流程
================================================================================

1. 準備 Turso 資料庫
   - turso.tech 建立資料庫
   - 取得 TURSO_DATABASE_URL 與 TURSO_AUTH_TOKEN

2. 設定 Vercel
   - 匯入 Git repository
   - 設定環境變數
   - Build Command: npm run build（包含 prisma generate）

3. 初始化資料庫
   npm run db:turso:init       建表
   npm run db:seed             種子資料

4. LINE Developers 設定
   - LIFF Endpoint URL 指向正式網域
   - 建立圖文選單（6 格）

5. 金流商設定
   - NotifyURL: https://你的網域/api/payments/{provider}/notify

6. Cron 設定
   - vercel.json 已配置，每 5 分鐘執行 expire-bookings

健康檢查：
  curl https://你的網域/api/health

================================================================================
                            文件結構總覽
================================================================================

根目錄檔案：
  package.json                       依賴與指令
  tsconfig.json                      TypeScript 設定
  tailwind.config.ts                 Tailwind 設定
  next.config.ts                     Next.js 設定
  vercel.json                        Vercel 部署設定
  .env.example                       環境變數模板
  README.md                          完整技術文檔

prisma/
  schema.prisma                      資料模型定義
  seed.ts                            示範資料
  turso-init.sql                     建表 SQL
  migrations-manual/                 手動遷移

src/
  app/
    (公開路由)
      booking/                       訂場
      bookings/                      我的預約
      cart/                          購物車
      checkout/                      結帳
      account/                       會員中心
      sessions/                      球敘
      privacy/, terms/               政策頁

    admin/                           後台管理
      login/                         登入頁
      bookings/, schedule/           訂單、時段
      members/, courts/              人員、球場
      finance/, invoices/            財務、發票
      events/, ai-courts/            活動、智慧場館
      settings/, audit/              設定、稽核

    api/
      auth/                          身分驗證
      bookings/                      訂單 API
      payments/                      金流 API
      topup/                         儲值 API
      cron/                          定期任務
      admin/                         後台 API
      health/                        健康檢查

  components/
    booking/                         訂場元件
    checkout/                        結帳元件
    admin/                           後台元件
    ui/                              UI 基礎元件
    layout/                          共用排版
    home/                            首頁區段

  lib/
    db.ts                            資料庫連線
    time.ts                          時區工具
    pricing.ts                       費率計算
    availability.ts                  可用性查詢
    session.ts                       Session 管理
    payments/                        金流實作
    line.ts                          LINE API
    admin-auth.ts                    後台認證

  server/
    booking-service.ts               預約核心
    actions.ts                       顧客 Server Actions
    admin-actions.ts                 管理員 Server Actions
    ai-assistant.ts                  AI 助理

scripts/
  generate-prisma.mjs                Prisma CLI 包裝
  apply-turso-sql.mjs                SQL 套用工具
  admin:password.mjs                 密碼設定
  verify-*.ts                        驗證工具

docs/
  PHASE_1_ACCEPTANCE.md              第一階段驗收
  PHASE_2_API_SPEC.md                第二階段 API 規格

================================================================================
                             聯絡與支援
================================================================================

問題回報：GitHub Issues
文檔：README.md, docs/ 資料夾
環境問題：見 README.md 疑難排解章節

================================================================================
最後更新：2026-10-08
版本：1.0.0
================================================================================
