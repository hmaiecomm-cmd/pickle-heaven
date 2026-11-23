# 顧好 IoT 架構（平台 ↔ IoT Gateway ↔ 場館電腦）

給地端廠商的完整規格在 Notion：「顧好 IoT 場館電腦（地端）開發規格 v1」。這份是給我們自己維護用的。

## 資料流

```
顧好平台（Vercel，src/）
  ├─ 預約付款／取消／退款 → 時段密碼同步 → 推送「場館計畫」（src/server/iot/sync.ts）
  ├─ 每 15 分鐘 cron /api/cron/slot-passwords → 所有場館重推計畫（48 小時視窗往前滾）
  ├─ 後台手動開關 → circuit-control.ts → Gateway 指令佇列
  ├─ 後台「日誌檢視」調閱場館 log → edge-logs.ts → log.upload 指令（內容存在 Gateway，30 天）
  └─ /api/iot/webhook ← Gateway 回報（ack、狀態、事件、上下線）
        │ HMAC 簽章（keyId platform / gateway）
        ▼
IoT Gateway（DigitalOcean App Platform，services/iot-gateway/）
  Load Balancer → gateway × N（無狀態）→ Redis（長輪詢喚醒、nonce、在線、限流、鎖）＋ Postgres（場館、計畫、指令、事件、webhook outbox）
        ▲ HTTPS，只由場館主動連出（HMAC，keyId = siteId）
        │
場館電腦（地端廠商實作；參考實作 edge/simulator/src/agent.ts）
  依計畫自己執行排程與門禁，斷網照常運作
```

## 資料夾

| 路徑 | 內容 | 部署 |
|---|---|---|
| `packages/iot-contract/` | 三方共用型別、簽章、排程參考邏輯（無外部依賴） | 平台與 Gateway 打包時一起編入 |
| `services/iot-gateway/` | Gateway（Hono + postgres.js + ioredis） | DigitalOcean App Platform（Dockerfile） |
| `src/server/iot/` | 平台端：組計畫、推送、Gateway client | Vercel |
| `src/app/api/iot/webhook/` | 平台端：接收 Gateway 回報 | Vercel |
| `src/app/api/admin/iot/logs/`、`src/app/admin/logs/edge-logs-panel.tsx` | 平台端：調閱、列表、檢視／下載場館 log | Vercel |
| `edge/simulator/` | 場館模擬器：參考實作、23 個情境、壓力測試、模擬器網頁（含浮動 IP） | 本機，或 DO staging（`edge/simulator/Dockerfile`） |
| `src/app/admin/engineer_testmode/` | 後台「系統設定 → 地端 IoT（工程測試）」：切換實體／模擬器、下行參數、流量、錯誤、測試台、攝影機、浮動 IP 與心跳 | Vercel |
| `infra/digitalocean/staging.yaml` | DO 測試環境：Gateway（記憶體版）＋雲端模擬器 | DigitalOcean |
| `infra/digitalocean/` | App Platform 規格、環境變數範本 | — |
| `scripts/verify-iot-e2e.mts` | 平台真實程式 → Gateway → 模擬場館的端到端驗證 | 不部署 |

舊的 `iot/`（Python edge-control，含 Modbus／Soyal 驅動）與 `rpi-sdk/`（本機 MQTT 方案）暫時保留未動。

## 本機測試

```bash
# 場館模擬器（內建記憶體版 Gateway）
cd services/iot-gateway && npm install
cd ../../edge/simulator
npm run scenarios                 # 全部 23 個情境
npm run scenarios -- network      # 只跑某個標籤：schedule / door / command / network / hardware / safety / security / camera / logs / scale
npm run load -- --sites 200       # 多場館壓力測試
npm run panel                     # http://127.0.0.1:4310 即時面板（可切斷網、硬體故障、輸入密碼）

# 平台端到端（暫存 SQLite，不會連 Turso）
npm run verify:iot
```

## 互動測試環境（平台 ↔ 模擬器）

- 本機：雙擊 `edge/simulator/start-simulator.cmd`（或 `npm run iot:stack`）→ 本機 Gateway :8787＋模擬器網頁 :4310，並把 `IOT_*` 寫進 `.env.development.local`。平台 `npm run dev` 後到 `/admin/engineer_testmode`。
- 雲端（DO staging）：`infra/digitalocean/staging.yaml` 一個 App 兩個元件。`/` 是 Gateway，`/sim/` 是模擬器網頁（`CONSOLE_PASSWORD`，HTTP Basic，帳號任意）。模擬器啟動後自動向 Gateway 開通 `xindian001-sim`；Gateway 重開（記憶體版清空）時會自動重新開通。
- 後台首頁右下角隱藏圓點可一鍵把整個後台切到模擬器（`Venue.iotTarget`＝`SIMULATOR`，Gateway 場館 ID 加 `-sim`），橫幅會一直提示，可一鍵切回實體。

