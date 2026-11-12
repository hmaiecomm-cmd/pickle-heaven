# 無人化電力控制系統 — 快速參考卡片

**版本**: 1.0 (Phase 1-4 Complete)  
**更新**: 2026-11-11

---

## 🚀 5 分鐘快速啟動

```bash
# 1. 同步數據庫
npm run db:push && npm run db:seed

# 2. 編輯 .env.local
CONTROL_ENVIRONMENT="simulation"
CRON_SECRET="test-secret"

# 3. 啟動開發服務器
npm run dev

# 4. 訪問頁面
http://localhost:3000/admin                 # 首頁
http://localhost:3000/admin/logs            # 日誌
http://localhost:3000/admin/watchdog        # 監控
```

---

## 📍 主要 URL

| 頁面 | URL | 功能 |
|-----|-----|------|
| 首頁 | `/admin` | 摘要卡片、快速連結 |
| 日誌 | `/admin/logs` | 查詢、篩選、匯出 |
| Watchdog | `/admin/watchdog` | 告警管理、手動檢測 |
| 電力控制 | `/admin/control` | 18 路迴路表格（計劃） |

---

## 🔌 API 命令速查

### 排程檢查
```bash
curl "http://localhost:3000/api/cron/check-schedules?secret=test-secret"
```

### 人工控制（開啟迴路 01）
```bash
curl -X POST "http://localhost:3000/api/admin/control/command" \
  -H "Content-Type: application/json" \
  -d '{
    "circuitNumber": "01",
    "targetState": "ON",
    "reason": "測試"
  }'
```

### 人工控制（關閉迴路 01）
```bash
curl -X POST "http://localhost:3000/api/admin/control/command" \
  -H "Content-Type: application/json" \
  -d '{
    "circuitNumber": "01",
    "targetState": "OFF",
    "reason": "測試"
  }'
```

### Watchdog 檢測
```bash
curl "http://localhost:3000/api/cron/watchdog?secret=test-secret"
```

### 查詢日誌（最近 50 條）
```bash
curl "http://localhost:3000/api/admin/logs?venueId=venue-001&limit=50"
```

### 查詢日誌（ERROR 級別）
```bash
curl "http://localhost:3000/api/admin/logs?venueId=venue-001&severity=ERROR"
```

### 查詢告警（開啟狀態）
```bash
curl "http://localhost:3000/api/admin/watchdog?venueId=venue-001&status=OPEN"
```

### 確認告警
```bash
curl -X POST "http://localhost:3000/api/admin/watchdog" \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "alert-id",
    "action": "acknowledge",
    "note": "已確認"
  }'
```

### 解決告警
```bash
curl -X POST "http://localhost:3000/api/admin/watchdog" \
  -H "Content-Type: application/json" \
  -d '{
    "alertId": "alert-id",
    "action": "resolve",
    "note": "已解決"
  }'
```

---

## 🔧 常見配置修改

### 修改營業時間（08:00-22:00）
```sql
UPDATE OperatingHours
SET businessStartMinute = 480,    -- 08:00
    businessEndMinute = 1320      -- 22:00
WHERE venueId = 'venue-001';
```

### 修改夜間時段（18:00-22:00）
```sql
UPDATE OperatingHours
SET nightStartMinute = 1080,      -- 18:00
    nightEndMinute = 1320         -- 22:00
WHERE venueId = 'venue-001';
```

### 禁用特定迴路（迴路 17、18）
```sql
UPDATE Circuit
SET enabled = false
WHERE circuitNumber IN ('17', '18');
```

### 啟用遠端控制（迴路 01-09）
```sql
UPDATE Circuit
SET allowRemoteControl = true
WHERE circuitNumber IN ('01', '02', '03', '04', '05', '06', '07', '08', '09');
```

---

## 📊 18 路迴路對應表

| 迴路 | 名稱 | 類別 | 默認狀態 | 遠端控制 | 排程控制 |
|-----|------|------|---------|---------|---------|
| 01 | 球場 A 主燈 | RESERVATION_DYNAMIC | OFF | ✓ | ✓ |
| 02 | 球場 A 邊燈 | RESERVATION_DYNAMIC | OFF | ✓ | ✓ |
| 03 | 球場 B 主燈 | RESERVATION_DYNAMIC | OFF | ✓ | ✓ |
| 04 | 球場 B 邊燈 | RESERVATION_DYNAMIC | OFF | ✓ | ✓ |
| 05 | 大廳主燈 | OPERATING_HOURS | OFF | ✓ | ✓ |
| 06 | 大廳邊燈 | OPERATING_HOURS | OFF | ✓ | ✓ |
| 07 | 入口燈 | OPERATING_HOURS | OFF | ✓ | ✓ |
| 08 | 走廊燈 | OPERATING_HOURS | OFF | ✓ | ✓ |
| 09 | 樓梯燈 | OPERATING_HOURS | OFF | ✓ | ✓ |
| 10 | 夜間照明 A | NIGHT_AMBIENT | OFF | ✗ | ✓ |
| 11 | 夜間照明 B | NIGHT_AMBIENT | OFF | ✗ | ✓ |
| 12 | 空調系統 | ALWAYS_ON | ON | ✗ | ✗ |
| 13 | 安全系統 | ALWAYS_ON | ON | ✗ | ✗ |
| 14 | 淨水系統 | ALWAYS_ON | ON | ✗ | ✗ |
| 15 | 應急燈 | ALWAYS_ON | ON | ✗ | ✗ |
| 16 | 充電站 | ALWAYS_ON | ON | ✗ | ✗ |
| 17 | 預留迴路 1 | RESERVED | OFF | ✗ | ✗ |
| 18 | 預留迴路 2 | RESERVED | OFF | ✗ | ✗ |

