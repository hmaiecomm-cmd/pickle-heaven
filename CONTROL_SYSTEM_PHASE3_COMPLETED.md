# 無人化電力控制系統 — 第三階段實施完成報告

**狀態**: ✅ 完成（Watchdog 與日誌系統）

**實施時間**: 2026-11-11

---

## 📋 第三階段交付內容

### 1. Watchdog 監控服務 (`src/server/watchdog-service.ts`)

**責務**：
- 定期檢測系統各個環節的健康狀態
- 自動生成與更新告警
- 支援人工確認與解決告警

**核心檢測項目**（6 大類）：

#### 1.1 MQTT Broker 狀態
```typescript
checkMqttStatus(venueId, venueName)
// 檢查最近 1 小時內是否有連接事件
// 狀態：HEALTHY / OFFLINE / ERROR
```

#### 1.2 設備（Relay）在線狀態
```typescript
checkDeviceStatus(venueId, adapterId, adapterName)
// 檢查設備心跳（5 分鐘無回報視為離線）
// 狀態：HEALTHY / OFFLINE / ERROR
```

#### 1.3 命令確認狀態
```typescript
checkCommandAckStatus(venueId)
// 檢查未確認命令與已過期命令
// 狀態：HEALTHY / DEGRADED / ERROR
```

#### 1.4 排程執行狀態
```typescript
checkScheduleStatus(venueId)
// 檢查最近 1 小時內是否有排程執行事件
// 狀態：HEALTHY / DEGRADED / ERROR
```

#### 1.5 事件日誌同步狀態
```typescript
checkEventLogStatus(venueId)
// 檢查未同步到 Neon 的日誌數量
// 狀態：HEALTHY / DEGRADED / ERROR
```

**Watchdog 告警生命週期**：

```
發現問題 (OPEN)
    ↓
重複檢測多次，增加 detectionCount
    ↓
管理員確認 (ACKNOWLEDGED) ← 可人工操作
    ↓
問題解決 (RESOLVED)
    ↓
恢復歷史記錄
```

**API 函數**：

```typescript
// 執行 Watchdog 檢測
const results = await runWatchdogCheck()
// 返回 HealthCheckResult[]

// 取得場館摘要
const summary = await getWatchdogSummary(venueId)
// 返回 { totalAlerts, openAlerts, highestSeverity, recentAlerts[] }

// 人工確認告警
await acknowledgeAlert(alertId, operatorName, note?)

// 標記告警已解決
await resolveAlert(alertId, operatorName, note?)
```

---

### 2. 事件日誌服務 (`src/server/event-logger.ts`)

**責務**：
- 記錄所有系統事件
- 支援本地緩衝（當 Neon 不可用時）
- 非同步同步到 Neon
- 事件查詢與脫敏

**20 種事件類型**：

| 類別 | 事件類型 | 場景 |
|-----|---------|------|
| 預約 | RESERVATION_CREATED | 新預約建立 |
| | RESERVATION_CONFIRMED | 預約確認 |
| | RESERVATION_CANCELLED | 預約取消 |
| | RESERVATION_MODIFIED | 預約改期 |
| 排程 | SCHEDULE_RECALCULATED | 重新計算排程 |
| | SCHEDULE_EXECUTED | 排程執行 |
| 命令 | COMMAND_SENT | 命令已發送 |
| | COMMAND_ACKED | 設備已確認 |
| | COMMAND_FAILED | 命令失敗 |
| 設定 | OPERATING_HOURS_CHANGED | 營業時間變更 |
| | NIGHT_SCHEDULE_CHANGED | 夜間排程變更 |
| | MANUAL_OVERRIDE | 人工覆寫 |
| | OVERRIDE_EXPIRED | 覆寫過期 |
| 設備 | DEVICE_ONLINE | 設備上線 |
| | DEVICE_OFFLINE | 設備離線 |
| | STATUS_MISMATCH | 狀態不一致 |
| MQTT | MQTT_CONNECTED | MQTT 已連接 |
| | MQTT_DISCONNECTED | MQTT 已斷線 |
| 監控 | WATCHDOG_ALERT | Watchdog 告警 |
| | SYSTEM_ERROR | 系統錯誤 |

