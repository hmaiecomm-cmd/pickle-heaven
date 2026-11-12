# 無人化電力控制系統 — 第一階段實施完成報告

## 📋 實施概要

第一階段已完成顧好平台的電力控制系統數據模型、配置框架與類型系統的建立。該階段為後續的 MQTT 服務、排程引擎、Watchdog 監控與日誌系統奠定基礎。

**實施時間**: 2026-11-11

---

## ✅ 第一階段交付內容

### 1. Prisma 數據模型 (`prisma/schema.prisma`)

#### 新增枚舉
- **ControlCategory**: 回路控制分類 (RESERVATION_DYNAMIC / OPERATING_HOURS / NIGHT_AMBIENT / ALWAYS_ON / RESERVED)
- **CommandStatus**: MQTT 命令狀態 (PENDING / SENT / ACKED / FAILED / TIMEOUT / EXPIRED)
- **ControlEventType**: 控制事件類別 (20 種事件類型)
- **WatchdogAlertSeverity**: 監控告警嚴重程度 (HEALTHY / DEGRADED / OFFLINE / ERROR)
- **EventEnvironment**: 環境標記 (SIMULATION / PRODUCTION)

#### 新增模型

##### Circuit（18 路回路）
```
- circuitNumber: 01-18
- name, description: 回路名稱與說明
- category: ControlCategory（控制分類）
- enabled: 啟用狀態
- remoteControlEnabled / scheduleControlEnabled: 權限控制
- deviceMapping: JSON（設備 MAC ID、通道、ON/OFF 值映射）
- reservationAdvanceMinutes / reservationDelayMinutes: 預約控制的提前開啟／延遲關閉
- expectedState / actualState: 預期狀態 vs. 實際設備回報狀態
- lastStateChange / lastDeviceReport: 最後狀態更新時間
- lastCommandStatus / lastCommandAt / lastCommandError: 最後命令結果
```

##### ControlCommand（MQTT 命令追蹤）
```
- commandId: 跨日誌唯一識別
- circuitId: 所屬迴路
- source: 命令來源 (SCHEDULE / MANUAL_OVERRIDE / EMERGENCY)
- targetState: 目標狀態 (ON / OFF)
- status: CommandStatus（命令執行狀態）
- scheduleId / reservationId / requestedBy: 上下文關聯
- mqttTopic / mqttPayload: MQTT 細節
- sentAt / ackedAt: 發送與確認時間
- error: 失敗原因
- expiresAt: 命令有效期限（過期後離線復出不執行）
- simulated: 是否為模擬命令
```

##### OperatingHours（營業時間與夜間排程）
```
- businessStartMinute / businessEndMinute: 營業時間 (預設 08:00-22:00)
- nightStartMinute / nightEndMinute: 夜間時段 (預設 18:00-22:00)
- disabledDates: 禁用日期清單 (YYYY-MM-DD，逗號分隔)
- applicableWeekdays: 適用星期 (0-6，逗號分隔；空 = 每日)
```

##### DeviceAdapter（設備配置）
```
- name / deviceType / macId: 設備識別與型號
- mqtt: Broker URL、port、TLS、認證
- mqttTopicPrefix / mqttControlTopic / mqttStatusTopic: MQTT 細節
- totalChannels: 設備輸出通道數
- deviceStateMapping: 設備狀態值映射 (JSON)
- connectionStatus / lastHeartbeat: 連線狀態與心跳
- tlsCertReference: TLS 憑證參考（不直接存密鑰）
- enabled: 啟用狀態
```

##### ControlEvent（控制事件日誌）
```
- eventId: 跨系統唯一識別
- venueId / circuitId / commandId / reservationId / userId: 多層級關聯
- eventType: ControlEventType（20 種事件類別）
- severity / environment: 嚴重程度與環境標記
- title / description / data: 可讀說明與結構化資料
- correlationId: 關聯整條執行鏈的 ID
- syncedToNeon / syncedAt: 雲端日誌同步狀態
```

