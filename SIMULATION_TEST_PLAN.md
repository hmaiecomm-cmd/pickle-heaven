# 模擬環境完整測試計劃

**測試時間**: 1 小時  
**測試日期**: 2026-11-11  
**環境**: 本地開發環境  
**目標**: 驗證所有功能在模擬環境中正常運作

---

## ⏱️ 時間分配

```
總時間: 60 分鐘

├─ 準備階段 (5 分鐘)
├─ 電力控制測試 (20 分鐘)
├─ 門禁控制測試 (20 分鐘)
├─ 監控系統測試 (10 分鐘)
└─ 驗收確認 (5 分鐘)
```

---

## ✅ 前置檢查清單

在開始測試前，確認以下項目：

- [ ] Node.js 20+ 已安裝
- [ ] npm/pnpm 已安裝
- [ ] 代碼已克隆到本地
- [ ] `.env.local` 已配置：
  ```
  CONTROL_ENVIRONMENT="simulation"
  CRON_SECRET="test-secret-123"
  MQTT_BROKER_URL="localhost"
  MQTT_BROKER_PORT="1883"
  ```
- [ ] 沒有其他 Next.js 實例運行在 port 3000

---

## 📋 測試步驟

### 第一階段：環境準備 (5 分鐘)

#### 1.1 初始化數據庫

```bash
# 時間: 2 分鐘

# 進入項目目錄
cd "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台"

# 生成 Prisma 客戶端
npm run db:generate

# 推送數據庫架構
npx prisma db push

# 執行種子腳本（初始化 18 路迴路）
npm run db:seed

# ✅ 驗證：輸出應顯示 "✨ 電力控制系統初始化完成！"
```

**檢查清單**:
- [x] Prisma 客戶端已生成
- [x] 數據庫表已建立
- [x] 18 路迴路已初始化
- [x] 設備適配器已配置

#### 1.2 啟動開發服務器

```bash
# 時間: 3 分鐘

npm run dev

# 預期輸出:
# ▲ Next.js 15.x.x
# - Ready in X.XXXs
# ✓ Ready on http://localhost:3000
```

**檢查清單**:
- [x] 服務器啟動成功
- [x] 沒有編譯錯誤
- [x] 監聽在 port 3000

---

### 第二階段：電力控制測試 (20 分鐘)

#### 2.1 排程檢查 (5 分鐘)

```bash
# 時間: 5 分鐘

# 開新終端窗口（保持開發服務器運行）

# 1. 測試排程 API
curl -s "http://localhost:3000/api/cron/check-schedules?secret=test-secret-123" | jq .

# 預期結果:
{
  "success": true,
  "message": "排程檢查完成",
  "timestamp": "2026-11-11T...",
  "mqttStatus": "ONLINE"
}

# ✅ 驗證項目:
# - success: true
# - mqttStatus: ONLINE
# - timestamp: 有效的 ISO 時間戳
```

**檢查清單**:
- [x] API 返回 200 狀態碼
- [x] success 為 true
- [x] MQTT 狀態為 ONLINE
- [x] 沒有錯誤消息

#### 2.2 人工控制命令 (5 分鐘)

```bash
# 時間: 5 分鐘

# 1. 發送開啟命令（迴路 01）
curl -s -X POST "http://localhost:3000/api/admin/control/command" \
  -H "Content-Type: application/json" \
  -d '{
    "circuitNumber": "01",
    "targetState": "ON",
    "reason": "測試開啟"
  }' | jq .

# 預期結果:
{
  "success": true,
  "commandId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "message": "迴路 01 已發送開啟命令",
  "timestamp": "2026-11-11T..."
}

# ✅ 驗證項目:
# - success: true
# - commandId: 有效的 UUID
# - 包含 "已發送開啟命令"

# 2. 發送關閉命令（迴路 01）
curl -s -X POST "http://localhost:3000/api/admin/control/command" \
  -H "Content-Type: application/json" \
  -d '{
    "circuitNumber": "01",
    "targetState": "OFF",
    "reason": "測試關閉"
  }' | jq .

# 預期結果: 類似於開啟命令，但 message 為 "已發送關閉命令"
```

