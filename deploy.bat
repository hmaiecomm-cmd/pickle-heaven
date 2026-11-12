@echo off
REM ================================================
REM 匹克精靈後台改版 V4 - Windows 部署腳本
REM ================================================
REM 用法: deploy.bat
REM ================================================

setlocal enabledelayedexpansion

echo ╔════════════════════════════════════════════════════╗
echo ║  匹克精靈後台改版 V4 - Windows 部署腳本              ║
echo ║  版本：v1.0.0                                        ║
echo ║  日期：%date% %time%                        ║
echo ╚════════════════════════════════════════════════════╝
echo.

REM ================================================
REM 第 1 步：環境驗證
REM ================================================
echo 【第 1 步】環境驗證（5 分鐘）...
echo.

echo ✓ 檢查 Node.js 版本...
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo   Node.js: %NODE_VERSION%

echo ✓ 檢查 npm 版本...
for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo   npm: %NPM_VERSION%

echo ✓ 驗證 .env.production...
if not exist ".env.production" (
  echo   ❌ .env.production 未找到
  echo   請先執行: copy .env.production.example .env.production
  echo   然後編輯文件填入必需的環境變數
  exit /b 1
)
echo   ✅ .env.production 已找到

echo.
echo ════════════════════════════════════════════════════

REM ================================================
REM 第 2 步：數據庫遷移
REM ================================================
echo 【第 2 步】數據庫遷移（5 分鐘）...
echo.

echo ✓ 執行 Prisma Migration...
call npx prisma migrate deploy
if errorlevel 1 (
  echo   ❌ Migration 失敗
  exit /b 1
)

echo ✓ 生成 Prisma Client...
call npx prisma generate

echo.
echo ════════════════════════════════════════════════════

REM ================================================
REM 第 3 步：依賴安裝
REM ================================================
echo 【第 3 步】安裝生產依賴（5 分鐘）...
echo.

echo ✓ npm install --production
call npm install --production
if errorlevel 1 (
  echo   ❌ 安裝失敗
  exit /b 1
)

echo.
echo ════════════════════════════════════════════════════

REM ================================================
REM 第 4 步：應用構建
REM ================================================
echo 【第 4 步】構建應用（5 分鐘）...
echo.

echo ✓ npm run build
call npm run build
if errorlevel 1 (
  echo   ❌ 構建失敗
  exit /b 1
)

if exist ".next" (
  echo   ✅ 構建成功
) else (
  echo   ❌ 構建失敗
  exit /b 1
)

echo.
echo ════════════════════════════════════════════════════

REM ================================================
REM 第 5 步：PM2 配置
REM ================================================
echo 【第 5 步】PM2 配置（2 分鐘）...
echo.

echo ✓ 檢查 PM2 安裝...
where pm2 >nul 2>nul
if errorlevel 1 (
  echo   ℹ️ 安裝 PM2...
  call npm install -g pm2
)

echo ✓ 停止舊進程...
call pm2 stop pickle-heaven >nul 2>nul
call pm2 delete pickle-heaven >nul 2>nul

echo ✓ 啟動新進程...
call pm2 start npm --name "pickle-heaven" -- start

echo ✓ 保存 PM2 配置...
call pm2 save

echo ✓ 設置開機自啟...
call pm2 startup >nul 2>nul

echo.
echo ════════════════════════════════════════════════════

REM ================================================
REM 第 6 步：驗證上線
REM ================================================
echo 【第 6 步】驗證上線（3 分鐘）...
echo.

timeout /t 3 /nobreak

echo ✓ 檢查進程狀態...
call pm2 status

echo.
echo ✓ 檢查應用日誌...
call pm2 logs pickle-heaven --lines 5

echo.
echo ════════════════════════════════════════════════════
echo ✅ 部署完成！
echo ════════════════════════════════════════════════════
echo.
echo 應用已啟動，訪問以下地址查看登入頁面：
echo   http://localhost:3000/admin/login
echo.
echo 常用命令：
echo   pm2 status          - 檢查進程狀態
echo   pm2 logs            - 查看應用日誌
echo   pm2 restart pickle-heaven  - 重啟應用
echo   pm2 stop pickle-heaven     - 停止應用
echo.

pause
