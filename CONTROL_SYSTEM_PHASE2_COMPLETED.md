# 無人化電力控制系統 — 第二階段實施完成報告

**狀態**: ✅ 完成（基於模擬環境，不依賴真實設備參數）

**實施時間**: 2026-11-11

---

## 📋 第二階段交付內容

### 1. 後端排程服務 (`src/server/scheduling-service.ts`)

**責務**:
- 監聽預約事件，計算受影響球場的排程
- 合併連續或重疊預約，避免誤關設備
- 生成 ControlCommand（待 MQTT 發送）
- 管理營業時間與夜間情境的排程

**核心函數**:

#### `calculateCircuitStates(venueId, atTime)`
根據指定時間計算所有迴路應有的預期狀態。

邏輯順序：
1. 預約動態控制（01-04）— 檢查是否有有效預約
2. 營業時間控制（05-09）— 檢查場館營業時段
3. 夜間情境（10-11）— 檢查夜間排程時段
4. 常時開啟（12-16）— 保持關閉（由硬體供電）
5. 預留迴路（17-18）— 保持關閉（停用）

```typescript
// 使用例
const states = await calculateCircuitStates(venueId, new Date())
// 輸出：{ "01": "ON", "02": "ON", "05": "OFF", ... }
```

#### `recalculateReservationSchedule(reservationId)`
在預約建立、確認、取消或改期時重新計算排程。

流程：
1. 查詢受影響的球場
2. 找出該時段的所有有效預約
3. 合併連續或重疊預約
4. 為每個時段生成控制命令

#### `sendCircuitCommand(venueId, circuits, targetState, source, reservationId?)`
生成 ControlCommand 記錄並記錄事件。

- 自動設定命令有效期限為 5 分鐘
- 所有命令在模擬環境中標記為 `simulated: true`
- 建立 ControlEvent 記錄以供審計

#### `checkAndUpdateSchedules()`
Cron 任務：每分鐘檢測排程狀態變化。

適用於 Vercel Cron 或類似的任務調度器。

**輔助函數**:
- `mergeReservationSlots()` — 合併時間重疊的預約
- `getCircuitsForCourt()` — 根據球場編號取得對應迴路
- `isWithinTimeRange()` — 檢查時間是否在指定範圍內
- `getMinuteOfDay()` — 計算當日分鐘數

---

### 2. MQTT 服務 (`src/server/mqtt-service.ts`)

**責務**:
- 與 MQTT Broker 的連接與通訊
- 發佈控制命令（真實或模擬）
- 訂閱設備狀態回報
- 心跳檢測與 Watchdog 整合
- 模擬環境支援

**核心實現**:

#### Mock MQTT Broker（模擬環境）
- 內存中模擬 Broker 行為
- 模擬 100ms 延遲的設備回報
- 記錄所有已發佈的消息
- 支援訂閱與發佈的完整生命週期

```typescript
// 初始化（自動選擇真實或模擬）
await initializeMqtt()

// 發佈命令
await publishCircuitCommand(
  commandId,
  deviceMacId,
  channel,
  value,
  topicTemplate,
)

// 訂閱狀態
await subscribeToDeviceStatus(deviceMacId, topicPrefix, onMessage)

// 取得狀態
getMqttStatus()  // 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR'
```

#### 模擬環境特性
- ✓ 不依賴真實 MQTT Broker
- ✓ 100ms 模擬設備回報延遲
- ✓ 自動狀態變化通知
- ✓ 完整的消息日誌（便於測試）

#### 真實環境預留
```typescript
if (environment === 'simulation' || !brokerUrl) {
  // 使用 Mock Broker
} else {
  // 真實 Broker（待實施）
  // 需要 mqtt 庫：npm install mqtt
}
```

**消息格式**（遵循研華 ADAM 協議）：

控制命令：
```json
{
  "command_id": "uuid",
  "v": 1,
  "timestamp": "2026-11-11T..."
}
```

狀態回報：
```json
{
  "v": 1,
  "timestamp": "2026-11-11T..."
}
```

---

### 3. 資料庫種子腳本 (`prisma/seed-control-system.ts`)

**目的**: 初始化 18 路回路、營業時間、設備適配器

**執行**:
```bash
# 方式 1：npm run db:seed
npm run db:seed

# 方式 2：直接執行
tsx prisma/seed-control-system.ts
```

**初始化內容**:

#### 18 路回路定義
- ✓ 自動建立所有迴路
- ✓ 使用 CIRCUIT_DEFINITIONS 的預設設定
- ✓ 自動映射到模擬 Relay 通道
- ✓ 設定啟用狀態與權限

