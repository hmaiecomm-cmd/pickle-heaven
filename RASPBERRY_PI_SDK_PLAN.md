# Raspberry Pi 現場控制軟件套件 — 實現計劃

## 一、系統架構概覽

### 1.1 主要組件關係

```
頂層：顧好 AI 雲端平台（Next.js 後端）
  ↓ MQTT 命令 (TLS/認證)
Raspberry Pi 本地環境
  ├─ Local MQTT Broker (Mosquitto)
  │   ├─ topic: `{siteId}/control/{circuitId}/ctl` (雲→現場)
  │   ├─ topic: `{siteId}/control/{circuitId}/data` (現場→雲)
  │   └─ ACL + 認證 (場館專用)
  │
  ├─ Gateway Agent (常駐服務)
  │   ├─ 連接本地 Broker
  │   ├─ 訂閱控制命令
  │   ├─ 驗證命令（來源、簽名、過期時間）
  │   ├─ 映射迴路編號 → Relay 設備地址
  │   ├─ 發送 RS-485 信號
  │   ├─ 接收設備回報
  │   ├─ 發佈狀態到 Broker
  │   └─ 本地持久化隊列（斷線備份）
  │
  ├─ RS-485 Adapter SDK
  │   ├─ 序列埠通訊 (波特率、停止位、校驗)
  │   ├─ 設備協議轉換 (Modbus / 自訂)
  │   ├─ 超時與重試邏輯
  │   ├─ CRC 校驗
  │   └─ Mock 模式 (測試用)
  │
  ├─ Systemd 服務管理
  │   ├─ 自動啟動
  │   ├─ 異常重啟
  │   └─ 日誌管理
  │
  └─ CLI 工具
      ├─ 安裝與配置
      ├─ 連線檢查
      ├─ 狀態查詢
      ├─ 模擬測試
      └─ 日誌查看

  ↓ TLS Bridge (VPN 或受保護連接)
雲端 MQTT Broker (可選轉送層)
  ↓
  雲端資料庫 (Neon)
```

---

## 二、技術棧選擇

### 2.1 推薦方案

| 組件 | 技術 | 理由 |
|------|------|------|
| **Local MQTT Broker** | Mosquitto 3.0+ | 成熟穩定、輕量級、樹莓派官方支持 |
| **Gateway Agent** | Node.js 20 LTS + TypeScript | 與現有雲端技術棧一致、易於維護 |
| **RS-485 通訊** | `serialport` npm 模組 | 跨平台、穩定、async 友好 |
| **資料庫** | SQLite (本地) | 斷線時存儲命令與日誌，重連時同步 |
| **服務管理** | systemd | Linux 標準，容易實現自動啟動與監視 |
| **配置管理** | JSON + 環境變數 | 簡單易維護 |
| **日誌** | winston + 檔案滾動 | 結構化日誌，易於分析 |

### 2.2 為何不選其他方案

- **Python**: 系統無人守值，需要較少依賴；Node.js 與現有技術棧一致
- **Go**: 二進制輕量，但與現有技術棧不一致，維護成本高
- **Rust**: 邊際效益不足，複雜度增加

---

## 三、軟件組件詳細設計

### 3.1 Local MQTT Broker 部署

#### 3.1.1 安裝與配置

**檔案：`rpi-sdk/mosquitto/install.sh`**

```bash
#!/bin/bash
set -e

# 1. 安裝 Mosquitto
sudo apt-get update
sudo apt-get install -y mosquitto mosquitto-clients

# 2. 生成 TLS 憑證（自簽或使用場館簽署）
# 預設不強制 TLS（允許本地無認證連接）
# 若開啟 TLS，改用 8883 埠

# 3. 配置 Broker（ACL + 認證）
# 詳見 mosquitto.conf

# 4. 啟動服務
sudo systemctl enable mosquitto
sudo systemctl start mosquitto

echo "Mosquitto 已安裝並啟動"
```

**檔案：`rpi-sdk/mosquitto/mosquitto.conf`**