### 浮動 IP 與心跳

真實場館電腦在浮動 IP／NAT 後面，雲端**不能**主動連進去。雲端「呼叫場館」＝把指令排進 Gateway，場館下次長輪詢（連出）時取走、執行、ack。

- Gateway 記錄每個場館的來源 IP（DO 的 `do-connecting-ip`／`x-forwarded-for`）。IP 改變時寫進 IP 歷史（50 筆），流量紀錄註記「來源 IP 變更 A → B」。
- 每次心跳記錄時間、IP、與上次心跳的間隔、時差、待送事件（120 筆）。超過 `OFFLINE_AFTER_SEC`（staging 設 30 秒）沒心跳判定離線並 webhook 平台。
- 內部 API `GET /internal/v1/sites/:id/connection` 回傳上述資料。工程測試頁「場館鏡像」分頁顯示目前 IP、IP 歷史、心跳間隔圖，以及「從雲端呼叫場館」（量測排入 → 取走 → 回覆的秒數）。
- 模擬器：每個請求帶 `x-sim-egress-ip` 宣告模擬的浮動 IP（台灣動態 IP 網段）。Gateway **只對 siteId 結尾 `-sim` 的場館採信**，真實場館送了也不理。預設每 30 分鐘換號一次（`FLOATING_IP_EVERY_MIN`／`--floating-ip-min`，0＝不自動）。換號時斷線幾秒（可調），之後新 IP 立即送心跳。模擬器網頁可手動換號、改頻率、改斷線秒數。

## 上線步驟

1. 正式庫與展示庫套用 `prisma/migrations-manual/2026-11-23a_iot_site_code.sql`，並設定場館代碼：
   `UPDATE "Venue" SET "siteCode" = 'xindian001' WHERE "slug" = 'taipei-dazhi';`
2. DigitalOcean：建立 Managed Redis（sgp1），依 `infra/digitalocean/app.yaml` 建立 App（含 Postgres 與 PRE_DEPLOY migrate job），設定 `env.example` 列出的秘密值。
3. Vercel：設定 `IOT_GATEWAY_URL`、`IOT_PLATFORM_SECRET`、`IOT_WEBHOOK_SECRET` 後部署。設定後後台的設備模式會變成「IoT Gateway」，手動指令改經 Gateway 送出。
4. 取得場館金鑰交給地端廠商：呼叫 Gateway `POST /internal/v1/sites/xindian001/credentials`（平台身分簽章）。換金鑰加 `?rotate=true`，舊金鑰立即失效。
5. 地端程式先連 staging，依 Notion 規格第 13 節驗收。

## 設計重點

- **斷網可運作**：計畫含 48 小時的迴路時段與門禁密碼；指令只處理臨時事件，30 秒過期。
- **規模**：Gateway 無狀態可加機器；長輪詢靠 Redis pub/sub 喚醒；心跳只寫 Redis，資料庫每 5 分鐘落地一次；計畫內容沒變不遞增版本。
- **安全**：每個請求 HMAC＋時間戳＋nonce；場館金鑰由主金鑰派生（可輪替、可停用）；計畫（含明碼）在 Postgres 以 AES-256-GCM 加密；log 與事件不含明碼。
- **log 調閱**：場館本機 log 平常不上傳；後台按「向場館調閱」才送 log.upload（15 分鐘內要開始），場館篩選後 `PUT /edge/v1/logs/:id`（合計 ≤ 5 MB，超過保留最新並標截斷）。Gateway 以 gzip 存在 `log_uploads`（migration 002），每小時清掉 30 天前的；平台只記 AuditLog `IOT_LOG_REQUESTED`／`IOT_LOG_UPLOADED`。
- **至少送達一次**：指令未 ack 20 秒後重送、事件以 eventId 去重、webhook 有 outbox 與退避重試，平台處理皆可重複執行。

## 已知限制與後續

- `Circuit.circuitNumber` 目前全系統唯一；第二間場館上線前要改成「場館＋編號」唯一，並把 `prisma.circuit.findUnique({ where: { circuitNumber } })` 全部改為帶場館。
- 多處程式假設只有一個場館（`venue.findFirst({ where: { active: true } })`）。
- 後台修改營業時間／夜間排程後，最慢 15 分鐘才會推到場館（cron）；之後可在排程儲存後直接呼叫 `pushSitePlanSafe`。
- 跨午夜的時段以「開始那天」判斷星期，與 `calculateCircuitStates` 在午夜後的判斷略有不同。
- 後台設備頁仍以「模擬／尚未串接」兩種文字顯示，尚未呈現 Gateway 在線狀態。
- log 調閱內容放在 Postgres（bytea）；若之後調閱量大，可改存 DigitalOcean Spaces，只在資料表留索引。