**核心函數**：

```typescript
// 記錄事件
const eventId = await logEvent({
  venueId: 'venue-001',
  circuitId: 'circuit-01',
  eventType: 'COMMAND_SENT',
  severity: 'INFO',
  environment: 'SIMULATION',
  title: '迴路 01 命令已發送',
  description: '目標狀態: ON',
  data: { targetState: 'ON', source: 'SCHEDULE' },
  correlationId: 'corr-001', // 關聯整條流程
})

// 查詢事件
const result = await queryEvents({
  venueId,
  startDate: new Date('2026-11-11'),
  endDate: new Date('2026-11-12'),
  eventTypes: ['COMMAND_SENT', 'COMMAND_ACKED'],
  severity: ['ERROR'],
  environment: 'SIMULATION',
  limit: 50,
  offset: 0,
})

// 取得統計
const stats = await getEventStats(venueId, hours = 24)
// 返回 { totalEvents, byType, errorCount, unsyncedCount }

// 追蹤預約完整時間線
const timeline = await getEventTimeline(reservationId)
// 返回事件序列（預約建立 → 排程 → 命令 → 設備回報 → 日誌同步）

// 批量同步待同步事件到 Neon
const synced = await syncPendingEventsToNeon(limit = 100)
```

**事件脫敏**：

敏感欄位自動移除：
- password / pin / credential
- token / secret / key
- mqttPassword / tlsKey

**幂等性**：

同一 `eventId` 僅記錄一次，重複調用返回既有記錄。

---

### 3. 日誌查詢 API (`src/app/api/admin/logs/route.ts`)

**端點**: `GET/POST /api/admin/logs`

#### GET — 查詢日誌

**查詢參數**：
```
GET /api/admin/logs?venueId=venue-001&eventType=COMMAND_SENT,COMMAND_ACKED&severity=ERROR&limit=50&offset=0
```

| 參數 | 類型 | 必填 | 說明 |
|-----|------|------|------|
| venueId | string | ✓ | 場館 ID |
| eventType | string | | 逗號分隔的事件類型 |
| severity | string | | 逗號分隔（INFO,WARNING,ERROR） |
| environment | string | | SIMULATION 或 PRODUCTION |
| startDate | string | | ISO 日期格式 |
| endDate | string | | ISO 日期格式 |
| circuitId | string | | 迴路 ID |
| commandId | string | | 命令 ID |
| reservationId | string | | 預約 ID |
| limit | number | | 每頁數量（預設 50，最多 500） |
| offset | number | | 分頁偏移（預設 0） |

**回應**：
```json
{
  "success": true,
  "data": [
    {
      "id": "event-001",
      "eventId": "uuid",
      "eventType": "COMMAND_SENT",
      "severity": "INFO",
      "environment": "SIMULATION",
      "title": "迴路 01 命令已發送",
      "description": "...",
      "circuit": { "circuitNumber": "01", "name": "球場 A 主燈" },
      "commandId": "cmd-001",
      "createdAt": "2026-11-11T12:34:56Z",
      "syncedToNeon": true
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1234,
    "hasMore": true
  }
}
```

#### POST — 特殊動作

**取得統計**：
```bash
curl -X POST /api/admin/logs \
  -H "Content-Type: application/json" \
  -d '{
    "venueId": "venue-001",
    "hours": 24,
    "action": "getStats"
  }'
```

**取得事件時間線**：
```bash
curl -X POST /api/admin/logs \
  -H "Content-Type: application/json" \
  -d '{
    "venueId": "venue-001",
    "reservationId": "res-001",
    "action": "getTimeline"
  }'
```

---

### 4. Watchdog 告警 API (`src/app/api/admin/watchdog/route.ts`)

**端點**: `GET/POST /api/admin/watchdog`

#### GET — 查詢告警

**查詢參數**：
```
GET /api/admin/watchdog?venueId=venue-001&status=OPEN&limit=20&action=summary
```

| 參數 | 說明 |
|-----|------|
| venueId | 場館 ID（必填） |
| status | OPEN / ACKNOWLEDGED / RESOLVED（預設 OPEN） |
| limit | 每頁數量（預設 20） |
| action | summary：取得摘要 / check：執行檢測 |