#### 營業時間與夜間排程
- ✓ 營業時間：08:00-22:00（可自訂）
- ✓ 夜間時段：18:00-22:00（可自訂）
- ✓ 每日適用所有星期

#### 模擬設備適配器
- ✓ 設備型號：Advantech ADAM-4019 (Mock)
- ✓ Mock MAC ID：00:01:02:03:04:05
- ✓ 18 個輸出通道
- ✓ 完整的 MQTT 配置

**輸出示例**：
```
✓ 迴路 01: 球場 A 主燈 (RESERVATION_DYNAMIC)
✓ 迴路 02: 球場 A 涼風扇 (RESERVATION_DYNAMIC)
...
✓ 迴路 18: 預留迴路 2 【停用】
✓ 營業時間: 08:00-22:00
✓ 夜間時段: 18:00-22:00
✓ 設備適配器: Simulation Relay (Mock ADAM-4019)
```

---

### 4. Cron API 路由 (`src/app/api/cron/check-schedules/route.ts`)

**目的**: 定期檢查排程狀態變化

**端點**: `GET /api/cron/check-schedules?secret=YOUR_CRON_SECRET`

**整合方式**:

#### Vercel Cron 設定（vercel.json）
```json
{
  "crons": [{
    "path": "/api/cron/check-schedules",
    "schedule": "* * * * *"
  }]
}
```

#### 手動測試
```bash
curl -X GET "http://localhost:3000/api/cron/check-schedules?secret=YOUR_CRON_SECRET"
```

**功能**:
- ✓ 驗證 Cron secret（防止未授權呼叫）
- ✓ 執行 `checkAndUpdateSchedules()`（更新排程）
- ✓ 執行 `checkMqttHeartbeat()`（監測 MQTT）
- ✓ 最長執行時間 60 秒
- ✓ 返回 JSON 結果與時間戳

**回應示例**：
```json
{
  "success": true,
  "message": "排程檢查完成",
  "timestamp": "2026-11-11T12:34:56Z",
  "mqttStatus": "ONLINE"
}
```

---

### 5. 管理員 API 路由 (`src/app/api/admin/control/command/route.ts`)

**目的**: 允許授權管理員發送人工控制命令

**端點**: 
- `POST /api/admin/control/command` — 發送命令
- `GET /api/admin/control/command` — 查詢歷史

#### POST：發送命令

**請求**：
```json
{
  "circuitNumber": "01",
  "targetState": "ON",
  "reason": "手動測試"
}
```

**驗證**：
- ✓ 管理員權限檢查
- ✓ 迴路存在性檢查
- ✓ 迴路啟用狀態檢查
- ✓ 遠端控制權限檢查
- ✓ 狀態值有效性檢查

**流程**：
1. 驗證所有輸入
2. 查詢迴路與相關設備
3. 建立 ControlCommand（5 分鐘有效期）
4. 發佈到 MQTT（如果設備可用）
5. 記錄 ControlEvent（審計）

**回應**：
```json
{
  "success": true,
  "commandId": "uuid",
  "message": "迴路 01 已發送開啟命令",
  "timestamp": "2026-11-11T12:34:56Z"
}
```

#### GET：查詢歷史

**參數**: `?limit=20`（預設 20 條）

**回應**：
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "commandId": "...",
      "circuit": "球場 A 主燈",
      "targetState": "ON",
      "status": "SENT",
      "requestedBy": "admin",
      "createdAt": "2026-11-11T12:34:56Z"
    }
  ]
}
```

---

## 🧪 測試清單

### 排程服務測試

- [ ] 建立預約後，迴路 01、02 應該在預約時段內 ON
- [ ] 取消預約後，迴路應該在無後續預約時 OFF
- [ ] 合併連續預約，不應在預約交界誤關設備
- [ ] 營業時間控制（05-09）應在 08:00-22:00 ON
- [ ] 夜間情境（10-11）應在 18:00-22:00 ON
- [ ] 迴路 12-16 應保持 OFF（24 小時供電不由排程控制）

### MQTT 服務測試

- [ ] 初始化成功，返回 ONLINE 狀態
- [ ] 發佈命令，MQTT 記錄正確
- [ ] 模擬設備在 100ms 後回報狀態
- [ ] 訂閱狀態，收到設備回報通知
- [ ] ControlCommand 狀態更新為 SENT / ACKED

### API 測試

#### Cron API
```bash
curl -X GET "http://localhost:3000/api/cron/check-schedules?secret=test-secret"
```

#### 控制命令 API
```bash
# 發送命令
curl -X POST "http://localhost:3000/api/admin/control/command" \
  -H "Content-Type: application/json" \
  -d '{
    "circuitNumber": "01",
    "targetState": "ON",
    "reason": "測試"
  }'

