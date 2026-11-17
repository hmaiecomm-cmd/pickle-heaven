# Phase 6.4 — Watchdog 監控系統 ✅ 完成

**完成時間**: 2026-11-17  
**狀態**: ✅ Phase 6.4 核心實現完成  
**代碼行數**: ~600 行（API + UI + Cron）

## 實現內容

### 1. 後端實現 ✅

#### Watchdog 擴展 (已有框架)
- **檔案**: `src/server/watchdog-door-extension.ts`
- **13 項檢測規則**（完整實現）:
  1. ✅ 排程 → MQTT 超時
  2. ✅ MQTT → Pi 超時
  3. ✅ Pi → 控制器超時
  4. ✅ 憑證寫入不一致
  5. ✅ 通知失敗
  6. ✅ 取消後仍有效
  7. ✅ 過期憑證未移除
  8. ✅ 控制器時鐘漂移
  9. ✅ Pi 時鐘漂移
  10. ✅ 門長開啟
  11. ✅ 交易 vs 門磁矛盾
  12. ✅ 缺少交易記錄
  13. ✅ 撤銷未確認

#### API 端點
- **檔案**: `src/app/api/door/watchdog/route.ts`
- `POST /api/door/watchdog` — 手動執行所有 13 項檢測
- `GET /api/door/watchdog?venueId=...` — 查詢告警歷史
- 驗證權限: `venue.admin`
- 返回結果包括: 檢測狀態、受影響資源、執行時間

#### Cron 定時任務
- **檔案**: `src/app/api/cron/door-watchdog/route.ts`
- 自動執行時間: 每 6 小時
- 配置在 `vercel.json`: `"schedule": "0 */6 * * *"`
- 支持多場館並行執行
- 自動記錄檢測結果到 `CredentialAlert`

### 2. 前端實現 ✅

#### Watchdog 客戶端組件
- **檔案**: `src/app/admin/access/watchdog-client.tsx`
- **功能**:
  - 實時檢測結果展示
  - 13 項檢測分類顯示
  - 告警歷史查詢與分頁
  - 一鍵執行檢測按鈕
  - 狀態指示器（通過/失敗/警告）
  - 受影響資源計數

#### UI 設計
- 4 格狀態卡片（檢測總數、通過、失敗、上次執行時間）
- 13 項檢測結果列表（分類顯示）
- 告警歷史側欄（可折疊）
- 說明文字與使用指南

### 3. 頁面集成 ✅

#### 門禁管理頁面
- **檔案**: `src/app/admin/access/page.tsx`
- 新增 `AlertsTab` 組件
- 集成 `WatchdogClient`
- 導入 Watchdog 客戶端
- 動態查詢活動場館

## 技術架構

```
├── 前端層
│   ├── WatchdogClient (UI)
│   │   ├── 狀態卡片
│   │   ├── 檢測結果列表
│   │   ├── 告警歷史
│   │   └── 控制按鈕
│   └── 門禁頁面 (alerts 標籤)
│
├── API 層
│   ├── POST /api/door/watchdog (手動執行)
│   ├── GET /api/door/watchdog (查詢告警)
│   └── GET /api/cron/door-watchdog (定時執行)
│
├── 業務邏輯層
│   └── DoorWatchdogExtension (13 項檢測)
│
└── 資料層
    └── CredentialAlert (告警存儲)
```

## 檢測邏輯

### 通信超時檢測
```typescript
1. 排程→MQTT: 尋找 PENDING 命令超過 30 秒
2. MQTT→Pi: 尋找 SENT 命令超過 30 秒
3. Pi→控制器: 尋找 SENT 命令超過 90 秒 (3x 超時)
```

### 憑證一致性檢測
```typescript
4. 寫入不一致: 檢查 credentialState vs userSlotNumber
6. 取消後仍有效: 檢查 REVOKED 會話的憑證狀態
7. 過期憑證: 檢查已過期但仍在控制器上的憑證
```

### 設備狀態檢測
```typescript
8. 控制器時鐘: 查詢時鐘偏差 > 60 秒
9. Pi 時鐘: 透過 MQTT 查詢時鐘狀態
10. 門長開啟: 檢查門開啟超過 300 秒
```

