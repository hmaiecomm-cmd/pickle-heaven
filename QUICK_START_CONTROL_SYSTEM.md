# 無人化電力控制系統 — 快速啟動指南

**目標**: 5 分鐘內讓你的開發環境可以測試電力控制系統

---

## 🚀 快速啟動（5 步）

### 第 1 步：同步數據庫模型（2 分鐘）

```bash
# 進入專案目錄
cd "C:\Users\hmai.ecomm\Dropbox\顧好AI智慧場館平台"

# 生成 Prisma 遷移
npm run db:generate

# 同步到 Turso
npm run db:turso:init

# 推送數據庫
npx prisma db push
```

**預期輸出**：
```
✓ 已建立 Circuit 表
✓ 已建立 ControlCommand 表
✓ 已建立 OperatingHours 表
✓ 已建立 DeviceAdapter 表
✓ 已建立 ControlEvent 表
✓ 已建立 WatchdogAlert 表
```

### 第 2 步：初始化 18 路回路（2 分鐘）

```bash
# 執行種子腳本
npm run db:seed
```

**預期輸出**：
```
🌱 開始初始化電力控制系統...

✓ 使用場館: [你的場館名稱]

📍 初始化 18 路回路...
  ✓ 迴路 01: 球場 A 主燈 (RESERVATION_DYNAMIC)
  ✓ 迴路 02: 球場 A 涼風扇 (RESERVATION_DYNAMIC)
  ... (16 條迴路)

⏰ 初始化營業時間與夜間排程...
  ✓ 營業時間: 08:00-22:00
  ✓ 夜間時段: 18:00-22:00

🔧 初始化設備適配器...
  ✓ 設備適配器: Simulation Relay (Mock ADAM-4019)

✨ 電力控制系統初始化完成！
```

### 第 3 步：設定環境變數（30 秒）

編輯 `.env.local`，添加：

```bash
# 電力控制相關設定
CONTROL_ENVIRONMENT="simulation"
CRON_SECRET="my-test-secret-123"
```

### 第 4 步：啟動開發服務器（1 分鐘）

```bash
npm run dev
```

**等待輸出**：
```
▲ Next.js X.X.X
  - Local: http://localhost:3000
```

### 第 5 步：測試排程功能（驗證，1 分鐘）

在瀏覽器中訪問：

```
http://localhost:3000/admin/control
```

你應該看到：
- ✅ 18 路回路的完整列表
- ✅ 每路的狀態、最後更新時間、命令結果
- ✅ 設備連接狀態顯示「模擬環境」

---

## 🧪 測試排程功能

### 測試 1：預約動態控制

#### 建立預約
1. 前台建立一個「今天 14:00-15:00」的球場 A 預約
2. 確認支付
3. 等待後端處理（或手動呼叫 cron 端點）

#### 驗證排程
```bash
# 終端執行
curl -X GET "http://localhost:3000/api/cron/check-schedules?secret=my-test-secret-123"
```

**預期結果**：
```json
{
  "success": true,
  "message": "排程檢查完成",
  "timestamp": "2026-11-11T14:30:00Z",
  "mqttStatus": "ONLINE"
}
```

#### 在資料庫驗證
```sql
-- 使用 Prisma Studio
npx prisma studio

-- 檢查 ControlCommand 表
-- 應該看到在 14:00-15:00 期間內新增的命令
-- - 迴路 01: targetState = ON
-- - 迴路 02: targetState = ON
-- - status = SENT (if simulated)
```

### 測試 2：人工控制命令

#### 發送 ON 命令
```bash
curl -X POST "http://localhost:3000/api/admin/control/command" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-admin-session-cookie" \
  -d '{
    "circuitNumber": "01",
    "targetState": "ON",
    "reason": "測試開啟"
  }'
```

**預期回應**：
```json
{
  "success": true,
  "commandId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "迴路 01 已發送開啟命令",
  "timestamp": "2026-11-11T14:35:00Z"
}
```

#### 發送 OFF 命令
```bash
curl -X POST "http://localhost:3000/api/admin/control/command" \
  -H "Content-Type: application/json" \
  -d '{
    "circuitNumber": "01",
    "targetState": "OFF",
    "reason": "測試關閉"
  }'
```

#### 查詢命令歷史
```bash
curl -X GET "http://localhost:3000/api/admin/control/command?limit=5"
```