```ini
# 監聽埠
listener 1883
listener 8883

# TLS 配置（生產推薦開啟）
certfile /etc/mosquitto/certs/server.crt
keyfile /etc/mosquitto/certs/server.key
cafile /etc/mosquitto/certs/ca.crt
tls_version tlsv1.2

# ACL 與認證
allow_anonymous false
password_file /etc/mosquitto/passwd
acl_file /etc/mosquitto/acl.conf

# 日誌
log_dest syslog
log_dest file /var/log/mosquitto/mosquitto.log
log_type all
```

**檔案：`rpi-sdk/mosquitto/acl.conf`**

```
# 格式：
# user <username>
# topic [read|write] <topic>

user cloud_gateway
topic write {siteId}/control/+/ctl
topic read {siteId}/control/+/data

user local_agent
topic read {siteId}/control/+/ctl
topic write {siteId}/control/+/data

user admin_monitor
topic read {siteId}/#
```

#### 3.1.2 密碼與用戶管理

**檔案：`rpi-sdk/mosquitto/setup-users.sh`**

```bash
#!/bin/bash
# 為雲端和本地 Agent 設置用戶

SITE_ID=$1
SITE_PASSWORD=$2  # 由安裝腳本生成，存儲在安全位置

# 創建密碼檔案
sudo mosquitto_passwd -c /etc/mosquitto/passwd cloud_gateway "${SITE_PASSWORD}"
sudo mosquitto_passwd -b /etc/mosquitto/passwd local_agent "$(openssl rand -base64 32)"
sudo mosquitto_passwd -b /etc/mosquitto/passwd admin_monitor "$(openssl rand -base64 32)"

# 設置權限
sudo chown mosquitto:mosquitto /etc/mosquitto/passwd
sudo chmod 600 /etc/mosquitto/passwd

# 重啟 Broker
sudo systemctl restart mosquitto
```

---

### 3.2 Gateway Agent 實現

#### 3.2.1 項目結構

```
rpi-sdk/
├─ mqtt-broker/
│  ├─ mosquitto.conf
│  ├─ acl.conf
│  ├─ install.sh
│  └─ setup-users.sh
│
├─ gateway-agent/
│  ├─ src/
│  │  ├─ index.ts              (主入口)
│  │  ├─ mqtt-client.ts        (MQTT 連接與訂閱)
│  │  ├─ command-processor.ts  (命令驗證與分發)
│  │  ├─ rs485-adapter.ts      (RS-485 通訊)
│  │  ├─ device-registry.ts    (Relay 設備映射)
│  │  ├─ watchdog.ts           (健康監控)
│  │  ├─ persistence.ts        (本地佇列)
│  │  ├─ logger.ts             (結構化日誌)
│  │  └─ config.ts             (組態管理)
│  │
│  ├─ test/
│  │  ├─ mqtt-client.test.ts
│  │  ├─ command-processor.test.ts
│  │  ├─ rs485-adapter.test.ts
│  │  └─ integration.test.ts
│  │
│  ├─ dist/                    (編譯輸出)
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ .env.example
│  └─ README.md
│
├─ cli/
│  ├─ src/
│  │  ├─ commands/
│  │  │  ├─ install.ts
│  │  │  ├─ status.ts
│  │  │  ├─ test-connection.ts
│  │  │  ├─ simulate.ts
│  │  │  └─ logs.ts
│  │  └─ index.ts
│  │
│  ├─ package.json
│  └─ tsconfig.json
│
├─ systemd/
│  ├─ pickle-heaven-gateway.service
│  └─ install-service.sh
│
├─ config/
│  ├─ device-mapping.json.example
│  ├─ site-config.json.example
│  └─ relay-protocols/
│     ├─ modbus-rtu.yaml
│     ├─ custom-iot.yaml
│     └─ _template.yaml
│
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ INSTALLATION.md
│  ├─ CONFIGURATION.md
│  ├─ SIMULATION.md
│  ├─ TROUBLESHOOTING.md
│  └─ API.md
│
├─ scripts/
│  ├─ install-rpi.sh          (一鍵安裝)
│  ├─ update-gateway.sh       (升級)
│  ├─ uninstall.sh            (移除)
│  └─ test-simulation.sh      (模擬測試)
│
└─ package.json               (根級，管理 workspace)
```

