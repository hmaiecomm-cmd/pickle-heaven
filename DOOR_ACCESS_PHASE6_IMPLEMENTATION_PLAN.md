# 門禁控制系統 — Phase 6 實施計劃

**狀態**: 📋 計劃中（數據模型已完成）  
**開始時間**: 2026-11-11  
**預計完成**: 5-7 天

---

## 📊 進度概覽

| 項目 | 狀態 | 備註 |
|------|------|------|
| **數據模型** | ✅ 完成 | AccessSession、CredentialRef 等 6 個新模型 |
| **類型定義** | 📋 計劃中 | TypeScript 類型與常數定義 |
| **核心服務** | 📋 計劃中 | 門禁邏輯服務（12 步流程） |
| **Raspberry Pi 適配器** | 📋 計劃中 | RS-485 通信與命令驗證 |
| **Watchdog 擴展** | 📋 計劃中 | 13 項門禁監控規則 |
| **API 端點** | 📋 計劃中 | 門禁命令、查詢、管理 API |
| **模擬環境** | 📋 計劃中 | 14 層深度模擬 |
| **實體驗收清單** | 📋 計劃中 | 8 項現場測試 |

---

## 🔧 已完成工作

### 1. 數據模型（✅ 完成）

新增 **6 個 Prisma 模型** + **3 個枚舉**：

#### 新增枚舉
```typescript
enum CredentialState {
  CREATED, APPLIED, FAILED, UNKNOWN, REVOKED, REVOKE_PENDING
}

enum AccessStatus {
  GRANTED, DENIED, UNKNOWN, NOT_USED
}

enum DoorAccessCommandType {
  PROVISION_CREDENTIAL, REVOKE_CREDENTIAL, QUERY_STATUS, SYNC_CLOCK, REMOTE_UNLOCK
}
```

#### 新增模型
1. **AccessSession** — 綁定預約與門禁憑證
   - 版本管理（bookingVersion）
   - 憑證狀態追蹤
   - 有效期管理（精確到秒）

2. **DoorAccessCommand** — 下發給 Raspberry Pi 的命令
   - 命令序列管理
   - 版本檢查
   - 設備回報狀態

3. **AccessLog** — 使用者通行記錄
   - 控制器時鐘記錄
   - 門磁狀態追蹤
   - 時間異常偵測

4. **CredentialAlert** — 門禁告警
   - 自動或人工觸發
   - 告警狀態管理

5. 已更新 **Reservation** 模型添加 accessSession 關係

---

## 📋 下一步實施計劃

### Phase 6.1 — 類型定義與常數（1 天）

**新建檔案**: `src/lib/door-access-types.ts`

```typescript
// 密碼策略
interface CredentialConfig {
  pinLength: number // 4-6
  pinFormat: 'numeric' | 'alphanumeric'
  dailyQuota: number // 控制器容量
  expirationBehavior: 'revoke' | 'disable' // 到期後行為
}

// 命令狀態機
interface CommandStateTransition {
  PENDING → SENT → ACKED ✓
  PENDING → SENT → FAILED ✗
  PENDING → SENT → TIMEOUT ⏱️
  PENDING → EXPIRED (取消預約)
}

// 12 步流程狀態
enum AccessSessionStep {
  STEP_1_BOOKING_CONFIRMED = 1,
  STEP_2_VERIFICATION = 2,
  STEP_3_SESSION_CREATED = 3,
  STEP_4_QUOTA_CHECKED = 4,
  STEP_5_OUTBOX_RECORDED = 5,
  STEP_6_MQTT_SENT = 6,
  STEP_7_PI_VERIFIED = 7,
  STEP_8_RS485_CONFIGURED = 8,
  STEP_9_CONTROLLER_RESPONSE = 9,
  STEP_10_USER_NOTIFIED = 10,
  STEP_11_FOLLOW_UP = 11,
  STEP_12_EVENT_TIMELINE = 12,
}
```

