# 匹克精靈後台改版 V4 - 生產運維指南

**發布日期：** 2026-11-12  
**版本：** v1.0.0  
**狀態：** 🟢 生產環境上線

---

## 🎯 **快速參考**

### 上線命令速查表

```bash
# 部署
npm install --production
npx prisma migrate deploy
npm run start

# 監控狀態
curl http://localhost:3000/admin/login
curl http://localhost:3000/api/health

# 查看日誌
pm2 logs pickle-heaven
tail -f /var/log/pickle-heaven.log
```

---

## 📋 **系統架構概覽**

```
🌐 Next.js 15
    ├─ 前端頁面 (React Server Components)
    ├─ API 路由 (Node.js)
    └─ WebSocket (實時通知)

🔐 認證層
    ├─ LINE OAuth 2.0
    ├─ JWT Session
    └─ HttpOnly Cookies

💾 數據層
    ├─ Prisma ORM
    ├─ SQLite/Turso
    └─ Redis (可選)

📨 服務層
    ├─ Resend (郵件)
    ├─ MQTT (IoT 設備)
    └─ LINE Messaging (通知)
```

---

## 🚀 **上線步驟**

### 第 1 階段：環境準備

```bash
# 1.1 複製配置模板
cp .env.example .env.production

# 1.2 編輯生產環境變數
cat .env.production
# 設置以下關鍵變數：
# ADMIN_JWT_SECRET=<32-char-random-string>
# RESEND_API_KEY=<from-resend.com>
# LINE_CHANNEL_ID=<from-line-console>
# LINE_CHANNEL_SECRET=<from-line-console>
# NEXT_PUBLIC_APP_URL=https://your-domain.com

# 1.3 驗證配置
source .env.production
echo "JWT Secret: $ADMIN_JWT_SECRET"
echo "App URL: $NEXT_PUBLIC_APP_URL"
```

### 第 2 階段：數據庫部署

```bash
# 2.1 連接到數據庫
# (Turso CLI 或 PostgreSQL 驗證)

# 2.2 應用 migrations
npx prisma migrate deploy

# 2.3 驗證表結構
npx prisma db execute --stdin << SQL
SELECT count(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public';
SQL

# 2.4 驗證管理員表
npx prisma db execute --stdin << SQL
SELECT count(*) as admin_count FROM "AdminUser";
SQL
```

### 第 3 階段：應用部署

```bash
# 3.1 安裝生產依賴
npm install --production

# 3.2 構建應用
npm run build

# 3.3 測試启動
npm run start &
sleep 5

# 3.4 驗證健康狀態
curl -s http://localhost:3000/admin/login | head -20

# 3.5 用 PM2 管理
pm2 start npm --name "pickle-heaven" -- start
pm2 save
pm2 startup
```

### 第 4 階段：上線驗證

```bash
# 4.1 檢查應用日誌
pm2 logs pickle-heaven --lines 50

# 4.2 驗證 API 端點
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"test"}'

# 4.3 驗證數據庫連接
curl http://localhost:3000/api/health

# 4.4 檢查 session cookie
curl -i http://localhost:3000/admin | grep -i cookie
```

---

## 🔍 **監控與告警**

### 關鍵指標

| 指標 | 告警閾值 | 檢查命令 |
|------|---------|--------|
| **CPU** | > 80% | `top`, Datadog |
| **內存** | > 85% | `free -h`, Datadog |
| **磁盤** | > 90% | `df -h` |
| **API 延遲** | > 500ms | Sentry APM |
| **錯誤率** | > 1% | Sentry Errors |
| **DB 連接** | > 90% pool | Prisma metrics |

### 實時監控命令

```bash
# PM2 監控面板
pm2 monit

# Sentry 儀表板
open https://sentry.io/organizations/your-org/issues/

# 數據庫查詢日誌
npx prisma studio

# 應用日誌
pm2 logs pickle-heaven --tail 100
```

---

## 🛡️ **安全檢查清單**

### 部署前

- [ ] SSL 證書已安裝
- [ ] 防火牆規則已配置
- [ ] 數據庫備份已測試
- [ ] API 速率限制已啟用
- [ ] CORS 策略已檢查
- [ ] 敏感環境變數已隱藏

### 上線後

- [ ] HTTPS 重定向已驗證
- [ ] Cookie Secure 標誌已驗證
- [ ] CSRF token 已驗證
- [ ] 登入失敗鎖定已測試
- [ ] Audit Log 已記錄
- [ ] 密碼雜湊已驗證

---

## 📊 **日誌與調試**

### 日誌位置

```
應用日誌：    pm2 logs pickle-heaven
HTTP 日誌：   /var/log/nginx/access.log
錯誤日誌：    /var/log/nginx/error.log
系統日誌：    /var/log/syslog
數據庫日誌：  ~/turso.log 或 /var/log/postgresql/
```

### 常見問題調試

