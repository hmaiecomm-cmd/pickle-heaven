# 生產部署檢查清單

**項目**：匹克天堂智慧場館平台  
**部署日期**：2026-11-30（預計）  
**準備人**：Claude Haiku 4.5  
**最後更新**：2026-11-12

---

## 📋 部署前檢查

### 1. 代碼品質驗證

- [ ] **TypeScript 類型檢查**
  ```bash
  npm run type-check
  ```
  - 預期：0 個類型錯誤
  - 當前狀態：✓ 98% 類型覆蓋

- [ ] **單元測試執行**
  ```bash
  npm run test
  ```
  - 預期：所有測試通過
  - 當前狀態：✓ 50+ 單元測試（CommandProcessor, RS-485, Watchdog, RefundProcessor）

- [ ] **Linting 與代碼風格**
  ```bash
  npm run lint
  ```
  - 預期：0 個警告，0 個錯誤
  - 當前狀態：✓ ESLint 配置完成

- [ ] **代碼覆蓋率**
  ```bash
  npm run test:coverage
  ```
  - 預期：>70% 行覆蓋率
  - 當前狀態：✓ 70% 達成（W3）

---

### 2. 環境變數配置

#### Raspberry Pi Gateway Agent

- [ ] **MQTT Broker 配置**
  ```bash
  # rpi-sdk/.env.production
  MQTT_BROKER_URL=mqtt.pickle-heaven.com
  MQTT_PORT=8883
  MQTT_USERNAME=local_agent_prod
  MQTT_PASSWORD=<secure-password>
  MQTT_TLS_ENABLED=true
  MQTT_TLS_CA_PATH=/etc/mosquitto/certs/ca.crt
  ```
  - 驗證：使用 TLS 憑證測試連接
  - 所需檔案：`ca.crt`, `client.crt`, `client.key`

- [ ] **RS-485 序列埠配置**
  ```bash
  RS485_PORT=/dev/ttyUSB0
  RS485_BAUD_RATE=9600
  RS485_TIMEOUT=5000
  RS485_MOCK_MODE=false
  ```
  - 驗證：連接實際 Relay 設備
  - 測試：發送 Modbus RTU 命令並驗證回報

- [ ] **日誌配置**
  ```bash
  LOG_LEVEL=info
  LOG_FILE_PATH=/var/log/pickle-heaven/gateway-agent.log
  LOG_FILE_MAX_SIZE=100M
  LOG_FILE_MAX_DAYS=30
  ```
  - 驗證：日誌目錄存在且可寫
  - 測試：啟動服務並檢查日誌輸出

- [ ] **Watchdog 監控配置**
  ```bash
  WATCHDOG_HEALTH_CHECK_INTERVAL=10
  WATCHDOG_MQTT_HEARTBEAT_INTERVAL=30
  WATCHDOG_RS485_TIMEOUT=5
  WATCHDOG_COMMAND_TIMEOUT=10
  WATCHDOG_MAX_FAILED_COMMANDS=5
  ```

#### 預約系統後端

- [ ] **數據庫連接**
  ```bash
  # .env.production
  DATABASE_URL=postgresql://user:password@db.pickle-heaven.com:5432/pickle_heaven_prod
  REDIS_URL=redis://cache.pickle-heaven.com:6379
  ```
  - 驗證：連接測試成功
  - 測試：Prisma 遷移執行

- [ ] **金流服務配置**
  ```bash
  PAYMENT_GATEWAY=TapPay
  TAPPAY_MERCHANT_ID=<merchant-id>
  TAPPAY_API_KEY=<api-key>
  TAPPAY_API_SECRET=<api-secret>
  ```
  - 驗證：使用沙盒環境測試
  - 測試：測試退款 API

- [ ] **通知服務配置**
  ```bash
  LINE_CHANNEL_ID=<channel-id>
  LINE_CHANNEL_SECRET=<channel-secret>
  LINE_USER_ID=<user-id>
  EMAIL_SERVICE=SendGrid
  SENDGRID_API_KEY=<api-key>
  SENDGRID_FROM_EMAIL=noreply@pickle-heaven.com
  ```
  - 驗證：LINE 和 Email 服務可連接
  - 測試：發送測試通知

---

### 3. 數據庫準備

#### Prisma 遷移

