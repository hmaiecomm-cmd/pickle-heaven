# 無人化電力控制系統 — 完整實施指南

**適用對象**: 開發者 / 系統管理員 / 場館管理者  
**更新時間**: 2026-11-11  
**系統狀態**: 生產就緒

---

## 📋 目錄

1. [快速啟動（5 分鐘）](#快速啟動5-分鐘)
2. [模擬環境測試（30 分鐘）](#模擬環境測試30-分鐘)
3. [真實環境配置](#真實環境配置)
4. [驗收清單](#驗收清單)
5. [故障排除](#故障排除)
6. [進階配置](#進階配置)

---

## 🚀 快速啟動（5 分鐘）

### 前置條件
- Node.js 20+
- npm 或 pnpm
- 已建立的場館（至少一個）

### 1. 同步數據庫

```bash
cd "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台"

# 生成遷移
npm run db:generate

# 初始化 Turso
npm run db:turso:init

# 推送數據庫
npx prisma db push
```

**預期輸出**:
```
✓ 已建立 Circuit 表
✓ 已建立 ControlCommand 表
✓ 已建立 OperatingHours 表
✓ 已建立 DeviceAdapter 表
✓ 已建立 ControlEvent 表
✓ 已建立 WatchdogAlert 表
```

### 2. 初始化 18 路回路

```bash
npm run db:seed
```

**預期輸出**:
```
🌱 開始初始化電力控制系統...
✓ 使用場館: [你的場館名稱]
📍 初始化 18 路回路...
✓ 迴路 01: 球場 A 主燈 (RESERVATION_DYNAMIC)
... (共 18 路)
⏰ 初始化營業時間與夜間排程...
✓ 營業時間: 08:00-22:00
✓ 夜間時段: 18:00-22:00
🔧 初始化設備適配器...
✓ 設備適配器: Simulation Relay (Mock ADAM-4019)
✨ 電力控制系統初始化完成！
```

### 3. 設定環境變數

編輯 `.env.local`:

```bash
# 電力控制相關
CONTROL_ENVIRONMENT="simulation"
CRON_SECRET="my-local-test-secret-123"

# 如果有 Neon：
# NEON_DATABASE_URL="postgresql://..."
```

### 4. 啟動開發服務器

```bash
npm run dev
```

**預期**: 服務器運行在 http://localhost:3000

### 5. 驗證安裝

訪問以下 URL：

```
http://localhost:3000/admin                    # 首頁（應看到摘要卡片）
http://localhost:3000/admin/control            # 電力控制（應看到 18 路）
http://localhost:3000/admin/logs               # 日誌檢視
http://localhost:3000/admin/watchdog           # Watchdog 監控
```

✅ **快速啟動完成！**

---

## 🧪 模擬環境測試（30 分鐘）

### 測試 1：排程控制

#### 步驟 1.1 — 建立預約

1. 訪問 http://localhost:3000
2. 預約「今天 14:00-15:00 的球場 A」
3. 完成支付

#### 步驟 1.2 — 觸發排程檢查

```bash
curl -X GET "http://localhost:3000/api/cron/check-schedules?secret=my-local-test-secret-123"
```

**預期回應**:
```json
{
  "success": true,
  "message": "排程檢查完成",
  "timestamp": "2026-11-11T14:00:00Z",
  "mqttStatus": "ONLINE"
}
```

#### 步驟 1.3 — 驗證迴路狀態

訪問 http://localhost:3000/admin/logs，搜尋：
- eventType: COMMAND_SENT
- 應看到迴路 01、02 的命令

✅ **排程控制測試完成**

---

### 測試 2：人工控制命令

#### 步驟 2.1 — 發送 ON 命令

```bash
curl -X POST "http://localhost:3000/api/admin/control/command" \
  -H "Content-Type: application/json" \
  -d '{
    "circuitNumber": "05",
    "targetState": "ON",
    "reason": "測試開啟"
  }'
```

**預期回應**:
```json
{
  "success": true,
  "commandId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "迴路 05 已發送開啟命令",
  "timestamp": "2026-11-11T14:05:00Z"
}
```

#### 步驟 2.2 — 驗證命令記錄

訪問 http://localhost:3000/admin/logs，篩選 eventType = COMMAND_SENT，應看到新增的命令。

✅ **人工控制測試完成**

---

### 測試 3：Watchdog 監控

#### 步驟 3.1 — 執行檢測

```bash
curl -X GET "http://localhost:3000/api/cron/watchdog?secret=my-local-test-secret-123"
```

**預期回應**:
```json
{
  "success": true,
  "message": "Watchdog 監控完成",
  "timestamp": "2026-11-11T14:10:00Z",
  "checks": {
    "total": 24,
    "healthy": 20,
    "degraded": 2,
    "offline": 1,
    "error": 1
  },
  "eventSync": {
    "synced": 15
  }
}
```

#### 步驟 3.2 — 查看告警

訪問 http://localhost:3000/admin/watchdog，應看到告警列表。

✅ **Watchdog 監控測試完成**

---

### 測試 4：日誌查詢

#### 步驟 4.1 — 基本查詢

```bash
curl "http://localhost:3000/api/admin/logs?venueId=venue-001&limit=10"
```

#### 步驟 4.2 — 複雜篩選

```bash
curl "http://localhost:3000/api/admin/logs?venueId=venue-001&severity=ERROR&eventType=COMMAND_SENT,COMMAND_ACKED"
```

#### 步驟 4.3 — 時間線追蹤

訪問 http://localhost:3000/admin/logs，選擇預約 ID，應看到從建立到執行的完整事件序列。

✅ **日誌查詢測試完成**

---

## 🔧 真實環境配置

### 前提條件

在配置真實環境前，需要取得以下信息：

#### 1. AR-721 門禁控制器（可選，門禁系統用）
- [ ] 設備型號與 firmware 版本
- [ ] MAC ID
- [ ] RS-485 通訊參數（鮑率、資料位元、停止位元）

#### 2. MQTT Broker
- [ ] Broker URL / IP
- [ ] Port（通常 1883 或 8883 TLS）
- [ ] 使用者名稱 / 密碼
- [ ] TLS 證書（若使用 8883）
- [ ] Topic ACL 設定

#### 3. 研華 Relay（實際硬體）
- [ ] 設備型號
- [ ] MAC ID
- [ ] 實際 MQTT topic 格式
- [ ] ON / OFF 值對應

#### 4. 雲端數據庫（Neon PostgreSQL）
- [ ] Neon 連接字符串

### 環境變數設置

編輯 `.env.production`（或部署環境）：

```bash
# ─── 資料庫 ───
TURSO_DATABASE_URL="libsql://..."
TURSO_AUTH_TOKEN="..."
NEON_DATABASE_URL="postgresql://user:pass@host/db"

# ─── 應用程式 ───
NEXT_PUBLIC_APP_URL="https://your-domain.com"
SESSION_SECRET="long-random-secret-string"

# ─── 電力控制 ───
CONTROL_ENVIRONMENT="production"
MQTT_BROKER_URL="mqtt.your-domain.com"
MQTT_BROKER_PORT="8883"
MQTT_USE_TLS="true"
MQTT_USERNAME="control-user"
MQTT_PASSWORD="secure-password"
MQTT_TLS_CERT_PATH="/path/to/cert.pem"
MQTT_TLS_KEY_PATH="/path/to/key.pem"
MQTT_TLS_CA_PATH="/path/to/ca.pem"

# ─── Cron 任務 ───
CRON_SECRET="production-cron-secret"
WATCHDOG_HEARTBEAT_TIMEOUT="30"
WATCHDOG_ALERT_THRESHOLD="3"

# ─── 設備配置 ───
DEVICE_ADAPTER_CONFIG="{...}" # 或讀取文件
```

### 設備適配器配置

在資料庫中新增真實設備適配器：

```sql
INSERT INTO DeviceAdapter (
  venueId, name, deviceType, macId,
  mqttBrokerUrl, mqttPort, mqttUseTls, mqttUsername, mqttPassword,
  mqttTopicPrefix, totalChannels, mqttControlTopic, mqttStatusTopic,
  enabled, connectionStatus
) VALUES (
  'venue-001',
  'Relay-001 (ADAM-4019)',
  'ADVANTECH_ADAM_4019',
  '00:0E:4C:12:34:56',
  'mqtt.your-domain.com',
  8883,
  true,
  'control-user',
  'secure-password',
  'Advantech/00-0E-4C-12-34-56',
  18,
  'Advantech/{MAC_ID}/ctl/do{channel}',
  'Advantech/{MAC_ID}/data',
  true,
  'UNKNOWN'
);
```

### 迴路設備映射

更新 Circuit 表中的 deviceMapping：

```json
{
  "deviceMacId": "00:0E:4C:12:34:56",
  "channel": 1,
  "onValue": 1,
  "offValue": 0
}
```

---

## ✅ 驗收清單

### 數據庫驗收

- [ ] ✓ 所有新表已建立
- [ ] ✓ 18 路回路已初始化
- [ ] ✓ 營業時間與夜間排程已設置
- [ ] ✓ 設備適配器已配置
- [ ] ✓ 所有索引已建立

### 後端 API 驗收

- [ ] ✓ `/api/cron/check-schedules` 可正常調用
- [ ] ✓ `/api/cron/watchdog` 可正常調用
- [ ] ✓ `/api/admin/control/command` 可正常發送命令
- [ ] ✓ `/api/admin/logs` 可查詢事件
- [ ] ✓ `/api/admin/watchdog` 可管理告警

### 管理頁面驗收

- [ ] ✓ `/admin` 首頁有控制系統摘要卡片
- [ ] ✓ `/admin/logs` 可查詢、篩選、匯出日誌
- [ ] ✓ `/admin/watchdog` 可查看告警和執行檢測
- [ ] ✓ `/admin/control` 顯示 18 路狀態

### 功能驗收

- [ ] ✓ 預約建立時自動生成排程
- [ ] ✓ 營業時間控制迴路 05-09
- [ ] ✓ 夜間時段控制迴路 10-11
- [ ] ✓ 人工命令正常發送
- [ ] ✓ MQTT 連接正常
- [ ] ✓ 設備狀態回報正常
- [ ] ✓ Watchdog 告警生成正常
- [ ] ✓ 事件日誌記錄正常

### 安全驗收

- [ ] ✓ 敏感資訊已脫敏（日誌）
- [ ] ✓ MQTT 密碼未存於代碼
- [ ] ✓ TLS 證書正確配置
- [ ] ✓ 權限檢查完整
- [ ] ✓ 稽核日誌完整

### 效能驗收

- [ ] ✓ 排程檢查 < 5 秒
- [ ] ✓ 日誌查詢 < 1 秒（50 條）
- [ ] ✓ Watchdog 檢測 < 10 秒
- [ ] ✓ 並發命令（10+）正常處理

---

## 🔍 故障排除

### 問題 1：18 路未初始化

**症狀**: 訪問 `/admin/control` 看不到迴路

**解決**:
```bash
npm run db:seed
# 或檢查 npm log 輸出
```

### 問題 2：MQTT 連接失敗

**症狀**: 首頁顯示「MQTT Broker 離線」

**檢查**:
```bash
# 驗證 Broker 可達性
telnet mqtt.your-domain.com 1883

# 檢查 MQTT 連接日誌
curl "http://localhost:3000/api/admin/logs?venueId=venue-001&eventType=MQTT_CONNECTED,MQTT_DISCONNECTED"
```

### 問題 3：命令未執行

**症狀**: 發送命令後迴路狀態未變化

**檢查清單**:
1. MQTT 連接狀態是否為 ONLINE？
2. 設備適配器是否啟用？
3. 迴路是否被啟用且允許遠端控制？
4. deviceMapping 是否正確配置？
5. Relay 是否在線？

### 問題 4：Watchdog 告警累積

**症狀**: 告警數量不斷增加

**解決**:
1. 確認問題根源（MQTT、設備、日誌等）
2. 修復根本問題
3. 訪問 `/admin/watchdog` 手動確認告警
4. 執行 Watchdog 檢測刷新狀態

### 問題 5：日誌未同步到 Neon

**症狀**: 日誌 `syncedToNeon` 始終為 false

**檢查**:
```bash
# 確認 NEON_DATABASE_URL 已設置
echo $NEON_DATABASE_URL

# 測試連接
curl -s -I $NEON_DATABASE_URL
```

---

## 🎯 進階配置

### 自訂營業時間

在 `/admin/control` 或直接更新資料庫：

```sql
UPDATE OperatingHours
SET businessStartMinute = 900,    -- 15:00
    businessEndMinute = 1500,     -- 25:00 (跨日)
    nightStartMinute = 1200,      -- 20:00
    nightEndMinute = 600          -- 隔日 10:00
WHERE venueId = 'venue-001';
```

### 自訂預約提前開啟 / 延遲關閉

```sql
UPDATE Circuit
SET reservationAdvanceMinutes = 15,  -- 提前 15 分鐘開啟
    reservationDelayMinutes = 10     -- 延遲 10 分鐘關閉
WHERE circuitNumber IN ('01', '02', '03', '04');
```

### 禁用特定迴路

```sql
UPDATE Circuit
SET enabled = false
WHERE circuitNumber IN ('17', '18');  -- 禁用預留迴路
```

### 設定 Watchdog 檢測頻率

編輯 `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/watchdog",
      "schedule": "*/0.5 * * * *"  // 每 30 秒
    }
  ]
}
```

或本地測試：
```bash
# 每 30 秒手動執行
while true; do
  curl "http://localhost:3000/api/cron/watchdog?secret=..."
  sleep 30
done
```

---

## 📊 監控指標

### 關鍵指標

定期檢查：

```bash
# 1. 系統健康度
curl "http://localhost:3000/api/admin/watchdog?venueId=venue-001&action=summary"

# 2. 事件統計
curl "http://localhost:3000/api/admin/logs" -X POST -d '{"venueId":"venue-001","action":"getStats"}'

# 3. 待同步事件
curl "http://localhost:3000/api/admin/logs?venueId=venue-001&limit=1" | jq '.data[0].syncedToNeon'
```

### SLA 目標

- MQTT 連接正常率：> 99.5%
- 命令確認時間：< 5 秒
- 日誌同步延遲：< 1 分鐘
- Watchdog 告警響應：< 2 分鐘

---

## 🚀 部署檢查清單

### 部署前

- [ ] 所有環境變數已設置
- [ ] TLS 證書已安裝
- [ ] MQTT Broker 已配置
- [ ] Neon 連接已測試
- [ ] 數據庫遷移已執行
- [ ] 18 路已初始化

### 部署後

- [ ] 連接性測試（MQTT、Neon、Broker）
- [ ] 完整的功能測試（排程、命令、日誌）
- [ ] 性能基準測試
- [ ] 監控與告警已啟用
- [ ] 備份與災復計畫已準備

---

*指南完成於 2026-11-11*
*適用版本: Phase 1-4 Complete*
*下一步: 真實環境配置 / 門禁系統 / 性能優化*
