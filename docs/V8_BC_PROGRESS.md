# Pickle Heaven V8-BC 智慧營運整合版｜進度追蹤

## 目標架構

| 主分類 | 子分頁 | 資料責任 |
|---|---|---|
| 場地與預約 | 智慧排程 | 預約資料 |
| | 場地設定 | 場地規則 |
| | 維護與封場 | 占用與維護任務 |
| 智慧設備管理 | 設備總覽 | 設備配置、迴路資料 |
| | 控制中心 | 設備操作、執行紀錄 |
| | 自動化策略 | 控制時間、策略規則 |

其餘主分類（即時監控、門禁權限管理、訂單與財務、會員與活動、營運總覽、系統設定）保留。

---

## Phase 0：盤點與備份 — ✅ 完成（2026-11-14）

### 基準版本
- Git：`main` = `fdcdc09`（本機領先 origin/main `9d8ccf0` 一個 commit，尚未推送）
- 正式站：`pickle-heaven-1bq34943y`（2026-11-14 21:57 以 CLI 從 fdcdc09 的乾淨副本部署）
- 部署方式：Vercel 未連 GitHub，push 不會部署；部署一律從 Dropbox 外的 clone（`C:\Users\hmai.ecomm\ph-preview-build`）執行 `vercel deploy`
- 正式庫 `pickle-heaven`：62 表與 schema 一致；Circuit 0、ControlCommand 0、OperatingHours 0、Device 16、DeviceCommand 0、Venue 1
- 開發庫 `pickle-heaven-dev`（Preview 使用）：49 表，缺 15 張控制／門禁／自動化表

### 備份點
- 分支 `backup/v8-phase0-20261114_224956` → fdcdc09
- 標籤 `v8-phase0-baseline` → fdcdc09
- 先前：分支 `backup/r0-before-recovery-20261114_130842` → 9d8ccf0
- 回復方法：`git switch -c restore backup/v8-phase0-20261114_224956`；正式站回退用 Vercel Instant Rollback 至 `pickle-heaven-1bq34943y`

### 現況：場地與預約

| 現有選單 | 路由 | 實際功能 | 對應 V8 |
|---|---|---|---|
| 預約行事曆 | /admin/schedule | 可預約時段矩陣；可建立／解除手動封場（blockSlot/unblockSlot）；客戶預約只能看 | 智慧排程 |
| 場地與時段 | /admin/courts | 球場卡片、KPI、狀態切換（可存）；新增球場與編輯儲存未實作；無時段編輯 | 場地設定 |
| 封場與維護 | /admin/maintenance?tab=manual | 列出手動封場、只能解除 | 維護與封場 |
| 清潔／維護排程 | /admin/maintenance | 維護計畫完整 CRUD、週期、衝突檢查、事件操作 | 維護與封場 |
| （系統設定）營業時間與預約規則 | /admin/pricing | 實際是「定價」：PriceRule 唯讀、會員折扣可改；沒有營業時間 | 場地設定（規則） |
| （系統設定）球館基本資料 | /admin/settings | 實際編輯 Venue 營業時間、預約天數、保留時間、截止時間 | 場地設定（規則） |

### 現況：智慧設備管理

| 現有選單 | 路由 | 實際功能 | 對應 V8 |
|---|---|---|---|
| 設備配置與電力迴路 | /admin/devices | 平面圖、18 路迴路清單、內嵌每迴路排程編輯（ControlSchedulePanel） | 設備總覽（排程編輯應移到自動化策略） |
| 無人化控制 | /admin/control | 依球場對門、燈、風扇下指令（Device/DeviceCommand），含預覽、原因、紀錄 | 控制中心 |
| 自動化規則 | /admin/automation | 只有「未開放」頁；API 完整但無 UI、無執行引擎 | 自動化策略 |
| （未列選單） | /admin/watchdog | 迴路監控告警，venueId 寫死 | 控制中心或設備總覽 |
| （未列選單） | /admin/remote-control-watchdog | Claude Code 遠端連線監控，與球館無關 | 不屬 V8 範圍 |

18 路迴路與五大分類定義在 `src/lib/control-types.ts`（另有 `venue-layout.ts`、`control-schedule-panel.tsx` 重複對照）：
預約動態 01–04、營業時間 05–09、環境夜間 10–11、**24 小時供電 12–16**、預留 17–18。
Demo Mode：設備、控制、監控頁皆有顯示。

