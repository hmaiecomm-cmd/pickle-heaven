# 部署檢查清單 — Phase 3-C 生產部署

部署日期：2026-11-13
目標環境：Vercel + Turso

## 1️⃣ 代碼與構建驗證

- [x] 通過 TypeScript 類型檢查（`npx tsc --noEmit`）
- [x] Prisma schema 驗證
- [x] 時間衝突檢測邏輯正確
- [x] 排程預覽 API 實現完整
- [x] Cron 任務配置在 vercel.json

```bash
# 本地驗證
npm run build
npm run dev
```

## 2️⃣ Vercel 環境變數配置

需要在 Vercel 專案設定頁面配置以下環境變數：

### 資料庫（生產 Turso）
```
TURSO_DATABASE_URL=libsql://pickle-heaven-prod-XXXXX.turso.io
TURSO_AUTH_TOKEN=<生產 token>
```

### 應用程式
```
NEXT_PUBLIC_APP_URL=https://pickle-heaven.vercel.app
SESSION_SECRET=<生成 32+ 字元的隨機字串>
ADMIN_JWT_SECRET=<生成隨機 JWT secret>
```

### LINE 整合
```
NEXT_PUBLIC_LIFF_ID=2012194682-UIj3OtpN
NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID=2012194682
LINE_LOGIN_CHANNEL_SECRET=fbf4d8fc629216cedbe3f190e774d6ec
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=MDShtM/TplZbKmTT2nyp7H0X7AXK7sWceJC1/pbkT2prA68p+kWWxt+0Il0sGCQSm4J5EyJgJYUyV4Kgn7/79CjY3SZGJ6kSIaJmfMl6CqQz/rF8NjXmTvmwR2BpZQb/syNYS/ArxRHwkt4JlSFNwwdB04t89/1O/w1cDnyilFU=
```

### 金流（保持 mock，除非已整合真實支付）
```
PAYMENT_PROVIDER=mock
NEXT_PUBLIC_PAYMENT_PROVIDER=mock
```

### Cron 安全
```
CRON_SECRET=<生成強隨機字串>
```

## 3️⃣ Turso 資料庫準備

### 生產資料庫建立
```bash
# 在 Turso 儀表板建立新資料庫：pickle-heaven-prod

# 本地應用遷移到生產環境
DATABASE_URL="libsql://pickle-heaven-prod-XXXXX.turso.io" \
TURSO_AUTH_TOKEN="<token>" \
npx prisma migrate deploy
```

## 4️⃣ 排程執行服務驗證

### Cron 任務配置
- [x] `check-schedules`：每分鐘（驗證排程狀態、生成控制命令）
- [x] `expire-bookings`：每天 17:00（清除過期預約）
- [x] `sessions`：每天 17:05（清理過期會話）
- [x] `reminders`：每 15 分鐘（發送預約提醒）

## 5️⃣ API 端點驗證

### 排程管理 API
- POST `/api/admin/circuits/schedule` — 儲存排程設定
- GET `/api/admin/circuits/schedule` — 獲取排程配置
- GET `/api/admin/circuits/schedule/audit` — 審計日誌
- POST `/api/admin/circuits/schedule/preview` — 預覽 7 天排程

## 6️⃣ 部署步驟

### 方法：GitHub 連接 + Vercel 自動部署
```bash
# 1. 推送到 GitHub main 分支
git push origin main

# 2. Vercel 自動部署並執行遷移
# 3. 監控 Vercel 儀表板
```

## 7️⃣ 上線後驗證

### 運行狀態檢查
1. 後台管理登入
2. 建立/修改迴路排程
3. 驗證時間衝突檢測
4. 查看排程預覽
5. 檢查審計日誌

---

## 總結

✅ Phase 3-B 完成：
- 時間衝突檢測
- 排程預覽功能
- 審計日誌
- 權限控制

✅ Phase 3-C 準備就緒