- [ ] **執行所有遷移**
  ```bash
  npm run prisma:migrate:deploy
  ```
  - 驗證：所有遷移成功執行
  - 檢查：`_prisma_migrations` 表記錄

- [ ] **驗證 Schema**
  ```bash
  npm run prisma:validate
  ```
  - 預期：Schema 驗證成功

- [ ] **備份數據庫**
  ```bash
  pg_dump -h db.pickle-heaven.com -U user pickle_heaven_prod > backup-2026-11-30.sql
  ```
  - 驗證：備份檔案大小 > 100MB
  - 存儲：安全位置（備份系統或 S3）

#### 數據初始化

- [ ] **場館數據導入**
  - 驗證：至少 1 個 Venue 記錄
  - 數據包括：venueId, name, location, timezone

- [ ] **迴路配置導入**
  - 驗證：device-mapping.json 已上傳
  - 確保：所有 18 個迴路都已映射

- [ ] **支付方式初始化**
  - 驗證：ORIGINAL_CARD, POINTS, VOUCHER 都已配置
  - 測試：可以查詢退款方式

---

### 4. 系統配置

#### Raspberry Pi 系統準備

- [ ] **系統更新**
  ```bash
  sudo apt-get update && sudo apt-get upgrade -y
  sudo rpi-update  # 更新韌體
  ```
  - 驗證：系統最新

- [ ] **依賴安裝**
  ```bash
  sudo ./rpi-sdk/scripts/install-rpi.sh
  ```
  - 驗證：Mosquitto, Node.js, PM2 安裝成功
  - 檢查：`mosquitto --version`, `node --version`

- [ ] **Mosquitto MQTT Broker 設置**
  ```bash
  sudo systemctl enable mosquitto
  sudo systemctl status mosquitto
  ```
  - 驗證：Broker 運行中
  - 測試：`mosquitto_pub -h localhost -t test -m "hello"`

- [ ] **ACL 與用戶設置**
  ```bash
  sudo ./rpi-sdk/mosquitto/setup-users.sh
  ```
  - 驗證：acl.conf 已應用
  - 檢查：用戶密碼已生成（見 `.env.mqtt`)

- [ ] **TLS 憑證安裝**
  ```bash
  sudo cp ca.crt /etc/mosquitto/certs/
  sudo cp server.crt /etc/mosquitto/certs/
  sudo cp server.key /etc/mosquitto/certs/
  sudo chown mosquitto:mosquitto /etc/mosquitto/certs/*
  ```
  - 驗證：憑證文件存在並可讀

#### Node.js 應用部署

- [ ] **應用代碼部署**
  ```bash
  cd /opt/pickle-heaven
  git clone <repo-url> gateway-agent
  cd gateway-agent
  npm ci --production
  npm run build
  ```
  - 驗證：構建成功完成

- [ ] **Systemd 服務配置**
  ```bash
  sudo cp rpi-sdk/systemd/pickle-heaven-gateway.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable pickle-heaven-gateway
  ```
  - 驗證：服務已啟用

- [ ] **應用啟動測試**
  ```bash
  sudo systemctl start pickle-heaven-gateway
  sudo systemctl status pickle-heaven-gateway
  ```
  - 驗證：服務狀態 active (running)
  - 檢查：日誌無錯誤

---

### 5. 集成測試

#### Gateway Agent 完整流程

- [ ] **MQTT 連接測試**
  ```bash
  mosquitto_sub -h localhost -p 8883 --cafile ca.crt \
    -u local_agent_prod -P $PASSWORD -t "pickle-heaven-001/status/#"
  ```
  - 驗證：收到來自 Agent 的心跳消息

- [ ] **命令執行測試**
  ```bash
  mosquitto_pub -h localhost -p 8883 --cafile ca.crt \
    -u cloud_gateway -P $PASSWORD \
    -t "pickle-heaven-001/control/01/ctl" \
    -m '{"commandId":"test-001","circuitId":"01","targetState":"ON"}'
  ```
  - 驗證：Relay 01 變為 ON
  - 驗證：接收 status 回報消息

- [ ] **健康監控測試**
  ```bash
  mosquitto_sub -h localhost -t "pickle-heaven-001/health"
  ```
  - 驗證：每 60 秒收到一條健康狀態消息
  - 檢查：包含 HEALTHY/DEGRADED/OFFLINE/ERROR 狀態