#### 3.2.2 核心模組實現大綱

**`gateway-agent/src/mqtt-client.ts`** — MQTT 連接管理

```typescript
export class MqttClient {
  // 連接到本地 Broker
  connect(config: MqttConfig): Promise<void>
  
  // 訂閱控制命令主題
  subscribeToControlTopic(siteId: string): Promise<void>
  
  // 發佈設備狀態
  publishStatus(circuitId: string, state: CircuitState): Promise<void>
  
  // 心跳與重連邏輯
  startHeartbeat(): void
  stopHeartbeat(): void
  
  // 連接狀態監聽
  onConnected: (callback) => void
  onDisconnected: (callback) => void
}
```

**`gateway-agent/src/command-processor.ts`** — 命令驗證與分發

```typescript
export interface ControlCommandPayload {
  commandId: string        // 跨系統追蹤 ID
  siteId: string          // 場館 ID
  circuitId: string       // 迴路號碼 (01-18)
  targetState: 'ON' | 'OFF'
  source: 'SCHEDULE' | 'MANUAL_OVERRIDE' | 'EMERGENCY'
  scheduleVersion: number // 排程版本
  issuedAt: string        // ISO 8601
  expiresAt: string       // 命令失效時間
  signature?: string      // HMAC-SHA256（選填，未來加密驗證用）
}

export class CommandProcessor {
  // 驗證命令格式、簽名、過期時間
  validateCommand(payload: ControlCommandPayload): Promise<ValidationResult>
  
  // 映射迴路編號到 Relay 設備
  mapCircuitToDevice(circuitId: string): Promise<DeviceMapping>
  
  // 轉換為 RS-485 協議格式
  convertToRS485(mapping: DeviceMapping, targetState: CircuitState): Buffer
  
  // 分發命令給 RS-485 Adapter
  executeCommand(payload: ControlCommandPayload): Promise<ExecutionResult>
  
  // 重複命令檢測（commandId 快取）
  isDuplicateCommand(commandId: string): boolean
}
```

**`gateway-agent/src/rs485-adapter.ts`** — RS-485 通訊層

```typescript
export class RS485Adapter {
  // 初始化序列埠
  connect(config: RS485Config): Promise<void>
  
  // 發送 RS-485 訊號
  send(buffer: Buffer): Promise<void>
  
  // 接收與解析設備回報
  receive(timeout: number): Promise<Buffer>
  
  // CRC 校驗（Modbus RTU）
  calculateCRC16(data: Buffer): number
  verifyCRC16(data: Buffer, crc: number): boolean
  
  // Mock 模式（測試）
  setMockMode(enabled: boolean): void
}

// 設備協議適配
export class DeviceProtocolAdapter {
  // 支援多種設備協議
  constructor(protocolName: 'MODBUS_RTU' | 'CUSTOM_IOT' | string)
  
  // 編碼命令
  encodeCommand(deviceAddr: number, value: number): Buffer
  
  // 解碼回報
  decodeResponse(buffer: Buffer): { status: string; value?: number; error?: string }
}
```

**`gateway-agent/src/watchdog.ts`** — 健康監控

```typescript
export class Watchdog {
  // 監測項目
  monitoring: {
    mqttConnectionStatus: 'ONLINE' | 'OFFLINE'
    lastMqttHeartbeat: Date
    
    rs485InterfaceStatus: 'OK' | 'ERROR' | 'UNKNOWN'
    lastRS485Heartbeat: Date
    
    commandQueueLength: number
    lastCommandExecutedAt: Date
    failedCommandCount: number
    
    statusMismatchCount: number
    persistenceQueueLength: number
  }
  
  // 檢測並產生告警
  checkHealth(): Promise<WatchdogAlert[]>
  
  // 恢復信號發佈
  reportHealthToMqtt(): Promise<void>
}
```

**`gateway-agent/src/persistence.ts`** — 本地持久化佇列

