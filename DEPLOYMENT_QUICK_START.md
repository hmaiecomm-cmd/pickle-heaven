# 🚀 部署快速開始 (30 分鐘)

## 前置需求
- ✅ Node.js 18+
- ✅ npm 9+
- ✅ git
- ✅ 足夠磁碟空間（> 1GB）

## 部署步驟

### 步驟 1：配置環境變數（3 分鐘）

```bash
# 複製配置範本
cp .env.production.example .env.production

# 編輯 .env.production 並填入：
# - ADMIN_JWT_SECRET（32位隨機字符）
# - LINE_CHANNEL_ID 和 LINE_CHANNEL_SECRET
# - RESEND_API_KEY
# - DATABASE_URL
# - NEXT_PUBLIC_APP_URL
```

**關鍵變數說明：**
- `ADMIN_JWT_SECRET`: 用於簽署 JWT token（保密）
- `LINE_CHANNEL_ID/SECRET`: 從 LINE Developers Console 獲得
- `RESEND_API_KEY`: 從 https://resend.com 獲得
- `DATABASE_URL`: 數據庫連接字符串
- `NEXT_PUBLIC_APP_URL`: 生產環境 URL（必須 HTTPS）

### 步驟 2：執行部署腳本（27 分鐘）

**Windows 用戶：**
```bash
deploy.bat
```

**Linux/macOS 用戶：**
```bash
bash deploy.sh
```

**或手動執行以下命令：**
```bash
# 數據庫遷移
npx prisma migrate deploy

# 安裝依賴
npm install --production

# 構建應用
npm run build

# 啟動應用（使用 PM2）
npm install -g pm2
pm2 start npm --name "pickle-heaven" -- start
```

## 驗證部署

```bash
# 檢查進程狀態
pm2 status

# 查看日誌
pm2 logs pickle-heaven

# 測試 API
curl http://localhost:3000/admin/login
```

## 常用命令

| 命令 | 說明 |
|------|------|
| `pm2 status` | 查看進程狀態 |
| `pm2 logs` | 查看應用日誌 |
| `pm2 restart pickle-heaven` | 重啟應用 |
| `pm2 stop pickle-heaven` | 停止應用 |
| `pm2 start pickle-heaven` | 啟動應用 |
| `npm run dev` | 開發模式 |

## 故障排除

### 問題：PORT 3000 已被佔用
```bash
# 查找佔用進程
lsof -i :3000

# 殺死進程（如果需要）
kill -9 <PID>

# 或更改端口
PORT=3001 npm start
```

### 問題：數據庫連接失敗
```bash
# 驗證 DATABASE_URL
echo $DATABASE_URL

# 測試連接（如果使用 PostgreSQL）
psql $DATABASE_URL -c "SELECT 1;"
```

### 問題：構建失敗
```bash
# 清除快取
rm -rf .next node_modules package-lock.json

# 重新安裝和構建
npm install --production
npm run build
```

## 監控

部署完成後，應該看到：
- ✅ PM2 進程在線 (online)
- ✅ HTTP 200 響應
- ✅ 日誌無錯誤
- ✅ CPU < 50%
- ✅ 內存 < 300MB

## 下一步

部署完成後，您可以：
1. ✓ 訪問登入頁面：http://localhost:3000/admin/login
2. ✓ 配置 SSL 證書（生產環境）
3. ✓ 設置反向代理（Nginx/Apache）
4. ✓ 實施監控告警（Sentry/Datadog）
5. ✓ 繼續實施步驟 2-6

---

**預計部署時間：30 分鐘** ⏱️
