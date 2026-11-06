# LINE 通知功能測試指南

## 📋 系統概覽

本系統包含以下 LINE 推播通知功能：

1. **預約成功通知** — 付款完成立即發送
2. **開打提醒** — 前一天 20:00 + 開打前 2 小時
3. **預約取消通知** — 取消時立即發送

---

## 🔧 環境要求

### 必須設置
```env
# LINE Messaging API Token（在 LINE Developers 後台取得）
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=Channel_Access_Token_from_LINE_Developers

# Cron 執行授權碼（用於自動提醒排程）
CRON_SECRET=your-secret-key-min-16-chars
```

### 可選設置（測試模式）
```env
# 開發環境若未設 TOKEN，系統會自動:
# 1. 檢查展示環境——展示資料庫會模擬推播（不真的發送）
# 2. 記錄警告日誌——可查看如何呼叫
```

---

## 🧪 測試方式

### 方式 1️⃣：手動測試路由

#### 1. 測試預約成功通知

**URL:**
```
http://localhost:3000/api/test/send-booking-confirmed?code=PH-20261107-UJQB
```

**查詢參數:**
- `code` — 訂單編號（預設：PH-20261107-UJQB）

**預期回應:**
```json
{
  "ok": true,
  "results": {
    "bookingCode": "PH-20261107-UJQB",
    "lineUserId": "U1234567890...",
    "status": "PAID",
    "total": 2000,
    "items": [
      {
        "type": "場地預約通知（Flex Message）",
        "ok": true,
        "message": "✅ 已發送"
      },
      {
        "type": "活動報名通知（文字訊息）",
        "ok": true,
        "message": "✅ 已發送"
      }
    ]
  },
  "message": "✅ 所有通知已發送到 LINE"
}
```

**疑難排解:**
- ❌ `使用者沒有 LINE User ID` — 該訂單使用者未登入 LINE 或尚未授權
- ❌ `發送失敗` — 檢查環境變數 `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` 是否正確
- ❌ `未加好友` — 訂單所有者必須先將官方帳號加入 LINE 好友

#### 2. 測試開打提醒

**URL:**
```
http://localhost:3000/api/test/send-reminder?code=PH-20261107-UJQB&kind=DAY_BEFORE
```

**查詢參數:**
- `code` — 訂單編號
- `kind` — 提醒類型：`DAY_BEFORE` 或 `TWO_HOURS`（預設：DAY_BEFORE）

**預期回應:**
```json
{
  "ok": true,
  "message": "✅ 提醒已發送到 LINE",
  "bookingCode": "PH-20261107-UJQB",
  "lineUserId": "U1234567890...",
  "reminderText": "【匹克天堂】明天開打提醒\n\n2026年11月7日...",
}
```

---

### 方式 2️⃣：手動指令碼測試

**執行預約成功通知:**
```bash
npm run ts-node scripts/send-booking-notification.ts
```

**執行開打提醒:**
```bash
npm run ts-node scripts/send-reminder-now.ts
```

**檢查通知紀錄:**
```bash
npm run ts-node scripts/check-notifications.ts
```

---

### 方式 3️⃣：實況測試（付款流程）

#### 前置準備
1. 登入系統（用 LINE 或開發者帳號）
2. 建立一筆預約（選擇場地 + 日期 + 時段）
3. 進入結帳頁面

#### 測試步驟

**步驟 1: 成功付款**
```
1. 選擇付款方式
2. 完成付款流程（測試金流或真實金流）
3. 等待重導至預約完成頁面
```

**預期結果:**
- ✅ 頁面顯示「預約成功」
- ✅ LINE 收到訂單成立訊息（內含 Flex Message 或文字）
  - 場地預約：美化的 Flex Message（藍紫色卡片）
  - 活動報名：文字訊息（簡潔格式）

**步驟 2: 驗證 NotificationLog**
```bash
npm run db:studio
# → 開啟 Prisma Studio
# → 查看 NotificationLog 表
# → 尋找本訂單的通知記錄
```

**預期記錄:**
```
type: CONFIRMATION
status: SENT
dedupeKey: BOOKING_NOTIFICATION:CONFIRMATION:{bookingId}:{playDate}
sentAt: [時間戳]
```

---

## 🔄 定時提醒工作流程

### 自動排程（生產環境）

**Vercel Cron 配置：** (`vercel.json`)
```json
{
  "path": "/api/cron/reminders",
  "schedule": "*/15 * * * *"  // 每 15 分鐘執行
}
```

**執行邏輯:**
1. 每 15 分鐘查詢符合條件的訂單
2. 計算是否應該發送「前一天提醒」或「前兩小時提醒」
3. 檢查 NotificationLog 避免重複發送
4. 發送推播訊息
5. 記錄發送結果（SENT / FAILED）

### 本機測試排程

**模擬 Cron 執行:**
```bash
# 方式 1: 直接呼叫 API（需有 CRON_SECRET）
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/reminders

# 方式 2: 執行指令碼
npm run ts-node scripts/send-reminder-now.ts
```

---

## 📊 通知去重機制

所有通知都使用 **NotificationLog 表的 dedupeKey** 去重：

### 預約成功通知
```
BOOKING_NOTIFICATION:CONFIRMATION:{bookingId}:{playDate}
```

### 前一天提醒
```
BOOKING_REMINDER:DAY_BEFORE:{bookingId}:{playDate}
```