```typescript
export class PersistenceQueue {
  // SQLite 本地資料庫（斷線時備份）
  
  // 入隊命令
  enqueueCommand(payload: ControlCommandPayload): Promise<void>
  
  // 出隊並執行
  dequeueCommand(): Promise<ControlCommandPayload | null>
  
  // 記錄設備回報
  logDeviceResponse(circuitId: string, state: CircuitState): Promise<void>
  
  // 同步至雲端（網路恢復時）
  syncToCloud(): Promise<void>
  
  // 清理過期命令
  purgeExpiredCommands(): Promise<void>
}
```

#### 3.2.3 組態管理

**`config/device-mapping.json.example`**

```json
{
  "siteId": "pickle-heaven-001",
  "timezone": "Asia/Taipei",
  "mqtt": {
    "brokerUrl": "localhost",
    "port": 1883,
    "useTls": false,
    "username": "local_agent",
    "password": "${MQTT_AGENT_PASSWORD}"
  },
  "rs485": {
    "port": "/dev/ttyUSB0",
    "baudRate": 9600,
    "dataBits": 8,
    "stopBits": 1,
    "parity": "none",
    "timeout": 2000
  },
  "devices": {
    "RELAY_001": {
      "macId": "aa:bb:cc:dd:ee:01",
      "protocol": "MODBUS_RTU",
      "baseAddress": 1,
      "channels": {
        "1": { "circuitId": "01", "onValue": 1, "offValue": 0 },
        "2": { "circuitId": "02", "onValue": 1, "offValue": 0 },
        "3": { "circuitId": "03", "onValue": 1, "offValue": 0 },
        "4": { "circuitId": "04", "onValue": 1, "offValue": 0 }
      }
    },
    "RELAY_002": {
      "macId": "aa:bb:cc:dd:ee:02",
      "protocol": "MODBUS_RTU",
      "baseAddress": 2,
      "channels": {
        "1": { "circuitId": "05", "onValue": 1, "offValue": 0 }
      }
    }
  },
  "simulation": {
    "enabled": false,
    "mockRS485": false,
    "delayMs": 100
  }
}
```

---

### 3.3 CLI 工具

#### 3.3.1 命令清單

```bash
# 安裝與初始化
./cli install --site-id=pickle-heaven-001 --mqtt-password=xxx

# 檢查連線狀態
./cli status

# 測試連線
./cli test-connection

# 執行模擬測試
./cli simulate --circuit=01 --state=ON --duration=5s

# 查看日誌
./cli logs --follow --filter=ERROR

# 升級 Agent
./cli update --version=1.2.3

# 查看設備映射
./cli devices list

# 手動執行命令（DEBUG）
./cli command --circuit=01 --state=ON --source=MANUAL
```

---

### 3.4 Systemd 服務管理

**`systemd/pickle-heaven-gateway.service`**

```ini
[Unit]
Description=Pickle Heaven Gateway Agent
After=network-online.target mosquitto.service
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/pickle-heaven-gateway
ExecStart=/usr/bin/node /opt/pickle-heaven-gateway/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=gateway-agent

# 環境變數
EnvironmentFile=/etc/pickle-heaven/gateway.env

# 資源限制
MemoryMax=256M
CPUQuota=25%

[Install]
WantedBy=multi-user.target
```

---

## 四、命令與響應流程

### 4.1 成功執行流程

```
1. 雲端平台發佈命令到 MQTT Broker
   Topic: {siteId}/control/{circuitId}/ctl
   Payload: {
     "commandId": "cmd-20261112-001",
     "siteId": "pickle-heaven-001",
     "circuitId": "01",
     "targetState": "ON",
     "source": "SCHEDULE",
     "scheduleVersion": 42,
     "issuedAt": "2026-11-12T10:30:00Z",
     "expiresAt": "2026-11-12T10:35:00Z"
   }

2. Gateway Agent 訂閱並接收命令

3. CommandProcessor 驗證：
   ✓ 格式正確
   ✓ commandId 不重複
   ✓ 未過期
   ✓ 場館 ID 匹配
   ✓ 迴路編號有效

4. RS485Adapter 轉換並發送：
   Modbus RTU 訊號 → /dev/ttyUSB0

5. Relay 設備執行並回報狀態

6. Gateway Agent 解析回報

7. Gateway Agent 發佈狀態到 MQTT
   Topic: {siteId}/control/{circuitId}/data
   Payload: {
     "circuitId": "01",
     "actualState": "ON",
     "commandId": "cmd-20261112-001",
     "timestamp": "2026-11-12T10:30:05Z",
     "executionTime": 5,
     "status": "ACKED"
   }

8. 雲端 Watchdog 接收狀態確認
   ControlCommand.status = "ACKED"
```

