# Pickle Heaven — Raspberry Pi 現場控制軟件套件

完整的 MQTT Broker + Gateway Agent 軟件包，用於控制現場球場電力設備（18 路迴路）。

## 📋 功能概述

- **MQTT Broker（Mosquitto）** — 本地訊息轉送中心
- **Gateway Agent** — 命令處理與 RS-485 轉換
- **RS-485 通訊** — 與 Relay 設備交互
- **本地佇列** — 離線時備份命令與狀態
- **Watchdog 監控** — 實時健康檢查
- **Systemd 服務** — 自動啟動與管理

## 🚀 快速開始

### 前置需求

- Raspberry Pi（推薦 Pi 4B+ 或更新）
- Raspberry Pi OS（Debian 11+）
- 互聯網連接（初始安裝）
- RS-485 to USB 適配器（或原生 RS-485 埠）

### 一鍵安裝

```bash
# 以 sudo 身份執行
sudo bash rpi-sdk/scripts/install-rpi.sh pickle-heaven-001
```

安裝腳本將自動：
1. ✓ 安裝系統依賴（Mosquitto、Node.js、SQLite）
2. ✓ 部署 Mosquitto Broker（含 ACL 配置）
3. ✓ 部署 Gateway Agent
4. ✓ 建立 Systemd 服務
5. ✓ 啟動所有服務

**預期時間**：3-5 分鐘

## ⚙️ 配置

### 設備映射（關鍵步驟）

編輯設備映射檔案，將迴路號碼映射到實際 Relay 設備：

```bash
sudo nano /opt/pickle-heaven-gateway/config/device-mapping.json
```

**必填項**：

```json
{
  "siteId": "pickle-heaven-001",
  "rs485": {
    "port": "/dev/ttyUSB0",      // RS-485 序列埠
    "baudRate": 9600              // 波特率（依設備而定）
  },
  "devices": {
    "RELAY_001": {
      "macId": "aa:bb:cc:dd:ee:01",  // 設備 MAC ID
      "protocol": "MODBUS_RTU",      // 通訊協議
      "baseAddress": 1,              // RS-485 地址
      "channels": {
        "1": { "circuitId": "01" }   // 通道 1 → 迴路 01
      }
    }
  }
}
```

### 環境變數

編輯 MQTT 密碼（安全存儲）：

```bash
sudo nano /etc/pickle-heaven/gateway.env
```

## 🧪 測試與驗證

### 查看服務狀態

```bash
# 檢查服務運行狀態
systemctl status pickle-heaven-gateway

# 查看實時日誌
journalctl -u pickle-heaven-gateway -f

# 檢查 Mosquitto 狀態
mosquitto -v
```

### 測試 MQTT 通訊

```bash
# 訂閱設備狀態（開新終端機）
mosquitto_sub -u local_agent -P <password> -t 'pickle-heaven-001/control/+/data'

# 發佈控制命令（開新終端機）
mosquitto_pub -u cloud_gateway -P 'cloud_secure_password' \
  -t 'pickle-heaven-001/control/01/ctl' \
  -m '{"commandId":"test-001","targetState":"ON",...}'
```

### 模擬環境測試

```bash
cd /opt/pickle-heaven-gateway

# 啟動模擬模式（不發送真實 RS-485 信號）
SIMULATION_MODE=true npm run start:simulation

# 或透過 systemd 環境變數
sudo systemctl set-environment NODE_ENV=simulation
sudo systemctl restart pickle-heaven-gateway
```

## 📊 日誌與監控

### 日誌位置

```
/opt/pickle-heaven-gateway/logs/          # 應用日誌
/var/log/mosquitto/mosquitto.log           # Broker 日誌
/var/log/pickle-heaven/                   # 系統日誌
```

### 查看健康狀態

```bash
# 檢查最後 50 行日誌
journalctl -u pickle-heaven-gateway -n 50 --no-pager

# 查看錯誤日誌
journalctl -u pickle-heaven-gateway -p err --no-pager

# 實時監控
journalctl -u pickle-heaven-gateway -f
```

## 🔌 設備映射示例

### Modbus RTU Relay（ADVANTECH ADAM-4019 等）

