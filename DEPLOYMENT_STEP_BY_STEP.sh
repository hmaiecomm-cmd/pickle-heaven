#!/bin/bash

# 匹克精靈後台改版 V4 - 生產部署腳本
# 使用說明：在生產服務器上執行 bash DEPLOYMENT_STEP_BY_STEP.sh
# 預計耗時：30 分鐘

set -e  # 任何命令失敗則停止

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     匹克精靈後台改版 V4 - 生產部署腳本                      ║"
echo "║     版本：v1.0.0                                            ║"
echo "║     日期：$(date)                              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# ============================================================
# 第 1 步：環境檢查
# ============================================================
echo "【第 1 步】環境檢查..."
echo ""

# 檢查 Node.js 版本
echo -n "✓ 檢查 Node.js 版本... "
NODE_VERSION=$(node -v)
echo "$NODE_VERSION"
if ! node -v | grep -E "v(1[8-9]|[2-9][0-9])" > /dev/null; then
  echo "❌ 需要 Node.js 18+ 版本"
  exit 1
fi

# 檢查 npm 版本
echo -n "✓ 檢查 npm 版本... "
npm -v

# 檢查 git 版本
echo -n "✓ 檢查 git 版本... "
git -v

# 檢查是否在正確目錄
if [ ! -f "package.json" ]; then
  echo "❌ 未找到 package.json - 請在項目根目錄執行此腳本"
  exit 1
fi

echo "✅ 環境檢查完成"
echo ""

# ============================================================
# 第 2 步：環境變數配置
# ============================================================
echo "【第 2 步】環境變數配置..."
echo ""

if [ ! -f ".env.production" ]; then
  echo "📋 複製環境變數範本..."
  cp .env.example .env.production
  echo "⚠️  請編輯 .env.production 並設置以下變數："
  echo ""
  echo "   ADMIN_JWT_SECRET           = (32位隨機字符)"
  echo "   LINE_CHANNEL_ID            = (from LINE Console)"
  echo "   LINE_CHANNEL_SECRET        = (from LINE Console)"
  echo "   RESEND_API_KEY             = (from resend.com)"
  echo "   DATABASE_URL               = (生產數據庫連接)"
  echo "   NEXT_PUBLIC_APP_URL        = (生產域名)"
  echo ""
  echo "❌ 請先編輯 .env.production，完成後重新運行此腳本"
  exit 1
else
  echo "✅ 已找到 .env.production"
fi

# 驗證必需的環境變數
echo "🔍 驗證環境變數..."
REQUIRED_VARS=("ADMIN_JWT_SECRET" "LINE_CHANNEL_ID" "LINE_CHANNEL_SECRET" "RESEND_API_KEY" "DATABASE_URL" "NEXT_PUBLIC_APP_URL")

source .env.production 2>/dev/null || true

for var in "${REQUIRED_VARS[@]}"; do
  eval "value=\$$var"
  if [ -z "$value" ]; then
    echo "❌ 缺少環境變數: $var"
    exit 1
  else
    echo "   ✓ $var 已配置"
  fi
done

echo "✅ 環境變數驗證完成"
echo ""

# ============================================================
# 第 3 步：依賴安裝
# ============================================================
echo "【第 3 步】安裝生產依賴..."
echo ""

npm install --production
echo "✅ 依賴安裝完成"
echo ""

# ============================================================
# 第 4 步：數據庫遷移
# ============================================================
echo "【第 4 步】應用數據庫遷移..."
echo ""

echo "⚙️  執行 Prisma Migration..."
npx prisma migrate deploy --skip-generate

echo ""
echo "✓ 驗證數據庫表..."
npx prisma db execute --stdin << SQL
SELECT
  (SELECT count(*) FROM "AdminUser") as admin_users,
  (SELECT count(*) FROM "AdminInvitation") as invitations,
  (SELECT count(*) FROM "AdminLineBinding") as line_bindings,
  (SELECT count(*) FROM "AuditLog") as audit_logs;
SQL

echo "✅ 數據庫遷移完成"
echo ""

# ============================================================
# 第 5 步：應用構建
# ============================================================
echo "【第 5 步】構建生產應用..."
echo ""

echo "🔨 執行 Next.js 構建..."
npm run build

echo "✅ 應用構建完成"
echo ""

# ============================================================
# 第 6 步：啟動應用
# ============================================================
echo "【第 6 步】啟動應用進程..."
echo ""

echo "📦 檢查 PM2 安裝..."
if ! command -v pm2 &> /dev/null; then
  echo "安裝 PM2..."
  npm install -g pm2
fi

echo "🚀 啟動應用..."
pm2 start npm --name "pickle-heaven" -- start

echo "💾 保存 PM2 配置..."
pm2 save

echo "⚙️  配置開機自啟..."
pm2 startup

echo "✅ 應用啟動完成"
echo ""

# ============================================================
# 第 7 步：驗證上線
# ============================================================
echo "【第 7 步】驗證上線..."
echo ""

sleep 3

echo "🔍 檢查應用進程..."
pm2 status

echo ""
echo "📊 檢查應用日誌..."
pm2 logs pickle-heaven --lines 20

echo ""
echo "🌐 驗證 API 可訪問性..."
if curl -s http://localhost:3000/admin/login > /dev/null; then
  echo "✅ API 可訪問"
else
  echo "⚠️  API 無法訪問 - 請檢查日誌"
fi

echo ""
echo "✅ 驗證完成"
echo ""

# ============================================================
# 完成
# ============================================================
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║         🎉 部署完成！應用已上線                           ║"
echo "║                                                           ║"
echo "║     應用地址：http://localhost:3000/admin/login          ║"
echo "║     監控面板：pm2 monit                                  ║"
echo "║     查看日誌：pm2 logs pickle-heaven                     ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

echo "📋 部署後驗證清單："
echo "  □ 訪問 http://localhost:3000/admin/login"
echo "  □ 點擊 LINE Login 按鈕"
echo "  □ 測試本地登入功能"
echo "  □ 創建管理員邀請"
echo "  □ 驗證郵件發送"
echo "  □ 檢查審計日誌"
echo ""