### 4.2 失敗場景

| 場景 | 處理方式 |
|------|---------|
| **命令過期** | 拒絕執行，標記 EXPIRED，發佈錯誤到 MQTT |
| **RS-485 超時** | 重試 3 次（100ms 間隔），失敗後標記 TIMEOUT |
| **設備無回應** | 記錄日誌，產生 Watchdog 告警（OFFLINE） |
| **CRC 校驗失敗** | 拒絕，重新請求設備回報 |
| **MQTT 斷線** | 命令入隊本地 SQLite，網路恢復後同步 |
| **重複命令** | 檢測重複 commandId，跳過執行，回報已確認 |

---

## 五、模擬與測試環境

### 5.1 Simulation 架構

```
simulation: {
  enabled: true,
  mockRS485: true,           // 不發送真實序列埠信號
  mockMqttBroker: false      // 連接真實本地 Broker
}
```

### 5.2 測試腳本

**`scripts/test-simulation.sh`**

```bash
#!/bin/bash
set -e

echo "=== Pickle Heaven Gateway Simulation ==="

# 1. 啟動 Mosquitto（如果未運行）
if ! pgrep -x mosquitto > /dev/null; then
  mosquitto -d -c config/mosquitto.conf
  sleep 2
fi

# 2. 啟動 Gateway Agent（Simulation 模式）
npm run start:simulation &
AGENT_PID=$!

sleep 3

# 3. 執行測試用例
npm run test:integration

# 4. 清理
kill $AGENT_PID

echo "模擬測試完成"
```

### 5.3 模擬測試場景

```typescript
describe('Gateway Agent - Simulation Mode', () => {
  it('should handle ON command for circuit 01', async () => {
    // 發佈控制命令
    await mqtt.publish('pickle-heaven-001/control/01/ctl', {
      commandId: 'test-001',
      siteId: 'pickle-heaven-001',
      circuitId: '01',
      targetState: 'ON',
      source: 'MANUAL_OVERRIDE',
      issuedAt: new Date().toISOString(),
      expiresAt: addMinutes(new Date(), 5).toISOString(),
    })
    
    // 等待回報
    const response = await waitFor(
      'pickle-heaven-001/control/01/data',
      { timeout: 5000 }
    )
    
    expect(response.actualState).toBe('ON')
    expect(response.status).toBe('ACKED')
  })
  
  it('should reject expired commands', async () => {
    // 發佈已過期的命令
    await mqtt.publish('pickle-heaven-001/control/01/ctl', {
      commandId: 'test-002',
      circuitId: '01',
      targetState: 'OFF',
      expiresAt: subMinutes(new Date(), 1).toISOString(), // 已過期
    })
    
    // 應該收到錯誤回報
    const response = await waitFor('pickle-heaven-001/control/01/data')
    expect(response.status).toBe('EXPIRED')
  })
})
```

---

## 六、雲端與現場通訊方式

### 6.1 安全連接選項

#### 選項 A：VPN + TLS

```
┌─────────────────────────────────────────────────────────┐
│  雲端（Vercel / AWS）                                      │
│  MQTT 命令發佈者                                           │
│  ↓ (HTTPS API 呼叫)                                      │
│  → 雲端 MQTT Broker (with VPN Gateway)                   │
└─────────────────────────────────────────────────────────┘
         ↓ VPN Tunnel (IPSec / Wireguard)
┌─────────────────────────────────────────────────────────┐
│  現場 Raspberry Pi                                        │
│  Local Mosquitto Broker (TLS 1.2+)                       │
│  Gateway Agent                                            │
└─────────────────────────────────────────────────────────┘
```

#### 選項 B：Broker Bridge (推薦初期)

