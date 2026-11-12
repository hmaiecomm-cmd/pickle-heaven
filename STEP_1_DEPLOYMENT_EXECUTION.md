# 🚀 步驟 1：開始實施部署 - 執行檢查清單

**日期：** 2026-11-12  
**狀態：** 執行中  
**預計時間：** 30 分鐘  
**負責人：** DevOps 團隊  

---

## ✅ 部署前環境驗證（10 分鐘）

### 1.1 系統環境檢查

```bash
#!/bin/bash
# 執行環境驗證

echo "🔍 系統環境檢查開始..."

# 檢查 OS
echo "OS: $(uname -s)"

# 檢查 Node.js
NODE_VERSION=$(node -v)
echo "Node.js: $NODE_VERSION"
if ! echo $NODE_VERSION | grep -E "v(1[8-9]|[2-9][0-9])" > /dev/null; then
  echo "❌ 需要 Node.js 18+ 版本"
  exit 1
fi

# 檢查 npm
NPM_VERSION=$(npm -v)
echo "npm: $NPM_VERSION"

# 檢查 git
GIT_VERSION=$(git -v)
echo "git: $GIT_VERSION"

# 檢查磁碟空間
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}')
echo "磁碟使用: $DISK_USAGE"
if [ "${DISK_USAGE%\%}" -gt 90 ]; then
  echo "⚠️  磁碟空間不足"
fi

# 檢查記憶體
MEMORY=$(free -h | awk 'NR==2 {print $7}')
echo "可用記憶體: $MEMORY"

# 檢查網絡連接
echo "🌐 測試網絡連接..."
if ping -c 1 8.8.8.8 &> /dev/null; then
  echo "✅ 網絡連接正常"
else
  echo "❌ 網絡連接失敗"
  exit 1
fi

echo "✅ 環境檢查完成"
```

### 1.2 代碼準備檢查

```bash
# 驗證代碼狀態
cd /opt/pickle-heaven  # 或您的項目路徑

# 檢查 git 狀態
echo "📋 檢查代碼狀態..."
git status

# 驗證版本標籤
git tag | grep v1.0.0
if [ $? -eq 0 ]; then
  echo "✅ v1.0.0 標籤已找到"
else
  echo "❌ v1.0.0 標籤未找到"
  exit 1
fi

# 檢查 package.json
echo "✅ 檢查 package.json..."
cat package.json | grep version

# 驗證數據庫配置
echo "🗄️ 檢查數據庫配置..."
if [ -f ".env.production" ]; then
  echo "✅ .env.production 已存在"
  # 驗證必要變數
  if grep -q "DATABASE_URL" .env.production; then
    echo "✅ DATABASE_URL 已配置"
  else
    echo "❌ DATABASE_URL 未配置"
    exit 1
  fi
else
  echo "⚠️ .env.production 不存在 - 將使用範本"
fi
```

---

## 🔧 實際部署步驟（20 分鐘）

### 步驟 1：環境變數配置（3 分鐘）

```bash
# 如果 .env.production 不存在，複製範本
if [ ! -f ".env.production" ]; then
  cp .env.example .env.production
  echo "⚠️ 請編輯 .env.production，設置以下變數："
  echo ""
  echo "   ADMIN_JWT_SECRET=<32位隨機字符>"
  echo "   LINE_CHANNEL_ID=<YOUR_CHANNEL_ID>"
  echo "   LINE_CHANNEL_SECRET=<YOUR_SECRET>"
  echo "   RESEND_API_KEY=<YOUR_API_KEY>"
  echo "   DATABASE_URL=<YOUR_DB_URL>"
  echo "   NEXT_PUBLIC_APP_URL=https://your-domain.com"
  echo ""
  read -p "完成編輯後按 Enter..."
fi

# 驗證環境變數
source .env.production
echo "✅ 環境變數已加載"
```

### 步驟 2：數據庫遷移（3 分鐘）

```bash
echo "🗄️ 執行數據庫 Migration..."

# 檢查當前狀態
echo "📊 當前 Migration 狀態："
npx prisma migrate status

# 執行 Migration
echo "⚙️ 應用遷移..."
npx prisma migrate deploy

# 驗證表已創建
echo "✓ 驗證數據庫表..."
npx prisma db execute --stdin << SQL
SELECT 
  (SELECT COUNT(*) FROM "AdminUser") as admin_users,
  (SELECT COUNT(*) FROM "AdminInvitation") as invitations,
  (SELECT COUNT(*) FROM "AdminLineBinding") as line_bindings,
  (SELECT COUNT(*) FROM "AuditLog") as audit_logs;
SQL

echo "✅ 數據庫遷移完成"
```

### 步驟 3：安裝依賴（5 分鐘）

