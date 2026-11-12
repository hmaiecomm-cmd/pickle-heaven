# 🚀 選項 A：完成部署上線 - 完整指南

**狀態：** 開發完成，準備上線  
**預計時間：** 30 分鐘  
**難度：** 中等  
**負責人：** 運維團隊  

---

## 📋 部署前檢查清單

在開始部署前，請確認以下項目：

### 環境要求
- [ ] **服務器系統**：Linux (Ubuntu 22.04 推薦) 或 macOS
- [ ] **Node.js 版本**：18.x 或更新
- [ ] **npm 版本**：9.x 或更新
- [ ] **git 版本**：2.30+
- [ ] **PM2**：全局安裝 (`npm install -g pm2`)

### 代碼準備
- [ ] 克隆/更新最新代碼：`git clone ... && git checkout v1.0.0`
- [ ] 驗證代碼完整性：`git log | head -1`（應顯示 v1.0.0 標籤）
- [ ] 檢查 package.json：`cat package.json | grep version`

### 數據庫準備
- [ ] 已創建數據庫（SQLite、PostgreSQL 或 Turso）
- [ ] 數據庫連接字符串已獲得
- [ ] 數據庫用戶已創建並有正確權限

### 認證服務準備
- [ ] LINE Console 應用已創建
  - 記錄：LINE_CHANNEL_ID
  - 記錄：LINE_CHANNEL_SECRET
- [ ] LINE Login 回調 URL 已配置：`https://your-domain.com/api/auth/line/callback`
- [ ] Resend.com 賬號已建立
  - 記錄：RESEND_API_KEY
- [ ] SMTP 郵件服務配置（如果使用）

### 域名與 SSL
- [ ] 生產域名已註冊
- [ ] SSL 證書已獲得（Let's Encrypt 推薦）
- [ ] 反向代理已配置（Nginx/Apache）
- [ ] 防火牆規則已開放（HTTP 80, HTTPS 443）

---

## 🔧 部署步驟（分解版）

### 步驟 1：準備環境變數（5 分鐘）

```bash
# 1.1 進入項目目錄
cd /path/to/pickle-heaven

# 1.2 複製環境變數範本
cp .env.example .env.production

# 1.3 編輯環境變數
nano .env.production  # 或使用您偏好的編輯器
```

**需要設置的環境變數：**

```env
# JWT 密鑰（生成方法見下文）
ADMIN_JWT_SECRET=your-32-char-random-string

# LINE OAuth
LINE_CHANNEL_ID=your-line-channel-id
LINE_CHANNEL_SECRET=your-line-channel-secret
LINE_LOGIN_REDIRECT_URI=https://your-domain.com/api/auth/line/callback

# 郵件服務
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@your-domain.com

# 數據庫
DATABASE_URL=postgresql://user:password@host:5432/pickle_heaven

# 應用設置
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

**生成安全的 JWT_SECRET：**

```bash
# 方法 1：使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 方法 2：使用 OpenSSL
openssl rand -hex 32

# 方法 3：使用 /dev/urandom
head -c 32 /dev/urandom | xxd -p
```

### 步驟 2：驗證環境（5 分鐘）

```bash
# 2.1 檢查 Node.js 版本
node -v  # 應為 18.x+
npm -v   # 應為 9.x+

# 2.2 驗證環境變數
source .env.production
echo "JWT_SECRET: ${ADMIN_JWT_SECRET:0:10}..."
echo "DATABASE_URL: ${DATABASE_URL}"

# 2.3 檢查數據庫連接
npm install  # 確保依賴已安裝
npx prisma db execute --stdin << SQL
SELECT 1 as connection_test;
SQL
```

### 步驟 3：應用 Database Migration（5 分鐘）

```bash
# 3.1 查看待執行 Migration
npx prisma migrate status

# 3.2 執行 Migration
npx prisma migrate deploy

# 3.3 驗證表已創建
npx prisma db execute --stdin << SQL
SELECT 
  table_name 
FROM information_schema.tables 
WHERE table_schema='public' 
AND table_name IN ('AdminUser', 'AdminInvitation', 'AdminLineBinding', 'AuditLog');
SQL

# 3.4 檢查表結構
npx prisma studio  # 在瀏覽器中視覺化數據庫
```

### 步驟 4：安裝依賴並構建（8 分鐘）

```bash
# 4.1 安裝生產依賴
npm install --production

# 4.2 構建應用
npm run build

# 4.3 驗證構建成功
ls -la .next/  # 應該看到 build 輸出

# 4.4 測試本地運行（可選）
npm run start &
sleep 5
curl http://localhost:3000/admin/login
kill %1
```

### 步驟 5：配置 PM2（3 分鐘）

```bash
# 5.1 安裝 PM2（如果未安裝）
npm install -g pm2