**回應（查詢列表）**：
```json
{
  "success": true,
  "data": [
    {
      "id": "alert-001",
      "alertType": "MQTT_DOWN",
      "severity": "ERROR",
      "title": "【ERROR】MQTT Broker - 場館 A",
      "description": "MQTT Broker 已斷線",
      "status": "OPEN",
      "detectionCount": 3,
      "createdAt": "2026-11-11T12:30:00Z",
      "acknowledgedAt": null,
      "resolvedAt": null
    }
  ]
}
```

**回應（摘要）**：
```json
{
  "success": true,
  "data": {
    "totalAlerts": 5,
    "openAlerts": 2,
    "highestSeverity": "ERROR",
    "recentAlerts": [
      { "title": "...", "severity": "ERROR", "status": "OPEN", ... }
    ]
  }
}
```

#### POST — 確認或解決告警

**確認告警**：
```bash
curl -X POST /api/admin/watchdog \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "alert-001",
    "action": "acknowledge",
    "note": "已知問題，待修復"
  }'
```

**解決告警**：
```bash
curl -X POST /api/admin/watchdog \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "alert-001",
    "action": "resolve",
    "note": "MQTT Broker 已重啟"
  }'
```

---

### 5. Watchdog Cron 任務 (`src/app/api/cron/watchdog/route.ts`)

**目的**：定期執行 Watchdog 檢測

**執行頻率**：
- 推薦每 30 秒一次：`*/0.5 * * * *`
- 或每分鐘一次：`* * * * *`

**端點**：`GET /api/cron/watchdog?secret=YOUR_CRON_SECRET`

**功能**：
1. 執行完整的 Watchdog 檢測（6 大項）
2. 同步待同步的事件到 Neon（最多 100 條）
3. 返回檢測摘要

**回應**：
```json
{
  "success": true,
  "message": "Watchdog 監控完成",
  "timestamp": "2026-11-11T12:35:00Z",
  "checks": {
    "total": 24,
    "healthy": 18,
    "degraded": 3,
    "offline": 2,
    "error": 1
  },
  "eventSync": {
    "synced": 42
  }
}
```

---

## 🧪 測試清單

### Watchdog 服務測試

- [ ] ✅ 檢測 MQTT 連接狀態
- [ ] ✅ 檢測設備心跳（5 分鐘判定離線）
- [ ] ✅ 檢測未確認命令
- [ ] ✅ 檢測排程執行狀態
- [ ] ✅ 檢測日誌同步狀態
- [ ] ✅ 自動生成告警（新問題）
- [ ] ✅ 自動更新告警（重複檢測）
- [ ] ✅ 自動關閉告警（問題已解決）

### 事件日誌服務測試

- [ ] ✅ 記錄各類型事件
- [ ] ✅ 幂等性（重複記錄返回相同 ID）
- [ ] ✅ 脫敏敏感資料
- [ ] ✅ 日誌查詢（按時間、類型、嚴重程度篩選）
- [ ] ✅ 事件統計
- [ ] ✅ 時間線追蹤（預約→命令→回報）
- [ ] ✅ 本地緩衝（Neon 不可用時）
- [ ] ✅ 批量同步到 Neon

### API 測試

#### 日誌查詢
```bash
# 查詢過去 24 小時的 ERROR 級別事件
curl -X GET "http://localhost:3000/api/admin/logs?venueId=venue-001&severity=ERROR&startDate=2026-11-10&endDate=2026-11-11&limit=50"

# 查詢特定預約的完整事件時間線
curl -X POST "http://localhost:3000/api/admin/logs" \
  -H "Content-Type: application/json" \
  -d '{"venueId":"venue-001","reservationId":"res-001","action":"getTimeline"}'
```

#### Watchdog 告警
```bash
# 查詢開啟的告警
curl -X GET "http://localhost:3000/api/admin/watchdog?venueId=venue-001&status=OPEN"

# 取得 Watchdog 摘要
curl -X GET "http://localhost:3000/api/admin/watchdog?venueId=venue-001&action=summary"

# 確認告警
curl -X POST "http://localhost:3000/api/admin/watchdog" \
  -H "Content-Type: application/json" \
  -d '{"alertId":"alert-001","action":"acknowledge","note":"已確認"}'
```