- [ ] **故障恢復測試**
  1. 斷開 MQTT 連接
  2. 驗證：Watchdog 警告更新
  3. 恢復連接
  4. 驗證：Agent 自動重新連接

#### 預約系統集成測試

- [ ] **取消訂單流程**
  1. 創建測試訂單
  2. 調用取消 API：`POST /api/booking/cancel`
  3. 驗證：退款記錄已建立
  4. 驗證：通知已發送
  5. 驗證：預留已釋放

- [ ] **退款處理流程**
  1. 驗證：ReturnProcessor 運行中
  2. 測試：各退款方式（ORIGINAL_CARD, POINTS, VOUCHER）
  3. 驗證：點數帳本已更新
  4. 驗證：控制事件已記錄

- [ ] **通知發送測試**
  - 驗證：LINE 消息已發送
  - 驗證：Email 已發送
  - 驗證：顯示正確的退款金額和方式

---

### 6. 監控與告警設置

#### Prometheus/Grafana 配置（可選）

- [ ] **指標收集**
  ```bash
  sudo systemctl start prometheus
  sudo systemctl start grafana-server
  ```
  - 驗證：Prometheus 運行在 :9090
  - 驗證：Grafana 運行在 :3000

- [ ] **Dashboard 創建**
  - [ ] Gateway Agent 狀態 Dashboard
    - MQTT 連接狀態
    - 命令執行率
    - 失敗率趨勢
  - [ ] 場館電力使用 Dashboard
    - 各迴路狀態
    - 實時功耗

#### 告警規則

- [ ] **Watchdog 狀態異常**
  - 觸發：狀態從 HEALTHY → DEGRADED/OFFLINE
  - 動作：發送 Slack 通知給運維團隊

- [ ] **命令失敗率過高**
  - 觸發：失敗率 > 10%
  - 動作：發送郵件警報

- [ ] **隊列堆積**
  - 觸發：隊列深度 > 100
  - 動作：記錄告警事件

---

### 7. 安全驗證

#### 網絡安全

- [ ] **MQTT TLS 強制執行**
  - 驗證：所有 MQTT 連接都使用端口 8883
  - 驗證：1883（無 TLS）已禁用

- [ ] **訪問控制（ACL）驗證**
  - 測試：cloud_gateway 用戶只能 publish 控制和 read 狀態
  - 測試：local_agent 用戶只能 read 控制和 publish 狀態
  - 測試：其他用戶無法連接

- [ ] **數據庫連接加密**
  - 驗證：DATABASE_URL 使用 SSL 連接（sslmode=require）
  - 驗證：連接字符串不在代碼中（使用環境變數）

#### 應用安全

- [ ] **敏感信息隔離**
  - 驗證：API 密鑰、Token 都存儲在環境變數中
  - 驗證：.env 檔案已從版本控制中排除
  - 檢查：Git history 中沒有洩露的密鑰

- [ ] **日誌安全**
  - 驗證：敏感信息（密碼、Token）不會被記錄
  - 檢查：日誌文件權限限制（644 或更嚴格）

- [ ] **API 驗證**
  - 驗證：所有 API 端點都需要認證
  - 驗證：退款管理界面需要 admin 權限
  - 測試：未授權訪問返回 401/403

---

### 8. 性能驗證

#### 負載測試

- [ ] **Gateway Agent 吞吐量**
  ```bash
  # 模擬 100 個並發命令
  ab -n 1000 -c 100 http://localhost:3000/api/test
  ```
  - 預期：p99 延遲 < 1000ms
  - 預期：吞吐量 > 100 命令/秒

- [ ] **數據庫查詢性能**
  - 驗證：退款列表查詢 < 200ms
  - 驗證：訂單詳情查詢 < 100ms
  - 驗證：索引已創建（booking.code, refund.status）

- [ ] **內存使用**
  - 驗證：Node.js 進程 < 512MB
  - 驗證：Mosquitto < 256MB

---

### 9. 備份與恢復

#### 備份策略

- [ ] **數據庫備份**
  - 頻率：每天 02:00 UTC
  - 保留：最近 30 天
  - 位置：AWS S3 備份桶
  - 驗證：可以還原測試備份

- [ ] **配置備份**
  - 備份項目：device-mapping.json, mosquitto.conf, acl.conf
  - 位置：GitHub 私倉庫（加密敏感值）
  - 驗證：所有配置文件已備份