##### WatchdogAlert（監控告警）
```
- alertType: 告警類型 (HEARTBEAT_LOST / MQTT_DOWN / RELAY_OFFLINE / COMMAND_TIMEOUT / STATUS_MISMATCH / SCHEDULE_FAILED / SYNC_FAILED)
- severity: WatchdogAlertSeverity
- component / componentId: 受影響元件
- detectionSource / detectionCount: 檢測來源與次數
- expectedValue / actualValue: 預期 vs. 實際值
- status: OPEN / ACKNOWLEDGED / RESOLVED
- acknowledgedBy / resolvedBy: 操作人員與時間
```

#### 關係延伸
- **Venue** 延伸: circuits, operatingHours, deviceAdapters, controlEvents, watchdogAlerts
- **Reservation** 延伸: commands, events

---

### 2. 類型定義與常數 (`src/lib/control-types.ts`)

- **CircuitNumber 型別**: 01-18 的聯合型別
- **CIRCUIT_DEFINITIONS**: 18 路回路的預設名稱、分類、權限設定及說明
- 命令狀態、事件類型、Watchdog 嚴重程度的完整枚舉
- **DeviceMapping / MqttConfig / ControlCommand / ControlEvent / WatchdogAlert** 介面定義
- **DEFAULT_CIRCUIT_CONFIG**: 預設配置 (預約提前／延遲、營業時間、夜間時段)

---

### 3. 設備配置與適配器 (`src/lib/device-config.ts`)

- **DeviceAdapterConfig 介面**: 統一的設備配置結構
- **SIMULATION_DEVICE_CONFIG**: 模擬環境的預設 mock Relay 配置
  - 型號: ADVANTECH_ADAM_4019_MOCK
  - Mock MAC ID: 00:01:02:03:04:05
  - MQTT topic 前綴、控制模板、狀態解析規則
- **SIMULATION_CIRCUIT_TO_RELAY_MAPPING**: 18 路到 mock relay 通道的映射 (01-18 分別映射到通道 1-18)
- **buildMqttTopic()**: 動態構建 MQTT topic 字符串
- **validateDeviceConfig()**: 驗證配置完整性的工具函數

---

### 4. 環境變數範本 (`.env.example`)

新增電力控制相關環境變數：

```env
# MQTT Broker 連接
MQTT_BROKER_URL=""
MQTT_BROKER_PORT="1883"
MQTT_USE_TLS="false"
MQTT_USERNAME=""
MQTT_PASSWORD=""

# 雲端日誌數據庫 (Neon PostgreSQL)
NEON_DATABASE_URL=""

# Watchdog 監控參數
WATCHDOG_HEARTBEAT_TIMEOUT="30"
WATCHDOG_ALERT_THRESHOLD="3"

# 環境模式
CONTROL_ENVIRONMENT="simulation"

# TLS 憑證路徑
MQTT_TLS_CERT_PATH=""
MQTT_TLS_KEY_PATH=""
MQTT_TLS_CA_PATH=""

# 設備配置
DEVICE_ADAPTER_CONFIG=""
```

---

## 📝 18 路回路預設定義

| 迴路 | 名稱 | 分類 | 預設啟用 | 遠端控制 | 排程控制 |
|-----|------|------|--------|--------|--------|
| 01 | 球場 A 主燈 | 預約動態 | ✓ | ✓ | ✓ |
| 02 | 球場 A 涼風扇 | 預約動態 | ✓ | ✓ | ✓ |
| 03 | 球場 B 主燈 | 預約動態 | ✓ | ✓ | ✓ |
| 04 | 球場 B 涼風扇 | 預約動態 | ✓ | ✓ | ✓ |
| 05-09 | 營業時間設備 | 營業時間 | ✓ | ✓ | ✓ |
| 10-11 | 夜間環境燈 | 夜間情境 | ✓ | ✓ | ✓ |
| 12-16 | 24 小時供電 | 長時開啟 | ✓ | ✗ | ✗ |
| 17-18 | 預留回路 | 預留 | ✗ | ✗ | ✗ |