---

## ⚡ 故障排除快速指南

### 問題：18 路未顯示
**解決**: `npm run db:seed`

### 問題：MQTT 顯示離線
**檢查**:
1. 確認 `.env.local` 中 `CONTROL_ENVIRONMENT="simulation"`
2. 檢查日誌：`curl "http://localhost:3000/api/admin/logs?venueId=venue-001&eventType=MQTT_CONNECTED"`

### 問題：命令未執行
**檢查清單**:
1. MQTT 連接狀態？ → `/admin` 首頁卡片
2. 迴路啟用？ → 資料庫 Circuit 表
3. 允許遠端控制？ → Circuit.allowRemoteControl = true
4. 設備適配器啟用？ → 資料庫 DeviceAdapter 表

### 問題：日誌未同步到 Neon
**解決**:
1. 檢查 `NEON_DATABASE_URL` 是否設置
2. 查詢 ControlEvent 表，檢查 `syncedToNeon` 狀態

### 問題：Watchdog 告警過多
**解決**:
1. 進入 `/admin/watchdog`
2. 查看告警詳情，識別根因
3. 修復根本問題
4. 點擊「確認」或「解決」

---

## 📋 驗收檢查清單

### 數據庫 ✅
- [ ] Circuit 表有 18 路
- [ ] OperatingHours 已設置
- [ ] DeviceAdapter 已配置

### API ✅
- [ ] `/api/cron/check-schedules` 正常
- [ ] `/api/admin/control/command` 正常
- [ ] `/api/admin/logs` 正常
- [ ] `/api/admin/watchdog` 正常

### 前端 ✅
- [ ] `/admin` 顯示摘要卡片
- [ ] `/admin/logs` 可查詢日誌
- [ ] `/admin/watchdog` 可管理告警

### 功能 ✅
- [ ] 預約時自動生成排程
- [ ] 人工命令可正常發送
- [ ] Watchdog 檢測正常
- [ ] 事件日誌記錄完整

---

## 🎯 日常操作

### 早間檢查（30 秒）
```bash
# 檢查系統狀態
curl "http://localhost:3000/api/admin/watchdog?venueId=venue-001&action=summary" | jq '.data.openAlerts'
```
> 如果 openAlerts > 0，訪問 `/admin/watchdog` 查看詳情

### 週期性維護（1 次/週）
```bash
# 備份日誌
curl "http://localhost:3000/api/admin/logs?venueId=venue-001&limit=10000" > logs-backup-$(date +%Y%m%d).json
```

### 月度檢查（1 次/月）
1. 訪問 `/admin/control` 驗證迴路配置
2. 訪問 `/admin/watchdog` 查看告警趨勢
3. 檢查 MQTT 連接穩定性

---

## 📚 完整文檔

| 文檔 | 用途 |
|-----|------|
| `QUICK_START_CONTROL_SYSTEM.md` | 5 分鐘啟動 |
| `CONTROL_SYSTEM_IMPLEMENTATION_GUIDE.md` | 完整實施指南 |
| `PROJECT_COMPLETION_SUMMARY.md` | 項目完成總結 |
| `CONTROL_SYSTEM_PHASE[1-4]_*.md` | 各階段詳情 |
| `DOOR_ACCESS_SYSTEM.md` | 門禁系統規範（第六階段） |
| `QUICK_REFERENCE_CARD.md` | 本文檔 |

---

## 🔐 環境變數一覽

### 開發環境 (.env.local)
```bash
# 應用程式
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SESSION_SECRET="local-dev-secret"

# 電力控制
CONTROL_ENVIRONMENT="simulation"
MQTT_BROKER_URL="localhost"
MQTT_BROKER_PORT="1883"

# Cron
CRON_SECRET="my-local-test-secret-123"

# 可選：Neon
# NEON_DATABASE_URL="postgresql://..."
```

### 生產環境 (.env.production)
```bash
# 應用程式
NEXT_PUBLIC_APP_URL="https://your-domain.com"
SESSION_SECRET="long-random-secret"

# 電力控制
CONTROL_ENVIRONMENT="production"
MQTT_BROKER_URL="mqtt.your-domain.com"
MQTT_BROKER_PORT="8883"
MQTT_USE_TLS="true"
MQTT_USERNAME="control-user"
MQTT_PASSWORD="secure-password"
MQTT_TLS_CERT_PATH="/path/to/cert.pem"
MQTT_TLS_KEY_PATH="/path/to/key.pem"
MQTT_TLS_CA_PATH="/path/to/ca.pem"

# Cron
CRON_SECRET="production-cron-secret"
WATCHDOG_HEARTBEAT_TIMEOUT="30"

# Neon
NEON_DATABASE_URL="postgresql://..."
```

---

## 🎁 後續步驟

### ✅ 完成（Phase 1-4）
- 數據模型 + 配置
- 排程 + MQTT + 人工控制
- Watchdog + 日誌系統
- 管理 UI + 首頁摘要

### 📋 可選（Phase 5）
- 完善 `/admin/control` 頁面
- 排程編輯界面
- 性能優化

### 🔮 計劃（Phase 6+）
- 門禁系統整合
- LINE / Email 通知
- 真實環境部署

---

## 💬 支援與反饋

**問題?** → 檢查 `CONTROL_SYSTEM_IMPLEMENTATION_GUIDE.md` 的故障排除段落

**反饋?** → 在 `/admin/watchdog` 或 `/admin/logs` 收集數據，聯繫技術支援

**文檔不清楚?** → 查閱各階段詳細報告（PHASE 1-4）

---

*卡片完成於 2026-11-11*  
*保存此文檔以便快速查閱* 📌