### 發現的問題（已人工核實）

**高風險（違反 V8 設備安全規則）**
1. **24 小時迴路沒有防護**：`src/server/scheduling-service.ts` 初始化所有迴路為 OFF，每分鐘 cron `checkAndUpdateSchedules()` 會對 12–16 送出 OFF；`sendCircuitCommand` 不檢查分類。目前正式庫沒有迴路資料、未接硬體，尚未實際發生。
2. **排程儲存全部 403**：`/api/admin/circuits/schedule` POST 要求角色 ADMIN／SUPERVISOR，但系統角色只有 OWNER／MANAGER／OPERATOR／FRONTDESK／VIEWER／DEMO。
3. **`/api/remote-control/watchdog` 無登入驗證**（不在 middleware 範圍），可標記設備上下線；頁面也無權限檢查。
4. **排程 cron 驗證方式不符**：`/api/cron/check-schedules` 讀 `?secret=`，Vercel Cron 送的是 `Authorization: Bearer`，排程應該一直 401。

**資料重複／衝突**
5. 營業時間有三份：Venue.openMinute/closeMinute（真正影響預約）、OperatingHours（無編輯器，cron 讀這個）、CircuitSchedule 的營業時間分類。
6. 手動封場有兩個編輯入口（schedule 建立＋解除、maintenance 解除）；維護頁在選單出現兩次。
7. 「場地不可用」有兩套：Court.status 與 BLOCKED 預約。
8. 兩套控制模型：控制頁用 Device/DeviceCommand（依球場），18 路迴路用 Circuit/ControlCommand（無 UI，只有 cron 與一支 API）。
9. 存下的 CircuitSchedule 不會被 cron 使用；夜間排程送 `nightAmbience` 但 API 只讀 `operatingHours`，存不進去；排程 API 不檢查分類，24h 迴路可被設定營業時間排程。
10. 門禁重疊：控制頁可對門下 UNLOCK/LOCK（權限 `device.control`），與獨立門禁系統重疊。
11. 預設時間定義在三處；`page-control-summary.tsx` 未被使用。
12. 選單標籤與內容不符：「營業時間與預約規則」→ 定價頁；「場地與時段」沒有時段。

### 測試與工具現況
- Type Check：`npm run typecheck` 可用
- Lint：專案未設定 ESLint，`next lint` 無法執行（需決定是否加入設定）
- 單元／功能測試：`verify:*` 腳本多數讀 `.env`；`.env` 尾端的 `TURSO_DATABASE_URL` 被覆寫成空庫 `pickle-heaven-prod`，執行前需修正，否則會失敗或連錯庫
- 瀏覽器測試：可用 Playwright（使用本機 Chrome）＋本機暫時 SQLite 資料庫，不碰遠端資料

### Phase 0 執行紀錄
- 修改檔案：僅新增本文件（無 UI／API／資料庫變更）
- 截圖：不適用（無 UI 變更）
- Build／Preview 部署：不適用（程式未變更，與正式站 fdcdc09 相同）
- Commit：見 git log（docs: V8-BC Phase 0）

### 逐階段方案（待確認）

| Phase | 內容 | 主要風險 |
|---|---|---|
| 1 導覽選單 | 兩大分類改為六個子分頁、合併重複入口、修正標籤；只改選單與路由對應，不動功能 | 低 |
| 2 智慧排程 | /admin/schedule 以預約為主；手動封場的建立移交「維護與封場」或改為捷徑 | 中 |
| 3 場地設定與維護 | 營業時間與預約規則集中一處；完成球場編輯；維護與封場整合手動封場 | 中（牽涉資料來源統一） |
| 4 設備總覽 | 只保留設備與迴路配置，排程編輯移出 | 低 |
| 5 控制中心 | 加入 18 路迴路操作、統一執行紀錄、24h 迴路防護、門禁指令移交門禁系統 | 高 |
| 6 自動化策略 | 排程＋自動化規則 UI、修正 403／夜間排程／分類檢查、cron 改讀策略與 Bearer 驗證 | 高 |
| 7 整合測試 | 預約→維護→控制→自動化跨系統測試 | — |
| 8 驗收與 Preview | 全面驗收 | — |

### 下一階段
等待使用者回覆「繼續下一階段」後執行 Phase 1。