**預期結果**：
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "commandId": "550e8400...",
      "circuit": "球場 A 主燈",
      "targetState": "OFF",
      "status": "SENT",
      "requestedBy": "admin",
      "createdAt": "2026-11-11T14:35:00Z"
    },
    {
      "circuit": "球場 A 主燈",
      "targetState": "ON",
      "status": "SENT",
      ...
    }
  ]
}
```

### 測試 3：模擬 MQTT 消息

#### 檢查發佈的 MQTT 消息

在 `src/server/mqtt-service.ts` 中有一個輔助函數：

```typescript
// 在 API 路由中添加（臨時用於測試）
import { getPublishedMessages } from '@/server/mqtt-service'

export async function GET() {
  const messages = getPublishedMessages()
  return NextResponse.json(messages)
}
```

或直接在終端檢查日誌：
```
[MQTT Mock] 已發佈: Advantech/sim-relay-001/ctl/do1 { command_id: '...', v: 1, timestamp: '...' }
```

---

## 📊 驗證清單

執行完以上步驟後，檢查以下清單：

### 數據庫
- [ ] ✅ `Circuit` 表有 18 條記錄
- [ ] ✅ `OperatingHours` 表有 1 條記錄
- [ ] ✅ `DeviceAdapter` 表有 1 條模擬設備

### 排程
- [ ] ✅ 預約時段內，迴路 01、02 應為 ON
- [ ] ✅ 營業時間內（08:00-22:00），迴路 05-09 應為 ON
- [ ] ✅ 迴路 12-16 始終為 OFF（不受排程控制）

### API
- [ ] ✅ Cron 端點返回 `success: true`
- [ ] ✅ 人工控制命令創建成功
- [ ] ✅ 查詢命令歷史返回列表

### MQTT（模擬）
- [ ] ✅ 命令已發佈到正確的 topic
- [ ] ✅ 命令包含正確的 payload
- [ ] ✅ 模擬設備在 100ms 後回報狀態

---

## 🐛 常見問題

### Q1：找不到場館？
**A**: 種子腳本要求至少存在一個有效的場館。先在管理後台建立場館，再執行 `npm run db:seed`。

### Q2：權限不足（403）？
**A**: 確保你以 ADMIN 角色登入後台。檢查 `pagePermission('control')` 的權限設定。

### Q3：CRON_SECRET 不匹配？
**A**: 確保 `.env.local` 中的 `CRON_SECRET` 與 curl 命令中的 `secret` 參數相同。

### Q4：預約後沒有生成命令？
**A**: 
1. 檢查預約的 `status` 是否為 `BOOKED`
2. 手動呼叫 cron 端點：`curl -X GET "http://localhost:3000/api/cron/check-schedules?secret=..."`
3. 檢查 `ControlCommand` 表中是否新增了記錄

### Q5：設備始終顯示「模擬環境」？
**A**: 這是正確的行為。當 `CONTROL_ENVIRONMENT=simulation` 時，所有設備和命令都在模擬模式下運行。

---

## 📚 重要文件

| 文件 | 用途 |
|-----|------|
| `CONTROL_SYSTEM_PHASE1.md` | 第一階段詳細報告（數據模型） |
| `CONTROL_SYSTEM_PHASE2_COMPLETED.md` | 第二階段詳細報告（排程、MQTT、API） |
| `DOOR_ACCESS_SYSTEM.md` | 門禁系統詳細規範（後續實施） |
| `src/lib/control-types.ts` | 類型定義與 18 路回路定義 |
| `src/lib/device-config.ts` | 設備配置與模擬設備映射 |
| `src/server/scheduling-service.ts` | 排程計算引擎 |
| `src/server/mqtt-service.ts` | MQTT 與模擬 Broker |
| `prisma/seed-control-system.ts` | 數據庫初始化 |

---

## 🎯 下一步建議

### 立即可做
1. ✅ 完成以上 5 步快速啟動
2. ✅ 執行驗證清單
3. ✅ 在 `/admin/control` 查看 18 路狀態
4. ✅ 測試人工控制命令

### 下階段工作（第三階段）
- [ ] Watchdog 監控服務
- [ ] 事件日誌與 Neon 同步
- [ ] `/admin/logs` 日誌檢視頁面
- [ ] 完整的 Simulation 環境與測試工具

### 待提供的參數（用於真實環境）
- [ ] AR-721 型號與 firmware
- [ ] 實際 MAC ID
- [ ] MQTT Broker 連接信息
- [ ] Neon PostgreSQL 連接字符串
- [ ] Raspberry Pi 網路配置

---

## 💬 需要幫助？

查看詳細文檔：
- 架構與設計：`CONTROL_SYSTEM_PHASE1.md`
- 實施詳情：`CONTROL_SYSTEM_PHASE2_COMPLETED.md`
- 門禁規範：`DOOR_ACCESS_SYSTEM.md`

---

*快速啟動指南完成於 2026-11-11*
*預計完成時間: 5-10 分鐘（包括安裝依賴）*