**問題：無法登入**
```bash
# 檢查 JWT Secret
echo $ADMIN_JWT_SECRET | wc -c  # 應該是 65（64 chars + newline）

# 檢查數據庫連接
npx prisma db execute --stdin << SQL
SELECT count(*) FROM "AdminUser";
SQL

# 查看詳細錯誤
pm2 logs pickle-heaven --err
```

**問題：郵件未發送**
```bash
# 檢查 Resend API Key
curl -X GET https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY"

# 查看郵件發送日誌
grep -i "email\|resend" /var/log/pickle-heaven.log
```

**問題：高 CPU/內存使用**
```bash
# 查看 Node.js 進程詳情
ps aux | grep node

# 檢查內存洩漏
pm2 logs pickle-heaven | grep -i "memory"

# 重啟應用
pm2 restart pickle-heaven
```

---

## 🔄 **更新流程**

### 小版本更新（安全補丁、bug 修復）

```bash
# 1. 拉取最新代碼
git pull origin main

# 2. 安裝依賴變更
npm ci

# 3. 應用 migrations（如有）
npx prisma migrate deploy

# 4. 重建應用
npm run build

# 5. 重啟服務
pm2 restart pickle-heaven

# 6. 驗證
curl http://localhost:3000/admin
```

### 大版本更新（新功能）

```bash
# 1. 創建維護窗口
# 通知用戶維護時間

# 2. 備份數據庫
pg_dump pickle_heaven > backup-2026-11-12.sql

# 3. 停止應用
pm2 stop pickle-heaven

# 4. 應用所有更新
git pull origin main
npm ci
npx prisma migrate deploy
npm run build

# 5. 驗證
npm run build:test

# 6. 重啟應用
pm2 start pickle-heaven

# 7. 監控 30 分鐘
pm2 logs pickle-heaven
```

---

## 📞 **故障恢復**

### 數據庫故障

```bash
# 恢復最新備份
pg_restore < backup-latest.sql

# 驗證數據完整性
npx prisma db execute --stdin << SQL
SELECT 
  (SELECT count(*) FROM "AdminUser") as admin_count,
  (SELECT count(*) FROM "AdminInvitation") as invitation_count,
  (SELECT count(*) FROM "AuditLog") as audit_count;
SQL

# 重新開始應用
pm2 restart pickle-heaven
```

### 應用崩潰

```bash
# 查看錯誤
pm2 logs pickle-heaven --err

# 回滾到上一個版本
git revert HEAD --no-edit
npm run build
pm2 restart pickle-heaven

# 或完全重啟
pm2 kill
npm run start &
```

### 高流量應急

```bash
# 啟用客戶端緩存
# (需要修改 headers)

# 啟用 API 速率限制
# (已在代碼中配置)

# 增加應用實例
pm2 start npm --name "pickle-heaven-2" -- start

# 配置負載均衡
# (使用 Nginx upstream)
```

---

## 📈 **性能優化**

### 已啟用的優化

- ✅ React Server Components (減少 JS)
- ✅ 圖片優化 (Next.js Image)
- ✅ API 路由快取
- ✅ 數據庫查詢優化（索引）
- ✅ Session 簽署（無需查詢）

### 可選優化

```bash
# Redis Session 存儲
npm install redis
# (修改 src/lib/admin-session.ts)

# CDN 加速
# 配置 Cloudflare/AWS CloudFront

# 數據庫連接池
# 設置 pgBouncer 或使用 Prisma 連接池

# 壓縮響應
# 啟用 gzip/brotli (Nginx)
```

---

## 🎯 **監控項清單**

### 每日檢查

- [ ] 應用是否運行中 (`pm2 status`)
- [ ] 是否有錯誤日誌 (`pm2 logs`)
- [ ] CPU/內存是否正常 (`pm2 monit`)
- [ ] 數據庫是否連接正常
- [ ] 郵件是否正常發送

### 每週檢查

- [ ] SSL 證書有效期
- [ ] 磁盤空間
- [ ] 備份文件是否完整
- [ ] 用戶登入趨勢
- [ ] API 性能基準

### 每月檢查

- [ ] 安全更新
- [ ] 依賴更新
- [ ] 數據庫優化
- [ ] 審計日誌歸檔
- [ ] 災難恢復測試

---

## 📞 **應急聯絡**

| 角色 | 聯絡方式 | 回應時間 |
|------|---------|--------|
| 技術主管 | on-call | 15 分鐘 |
| 資料庫管理 | Slack | 30 分鐘 |
| 基礎設施 | Pagerduty | 30 分鐘 |

---

## 📚 **相關資源**

- **源代碼**：https://github.com/your-org/pickle-heaven
- **Sentry 監控**：https://sentry.io
- **Datadog APM**：https://app.datadoghq.com
- **Prisma Studio**：`npx prisma studio`

---

**版本**：v1.0.0 | **最後更新**：2026-11-12 | **狀態**：✅ 生產環境

