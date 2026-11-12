#!/bin/bash
# ================================================
# 匹克精靈後台改版 V4 - 部署執行腳本
# ================================================
# 用法: bash deploy.sh
# ================================================

set -e

echo "╔════════════════════════════════════════════════════╗"
echo "║  匹克精靈後台改版 V4 - 部署執行腳本                  ║"
echo "║  版本：v1.0.0                                        ║"
echo "║  日期：$(date)                          ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# ================================================
# 第 1 步：環境驗證
# ================================================
echo "【第 1 步】環境驗證（5 分鐘）..."
echo ""

echo "✓ 檢查 Node.js 版本..."
NODE_VERSION=$(node -v)
echo "  Node.js: $NODE_VERSION"

echo "✓ 檢查 npm 版本..."
NPM_VERSION=$(npm -v)
echo "  npm: $NPM_VERSION"

echo "✓ 驗證 .env.production..."
if [ ! -f ".env.production" ]; then
  echo "  ❌ .env.production 未找到"
  echo "  請先執行: cp .env.production.example .env.production"
  echo "  然後編輯文件填入必需的環境變數"
  exit 1
fi
echo "  ✅ .env.production 已找到"

echo "✓ 驗證 package.json..."
if [ ! -f "package.json" ]; then
  echo "  ❌ package.json 未找到"
  exit 1
fi
echo "  ✅ package.json 已找到"

echo ""
echo "════════════════════════════════════════════════════"

# ================================================
# 第 2 步：數據庫遷移
# ================================================
echo "【第 2 步】數據庫遷移（5 分鐘）..."
echo ""

echo "✓ 執行 Prisma Migration..."
source .env.production
npx prisma migrate deploy

echo "✓ 生成 Prisma Client..."
npx prisma generate

echo ""
echo "════════════════════════════════════════════════════"

# ================================================
# 第 3 步：依賴安裝
# ================================================
echo "【第 3 步】安裝生產依賴（5 分鐘）..."
echo ""

echo "✓ npm install --production"
npm install --production

echo ""
echo "════════════════════════════════════════════════════"

# ================================================
# 第 4 步：應用構建
# ================================================
echo "【第 4 步】構建應用（5 分鐘）..."
echo ""

echo "✓ npm run build"
npm run build

if [ -d ".next" ]; then
  echo "  ✅ 構建成功"
else
  echo "  ❌ 構建失敗"
  exit 1
fi

echo ""
echo "════════════════════════════════════════════════════"

# ================================================
# 第 5 步：PM2 配置
# ================================================
echo "【第 5 步】PM2 配置（2 分鐘）..."
echo ""

echo "✓ 檢查 PM2 安裝..."
if ! command -v pm2 &> /dev/null; then
  echo "  ℹ️ 安裝 PM2..."
  npm install -g pm2
fi

echo "✓ 停止舊進程..."
pm2 stop pickle-heaven || true
pm2 delete pickle-heaven || true

echo "✓ 啟動新進程..."
pm2 start npm --name "pickle-heaven" -- start

echo "✓ 保存 PM2 配置..."
pm2 save

echo "✓ 設置開機自啟..."
pm2 startup || true

echo ""
echo "════════════════════════════════════════════════════"

# ================================================
# 第 6 步：驗證上線
# ================================================
echo "【第 6 步】驗證上線（3 分鐘）..."
echo ""

sleep 3

echo "✓ 檢查進程狀態..."
pm2 status

echo ""
echo "✓ 檢查應用日誌..."
pm2 logs pickle-heaven --lines 5

echo ""
echo "✓ 測試 API 端點..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/login)
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "301" ] || [ "$RESPONSE" = "307" ]; then
  echo "  ✅ API 可訪問 (HTTP $RESPONSE)"
else
  echo "  ⚠️ API 返回 HTTP $RESPONSE"
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "✅ 部署完成！"
echo "════════════════════════════════════════════════════"
echo ""
echo "應用已啟動，訪問以下地址查看登入頁面："
echo "  http://localhost:3000/admin/login"
echo ""
echo "常用命令："
echo "  pm2 status          - 檢查進程狀態"
echo "  pm2 logs            - 查看應用日誌"
echo "  pm2 restart pickle-heaven  - 重啟應用"
echo "  pm2 stop pickle-heaven     - 停止應用"
echo ""