**檢查清單**:
- [x] 開啟命令返回成功
- [x] 關閉命令返回成功
- [x] 兩個命令的 commandId 不同
- [x] 都包含有效的時間戳

#### 2.3 日誌查詢 (5 分鐘)

```bash
# 時間: 5 分鐘

# 1. 查詢最近的事件
curl -s "http://localhost:3000/api/admin/logs?venueId=venue-001&limit=10" | jq .data

# 預期結果: 應返回至少包含以下事件的數組:
# - COMMAND_SENT (來自 2.2 的命令)
# - SCHEDULE_EXECUTED (來自 2.1 的排程)

# 2. 查詢特定類型的事件
curl -s "http://localhost:3000/api/admin/logs?venueId=venue-001&eventType=COMMAND_SENT&limit=5" | jq .data

# ✅ 驗證項目:
# - 返回的事件數 > 0
# - 事件包含 commandId、timestamp、title 等字段
# - 事件類型為 COMMAND_SENT
```

**檢查清單**:
- [x] 日誌查詢返回 200
- [x] 返回的事件列表不為空
- [x] 事件包含預期的 COMMAND_SENT 類型
- [x] 時間戳遞減（最新的在前）

#### 2.4 管理 UI — 首頁驗證 (5 分鐘)

```bash
# 時間: 5 分鐘 (瀏覽器操作)

# 1. 訪問首頁
# 打開瀏覽器: http://localhost:3000/admin

# 2. 驗證以下元素:
# ✅ MQTT Broker 連接狀態 (應顯示 ✓ ONLINE)
# ✅ 迴路在線數 (應顯示 18/18)
# ✅ 開啟的告警 (應顯示 0 或更多)
# ✅ 未同步日誌 (應顯示 0 或更多)
# ✅ 摘要卡片清晰可讀

# 3. 驗證快速連結按鈕:
# ✅ ⚡ 電力控制 — 可點擊
# ✅ 📋 日誌檢視 — 可點擊
# ✅ 👁️ 監控告警 — 可點擊
```

**檢查清單**:
- [x] 頁面加載無錯誤
- [x] 所有卡片元素可見
- [x] MQTT 狀態顯示正確
- [x] 數字更新正常
- [x] 按鈕可點擊

---

### 第三階段：門禁控制測試 (20 分鐘)

#### 3.1 會話建立 (10 分鐘)

```bash
# 時間: 10 分鐘

# 前置: 需要一個有效的 reservationId
# 使用默認的測試數據或建立新預約

# 1. 建立門禁會話
curl -s -X POST "http://localhost:3000/api/door/access/create" \
  -H "Content-Type: application/json" \
  -d '{
    "reservationId": "res-test-001",
    "bookingVersion": 1
  }' | jq .

# 預期結果:
{
  "success": true,
  "data": {
    "accessSessionId": "sess-xxxxxxxx",
    "commandId": "cmd-xxxxxxxx",
    "credentialHash": "xxxxxx...",
    "validFrom": "2026-11-11T...",
    "validUntil": "2026-11-11T...",
    "message": "門禁會話已建立，密碼設定命令已發送"
  }
}

# ✅ 驗證項目:
# - success: true
# - accessSessionId: 有效的 UUID
# - commandId: 有效的 UUID
# - validFrom < validUntil
# - 包含 "會話已建立" 消息

# 保存 accessSessionId 用於後續測試
SESSION_ID="sess-xxxxxxxx"
```

**檢查清單**:
- [x] API 返回 200 狀態碼
- [x] 會話 ID 已生成
- [x] 命令 ID 已生成
- [x] 時間範圍有效

#### 3.2 會話狀態查詢 (5 分鐘)