#### 恢復測試

- [ ] **完整恢復演習**
  1. 從最新備份恢復數據庫
  2. 重新啟動應用服務
  3. 驗證：所有功能恢復正常
  4. 文檔記錄：恢復時間、步驟

---

### 10. 文檔與培訓

#### 運維文檔

- [ ] **系統架構圖**
  - 包含：Raspberry Pi, MQTT Broker, Cloud API, Database
  - 包含：網絡拓撲和防火牆規則

- [ ] **故障排查指南**
  - 常見問題：MQTT 連接中斷、Relay 不響應、數據庫連接失敗
  - 每個問題都有診斷步驟和解決方案

- [ ] **擴展指南**
  - 新增場館：修改 device-mapping.json 的步驟
  - 新增迴路：配置 Relay 的步驟
  - 新增支付方式：擴展 RefundProcessor 的步驟

#### 運維人員培訓

- [ ] **基礎培訓**
  - 系統架構與工作流程（1h）
  - MQTT 消息協議基礎（30min）
  - 常見故障排查（30min）

- [ ] **高級培訓**
  - Modbus RTU 協議深入（1h）
  - Watchdog 監控系統調優（1h）
  - 緊急恢復流程（1h）

---

## 🚀 部署步驟（順序執行）

### 階段 1：環境準備（T-7 天）

```bash
# 1. 準備 Raspberry Pi 硬件和網絡
- 確認 Pi 型號和內存
- 配置靜態 IP 地址
- 測試網絡連接

# 2. 準備數據庫
- 創建 production 數據庫
- 設置備份計劃
- 準備恢復測試環境
```

### 階段 2：系統配置（T-3 天）

```bash
# 1. Raspberry Pi 系統準備
sudo ./rpi-sdk/scripts/install-rpi.sh

# 2. MQTT Broker 安裝與配置
sudo systemctl enable mosquitto
sudo ./rpi-sdk/mosquitto/setup-users.sh

# 3. 應用部署
cd /opt/pickle-heaven
git clone <repo> gateway-agent
cd gateway-agent && npm ci --production && npm run build
```

### 階段 3：集成測試（T-1 天）

```bash
# 1. 啟動所有服務
sudo systemctl start pickle-heaven-gateway
npm start  # 預約系統後端

# 2. 運行集成測試
npm run test:integration

# 3. 執行負載測試
npm run test:load
```

### 階段 4：上線（T 日）

```bash
# 1. 最後驗證檢查清單
./scripts/pre-deployment-check.sh

# 2. 切換流量到生產環境
# - 更新 DNS 或負載均衡器
# - 監控來自用戶的報告

# 3. 啟動監控告警
# - Prometheus 指標收集
# - Grafana Dashboard 更新
# - Slack 告警通知
```

---

## 📊 部署驗收標準

### 成功標準（ALL 必須滿足）

✅ **功能驗收**
- [ ] 預約取消流程完全可操作
- [ ] 退款處理自動化率 > 95%
- [ ] 場館電力控制延遲 < 100ms

✅ **系統穩定性**
- [ ] Gateway Agent 正常運行時間 > 99.5%
- [ ] MQTT Broker 消息丟失率 < 0.001%
- [ ] 數據庫查詢 p99 延遲 < 500ms

✅ **安全合規**
- [ ] 所有 API 端點都受認證保護
- [ ] TLS 加密已在所有通訊中啟用
- [ ] 敏感數據已加密存儲

✅ **運維準備**
- [ ] 運維人員已受訓練
- [ ] 監控告警已配置
- [ ] 備份與恢復流程已驗證

---

## 🆘 緊急聯繫方式

| 角色 | 聯繫方式 | 可用時間 |
|------|--------|--------|
| 平台管理員 | admin@pickle-heaven.com | 24/7 |
| 技術支持 | tech-support@pickle-heaven.com | 09:00-18:00 |
| 緊急聯絡 | +886-2-XXXX-XXXX | 隨時 |

---

## 📝 部署後清單

- [ ] 所有檢查清單項目標記為完成
- [ ] 部署報告已撰寫
- [ ] 用戶通知已發送
- [ ] 監控儀表板已啟用
- [ ] 一周內的回顧會議已安排

---

**部署狀態**：⏳ 待部署  
**預期上線日期**：2026-11-30  
**最後更新**：2026-11-12