### Phase 6.2 — 核心服務（2 天）

**新建檔案**: `src/server/door-access-service.ts` (~800 行)

#### 關鍵函數

```typescript
// 1. 預約確認時建立門禁會話
async function createAccessSessionFromBooking(
  reservationId: string,
  bookingVersion: number
): Promise<AccessSession>

// 2. 驗證預約與門禁條件
async function validateAccessEligibility(
  reservation: Reservation,
  venue: Venue
): Promise<{ valid: boolean; reason?: string }>

// 3. 檢查配額與控制器容量
async function checkCredentialQuota(
  venueId: string,
  date: string,
  controllerMacId: string
): Promise<{
  availableSlots: number;
  alreadyProvisioned: number;
  canProvision: boolean;
}>

// 4. 產生密碼（PIN 或卡號）
function generateCredentialPin(
  accessSessionId: string,
  length: number
): string

// 5. 建立 MQTT 命令（Transactional Outbox）
async function createProvisionCommand(
  accessSession: AccessSession,
  credential: CredentialConfig
): Promise<DoorAccessCommand>

// 6. 發送 MQTT 命令給 Raspberry Pi
async function publishCredentialCommand(
  command: DoorAccessCommand
): Promise<void>

// 7. 處理取消 / 改期
async function handleCredentialRevocation(
  accessSession: AccessSession,
  reason: string
): Promise<void>

// 8. 查詢控制器狀態（RS-485 讀回）
async function queryControllerStatus(
  controllerMacId: string,
  userSlotNumber?: number
): Promise<ControllerStatus>

// 9. Reconciliation（網路恢復後同步）
async function reconcileAccessState(
  venueId: string,
  controllerMacId: string
): Promise<void>
```

#### 邏輯層次

1. **12 步交易流程實現**
   - 每步對應一個狀態檢查與記錄
   - 原子性與冪等性設計

2. **版本管理** (`booking_version`)
   - 預約取消 / 改期時遞增
   - 命令驗證時檢查版本

3. **離線運作**
   - 設備已確認的憑證離線仍可用
   - 新建憑證需網路確認

### Phase 6.3 — Raspberry Pi 適配器（1-2 天）

**新建檔案**: `src/server/raspberry-pi-adapter.ts` (~600 行)

#### 關鍵職責

```typescript
class RaspberryPiAdapter {
  // 1. 接收並驗證 MQTT 命令
  async validateCommandBeforeExecution(
    command: DoorAccessCommand
  ): Promise<{
    valid: boolean;
    reason?: string;
  }>

  // 2. RS-485 通信（控制器配置）
  async configureCredentialViaRS485(
    command: DoorAccessCommand,
    rsConfig: RS485Config
  ): Promise<ControllerResponse>

  // 3. 回報設備結果
  async reportCommandResult(
    command: DoorAccessCommand,
    result: ControllerResponse
  ): Promise<void>

  // 4. 查詢控制器狀態
  async queryControllerStatus(
    macId: string
  ): Promise<ControllerStatus>

  // 5. 時鐘校準
  async syncControllerClock(
    macId: string,
    ntpTime: DateTime
  ): Promise<boolean>

  // 6. 讀取門禁交易紀錄
  async readAccessLog(
    macId: string,
    limit: number = 100
  ): Promise<ControllerAccessLog[]>
}

interface RS485Config {
  baudRate: number // 9600, 19200, 38400
  dataBits: number // 8
  stopBits: number // 1
  parity: 'none' | 'odd' | 'even'
  stationId: number
  protocolVersion: string
  timeout: number // ms
  retries: number
  crc: boolean
}

interface ControllerResponse {
  success: boolean;
  userSlotNumber?: number;
  resultCode?: string;
  resultMessage?: string;
  timestamp?: DateTime;
}
```

#### RS-485 通信規格

```
鮑率: 待硬體確認（通常 9600, 19200, 38400）
資料位元: 8
停止位元: 1
校驗: CRC 或 checksum
超時: 5 秒
重試: 3 次
```