# 查詢歷史
curl -X GET "http://localhost:3000/api/admin/control/command?limit=10"
```

---

## 📊 資料庫變化

### 新增／修改的表

| 表名 | 用途 | 狀態 |
|-----|------|------|
| Circuit | 18 路回路定義 | ✓ 建立 + 種子資料 |
| ControlCommand | MQTT 命令追蹤 | ✓ 建立 |
| OperatingHours | 營業時間排程 | ✓ 建立 + 種子資料 |
| DeviceAdapter | 設備配置 | ✓ 建立 + 模擬設備 |
| ControlEvent | 控制事件日誌 | ✓ 建立 |
| WatchdogAlert | 監控告警 | ✓ 建立 |

### 新增關係

- Venue ↔ Circuit（1:N）
- Venue ↔ OperatingHours（1:1）
- Venue ↔ DeviceAdapter（1:N）
- Venue ↔ ControlEvent（1:N）
- Venue ↔ WatchdogAlert（1:N）
- Reservation ↔ ControlCommand（1:N）
- Circuit ↔ ControlCommand（1:N）
- Circuit ↔ ControlEvent（1:N）

---

## 🚀 立即執行步驟

### 1. 同步數據庫（如未執行）

```bash
npm run db:generate
npm run db:turso:init    # Turso
npx prisma db push      # 所有平台
```

### 2. 初始化 18 路回路

```bash
npm run db:seed
# 或
tsx prisma/seed-control-system.ts
```

### 3. 設定環境變數

```bash
# .env.local（開發環境）
CRON_SECRET="test-secret-for-development"
CONTROL_ENVIRONMENT="simulation"
```

### 4. 啟動開發服務器

```bash
npm run dev
```

### 5. 測試 Cron API

```bash
curl -X GET "http://localhost:3000/api/cron/check-schedules?secret=test-secret-for-development"
```

### 6. 測試控制命令 API

```bash
curl -X POST "http://localhost:3000/api/admin/control/command" \
  -H "Content-Type: application/json" \
  -d '{
    "circuitNumber": "01",
    "targetState": "ON",
    "reason": "測試"
  }'
```

---

## ⚠️ 當前限制與已知事項

### 限制條件

- ✋ 所有命令在模擬環境中標記為 `simulated: true`
- ⏱️ MQTT 模擬延遲固定為 100ms
- 🔌 真實 MQTT Broker 連接尚未實施（需真實設備參數）
- 📡 RS-485 通訊尚未實施（需 Raspberry Pi 與控制器規格）
- 🔐 TLS/mTLS 憑證尚未實施

### 模擬環境預留

模擬設備配置已在 `src/lib/device-config.ts` 中預定義：

```typescript
export const SIMULATION_DEVICE_CONFIG = {
  id: 'sim-relay-001',
  name: 'Simulation Relay (Mock ADAM-4019)',
  deviceType: 'ADVANTECH_ADAM_4019_MOCK',
  macId: '00:01:02:03:04:05', // Mock MAC ID
  // ...
}
```

當真實設備參數提供時，可建立 production 設備配置並切換。

---

## 📚 下一步工作 (第三階段)

### Watchdog 與日誌系統

1. **Watchdog 服務** (`watchdog-service.ts`)
   - 監測地端心跳
   - 監測 MQTT 連接
   - 監測命令確認
   - 狀態一致性檢查

2. **事件日誌服務** (`event-logger.ts`)
   - 本地緩衝（若 Neon 不可用）
   - 非同步上傳到 Neon
   - 幂等性保證
   - 日誌查詢 API

3. **日誌檢視頁面** (`/admin/logs`)
   - 時間範圍篩選
   - 事件類型篩選
   - 嚴重程度篩選
   - CSV 匯出

---

## 📞 技術參考

### 時間處理
- 所有業務邏輯使用 `Asia/Taipei` 時區
- 數據庫存儲 UTC
- 分鐘計算基於 00:00 為 0，23:59 為 1439

### 幂等性
- CommandId（UUID）用於命令去重
- EventId（UUID）用於事件去重
- 相同 ID 的重複操作返回相同結果

### 命令有效期
- 預設 5 分鐘（可在 `sendCircuitCommand` 中調整）
- 過期命令不得被 Relay 在重新連線後執行
- 每條命令都有明確的 `expiresAt` 時間戳

### 環境隔離
- `CONTROL_ENVIRONMENT` 環境變數控制模擬或真實
- 所有模擬事件標記為 `environment: SIMULATION`
- 查詢時可按環境過濾

---

*報告完成時間: 2026-11-11*
*實施者: Claude Haiku 4.5*
*下一階段: Watchdog 與日誌系統（第三階段）*