```
┌───────────────────────────────┐
│  雲端 MQTT Broker             │
│  (可選：Mosquitto 或 AWS IoT) │
└───────────────────────────────┘
         ↓ Bridge (認證 + TLS)
┌───────────────────────────────┐
│  現場 Local Mosquitto         │
│  (只轉送已授權的 topic)       │
└───────────────────────────────┘
```

**Broker Bridge 配置**

```ini
# /etc/mosquitto/conf.d/bridge.conf
connection cloud_bridge
address cloud.mqtt.example.com:8883

# 認證
remote_username cloud_gateway
remote_password ${CLOUD_MQTT_PASSWORD}

# TLS
bridge_cafile /etc/mosquitto/certs/ca.crt
bridge_certfile /etc/mosquitto/certs/client.crt
bridge_keyfile /etc/mosquitto/certs/client.key
tls_version tlsv1.2

# Topic 映射（只轉送必要的主題）
topic {siteId}/control/+/ctl in 1
topic {siteId}/control/+/data out 1
```

#### 選項 C：IoT 邊界網關

- 利用樹莓派做邊界設備，MQTT 消息先到本地 Broker
- 由 Agent 決定是否同步到雲端
- 離線時完全自主運作

---

## 七、安裝步驟概要

### 7.1 一鍵安裝腳本

**`scripts/install-rpi.sh`**

```bash
#!/bin/bash
set -e

# 參數
SITE_ID=${1:-"pickle-heaven-001"}
SITE_PASSWORD=$(openssl rand -base64 32)

echo "=== Pickle Heaven Gateway SDK 安裝 ==="
echo "場館 ID: $SITE_ID"

# 1. 系統更新
sudo apt-get update && sudo apt-get upgrade -y

# 2. 安裝依賴
sudo apt-get install -y \
  mosquitto mosquitto-clients \
  nodejs npm \
  git \
  sqlite3 \
  build-essential python3-dev

# 3. 部署 MQTT Broker
sudo cp mqtt-broker/mosquitto.conf /etc/mosquitto/
sudo cp mqtt-broker/acl.conf /etc/mosquitto/
./mqtt-broker/setup-users.sh "$SITE_ID" "$SITE_PASSWORD"

# 4. 部署 Gateway Agent
mkdir -p /opt/pickle-heaven-gateway
cp -r gateway-agent/* /opt/pickle-heaven-gateway/
cd /opt/pickle-heaven-gateway
npm install --production

# 5. 配置
cp config/device-mapping.json.example config/device-mapping.json
# 編輯 device-mapping.json（設備實際地址等）

# 6. 編譯
npm run build

# 7. 安裝 Systemd 服務
sudo cp systemd/pickle-heaven-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable pickle-heaven-gateway

# 8. 啟動服務
sudo systemctl start pickle-heaven-gateway

# 9. 驗證
echo "等待服務啟動..."
sleep 3
sudo systemctl status pickle-heaven-gateway

echo "✓ 安裝完成"
echo "⚠ 重要：妥善保管以下密碼"
echo "MQTT Agent 密碼: $SITE_PASSWORD"
echo "保存到: /etc/pickle-heaven/gateway.env"

# 10. 執行初步連線測試
./cli test-connection

echo "安裝完成，現在可開始配置設備映射"
```

---

## 八、部署與升級

### 8.1 生產環境檢查清單

- [ ] 設備映射配置正確（relay 地址、通道、波特率）
- [ ] TLS 憑證有效期 ≥ 3 個月
- [ ] Mosquitto ACL 限制只允許必要的 topic
- [ ] Gateway Agent 日誌輪轉已配置
- [ ] Systemd 服務設定正確
- [ ] 本地 SQLite 有足夠空間（初期建議 ≥ 100MB）
- [ ] 網路連接測試通過（ping 雲端、MQTT 通訊正常）
- [ ] 模擬測試所有 18 路迴路
- [ ] 實際 Relay 設備通訊驗證

### 8.2 升級流程