### 交易一致性檢測
```typescript
11. 交易矛盾: 檢查 GRANTED 但門未開的情況
12. 缺少記錄: 檢查已過期但無交易記錄的憑證
13. 撤銷未確認: 檢查 REVOKE_PENDING 超過 1 分鐘
```

## API 範例

### 手動執行檢測
```bash
POST /api/door/watchdog
Content-Type: application/json

{
  "venueId": "venue-123"
}

Response:
{
  "success": true,
  "venueId": "venue-123",
  "runAt": "2026-11-17T10:30:00Z",
  "summary": {
    "total": 13,
    "passed": 12,
    "failed": 1,
    "warnings": 0
  },
  "checkResults": [
    {
      "checkType": "SCHEDULE_TO_MQTT_TIMEOUT",
      "success": true,
      "message": "所有命令發送正常",
      "detectedAt": "2026-11-17T10:30:00Z",
      "affectedResourceCount": 0
    },
    ...
  ]
}
```

### 查詢告警歷史
```bash
GET /api/door/watchdog?venueId=venue-123&limit=20&offset=0

Response:
{
  "success": true,
  "venueId": "venue-123",
  "summary": {
    "total": 24,
    "openCount": 3,
    "errorCount": 2,
    "warningCount": 1
  },
  "alerts": [
    {
      "id": "alert-123",
      "alertType": "SCHEDULE_TO_MQTT_TIMEOUT",
      "severity": "ERROR",
      "title": "排程到 MQTT 超時",
      "description": "有 2 個命令超過待發送時間",
      "status": "OPEN",
      "triggeredBy": "WATCHDOG",
      "createdAt": "2026-11-17T10:30:00Z"
    },
    ...
  ]
}
```

## 定時任務配置

**vercel.json**:
```json
{
  "crons": [
    {
      "path": "/api/cron/door-watchdog",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**執行時間表**:
- 00:00 (每天午夜)
- 06:00 (上午 6 點)
- 12:00 (正午)
- 18:00 (下午 6 點)

## 待實施項目 (Phase 6.6 & 6.7)

### Phase 6.6 — 完整模擬環境
- 虛擬 AR-721 控制器
- 14 層深度模擬
- 邊界情況測試
- 故障注入

### Phase 6.7 — 驗收清單
- 8 項實體驗收測試
- 文檔與檢查清單

## 測試清單

### 功能測試
- [ ] 手動執行檢測（通過 API）
- [ ] 檢測結果顯示正確
- [ ] 告警歷史查詢
- [ ] 定時任務自動執行
- [ ] 多場館並行檢測

### 權限測試
- [ ] 非管理員無法存取 `/api/door/watchdog`
- [ ] 權限檢查正確

### 效能測試
- [ ] 單場館檢測 < 5 秒
- [ ] 多場館定時檢測 < 60 秒
- [ ] 告警查詢響應 < 500ms

### 告警測試
- [ ] 檢測失敗時生成告警
- [ ] 告警正確記錄到數據庫
- [ ] 告警狀態轉換正確

## 下一步

1. **Phase 6.6** (1-2 天)
   - 建立虛擬控制器模擬環境
   - 測試邊界情況

2. **Phase 6.7** (1 天)
   - 建立驗收清單
   - 執行實體測試

3. **部署與監控** (進行中)
   - 部署到 Vercel
   - 設置監控告警
   - 收集真實數據

## 文件

| 文件 | 位置 | 狀態 |
|------|------|------|
| Watchdog 擴展 | `src/server/watchdog-door-extension.ts` | ✅ 完成 |
| Watchdog API | `src/app/api/door/watchdog/route.ts` | ✅ 完成 |
| Cron 任務 | `src/app/api/cron/door-watchdog/route.ts` | ✅ 完成 |
| 客戶端組件 | `src/app/admin/access/watchdog-client.tsx` | ✅ 完成 |
| 頁面集成 | `src/app/admin/access/page.tsx` | ✅ 完成 |
| Vercel 配置 | `vercel.json` | ✅ 完成 |

## 提交記錄

```
b470606 feat(door-access): implement Phase 6.4 Watchdog monitoring system
ca5eb6c feat(door-watchdog): add automatic cron-based health checks
```

---

**進度**: Phase 0-6 核心完成，Phase 6.4 Watchdog 監控系統完成，Phase 6.6-6.7 待實施
