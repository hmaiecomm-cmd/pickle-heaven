# Raspberry Pi 智慧場館控制軟件套件 — 實現計劃

**文件**：詳細技術實現指南  
**版本**：1.0  
**發佈日期**：2026-11-12  
**目標硬體**：Raspberry Pi 4B/5 (2GB+ RAM)  
**預期完成**：2026-11-30

---

## 📋 目錄

1. [系統架構概述](#系統架構概述)
2. [硬體規格與準備](#硬體規格與準備)
3. [軟體棧設計](#軟體棧設計)
4. [分階段實現計劃](#分階段實現計劃)
5. [部署與驗證](#部署與驗證)
6. [測試計劃](#測試計劃)
7. [故障排查指南](#故障排查指南)
8. [性能優化](#性能優化)

---

## 系統架構概述

### 整體架構

```
┌─────────────────────────────────────────────────────────────┐
│                     雲端智慧場館平台                         │
│                    (Cloud API Server)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ MQTT (TLS 8883)
                     │
         ┌───────────▼───────────┐
         │  Mosquitto MQTT Broker │
         │   (Raspberry Pi)       │
         └───────────┬───────────┘
                     │
         ┌───────────▼─────────────────────┐
         │   Gateway Agent Service         │
         │   • MQTT Client                 │
         │   • Command Processor           │
         │   • RS-485 Adapter              │
         │   • Watchdog Monitor            │
         │   • Local Queue (SQLite)        │
         └───────────┬─────────────────────┘
                     │
                     │ RS-485 (Modbus RTU)
                     │
         ┌───────────▼─────────────────────┐
         │   Relay Control Units (18路)    │
         │   • Modbus RTU Slave            │
         │   • 18 Channels (1-18)          │
         │   • 220V AC Control             │
         └─────────────────────────────────┘
```

### 數據流

```
Web Request
    ↓
Cloud API
    ↓
MQTT Publish (control topic)
    ↓
Raspberry Pi Agent
    ├─ Validate Command
    ├─ Check Duplication
    ├─ Encode Modbus RTU
    └─ Queue to RS-485
         ↓
    RS-485 Serial
         ↓
    Relay Device (Modbus Slave)
         ↓
    Device ACK
         ↓
    Parse Response
         ↓
    Watchdog Update
    MQTT Publish (status topic)
         ↓
Cloud Update Status
```

---

## 硬體規格與準備

### Raspberry Pi 規格

| 規格 | 要求 | 備註 |
|------|------|------|
| 型號 | Pi 4B / Pi 5 | Pi 4B 2GB 最低要求 |
| 內存 | 2GB+ | 建議 4GB 以上 |
| 存儲 | 32GB+ microSD | Class 10 或 NVMe |
| 電源 | 5V/3A+ | 確保穩定供電 |
| 散熱 | 推薦被動散熱 | 連續運行溫度 < 60°C |

### 外設需求

| 設備 | 型號 | 數量 | 用途 |
|------|------|------|------|
| **USB-RS485** | CH340 或 FTDI | 1 | 與 Relay 通訊 |
| **Relay 模塊** | Modbus RTU Slave | 1+ | 18 路控制 |
| **以太網適配器** | 可選 | 1 | 有線網絡（Pi 4B） |
| **Wi-Fi 模塊** | 內置（Pi 4B+） | 內置 | 無線網絡 |
| **RTC 模塊** | DS3231 | 1 | 時間同步（可選） |

### 前置準備清單

- [ ] Raspberry Pi 4B/5（未刷系統）
- [ ] microSD 卡（32GB+）
- [ ] microSD 讀卡機
- [ ] USB-RS485 轉換器
- [ ] RS-485 雙絞線
- [ ] Relay 模塊（Modbus RTU）
- [ ] 直流電源（5V/3A）
- [ ] 網絡連接（有線或無線）
- [ ] HDMI 顯示器（初期配置用）
- [ ] USB 鍵盤滑鼠

---

## 軟體棧設計

### 系統層

```
OS Layer
├─ Raspberry Pi OS Lite (Bookworm)
│  └─ Kernel 6.6+
│
Service Layer
├─ Systemd (進程管理)
├─ OpenSSH (遠程訪問)
└─ NTP (時間同步)

Application Layer
├─ Node.js v20+ (LTS)
├─ Mosquitto (MQTT Broker)
└─ PM2 (進程監管)

Data Layer
├─ SQLite (本地佇列)
└─ Redis (可選快取)
```

### 應用層架構

```
Gateway Agent Application
├─ Config Manager
│  ├─ 環境變數
│  ├─ device-mapping.json
│  └─ 配置驗證
│
├─ MQTT Client
│  ├─ TLS 連接
│  ├─ Topic 訂閱
│  ├─ 心跳發送
│  └─ 自動重連
│
├─ Command Processor
│  ├─ 命令驗證 (18 項規則)
│  ├─ 去重機制 (60s 窗口)
│  ├─ 迴路映射
│  ├─ Modbus 編碼
│  └─ 日誌記錄
│
├─ RS-485 Adapter
│  ├─ 序列埠初始化
│  ├─ 訊號編碼/解碼
│  ├─ CRC-16 校驗
│  ├─ 回報解析
│  └─ Mock 模式
│
├─ Watchdog System
│  ├─ 健康評分
│  ├─ 指標監控
│  ├─ 告警生成
│  └─ 狀態發佈
│
├─ Local Queue
│  ├─ SQLite 持久化
│  ├─ 優先級排序
│  ├─ 失敗重試
│  └─ 同步機制
│
└─ Logger
   ├─ 結構化日誌
   ├─ 文件輪轉
   ├─ 每日備份
   └─ 遠程日誌轉發
```

---

## 分階段實現計劃

### 第 1 階段：環境準備（D1-D2）

#### Day 1：操作系統安裝

**目標**：Raspberry Pi 可正常啟動與網絡連接

**步驟**：

1. **下載系統鏡像**
   ```bash
   # Raspberry Pi Imager (GUI) 或命令行
   # 下載 Raspberry Pi OS Lite (Bookworm)
   # 64-bit 版本，無桌面環境
   ```

2. **刷入 microSD 卡**
   ```bash
   # 使用 Raspberry Pi Imager 或 balenaEtcher
   # 設置選項：
   # - Hostname: pickle-heaven-rpi
   # - Username: pi
   # - Password: <secure>
   # - WiFi SSID: <venue-network>
   # - Locale: Asia/Taipei
   ```

3. **首次啟動**
   - 插入 microSD 卡
   - 連接 HDMI 與電源
   - 等待啟動（3-5 分鐘）
   - 驗證 Wi-Fi 連接

4. **系統配置**
   ```bash
   sudo raspi-config
   # 1. System → Hostname (pickle-heaven-rpi)
   # 2. Interface → SSH (Enable)
   # 3. Interface → Serial Port (Enable)
   # 4. Performance → GPU Memory (16MB 足夠)
   # 5. Localization → Timezone (Asia/Taipei)
   ```

5. **系統更新**
   ```bash
   sudo apt-get update
   sudo apt-get upgrade -y
   sudo apt-get install -y git curl wget nano
   ```

6. **驗證連接**
   ```bash
   # 從其他機器 SSH 連接
   ssh pi@pickle-heaven-rpi.local
   # 驗證網絡速度
   speedtest-cli
   ```

**檢查清單**：
- [ ] Pi 開機成功
- [ ] SSH 可連接
- [ ] 網絡連通
- [ ] 系統已更新
- [ ] 時間同步

---

#### Day 2：環境初始化

**目標**：安裝所有必需的軟體依賴

**步驟**：

1. **安裝 Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs npm
   node --version   # v20.x.x
   npm --version    # 10.x.x
   ```

2. **安裝 Mosquitto MQTT Broker**
   ```bash
   sudo apt-get install -y mosquitto mosquitto-clients
   sudo systemctl enable mosquitto
   sudo systemctl start mosquitto
   # 驗證
   mosquitto_pub -h localhost -t test -m "hello"
   mosquitto_sub -h localhost -t test
   ```

3. **安裝序列埠工具**
   ```bash
   sudo apt-get install -y python3-serial python3-pip
   python3 -m pip install pyserial --upgrade
   # 設置 USB 設備權限
   sudo usermod -a -G dialout $USER
   ```

4. **安裝 PM2 進程管理**
   ```bash
   sudo npm install -g pm2
   pm2 startup
   sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u pi --hp /home/pi
   ```

5. **安裝 SQLite**
   ```bash
   sudo apt-get install -y sqlite3 libsqlite3-dev
   sqlite3 --version
   ```

6. **設置應用目錄**
   ```bash
   sudo mkdir -p /opt/pickle-heaven
   sudo chown -R pi:pi /opt/pickle-heaven
   sudo mkdir -p /var/log/pickle-heaven
   sudo chown -R pi:pi /var/log/pickle-heaven
   ```

**檢查清單**：
- [ ] Node.js v20+ 安裝
- [ ] Mosquitto 運行中
- [ ] PM2 安裝並啟用
- [ ] 序列埠驅動可用
- [ ] 應用目錄已創建

---

### 第 2 階段：應用部署（D3-D4）

#### Day 3：源代碼部署

**目標**：部署 Gateway Agent 應用代碼

**步驟**：

1. **克隆代碼庫**
   ```bash
   cd /opt/pickle-heaven
   git clone <repo-url> gateway-agent
   cd gateway-agent
   git checkout main
   ```

2. **安裝依賴**
   ```bash
   npm ci --production
   # 或
   npm install --production
   
   # 驗證依賴
   npm list --depth=0
   ```

3. **構建應用**
   ```bash
   npm run build
   # 驗證輸出
   ls -la dist/
   ```

4. **配置環境變數**
   ```bash
   cp .env.example .env.production
   # 編輯 .env.production
   nano .env.production
   ```

   **必需配置**：
   ```env
   # 基本設置
   NODE_ENV=production
   SITE_ID=pickle-heaven-001
   
   # MQTT 設置
   MQTT_BROKER_URL=mqtt.pickle-heaven.com
   MQTT_PORT=8883
   MQTT_USERNAME=local_agent_prod
   MQTT_PASSWORD=<secure-password>
   MQTT_TLS_ENABLED=true
   MQTT_TLS_CA_PATH=/etc/mosquitto/certs/ca.crt
   
   # RS-485 設置
   RS485_PORT=/dev/ttyUSB0
   RS485_BAUD_RATE=9600
   RS485_TIMEOUT=5000
   
   # 日誌設置
   LOG_LEVEL=info
   LOG_FILE_PATH=/var/log/pickle-heaven/gateway-agent.log
   ```

5. **驗證應用啟動**
   ```bash
   NODE_ENV=production npm start
   # 應看到：
   # ✓ Config validated
   # ✓ MQTT Connected (測試用本地 Broker)
   # ✓ RS-485 Connected
   # ✓ Watchdog Started
   # ✓ Gateway Agent Ready
   ```

**檢查清單**：
- [ ] 代碼克隆成功
- [ ] 依賴安裝完成
- [ ] 應用構建成功
- [ ] 環境變數配置
- [ ] 應用可正常啟動

---

#### Day 4：MQTT Broker 配置

**目標**：設置 Mosquitto MQTT Broker 的安全認證與 TLS

**步驟**：

1. **生成 TLS 憑證**
   ```bash
   # 創建憑證目錄
   sudo mkdir -p /etc/mosquitto/certs
   cd /etc/mosquitto/certs
   
   # 生成 CA 私鑰
   sudo openssl genrsa -out ca.key 2048
   
   # 生成 CA 自簽憑證
   sudo openssl req -new -x509 -days 365 -key ca.key -out ca.crt \
     -subj "/C=TW/ST=Taiwan/L=Taipei/O=PickleHeaven/CN=mosquitto-ca"
   
   # 生成服務器私鑰
   sudo openssl genrsa -out server.key 2048
   
   # 生成服務器証書請求
   sudo openssl req -new -out server.csr -key server.key \
     -subj "/C=TW/ST=Taiwan/L=Taipei/O=PickleHeaven/CN=pickle-heaven-rpi"
   
   # CA 簽署服務器証書
   sudo openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
     -CAcreateserial -out server.crt -days 365
   
   # 設置權限
   sudo chown mosquitto:mosquitto /etc/mosquitto/certs/*
   sudo chmod 600 /etc/mosquitto/certs/*.key
   ```

2. **配置 Mosquitto**
   ```bash
   sudo nano /etc/mosquitto/mosquitto.conf
   ```

   **添加配置**：
   ```conf
   # 監聽端口（無 TLS）
   listener 1883
   protocol mqtt
   
   # 監聽端口（TLS）
   listener 8883
   protocol mqtt
   cafile /etc/mosquitto/certs/ca.crt
   certfile /etc/mosquitto/certs/server.crt
   keyfile /etc/mosquitto/certs/server.key
   
   # 認證
   allow_anonymous false
   password_file /etc/mosquitto/passwd
   
   # ACL 控制
   acl_file /etc/mosquitto/acl.conf
   
   # 日誌
   log_dest file /var/log/mosquitto/mosquitto.log
   log_dest syslog
   log_type all
   ```

3. **設置用戶與密碼**
   ```bash
   # 創建用戶
   sudo mosquitto_passwd -c /etc/mosquitto/passwd local_agent_prod
   # 輸入密碼：<secure-password>
   
   # 添加其他用戶
   sudo mosquitto_passwd -b /etc/mosquitto/passwd cloud_gateway <password>
   sudo mosquitto_passwd -b /etc/mosquitto/passwd admin_monitor <password>
   
   # 驗證用戶列表
   cat /etc/mosquitto/passwd
   ```

4. **配置 ACL（訪問控制）**
   ```bash
   sudo nano /etc/mosquitto/acl.conf
   ```

   **ACL 規則**：
   ```
   # Cloud Gateway (云端應用)
   user cloud_gateway
   topic write pickle-heaven-001/control/+/ctl
   topic read pickle-heaven-001/status/#
   
   # Local Agent (本地 Pi 代理)
   user local_agent_prod
   topic read pickle-heaven-001/control/+/ctl
   topic write pickle-heaven-001/status/#
   topic write pickle-heaven-001/health
   
   # Admin Monitor (管理監控)
   user admin_monitor
   topic read pickle-heaven-001/status/#
   topic read pickle-heaven-001/health
   
   # 系統管理員
   user admin
   topic #
   ```

5. **重啟 Mosquitto**
   ```bash
   sudo systemctl restart mosquitto
   sudo systemctl status mosquitto
   
   # 驗證日誌
   sudo tail -f /var/log/mosquitto/mosquitto.log
   ```

6. **測試連接**
   ```bash
   # 測試 TLS 連接
   mosquitto_sub -h localhost -p 8883 --cafile /etc/mosquitto/certs/ca.crt \
     -u local_agent_prod -P <password> -t "pickle-heaven-001/status/#" -v
   
   # 在另一個終端發佈
   mosquitto_pub -h localhost -p 8883 --cafile /etc/mosquitto/certs/ca.crt \
     -u cloud_gateway -P <password> \
     -t "pickle-heaven-001/control/01/ctl" \
     -m '{"commandId":"test-001","circuitId":"01","targetState":"ON"}'
   ```

**檢查清單**：
- [ ] TLS 憑證已生成
- [ ] Mosquitto 配置完成
- [ ] 用戶與密碼已設置
- [ ] ACL 規則已應用
- [ ] TLS 連接可正常工作

---

### 第 3 階段：硬體集成（D5-D6）

#### Day 5：RS-485 適配器與 Relay 設備集成

**目標**：驗證 RS-485 通訊與 Relay 控制

**步驟**：

1. **連接 USB-RS485 適配器**
   ```bash
   # 物理連接：
   # Pi USB → USB-RS485 轉換器 → RS-485 線 → Relay 設備
   
   # 檢測設備
   ls -la /dev/ttyUSB*
   # 應顯示 /dev/ttyUSB0
   ```

2. **識別 Relay 設備地址**
   ```bash
   # 使用 modbus 工具掃描
   cd /opt/pickle-heaven/gateway-agent
   npm run test:modbus-scan
   
   # 或手動查詢
   # Relay 設備默認 Modbus 地址：0x01
   ```

3. **驗證 Modbus RTU 通訊**
   ```bash
   npm run test:modbus-read
   # 預期輸出：
   # Device Address: 0x01
   # Function Code: 0x03 (Read Holding Register)
   # Register Value: 0x0000 (所有迴路 OFF)
   ```

4. **測試單個迴路控制**
   ```bash
   npm run test:control-circuit 01 ON
   # 預期：迴路 01 打開，繼電器發出咔嚓聲
   
   npm run test:control-circuit 01 OFF
   # 預期：迴路 01 關閉
   ```

5. **驗證所有 18 個迴路**
   ```bash
   npm run test:control-all-circuits
   # 逐個打開每個迴路，驗證無誤
   ```

6. **設置 device-mapping.json**
   ```bash
   nano /opt/pickle-heaven/gateway-agent/config/device-mapping.json
   ```

   **配置示例**：
   ```json
   {
     "siteId": "pickle-heaven-001",
     "devices": {
       "RELAY_001": {
         "type": "ModbusRTU",
         "baseAddress": 1,
         "protocol": "MODBUS_RTU",
         "port": "/dev/ttyUSB0",
         "baudRate": 9600,
         "channels": {
           "1": { "circuitId": "01", "name": "照明區 1" },
           "2": { "circuitId": "02", "name": "照明區 2" },
           "3": { "circuitId": "03", "name": "照明區 3" },
           "4": { "circuitId": "04", "name": "空調區 1" },
           "5": { "circuitId": "05", "name": "空調區 2" },
           "6": { "circuitId": "06", "name": "空調區 3" },
           "7": { "circuitId": "07", "name": "設備區 1" },
           "8": { "circuitId": "08", "name": "設備區 2" },
           "9": { "circuitId": "09", "name": "設備區 3" },
           "10": { "circuitId": "10", "name": "設備區 4" },
           "11": { "circuitId": "11", "name": "設備區 5" },
           "12": { "circuitId": "12", "name": "設備區 6" },
           "13": { "circuitId": "13", "name": "備用迴路 1" },
           "14": { "circuitId": "14", "name": "備用迴路 2" },
           "15": { "circuitId": "15", "name": "備用迴路 3" },
           "16": { "circuitId": "16", "name": "備用迴路 4" },
           "17": { "circuitId": "17", "name": "備用迴路 5" },
           "18": { "circuitId": "18", "name": "備用迴路 6" }
         }
       }
     }
   }
   ```

**檢查清單**：
- [ ] USB-RS485 適配器已連接
- [ ] 設備識別成功
- [ ] Modbus RTU 通訊正常
- [ ] 單個迴路控制正常
- [ ] 所有 18 個迴路已驗證
- [ ] device-mapping.json 已配置

---

#### Day 6：系統集成與健康檢查

**目標**：完整系統集成與健康狀態驗證

**步驟**：

1. **啟動 Systemd 服務**
   ```bash
   sudo cp /opt/pickle-heaven/gateway-agent/systemd/pickle-heaven-gateway.service \
     /etc/systemd/system/
   
   sudo systemctl daemon-reload
   sudo systemctl enable pickle-heaven-gateway
   sudo systemctl start pickle-heaven-gateway
   sudo systemctl status pickle-heaven-gateway
   ```

2. **驗證日誌**
   ```bash
   sudo journalctl -u pickle-heaven-gateway -f
   # 或
   tail -f /var/log/pickle-heaven/gateway-agent.log
   
   # 預期日誌輸出：
   # ✓ Config loaded and validated
   # ✓ Logger initialized
   # ✓ MQTT connected to broker
   # ✓ RS-485 adapter connected
   # ✓ Watchdog started
   # ✓ Control topic subscribed
   # ✓ Gateway Agent ready to receive commands
   ```

3. **測試健康狀態端點**
   ```bash
   # 訂閱健康狀態主題
   mosquitto_sub -h localhost -p 8883 --cafile /etc/mosquitto/certs/ca.crt \
     -u admin_monitor -P <password> \
     -t "pickle-heaven-001/health" -v
   
   # 預期每 60 秒收到一條健康消息
   ```

4. **進行端到端控制測試**
   ```bash
   # 發佈開啟迴路 01 的命令
   mosquitto_pub -h localhost -p 8883 --cafile /etc/mosquitto/certs/ca.crt \
     -u cloud_gateway -P <password> \
     -t "pickle-heaven-001/control/01/ctl" \
     -m '{
       "commandId":"test-complete-001",
       "siteId":"pickle-heaven-001",
       "circuitId":"01",
       "targetState":"ON",
       "source":"TEST",
       "scheduleVersion":1,
       "issuedAt":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
       "expiresAt":"'$(date -u -d '+5 minutes' +%Y-%m-%dT%H:%M:%SZ)'"
     }'
   
   # 訂閱狀態主題驗證回報
   mosquitto_sub -h localhost -p 8883 --cafile /etc/mosquitto/certs/ca.crt \
     -u cloud_gateway -P <password> \
     -t "pickle-heaven-001/status/#" -v
   
   # 預期收到：
   # pickle-heaven-001/status/01 {"state":"ON","commandId":"test-complete-001",...}
   ```

5. **負載測試**
   ```bash
   npm run test:load
   # 模擬 100 個並發命令，驗證系統穩定性
   ```

6. **系統性能監控**
   ```bash
   # 檢查 CPU 使用率
   top -b -n 1 | head -15
   
   # 檢查內存使用
   free -h
   
   # 檢查進程狀態
   ps aux | grep node
   ps aux | grep mosquitto
   ```

**檢查清單**：
- [ ] Systemd 服務已啟用
- [ ] 應用日誌正常輸出
- [ ] 健康狀態定期發佈
- [ ] 端到端控制測試成功
- [ ] 系統資源使用正常
- [ ] 負載測試通過

---

### 第 4 階段：監控與優化（D7）

#### Day 7：監控系統配置與性能優化

**步驟**：

1. **配置 Prometheus 監控**
   ```bash
   sudo apt-get install -y prometheus
   sudo nano /etc/prometheus/prometheus.yml
   
   # 添加 Gateway Agent 監控
   scrape_configs:
     - job_name: 'pickle-heaven-gateway'
       static_configs:
         - targets: ['localhost:9090']
   ```

2. **啟用 Grafana Dashboard**
   ```bash
   sudo apt-get install -y grafana-server
   sudo systemctl enable grafana-server
   sudo systemctl start grafana-server
   # 訪問：http://localhost:3000
   ```

3. **配置告警規則**
   ```bash
   # 設置 MQTT 連接中斷告警
   # 設置 RS-485 故障告警
   # 設置命令失敗率高告警
   ```

4. **性能調優**
   ```bash
   # 調整 Node.js 內存限制
   export NODE_OPTIONS="--max-old-space-size=256"
   
   # 優化 PM2 設置
   pm2 config set instances max
   ```

**檢查清單**：
- [ ] Prometheus 監控就緒
- [ ] Grafana Dashboard 配置完成
- [ ] 告警規則已設置
- [ ] 系統性能監控

---

## 部署與驗證

### 完全部署檢查清單

| 檢查項目 | 命令/方法 | 預期結果 |
|---------|---------|--------|
| **操作系統** | `cat /etc/os-release` | Raspberry Pi OS Bookworm |
| **Node.js** | `node --version` | v20.x.x |
| **npm** | `npm --version` | 10.x.x |
| **Mosquitto** | `systemctl status mosquitto` | active (running) |
| **Gateway Service** | `systemctl status pickle-heaven-gateway` | active (running) |
| **RS-485 設備** | `ls /dev/ttyUSB*` | /dev/ttyUSB0 存在 |
| **MQTT 連接** | 訂閱測試主題 | 收到心跳消息 |
| **Relay 控制** | 發送控制命令 | 迴路狀態改變 |
| **日誌輸出** | `tail -f /var/log/pickle-heaven/gateway-agent.log` | 無錯誤 |
| **磁盤空間** | `df -h` | > 5GB 可用 |
| **內存使用** | `free -h` | < 1GB 已用 |
| **CPU 溫度** | `/opt/vc/bin/vcgencmd measure_temp` | < 60°C |

---

## 測試計劃

### 單元測試執行

```bash
# 所有測試
npm test

# 特定測試套件
npm test -- command-processor.test.ts
npm test -- rs485-adapter.test.ts
npm test -- watchdog.test.ts

# 測試覆蓋率
npm run test:coverage
```

### 集成測試

```bash
# 端到端模擬測試
npm run test:e2e

# 真實硬體測試
npm run test:hardware-integration
```

### 性能測試

```bash
# 負載測試（100 個並發命令）
npm run test:load

# 壓力測試（1000 個連續命令）
npm run test:stress

# 持久性測試（24 小時運行）
npm run test:endurance
```

---

## 故障排查指南

### 常見問題與解決方案

| 問題 | 症狀 | 診斷方法 | 解決方案 |
|------|------|--------|--------|
| **MQTT 連接失敗** | `Cannot connect to broker` | `systemctl status mosquitto` | 檢查 Mosquitto 是否運行，驗證憑證 |
| **RS-485 無法通訊** | `Serial port open failed` | `ls -la /dev/ttyUSB*` | 檢查 USB 設備連接，更新驅動 |
| **Modbus RTU 超時** | `CRC check failed` | `npm run test:modbus-read` | 檢查波特率，驗證 RS-485 線接 |
| **命令去重失敗** | 命令多次執行 | 檢查去重窗口 (60s) | 增加去重時間窗口 |
| **內存泄漏** | 內存持續上升 | `top -p $(pgrep -f node)` | 檢查 Watchdog 監控，啟用內存配額 |
| **日誌文件過大** | `/var/log/` 滿 | `du -sh /var/log/*` | 配置日誌輪轉，設置保留天數 |
| **健康狀態異常** | Watchdog 持續告警 | 檢查各子系統狀態 | 逐個排查 MQTT、RS-485、命令隊列 |

### 診斷工具

```bash
# 查看實時日誌
sudo journalctl -u pickle-heaven-gateway -f

# 檢查進程狀態
pm2 status
pm2 logs pickle-heaven-gateway

# 檢查 MQTT 連接
mosquitto_sub -h localhost -t "pickle-heaven-001/#" -v

# 檢查序列埠
ls -la /dev/ttyUSB*
stty -F /dev/ttyUSB0 115200

# 檢查網絡連接
ping <mqtt-broker-ip>
netstat -tuln | grep 8883
```

---

## 性能優化

### 系統級優化

```bash
# 禁用不必要的服務
sudo systemctl disable bluetooth
sudo systemctl disable avahi-daemon

# 調整 swappiness
echo 10 | sudo tee /proc/sys/vm/swappiness

# 優化 GPIO 訪問
echo "dtoverlay=disable-bt" | sudo tee -a /boot/config.txt
echo "dtoverlay=disable-wifi" | sudo tee -a /boot/config.txt  # 如果使用有線網絡
```

### 應用級優化

```bash
# Node.js 內存優化
NODE_OPTIONS="--max-old-space-size=256 --gc-interval=60000"

# PM2 優化配置
{
  "apps": [{
    "name": "gateway-agent",
    "script": "dist/index.js",
    "instances": 1,
    "exec_mode": "fork",
    "max_memory_restart": "256M",
    "merge_logs": true,
    "autorestart": true
  }]
}
```

### 網絡優化

```bash
# 優化 TCP 参数
sudo sysctl -w net.ipv4.tcp_keepalive_time=600
sudo sysctl -w net.ipv4.tcp_keepalive_intvl=60

# 增加網絡緩衝區
sudo sysctl -w net.core.rmem_max=134217728
sudo sysctl -w net.core.wmem_max=134217728
```

---

## 安全加固

### 系統安全

```bash
# 防火牆配置
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 1883/tcp  # MQTT (無 TLS)
sudo ufw allow 8883/tcp  # MQTT (TLS)
sudo ufw allow 3000/tcp  # Grafana (可選)

# SSH 硬化
# 禁用密碼認證，僅允許公鑰
echo "PasswordAuthentication no" | sudo tee -a /etc/ssh/sshd_config
sudo systemctl restart ssh
```

### 應用安全

```bash
# 定期更新依賴
npm audit fix
npm update

# 限制文件權限
chmod 600 /opt/pickle-heaven/.env.production
chmod 600 /var/log/pickle-heaven/*.log
```

---

## 部署檢查清單

### 上線前最終檢查

- [ ] 操作系統安裝並更新
- [ ] Node.js 與 npm 安裝
- [ ] Mosquitto 配置完成
- [ ] TLS 憑證已生成
- [ ] Gateway Agent 已部署
- [ ] RS-485 適配器已連接
- [ ] Relay 設備已識別
- [ ] Systemd 服務已啟用
- [ ] 端到端測試已通過
- [ ] 負載測試已通過
- [ ] 日誌輸出正常
- [ ] 監控系統就緒
- [ ] 備份計劃已制定
- [ ] 故障排查文檔已準備
- [ ] 運維人員已培訓

---

## 下一步

### 緊急集成（D8+）

1. **金流商 API 整合**（2-3 天）
   - TapPay / NewebPay 整合
   - 沙盒環境測試
   - 生產環境配置

2. **通知服務整合**（1-2 天）
   - LINE Messaging API
   - Email 服務（SendGrid/AWS SES）
   - 通知樣板驗證

3. **生產環境部署**（1 週）
   - 云端 API 服務部署
   - 負載均衡配置
   - CDN 緩存配置
   - 監控告警激活

---

**文檔版本**：1.0  
**最後更新**：2026-11-12  
**下一次審查**：2026-12-15
