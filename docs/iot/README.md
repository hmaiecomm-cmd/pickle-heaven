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
| `edge/simulator/` | 場館模擬器：參考實作、19 個情境、壓力測試、即時面板 | 不部署 |
| `infra/digitalocean/` | App Platform 規格、環境變數範本 | — |
| `scripts/verify-iot-e2e.mts` | 平台真實程式 → Gateway → 模擬場館的端到端驗證 | 不部署 |

舊的 `iot/`（Python edge-control，含 Modbus／Soyal 驅動）與 `rpi-sdk/`（本機 MQTT 方案）暫時保留未動。

## 本機測試

```bash
# 場館模擬器（內建記憶體版 Gateway）
cd services/iot-gateway && npm install
cd ../../edge/simulator
npm run scenarios                 # 全部 20 個情境
npm run scenarios -- network      # 只跑某個標籤：schedule / door / command / network / hardware / safety / security / camera / logs / scale
npm run load -- --sites 200       # 多場館壓力測試
npm run panel                     # http://127.0.0.1:4310 即時面板（可切斷網、硬體故障、輸入密碼）

# 平台端到端（暫存 SQLite，不會連 Turso）
npm run verify:iot
```

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