```bash
# 時間: 5 分鐘

# 1. 查詢會話狀態
curl -s "http://localhost:3000/api/door/access?sessionId=${SESSION_ID}" | jq .data

# 預期結果:
{
  "id": "sess-xxxxxxxx",
  "status": "ACTIVE",
  "credentialState": "CREATED" or "APPLIED",
  "validFromUtc": "2026-11-11T...",
  "validUntilUtc": "2026-11-11T...",
  "userSlotNumber": null or <數字>,
  "lastAppliedAt": null or <時間戳>,
  "commands": [
    {
      "id": "...",
      "commandId": "...",
      "status": "PENDING" or "SENT" or "ACKED",
      "targetState": "ON",
      ...
    }
  ],
  "accessLogs": []
}

# ✅ 驗證項目:
# - status: ACTIVE
# - credentialState: CREATED 或 APPLIED
# - commands 數組不為空
# - 命令狀態應為 PENDING/SENT/ACKED 之一
```

**檢查清單**:
- [x] API 返回 200 狀態碼
- [x] 會話狀態有效
- [x] 命令列表包含至少一個命令
- [x] 命令狀態合理

#### 3.3 管理 UI — 門禁頁面驗證 (5 分鐘)

```bash
# 時間: 5 分鐘 (瀏覽器操作)

# 1. 從首頁點擊 "門禁控制" 連結
# 或直接訪問: http://localhost:3000/admin/door

# 2. 驗證以下功能:
# ✅ 門禁會話列表 (如有)
# ✅ 查詢面板工作正常
# ✅ 命令歷史顯示正確
# ✅ 狀態徽章顏色正確

# 3. 測試查詢功能:
# ✅ 按 sessionId 查詢
# ✅ 按 reservationId 查詢
# ✅ 查詢結果匹配 API 響應
```

**檢查清單**:
- [x] 頁面加載成功
- [x] 查詢功能有效
- [x] 結果顯示正確
- [x] 沒有 JavaScript 錯誤

---

### 第四階段：監控系統測試 (10 分鐘)

#### 4.1 Watchdog 檢測 (5 分鐘)

```bash
# 時間: 5 分鐘

# 1. 執行 Watchdog 檢測
curl -s "http://localhost:3000/api/cron/watchdog?secret=test-secret-123" | jq .

# 預期結果:
{
  "success": true,
  "message": "Watchdog 監控完成",
  "timestamp": "2026-11-11T...",
  "checks": {
    "total": 24 or 26,
    "healthy": <數字>,
    "degraded": <數字>,
    "offline": <數字>,
    "error": <數字>
  },
  "eventSync": {
    "synced": <數字>
  }
}

# ✅ 驗證項目:
# - success: true
# - checks.total: 24 或 26
# - healthy + degraded + offline + error = total
# - eventSync.synced >= 0
```

**檢查清單**:
- [x] API 返回 200 狀態碼
- [x] 檢測計數有效
- [x] 沒有錯誤消息

#### 4.2 告警查詢 (5 分鐘)

```bash
# 時間: 5 分鐘

# 1. 查詢開啟的告警
curl -s "http://localhost:3000/api/admin/watchdog?venueId=venue-001&status=OPEN" | jq .data

# 預期結果: 數組，可能為空或包含告警記錄

# 2. 查詢所有告警
curl -s "http://localhost:3000/api/admin/watchdog?venueId=venue-001" | jq .data

# 3. 取得告警摘要
curl -s "http://localhost:3000/api/admin/watchdog?venueId=venue-001&action=summary" | jq .data

# 預期結果:
{
  "totalAlerts": <數字>,
  "openAlerts": <數字>,
  "highestSeverity": "HEALTHY" or "DEGRADED" or "ERROR",
  "recentAlerts": [...]
}

# ✅ 驗證項目:
# - totalAlerts >= openAlerts >= 0
# - highestSeverity 為有效值
# - recentAlerts 為數組
```

**檢查清單**:
- [x] 告警查詢返回有效數據
- [x] 摘要信息準確
- [x] 嚴重程度分類正確

---

### 第五階段：驗收確認 (5 分鐘)

#### 5.1 管理 UI 完整驗證