```bash
echo "📦 安裝生產依賴..."

# 清除舊的 node_modules（可選）
# rm -rf node_modules package-lock.json

# 安裝依賴
npm install --production

# 驗證關鍵依賴
echo "✓ 驗證關鍵包..."
npm list jose bcryptjs resend @prisma/client

echo "✅ 依賴安裝完成"
```

### 步驟 4：應用構建（5 分鐘）

```bash
echo "🔨 構建 Next.js 應用..."

# 執行構建
npm run build

# 驗證構建輸出
if [ -d ".next" ]; then
  echo "✅ 構建成功"
  ls -lh .next/
else
  echo "❌ 構建失敗"
  exit 1
fi

# 構建統計
du -sh .next/
```

### 步驟 5：PM2 配置和啟動（2 分鐘）

```bash
echo "🚀 配置 PM2..."

# 檢查 PM2
if ! command -v pm2 &> /dev/null; then
  echo "📦 安裝 PM2..."
  npm install -g pm2
fi

# 停止舊進程（如果存在）
pm2 stop pickle-heaven || true
pm2 delete pickle-heaven || true

# 啟動應用
pm2 start npm --name "pickle-heaven" -- start \
  --env NODE_ENV=production

# 檢查狀態
pm2 status

# 設置開機自啟
pm2 startup
pm2 save

echo "✅ PM2 配置完成"
```

### 步驟 6：驗證應用上線（2 分鐘）

```bash
echo "🔍 驗證應用..."

# 等待應用啟動
sleep 3

# 檢查進程
pm2 status

# 查看日誌（最後 20 行）
echo "📋 應用日誌："
pm2 logs pickle-heaven --lines 20

# 測試 API 端點
echo "🌐 測試 API 端點..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/login)

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "301" ] || [ "$RESPONSE" = "307" ]; then
  echo "✅ API 端點可訪問 (HTTP $RESPONSE)"
else
  echo "⚠️ API 返回 HTTP $RESPONSE"
  pm2 logs pickle-heaven --err
fi

# 檢查進程資源使用
echo "📊 資源使用："
pm2 monit
```

---

## 📋 部署檢查清單

### 部署前檢查
- [ ] Node.js 版本 >= 18
- [ ] npm 版本 >= 9
- [ ] git 已安裝
- [ ] 磁碟空間 > 1GB
- [ ] 記憶體 > 512MB
- [ ] 網絡連接正常
- [ ] .env.production 已配置
- [ ] 所有環境變數已設置

### 部署中檢查
- [ ] 代碼拉取成功
- [ ] 依賴安裝成功
- [ ] 數據庫 Migration 成功
- [ ] 應用構建成功
- [ ] PM2 啟動成功
- [ ] 沒有啟動錯誤

### 部署後檢查
- [ ] 應用進程正在運行
- [ ] API 端點可訪問
- [ ] 日誌無錯誤
- [ ] CPU 使用 < 50%
- [ ] 內存使用 < 500MB
- [ ] 響應時間 < 500ms
- [ ] 可以訪問登入頁面

---

## 🎯 成功標誌

部署完成後，您應該看到：

```
✅ pm2 status 顯示 pickle-heaven 為 online
✅ curl http://localhost:3000/admin/login 返回 200
✅ pm2 logs 沒有紅色錯誤
✅ 在瀏覽器訪問 https://your-domain.com/admin/login 成功
✅ LINE Login 按鈕顯示正常
```

---

## 🚨 常見問題排除

| 問題 | 症狀 | 解決方案 |
|------|------|--------|
| PORT 已佔用 | listen EADDRINUSE | `lsof -i :3000` 找到進程，然後 `kill -9 <PID>` |
| DB 連接失敗 | connection refused | 驗證 DATABASE_URL，檢查網絡連接 |
| 構建失敗 | Build error | 檢查日誌，確保所有依賴已安裝 |
| 記憶不足 | out of memory | 檢查磁碟空間，清理不必要文件 |
| PM2 失敗 | permission denied | 使用 `sudo pm2 startup` |

---

## 📊 部署完成報告

```bash
#!/bin/bash
# 生成部署報告

cat > deployment_report.txt << EOF
部署完成報告
時間: $(date)

系統信息:
  OS: $(uname -s)
  Node: $(node -v)
  npm: $(npm -v)

應用狀態:
$(pm2 status)

數據庫:
$(psql $DATABASE_URL -c "SELECT version();" 2>/dev/null || echo "SQLite 或連接失敗")

磁碟使用:
$(df -h /)

內存使用:
$(free -h)

最後 10 行日誌:
$(pm2 logs pickle-heaven --lines 10)
EOF

cat deployment_report.txt
```

---

## ✨ 部署成功！

```
🎉 應用已成功部署到生產環境
🚀 訪問: https://your-domain.com/admin/login
📊 監控: pm2 monit
📋 日誌: pm2 logs pickle-heaven
```

---

**部署完成。接下來進入步驟 2：實施功能擴展** 🚀