# 5.2 創建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'pickle-heaven',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pickle-heaven/error.log',
      out_file: '/var/log/pickle-heaven/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
EOF

# 5.3 啟動應用
pm2 start ecosystem.config.js

# 5.4 設置開機自啟
pm2 startup
pm2 save
```

### 步驟 6：配置反向代理（3 分鐘）

**Nginx 配置範例：**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;
    
    # SSL 證書（Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL 安全設置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 步驟 7：驗證上線（2 分鐘）

```bash
# 7.1 檢查應用進程
pm2 status

# 7.2 查看應用日誌
pm2 logs pickle-heaven --lines 50

# 7.3 測試 API 端點
curl https://your-domain.com/admin/login

# 7.4 檢查性能
pm2 monit  # 或使用 top 命令

# 7.5 測試登入功能
# 訪問 https://your-domain.com/admin/login
# 嘗試 LINE Login 和本地登入
```

---

## 🚨 故障排除

### 問題 1：Database Migration 失敗

**症狀：** `Migration failed: Unknown database`

**解決方案：**
```bash
# 檢查數據庫連接字符串
echo $DATABASE_URL

# 驗證數據庫可訪問
psql $DATABASE_URL -c "SELECT 1;"

# 如果使用 SQLite，確保目錄存在
mkdir -p ./prisma
touch ./prisma/dev.db
```

### 問題 2：PORT 3000 已被佔用

**症狀：** `Error: listen EADDRINUSE :::3000`

**解決方案：**
```bash
# 查找佔用進程
lsof -i :3000

# 終止進程
kill -9 <PID>

# 或更改端口
PORT=3001 npm start
```

### 問題 3：JWT_SECRET 未設置

**症狀：** `Error: ADMIN_JWT_SECRET environment variable is missing`

**解決方案：**
```bash
# 生成新的 JWT_SECRET
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 更新 .env.production
echo "ADMIN_JWT_SECRET=$JWT_SECRET" >> .env.production

# 重新啟動應用
pm2 restart pickle-heaven
```

### 問題 4：郵件發送失敗

**症狀：** 邀請郵件未送達

**解決方案：**
```bash
# 驗證 RESEND_API_KEY
curl https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json"

# 檢查應用日誌
pm2 logs pickle-heaven

# 測試郵件端點
curl -X POST http://localhost:3000/api/test/send-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

## ✅ 上線後驗證清單

### 第 1 小時（關鍵）

- [ ] 應用已啟動（`pm2 status` 顯示 online）
- [ ] 日誌無錯誤（`pm2 logs` 無紅色錯誤）
- [ ] 登入頁面可訪問（https://your-domain.com/admin/login）
- [ ] 網絡連接正常（CPU < 50%, 內存 < 300MB）

### 第 1 天（重要）

- [ ] LINE Login 按鈕可點擊
- [ ] 本地登入功能正常
- [ ] 邀請郵件可發送
- [ ] 審計日誌記錄成功
- [ ] 沒有收到錯誤告警

### 第 1 週（持續）

- [ ] API 平均延遲 < 200ms
- [ ] 成功率 > 99.9%
- [ ] 沒有內存洩漏
- [ ] 備份執行成功
- [ ] SSL 證書有效期充足

---

## 📊 部署完成清單

部署完成後，執行以下命令生成部署報告：

```bash
# 生成部署報告
cat > /var/log/pickle-heaven/deployment-report.txt << EOF
部署完成時間：$(date)
應用版本：v1.0.0
Node 版本：$(node -v)
npm 版本：$(npm -v)

進程狀態：
$(pm2 status)

數據庫連接：
$(npx prisma db execute --stdin << SQL
SELECT 
  (SELECT count(*) FROM "AdminUser") as admin_users,
  (SELECT count(*) FROM "AuditLog") as audit_logs;
SQL
)

應用日誌最後 5 條：
$(pm2 logs pickle-heaven --lines 5)
EOF

# 查看報告
cat /var/log/pickle-heaven/deployment-report.txt
```

---

## 🎉 部署成功標誌

當您看到以下情況時，部署已成功：

1. ✅ `pm2 status` 顯示應用 **online**
2. ✅ 訪問 https://your-domain.com/admin/login 成功
3. ✅ 數據庫表已創建（4 張表）
4. ✅ 日誌無錯誤
5. ✅ LINE Login 按鈕顯示正常

---

## 📞 部署支援

如遇問題：

1. 查看詳細日誌：`pm2 logs pickle-heaven -n 100`
2. 檢查環境變數：`source .env.production && env | grep ADMIN`
3. 驗證數據庫：`npx prisma db execute --stdin < verification.sql`
4. 參考 OPERATIONS_GUIDE.md 故障排除部分

---

**祝部署順利！** 🚀
