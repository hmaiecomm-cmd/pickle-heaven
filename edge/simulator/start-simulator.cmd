@echo off
chcp 65001 >nul
rem ─────────────────────────────────────────────────────────────
rem  顧好 場館模擬器（地端 IoT PC）啟動器
rem  放在 Dropbox 裡，哪一台電腦執行，模擬器就在那台電腦上「主動連出」到雲端 Gateway，
rem  等同場館電腦在浮動 IP 後面運作（不開任何對外 port）。
rem
rem  用法：
rem    雙擊執行                     → 本機互動測試：本機 Gateway＋模擬器（平台 npm run dev 連過來）
rem    start-simulator.cmd staging  → 連 .iot-dev\simulator.json 設定的雲端 Gateway（DigitalOcean staging）
rem
rem  .iot-dev\simulator.json 範例（不要提交到 git）：
rem    { "gateway": "https://xxx.ondigitalocean.app", "site": "xindian001-sim", "platformSecret": "..." }
rem ─────────────────────────────────────────────────────────────
cd /d "%~dp0\..\.."

where node >nul 2>nul || (echo 找不到 Node.js，請先安裝 Node 20 以上 & pause & exit /b 1)
if not exist "services\iot-gateway\node_modules" (
  echo 第一次執行：安裝 Gateway 與模擬器需要的套件…
  call npm --prefix services\iot-gateway install || (pause & exit /b 1)
)
where ffmpeg >nul 2>nul || (
  if not defined FFMPEG_PATH echo 提醒：沒有 ffmpeg，攝影機串流與錄影調閱會失敗。可執行 winget install Gyan.FFmpeg
)

if /i "%1"=="staging" (
  node -e "const c=require('./.iot-dev/simulator.json');const a=['edge/simulator/src/cli.ts','console','--gateway',c.gateway,'--site',c.site||'xindian001-sim'];if(c.secret)a.push('--secret',c.secret);if(c.platformSecret)a.push('--platform-secret',c.platformSecret);require('child_process').spawnSync(process.execPath,['services/iot-gateway/node_modules/tsx/dist/cli.mjs',...a],{stdio:'inherit'})"
) else (
  node services\iot-gateway\node_modules\tsx\dist\cli.mjs edge\simulator\src\cli.ts stack
)
pause