### Phase 6.4 — Watchdog 擴展（1 天）

**修改檔案**: `src/server/watchdog-service.ts`

#### 新增 13 項檢測

```typescript
async function checkAccessSystemHealth(): Promise<HealthCheck> {
  return {
    // 1. 排程 → MQTT 超時
    SCHEDULE_TO_MQTT_TIMEOUT,
    
    // 2. MQTT → Pi 超時
    MQTT_TO_PI_TIMEOUT,
    
    // 3. Pi → 控制器超時
    PI_TO_CONTROLLER_TIMEOUT,
    
    // 4. 憑證寫入不一致
    CREDENTIAL_APPLY_MISMATCH,
    
    // 5. 通知失敗
    CREDENTIAL_APPLIED_NOTIFICATION_FAILED,
    
    // 6. 取消後仍有效
    CANCELLED_CREDENTIAL_STILL_ACTIVE,
    
    // 7. 過期憑證未移除
    EXPIRED_CREDENTIAL_NOT_REMOVED,
    
    // 8. 控制器時鐘漂移
    CONTROLLER_CLOCK_DRIFT,
    
    // 9. Pi 時鐘漂移
    PI_CLOCK_DRIFT,
    
    // 10. 門長開啟
    DOOR_HELD_OPEN_TIMEOUT,
    
    // 11. 交易 vs 門磁矛盾
    ACCESS_LOG_VS_DOOR_MISMATCH,
    
    // 12. 缺少交易記錄
    MISSING_CONTROLLER_TRANSACTION_LOG,
    
    // 13. 撤銷未確認
    REVOKE_PENDING_UNRESOLVED,
  }
}
```

### Phase 6.5 — API 端點（1 天）

**新建檔案**:
- `src/app/api/door/access/route.ts` — 查詢與管理
- `src/app/api/door/command/route.ts` — 命令發送
- `src/app/api/door/log/route.ts` — 交易日誌查詢

#### 端點概覽

```
GET  /api/door/access/:accessSessionId        查詢門禁會話
GET  /api/door/access/reservation/:resId      查詢預約對應門禁
POST /api/door/command/revoke                 撤銷憑證
POST /api/door/command/sync-clock             校時
POST /api/door/command/remote-unlock          遠端開門
GET  /api/door/log?venueId=...&limit=50       查詢通行記錄
POST /api/door/status/query                   查詢控制器狀態
```

### Phase 6.6 — 模擬環境（1 天）

**新建檔案**: `src/server/door-access-simulator.ts` (~1000 行)

#### 14 層模擬

1. ✓ API 收到預約確認
2. ✓ 排程及憑證參照建立
3. ✓ 密碼配額與控制器容量檢查
4. ✓ MQTT broker 收到訊息
5. ✓ Raspberry Pi 接收及驗證
6. ✓ RS-485 Adapter 寫入控制器
7. ✓ 控制器接受、拒絕或回應未知
8. ✓ 使用者通知成功或失敗
9. ✓ 使用者輸入正確或錯誤密碼
10. ✓ 控制器通行紀錄與門磁開關狀態
11. ✓ 門未關、強行開門、電源斷電、網路中斷、控制器重啟及校時錯誤
12. ✓ 取消／改期與命令同時發生
13. ✓ 舊命令、重複命令、命令過期及撤銷未確認
14. ✓ 控制器使用者位置滿額、密碼配額滿額、密碼不可設定或 PIN 衝突