#### Watchdog Cron
```bash
curl -X GET "http://localhost:3000/api/cron/watchdog?secret=YOUR_CRON_SECRET"
```

---

## 📊 資料流圖

### 完整的控制流程

```
預約建立
    ↓ logEvent(RESERVATION_CREATED)
    ↓
後端排程
    ↓ logEvent(SCHEDULE_RECALCULATED)
    ↓
MQTT 命令下發
    ↓ logEvent(COMMAND_SENT)
    ↓
設備執行 & 回報
    ↓ logEvent(DEVICE_ONLINE / COMMAND_ACKED)
    ↓
事件寫入資料庫
    ├─ 本地 (Turso)
    └─ 雲端 (Neon) — 非同步同步
    ↓
Watchdog 監控
    ├─ 檢查命令確認
    ├─ 檢查設備心跳
    ├─ 檢查日誌同步
    └─ 生成告警（若有問題）
    ↓
管理員查詢
    ├─ /api/admin/logs — 事件時間線
    ├─ /api/admin/watchdog — 告警列表
    └─ /admin/logs — 管理頁面
```

---

## 🚀 立即使用

### 1. 運行 Watchdog Cron（在 vercel.json）

```json
{
  "crons": [
    {
      "path": "/api/cron/check-schedules",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/watchdog",
      "schedule": "*/0.5 * * * *"
    }
  ]
}
```

或本地測試：
```bash
curl -X GET "http://localhost:3000/api/cron/watchdog?secret=test-secret"
```

### 2. 在 /admin 首頁顯示 Watchdog 摘要

API 已就位，可在現有的 `/admin` 頁面整合：

```typescript
import { getWatchdogSummary } from '@/server/watchdog-service'

const watchdog = await getWatchdogSummary(venueId)
// 返回 { totalAlerts, openAlerts, highestSeverity, recentAlerts[] }
```

### 3. 查詢日誌

```bash
# 最近 100 個事件
curl -X GET "http://localhost:3000/api/admin/logs?venueId=venue-001&limit=100"

# 過去 24 小時的 ERROR
curl -X GET "http://localhost:3000/api/admin/logs?venueId=venue-001&severity=ERROR&startDate=2026-11-10"
```

---

## 📝 Neon PostgreSQL 集成提示

當提供 Neon 連接字符串時：

```bash
# .env.local
NEON_DATABASE_URL="postgresql://user:password@ep-xyz.aws-region.neon.tech/dbname"
```

日誌將：
1. 優先寫入本地 Turso（快速）
2. 標記 `syncedToNeon: false`
3. 非同步上傳到 Neon（背景任務）
4. 完成後標記 `syncedToNeon: true`

即使 Neon 暫時不可用，本地日誌仍正常運作。

---

## ⚠️ 已知限制

- ⏱️ Watchdog 檢測頻率受限於 Cron 調度（最少 30 秒）
- 🔌 Neon 同步需要在環境變量中提供連接字符串
- 📊 統計函數依賴於事件時間戳的精確性

---

## 📚 整體架構回顧

### 第一階段（已完成）
✅ 數據模型 & 配置框架

### 第二階段（已完成）
✅ 排程計算 & MQTT 服務 & 人工控制 API

### 第三階段（已完成）
✅ Watchdog 監控 & 事件日誌 & 日誌查詢 API

---

## 🎯 下一步（第四階段）

### 管理 UI 頁面
- [ ] 擴充 `/admin` 首頁摘要（Watchdog 告警卡片）
- [ ] 完善 `/admin/control` 頁面（18 路表格優化）
- [ ] 新增 `/admin/logs` 日誌檢視頁面
- [ ] Watchdog 告警管理界面

### 預期時間
- 第四階段：2-3 天

---

*報告完成時間: 2026-11-11*
*實施者: Claude Haiku 4.5*
*下一階段: 管理 UI 與首頁摘要（第四階段）*