```bash
# 1. 備份現有配置與日誌
./cli backup --output=/mnt/backup/gateway-$(date +%Y%m%d).tar.gz

# 2. 下載新版本
cd /opt/pickle-heaven-gateway
git fetch && git checkout v1.2.3

# 3. 安裝新依賴（如有）
npm install --production

# 4. 編譯
npm run build

# 5. 測試（可選，仍在 Simulation 模式）
npm run test:integration

# 6. 重啟服務
sudo systemctl restart pickle-heaven-gateway

# 7. 驗證
./cli status
./cli test-connection
```

---

## 九、故障排查與監控

### 9.1 常見問題

| 問題 | 排查步驟 |
|------|---------|
| Gateway Agent 無法連接 Broker | `journalctl -u pickle-heaven-gateway` 查看日誌，檢查 /dev/ttyUSB0 |
| MQTT 無應答 | `mosquitto_sub -t '...' -v` 測試訂閱 |
| 命令執行超時 | 檢查 RS-485 線序、波特率、Relay 供電 |
| 狀態不一致 | 查看 CRC 校驗錯誤計數，可能設備故障 |

### 9.2 遠端監控

雲端 Watchdog 應定期檢查：

```typescript
// src/server/pi-watchdog.ts
export async function checkPiHealth(siteId: string) {
  const lastHeartbeat = await getLastGatewayHeartbeat(siteId)
  const timeSinceLastHeartbeat = now() - lastHeartbeat
  
  if (timeSinceLastHeartbeat > 5 * 60 * 1000) {
    // 5 分鐘無回報 → 告警
    await createWatchdogAlert({
      siteId,
      alertType: 'GATEWAY_HEARTBEAT_LOST',
      severity: 'OFFLINE',
      description: `Raspberry Pi Gateway 已離線 ${timeSinceLastHeartbeat}ms`
    })
  }
}
```

---

## 十、實現時間表

| 階段 | 工作項目 | 預估工時 |
|------|---------|---------|
| **第 1 週** | Mosquitto 部署、MQTT Broker 配置、ACL 設置 | 8h |
| **第 2 週** | Gateway Agent 核心（MQTT、Command、RS-485 基本） | 16h |
| **第 3 週** | Watchdog、Persistence、CLI 工具 | 12h |
| **第 4 週** | 模擬環境、測試、文檔 | 12h |
| **第 5 週** | 與現有雲端系統整合、實機測試 | 16h |
| **第 6 週** | 優化、安全審計、部署腳本完善 | 12h |
| **總計** | | ~76h (約 2 人月) |

---

## 十一、交付物清單

### 代碼
- [ ] `rpi-sdk/mqtt-broker/` — Mosquitto 配置
- [ ] `rpi-sdk/gateway-agent/` — Node.js Gateway Agent
- [ ] `rpi-sdk/cli/` — 命令列工具
- [ ] `rpi-sdk/systemd/` — Systemd 服務配置
- [ ] `rpi-sdk/scripts/` — 安裝與測試腳本
- [ ] `rpi-sdk/config/` — 設備映射範本

### 文檔
- [ ] `INSTALLATION.md` — 安裝指南（逐步）
- [ ] `CONFIGURATION.md` — 設備映射與場館配置
- [ ] `SIMULATION.md` — 模擬環境使用說明
- [ ] `TROUBLESHOOTING.md` — 常見問題排查
- [ ] `API.md` — Gateway Agent REST / MQTT API 參考
- [ ] `ARCHITECTURE.md` — 系統架構詳細文檔

### 測試
- [ ] 單元測試 (Jest)
- [ ] 整合測試（含模擬環境）
- [ ] 實機測試報告

### 雲端整合
- [ ] 更新 `src/server/control-service.ts` 支援 Raspberry Pi SDK
- [ ] 更新 Watchdog 告警規則
- [ ] 後台管理界面支援 Pi 遠端狀態查詢

---

## 十二、後續計劃

1. **Phase 2**: 支援多個 Relay 設備的並行控制
2. **Phase 3**: 本地排程引擎（離線時獨立執行排程）
3. **Phase 4**: Edge AI（基於現場狀態的自適應控制）
4. **Phase 5**: Kubernetes 邊界部署（多場館、統一管理）