```json
{
  "devices": {
    "RELAY_001": {
      "protocol": "MODBUS_RTU",
      "baseAddress": 1,
      "channels": {
        "1": {
          "circuitId": "01",
          "registerType": "COIL",
          "registerAddress": 0,
          "onValue": 1,
          "offValue": 0
        }
      }
    }
  }
}
```

### 自訂 IoT Relay

```json
{
  "devices": {
    "RELAY_IoT": {
      "protocol": "CUSTOM_JSON",
      "channels": {
        "1": {
          "circuitId": "01",
          "cmdFormat": "SET_RELAY",
          "cmdPayload": {"relay": 1, "state": "{STATE}"}
        }
      }
    }
  }
}
```

## 🛠️ 故障排查

### Gateway Agent 無法啟動

```bash
# 查看詳細錯誤
journalctl -u pickle-heaven-gateway -n 100 --no-pager

# 檢查配置檔案
sudo cat /opt/pickle-heaven-gateway/config/device-mapping.json

# 檢查 RS-485 埠
ls -la /dev/ttyUSB*
dmesg | grep usb
```

### MQTT 連接失敗

```bash
# 檢查 Mosquitto 狀態
sudo systemctl status mosquitto

# 測試本地連接
mosquitto_sub -h localhost -u local_agent -P <password> -t 'test/topic'

# 查看 ACL 錯誤
sudo grep "ACL" /var/log/mosquitto/mosquitto.log
```

### RS-485 無回應

```bash
# 檢查序列埠權限
ls -la /dev/ttyUSB0

# 給予權限（若需要）
sudo usermod -a -G dialout pi

# 使用 minicom 測試序列埠
sudo apt-get install minicom
sudo minicom -D /dev/ttyUSB0

# 查看 RS-485 日誌
journalctl -u pickle-heaven-gateway | grep RS485
```

## 📈 性能調優

### 增加記憶體用量

編輯 `/etc/systemd/system/pickle-heaven-gateway.service`：

```ini
Environment="NODE_OPTIONS=--max-old-space-size=512"
```

### 調整 Watchdog 間隔

編輯 `.env`：

```bash
HEARTBEAT_INTERVAL=30        # 心跳間隔（秒）
HEALTH_CHECK_INTERVAL=60     # 健康檢查間隔（秒）
```

## 🔐 安全建議

### 密碼管理

1. 修改 `cloud_gateway` 密碼（默認：`cloud_secure_password`）
   ```bash
   sudo mosquitto_passwd -b /etc/mosquitto/passwd cloud_gateway "<new_password>"
   ```

2. 更新雲端配置指向新密碼

3. 定期輪轉 `local_agent` 密碼

### 防火牆設定

```bash
# 僅允許本地 MQTT（1883）
sudo ufw allow from 127.0.0.1 to 127.0.0.1 port 1883

# 若需遠端 Broker Bridge，使用 8883（TLS）
sudo ufw allow from <cloud_broker_ip> to 127.0.0.1 port 8883
```

### TLS 憑證

生成自簽證書：

```bash
sudo openssl req -new -x509 -days 365 -nodes \
  -out /etc/mosquitto/certs/server.crt \
  -keyout /etc/mosquitto/certs/server.key
```

## 🔄 升級與維護

### 升級到新版本

```bash
cd /opt/pickle-heaven-gateway
sudo systemctl stop pickle-heaven-gateway
sudo -u pi git pull origin main
sudo -u pi npm install --production
sudo -u pi npm run build
sudo systemctl start pickle-heaven-gateway
```

### 備份配置與資料

```bash
# 完整備份
tar czf backup-$(date +%Y%m%d).tar.gz \
  /opt/pickle-heaven-gateway/config \
  /opt/pickle-heaven-gateway/data \
  /etc/mosquitto/

# 定期備份（cron）
0 2 * * * tar czf /backup/gateway-$(date +\%Y\%m\%d).tar.gz /opt/pickle-heaven-gateway/
```

## 📞 支援與文檔

| 文檔 | 說明 |
|------|------|
| `ARCHITECTURE.md` | 系統架構詳細文檔 |
| `CONFIGURATION.md` | 設備配置指南 |
| `SIMULATION.md` | 模擬環境使用 |
| `TROUBLESHOOTING.md` | 常見問題排查 |
| `API.md` | MQTT API 參考 |

## 📝 授權

MIT License — 詳見 `LICENSE` 檔案

---

**最後更新**：2026-11-12  
**版本**：1.0.0