**圖片重複項說明**: 來源圖片將「09 浴室熱水器」列了兩次，但實際總數為 18 路。本實施只建立一個 09 迴路。

---

## 🔄 資料庫遷移

### 執行遷移

```bash
# 生成遷移腳本
npm run db:generate

# 如使用 Turso，執行初始化
npm run db:turso:init

# 同步數據庫
npx prisma db push
```

### 預期表格
- `Circuit` — 18 路回路定義與映射
- `ControlCommand` — MQTT 命令追蹤
- `OperatingHours` — 營業時間與夜間時段
- `DeviceAdapter` — 設備配置與連線狀態
- `ControlEvent` — 控制事件日誌
- `WatchdogAlert` — 監控告警事件

---

## ⚠️ 待確認與補充的參數

第一階段使用可配置的模擬設備與適配器。正式環境需補充以下真實參數：

### 設備硬體
- [ ] 研華 Relay 實際型號 (例: AR-721, ADAM-4019, 其他)
- [ ] Firmware 版本
- [ ] 實際 MAC ID（每台設備）
- [ ] 輸出通道數與對應的負載（燈、風扇、冷氣等）
- [ ] MQTT 原生 topic 格式與 payload 結構（依據官方文件）

### MQTT Broker
- [ ] 正式 Broker URL 與 port
- [ ] 認證方式 (username/password 或 mTLS)
- [ ] TLS 憑證位置
- [ ] 最小權限 ACL 設定

### 雲端日誌數據庫
- [ ] Neon PostgreSQL 連接字符串
- [ ] 或改用其他 PostgreSQL（本地或其他供應商）

### 地端控制服務
- [ ] Raspberry Pi 或其他控制電腦的網路連線與時區設定
- [ ] RS-485 與現場設備的實際連線拓撲

### 電氣與現場配置
- [ ] 每路實際負載（功率、啟動電流、保護方式）
- [ ] Relay 額定值與過載保護設計
- [ ] 磁力鎖、門磁、緊急釋放的實際配置

---

## 🎯 後續實施路線圖

### 第二階段：後端排程與 MQTT
- [ ] 建立 `scheduling-service.ts`（預約→排程計算、合併連續預約）
- [ ] 建立 `mqtt-service.ts`（連接、重連、發佈、訂閱、心跳）
- [ ] 建立 `device-adapter.ts`（研華協議轉換、通道映射）
- [ ] API 路由 `/api/admin/control/command`（發送人工命令）

### 第三階段：Watchdog 與日誌
- [ ] 建立 `watchdog-service.ts`（監測地端、MQTT、Relay、命令確認）
- [ ] 建立 `event-logger.ts`（本地緩衝、非同步上傳 Neon）
- [ ] 新增 `/admin/logs` 頁面（查詢、篩選、匯出）

### 第四階段：管理 UI
- [ ] 擴充 `/admin` 首頁摘要（連接狀態、Watchdog 告警）
- [ ] 完善 `/admin/control` 頁面（18 路表格、排程編輯、人工控制）

### 第五階段：Simulation 環境
- [ ] Mock MQTT Broker
- [ ] Mock 地端服務
- [ ] Mock Relay adapter
- [ ] 模擬時間控制與事件檢視器
- [ ] 完整流程測試

### 後續：門禁控制系統 (已提供詳細規範)
- 見本資料夾內 `DOOR_ACCESS_SYSTEM.md`（下述）

---

## 🚪 門禁控制系統 (第十三項補充要求)

**附註**: 用戶另外提供了門禁與 AR-721 控制器的詳細要求（十三、A-K 段）。該要求涉及預約到門禁憑證的完整生命週期、安全邏輯、RS-485 通訊、Watchdog 擴充等，超出第一階段的範圍。