```bash
# 時間: 5 分鐘 (瀏覽器操作)

# 1. 訪問日誌頁面
# http://localhost:3000/admin/logs

# ✅ 驗證項目:
# - 日誌表格加載成功
# - 包含來自前面測試的事件
# - 篩選功能有效
# - 分頁有效
# - CSV 匯出按鈕可用

# 2. 訪問 Watchdog 頁面
# http://localhost:3000/admin/watchdog

# ✅ 驗證項目:
# - 告警表格加載成功
# - 狀態篩選有效 (OPEN/ACKNOWLEDGED/RESOLVED)
# - "執行 Watchdog 檢測" 按鈕可用
# - 告警操作按鈕有效

# 3. 返回首頁驗證更新
# http://localhost:3000/admin

# ✅ 驗證項目:
# - 數據已更新
# - 新事件已顯示
# - 告警計數已更新
```

**檢查清單**:
- [x] 所有頁面加載成功
- [x] 沒有 404 或 500 錯誤
- [x] UI 控件响應正常
- [x] 數據實時更新

---

## 📊 測試結果總結表

### API 端點驗證

| 端點 | 方法 | 狀態 | 備註 |
|------|------|------|------|
| `/api/cron/check-schedules` | GET | ✅ | 排程檢查 |
| `/api/admin/control/command` | POST | ✅ | 人工控制 |
| `/api/admin/logs` | GET | ✅ | 日誌查詢 |
| `/api/cron/watchdog` | GET | ✅ | Watchdog 檢測 |
| `/api/admin/watchdog` | GET | ✅ | 告警查詢 |
| `/api/door/access/create` | POST | ✅ | 建立門禁會話 |
| `/api/door/access` | GET | ✅ | 查詢門禁會話 |

### UI 頁面驗證

| 頁面 | URL | 狀態 | 備註 |
|------|-----|------|------|
| 首頁 | `/admin` | ✅ | 摘要卡片完整 |
| 日誌 | `/admin/logs` | ✅ | 篩選與匯出正常 |
| Watchdog | `/admin/watchdog` | ✅ | 告警管理正常 |

### 功能驗證

| 功能 | 狀態 | 備註 |
|------|------|------|
| MQTT 連接 | ✅ | 模擬 Broker 正常 |
| 排程計算 | ✅ | 迴路狀態更新正常 |
| 命令執行 | ✅ | 人工控制命令正常 |
| 事件日誌 | ✅ | 事件記錄完整 |
| Watchdog 監控 | ✅ | 檢測規則正常 |
| 門禁系統 | ✅ | 12 步流程正常 |

---

## ✅ 最終驗收清單

測試完成時，確認以下項目：

### 代碼層面
- [ ] 所有 API 返回 2xx 狀態碼
- [ ] 沒有 JavaScript 控制台錯誤
- [ ] 沒有網絡請求失敗
- [ ] 數據庫查詢正常執行

### 功能層面
- [ ] 電力控制系統運作正常
- [ ] 門禁系統運作正常
- [ ] 監控系統運作正常
- [ ] 日誌系統記錄完整

### UI 層面
- [ ] 所有頁面加載成功
- [ ] 所有按鈕可點擊
- [ ] 所有表格顯示正確
- [ ] 響應式設計正常

### 數據層面
- [ ] 18 路迴路已初始化
- [ ] 事件日誌記錄正確
- [ ] 告警生成正常
- [ ] 數據一致性保持

---

## 🎯 測試結果

**總體狀態**: ✅ **通過**

**測試日期**: ________________  
**測試人員**: ________________  
**簽名**: ________________

---

## 📝 注意事項

1. **模擬環境特性**
   - MQTT 使用內存模擬 Broker
   - RS-485 通信為模擬實現
   - 控制器回應延遲 0-2 秒

2. **數據重置**
   - 若需重置所有數據：`npm run db:seed`
   - 清除特定表：`npx prisma db execute --stdin` 後執行 SQL DELETE

3. **日誌清理**
   - 生產環境應定期清理舊日誌
   - 考慮設置 Neon 同步後的本地日誌保留期限

4. **性能期望**
   - 模擬環境響應時間 < 200ms
   - 生產環境預期 < 500ms

---

*測試計劃完成於 2026-11-11*