```typescript
class DoorAccessSimulator {
  // 模擬 AR-721 控制器（內存狀態）
  private controllerState: {
    userSlots: Map<number, SimulatedUser>;
    accessLog: SimulatedAccessLog[];
    clock: DateTime;
    powerStatus: 'ON' | 'OFF' | 'BATTERY';
  };

  // 模擬命令執行（延遲、失敗、超時）
  async simulateCommandExecution(
    command: DoorAccessCommand,
    scenario: 'success' | 'failure' | 'timeout' | 'offline'
  ): Promise<void>

  // 模擬使用者輸入
  async simulateUserAccess(
    pin: string,
    timestamp?: DateTime
  ): Promise<AccessResult>

  // 模擬斷電 / 離線 / 重啟
  async simulatePowerEvent(event: 'offline' | 'reboot' | 'power_loss'): Promise<void>

  // 模擬時鐘漂移
  async simulateClockDrift(driftSeconds: number): Promise<void>

  // 模擬門磁狀態
  async simulateDoorEvent(event: 'open' | 'close' | 'held_open'): Promise<void>
}
```

### Phase 6.7 — 實體驗收清單（待現場測試）

| # | 項目 | 驗收方法 | 預期結果 |
|---|------|--------|--------|
| 1 | 斷網時已設定憑證仍可用 | 關閉 Wi-Fi，嘗試輸入 PIN | ✓ 允許通行 |
| 2 | 斷電時磁力鎖與出門按鈕 | 切斷 24V，嘗試推開門 | ✓ 門自動解鎖 |
| 3 | Pi 重啟後不執行舊遠端命令 | 發送命令 → 重啟 Pi → 檢查記錄 | ✗ 舊命令未執行 |
| 4 | 預約取消後憑證已撤銷 | 建立 → 取消 → 讀回控制器 | ✓ 位置已清空 |
| 5 | 有效時段邊界測試 | [08:00,09:00) 在 07:59、08:00、08:59、09:00 嘗試 | 邊界正確 |
| 6 | 多筆預約與容量壓力 | 同日 10 筆 → 取消 5 筆 → 改期 3 筆 | 所有操作成功 |
| 7 | 門磁超時與強行開門告警 | 門開超時 / 未授權開門 | ✓ 告警觸發 |
| 8 | 管理者手動操作與稽核 | 遠端解鎖 / 緊急撤銷 → 查詢日誌 | ✓ 記錄完整 |

---

## 📅 時程表

| 階段 | 工作內容 | 預計時間 | 狀態 |
|------|---------|--------|------|
| 6.1 | 類型定義與常數 | 1 天 | 📋 |
| 6.2 | 核心服務（12 步流程） | 2 天 | 📋 |
| 6.3 | Raspberry Pi 適配器 | 1-2 天 | 📋 |
| 6.4 | Watchdog 擴展 | 1 天 | 📋 |
| 6.5 | API 端點 | 1 天 | 📋 |
| 6.6 | 模擬環境 | 1 天 | 📋 |
| 6.7 | 文檔 & 驗收 | 1 天 | 📋 |
| **總計** | | **7-8 天** | |

---

## 🔐 安全考量

- ✅ 密碼不存明文，僅存 hash
- ✅ 命令版本檢查防止舊命令執行
- ✅ 事件脫敏（不記錄明文 PIN）
- ✅ Watchdog 自動偵測異常
- ✅ 緊急釋放獨立於軟體控制

---

## 🎯 成功指標

- [x] 數據模型完成
- [ ] 12 步流程完整實現
- [ ] 13 項 Watchdog 檢測全部啟用
- [ ] 14 層模擬環境就緒
- [ ] 8 項實體驗收全部通過

---

## 📝 相關文檔

- `DOOR_ACCESS_SYSTEM.md` — 完整規範（K 個部分）
- `CONTROL_SYSTEM_IMPLEMENTATION_GUIDE.md` — 電力控制實施指南
- `PROJECT_COMPLETION_SUMMARY.md` — 項目總覽

---

*計劃更新於 2026-11-11*  
*下一步: 開始 Phase 6.1 — 類型定義*

待蒐集參數：
- [ ] AR-721 完整規格 + firmware 版本
- [ ] MQTT Broker 配置
- [ ] Raspberry Pi + RS-485 硬體參數
- [ ] Neon PostgreSQL 連接字符串