### 前兩小時提醒
```
BOOKING_REMINDER:TWO_HOURS:{bookingId}:{startTime}
```

**去重規則:**
- 相同 dedupeKey 只會成功發送一次
- 重複呼叫會被略過（不會產生新記錄）
- 失敗的發送仍會記錄（status: FAILED），不會重試

---

## ✅ 完整測試清單

### 環境設置
- [ ] `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` 已設置
- [ ] `CRON_SECRET` 已設置（≥ 16 字符）
- [ ] `.env.local` 已正確配置
- [ ] 資料庫連接正常

### 預約成功通知
- [ ] 測試路由可以成功呼叫（HTTP 200）
- [ ] Flex Message 在 LINE 正確顯示
- [ ] 包含訂單編號、場館、時段、金額等資訊
- [ ] 「查看預約詳情」按鈕可點擊
- [ ] 活動報名顯示文字訊息
- [ ] NotificationLog 有記錄（status: SENT）

### 開打提醒
- [ ] 測試路由可以成功呼叫
- [ ] 提醒訊息包含正確的日期、時段、報到編號
- [ ] 前一天提醒和前兩小時提醒內容不同
- [ ] 連續時段合併為一筆提醒
- [ ] 提醒時間後才付款的訂單不收到提醒
- [ ] NotificationLog 記錄正確的 dedupeKey

### 預約取消通知
- [ ] 取消訂單後，LINE 收到取消訊息
- [ ] 如有退款點數，訊息包含點數資訊
- [ ] NotificationLog 有正確記錄

### 邊界情況
- [ ] 使用者未加官方帳號好友 — 訊息發送失敗（不中斷流程）
- [ ] 使用者未授權 LINE — NotificationLog 記錄失敗
- [ ] LINE API 故障 — 系統記錄錯誤，後續重試不補發
- [ ] 展示環境 — 推播被模擬，不真正發送

---

## 🐛 常見問題

### ❌ 「發送失敗」或收不到訊息

**檢查清單:**

1. **使用者未加好友**
   ```bash
   # 確認使用者是否加入官方帳號好友
   # LINE → 搜尋帳號 → 加好友
   ```

2. **環境變數缺失**
   ```bash
   echo $LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
   # 應該顯示長串 Token，不是空白
   ```

3. **Token 過期或無效**
   - 檢查 LINE Developers 後台的 Channel Access Token
   - 確認 Token 未被重新生成
   - 確認 Channel 為「Messaging API」類型

4. **展示環境（Demo）**
   ```bash
   # 若使用展示資料庫，推播會被模擬
   # 查看伺服器日誌：[line] 展示環境：推播僅模擬
   ```

5. **訂單狀態不正確**
   ```bash
   # 訂單必須是 PAID 狀態才會收到開打提醒
   # 檢查 Booking 表的 status 欄位
   ```

### ❌ 「找不到預約」

- 確認訂單編號拼寫正確
- 確認該訂單存在於資料庫
- 檢查查詢參數格式

### ❌ NotificationLog 中狀態為 FAILED

**可能原因:**
- 使用者未加好友（LINE 回傳 404）
- LINE Messaging API 配額已用完
- 訊息內容超過限制
- LINE 伺服器暫時故障

**解決方案:**
- 確認使用者加入好友
- 檢查 LINE Developers 儀表板的配額使用
- 檢查訊息文字長度
- 稍後重試

---

## 📝 實作細節

### 代碼位置

| 功能 | 檔案路徑 |
|------|--------|
| LINE 推播基礎函數 | `src/lib/line.ts` |
| 預約成功通知 | `src/server/booking-service.ts` (sendConfirmationNotification) |
| 開打提醒邏輯 | `src/server/booking-reminders.ts` |
| Cron 端點 | `src/app/api/cron/reminders/route.ts` |
| 測試路由 | `src/app/api/test/send-*` |

### 資料庫表

| 表名 | 用途 |
|------|------|
| Booking | 訂單主表 |
| NotificationLog | 推播記錄（去重） |
| Payment | 付款記錄 |

---

## 🚀 下一步

### 測試完畢後
1. ✅ 驗證所有通知正常發送
2. ✅ 檢查 NotificationLog 記錄完整
3. ✅ 確認邊界情況處理正確
4. ✅ 產品上線

### 上線後監控
- 定期檢查 NotificationLog 中的 FAILED 記錄
- 監控使用者反饋
- 備妥緊急聯絡管道

---

## 📞 快速參考

### 常用 URL
```
開發環境:
  預約成功: http://localhost:3000/api/test/send-booking-confirmed?code=PH-...
  開打提醒: http://localhost:3000/api/test/send-reminder?code=PH-...&kind=DAY_BEFORE

Vercel 生產環境:
  預約成功: https://pickle-heaven.vercel.app/api/test/send-booking-confirmed?code=PH-...
  開打提醒: https://pickle-heaven.vercel.app/api/test/send-reminder?code=PH-...&kind=DAY_BEFORE
```

### 快速命令
```bash
# 啟動開發伺服器
npm run dev

# 測試預約成功通知
curl "http://localhost:3000/api/test/send-booking-confirmed?code=PH-20261107-UJQB"

# 測試開打提醒
curl "http://localhost:3000/api/test/send-reminder?code=PH-20261107-UJQB"

# 檢查通知紀錄
npm run db:studio
# → NotificationLog 表 → 篩選 userId
```

---

祝測試順利！🎾📱