該要求已單獨整理為 `DOOR_ACCESS_SYSTEM.md`，包含：

- **A. 明確區分四種工作**: 預約授權排程、門禁憑證設定、現場通行、遠端解鎖
- **B. 密碼策略與硬體驗證**: AR-721 完整規格確認清單
- **C. 預約到門禁的交易流程**: 12 步完整流程與狀態轉換
- **D. 取消、改期與競態處理**: 版本管理、雲端欲達狀態 vs. 設備實際狀態 reconciliation
- **E. 離線運作與命令邊界**: 6 種命令類型與安全規則
- **F. 門鎖、門磁與開門結果判定**: 8 層確認層級
- **G. 人身安全與磁力鎖電氣邏輯**: 緊急釋放、斷電安全、硬體測試
- **H. RS-485 與現場安裝**: 通訊參數、拓撲、隔離、故障排查
- **I. Watchdog 增補規則**: 13 項監控項目與 8 種告警類型
- **J. 門禁 Simulation**: 14 層模擬深度
- **K. 最終設計文件清單**: 12 個必須回答的問題

該系統設計應在第二～五階段完成後，作為第六階段的專項實施。現階段 Circuit、ControlCommand、ControlEvent、WatchdogAlert 等模型已為門禁系統預留了足夠的擴展欄位（deviceMapping、component、componentId 等）。

---

## 🧪 現有測試與驗證

### 已驗證的項目
- ✓ Prisma schema 語法與關聯正確
- ✓ 18 路回路的枚舉定義完整
- ✓ 設備配置驗證函數可正確識別缺失欄位
- ✓ MQTT topic 構建函數處理模板變量

### 待驗證的項目
- [ ] 實際 MQTT Broker 連線（第二階段）
- [ ] 研華 Relay 協議實現（第二階段）
- [ ] 排程計算的預約合併邏輯（第二階段）
- [ ] Watchdog 監控的多層次告警（第三階段）
- [ ] 完整的預約→命令→設備→日誌流程（整合測試）

---

## 📚 檔案清單

### 新增／修改的檔案
1. **prisma/schema.prisma**
   - 5 個新枚舉
   - 6 個新模型
   - Venue 與 Reservation 關係延伸

2. **src/lib/control-types.ts** (新建)
   - 18 路回路定義
   - 類型與枚舉
   - 預設配置常數

3. **src/lib/device-config.ts** (新建)
   - DeviceAdapterConfig 介面
   - 模擬設備配置
   - 回路到 Relay 映射
   - 輔助函數

4. **.env.example**
   - 電力控制環境變數

5. **CONTROL_SYSTEM_PHASE1.md** (本文件)
   - 第一階段實施報告

6. **DOOR_ACCESS_SYSTEM.md** (待建)
   - 門禁控制系統詳細規範（已接收）

---

## 🎓 下一步操作

1. **數據庫同步**
   ```bash
   npm run db:generate
   npm run db:turso:init
   ```

2. **確認與補充參數**
   - 蒐集真實設備型號、MAC ID、MQTT topic 格式
   - 配置 MQTT Broker 與 Neon 連接

3. **進入第二階段**
   - 實作 MQTT 服務
   - 實現排程引擎
   - 建立研華協議適配器

---

## 📞 技術諾特

- **時區**: 所有業務邏輯使用 `Asia/Taipei`；數據庫採 UTC 存儲
- **幂等性**: CommandId、EventId 用以防止重複執行
- **環境隔離**: SIMULATION 與 PRODUCTION 日誌完全分離
- **無密鑰代碼**: MQTT 密碼、TLS 密鑰僅從環境變量或安全存儲讀取
- **脫敏日誌**: ControlEvent 的 data 欄位應脫敏敏感資訊（密碼、金鑰、個資）

---

*報告完成時間: 2026-11-11*
*實施者: Claude Haiku 4.5*
