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
Phase 1（已完成，見下方）。

---

## Phase 1：導覽選單整理 — ✅ 完成（2026-11-15）

### 範圍決定
使用者未回覆 Phase 0 的四項待決事項，採最保守做法：本階段只改選單與名稱；三個高風險安全問題、ESLint、.env 整理均未處理，仍待決定。

### 已完成
- 場地與預約：智慧排程（/admin/schedule）、場地設定（/admin/courts）、維護與封場（/admin/maintenance，合併原本兩個入口；?tab=manual 仍選取此項）
- 智慧設備管理：設備總覽（/admin/devices）、控制中心（/admin/control）、自動化策略（/admin/automation，仍標「未開放」）
- 其餘七個主分類不變
- 頁面標題、瀏覽器標題、跨頁連結、AI 指南連結、權限顯示名稱同步新名稱
- 系統設定「營業時間與預約規則」（實為定價頁）更名為「定價與會員折扣」

### 未完成（屬後續 Phase）
- 各頁內容與功能未調整；維護頁內分頁名稱「清潔／維護排程」「人工封場」保留
- 自動化策略仍為未開放頁

### 修改檔案（12 個，+28／−29，只改文字）
src/app/admin/admin-nav.ts、activities/page.tsx、automation/page.tsx、control/page.tsx、courts/page.tsx、courts/courts-client.tsx、devices/page.tsx、maintenance/page.tsx、pricing/page.tsx、schedule/schedule-client.tsx、src/lib/admin-permissions.ts、src/server/ai-guide.ts

### 測試結果
- Type Check：通過
- Lint：不適用（專案未設定 ESLint）
- Build：通過（Dropbox 外副本，c7b7b9e）
- 功能測試：verify:ai-guide 21／21（連開發庫）；選單結構與選取邏輯 15／15
- 瀏覽器測試：42／42（建置版本＋本機暫時 SQLite＋prisma/seed.ts 範例資料，測完刪除）
  - 六個子分頁逐一點擊：網址、選取狀態、頁面標題、無錯誤、無水平捲動
  - 九個主分類保留、維護頁 ?tab=manual、定價頁、舊網址 /admin/ai-courts
  - 1366×768、1024×768、390×844（抽屜選單）
- 測試中發現（非本次造成）：場館不存在時 /admin/maintenance 會整頁錯誤（「尚未設定場館」）

### 截圖
桌面 `V8_Phase1_導覽選單_截圖`（11 張：1180×820 六頁、1366×768 兩頁、1024×768 兩頁、390×844 一張）

### Git／部署
- Commit：`c7b7b9e` feat(admin): V8-BC Phase 1 導覽選單整理
- 備份點：標籤 `v8-phase1-start` → 53cf832
- Preview：https://pickle-heaven-n0pswq3mw-karajankuo-7123s-projects.vercel.app（/api/health ok，連開發庫）
- Preview 與 Commit 一致性：CLI 部署不記錄 commit；以內容雜湊比對，Preview 的選單程式檔 8202-851dca40405acae2.js 與 c7b7b9e 本機建置相同，含新名稱、無舊名稱
- Production：未部署（仍為 pickle-heaven-1bq34943y）

### 回復方法
- 程式：`git revert c7b7b9e`，或 `git switch -c restore v8-phase1-start`
- Preview 不影響正式站，無需回退

### 下一階段
Phase 2（已完成，見下方）。

---

## Phase 2：智慧排程 — ✅ 完成（2026-11-15）

### 範圍決定
使用者未另行指定，依建議：手動封場的建立移到「維護與封場」，智慧排程只留捷徑；三個高風險安全問題維持於 Phase 5／6 處理。

### 已完成
- 智慧排程改為後台專用的場地時段表（前台訂場矩陣元件未修改）
  - 格子顯示：預約人、付款中、封場原因、清潔維護排程名稱、活動名稱、可預約／已截止／未開放
  - 當日統計（已預約、付款中、可預約、活動、封場／維護格數）
  - 點選時段開啟詳情：預約顯示訂單編號與狀態；具 `bookings` 權限者另顯示電話、金額與「查看訂單」（/admin/bookings?q=訂單編號）
  - 封場／維護格只提供「到維護與封場管理」，不在此頁解除
  - 空白時段提供「到維護與封場新增封場」捷徑，自動帶入場地、日期、時段（需 `courts.manage`）
- 維護與封場「人工封場」分頁新增封場表單（場地、日期、時段、原因），可接收捷徑預填
- `blockSlot` 伺服器端驗證：日期格式、必須是營業時段格、不可封已結束時段；新增／解除後同步更新兩頁
- 資料責任：預約資料只在智慧排程檢視；封場的新增與解除只在維護與封場

### 未完成
- 智慧排程不提供代客建立或修改預約（訂單仍在「訂單與財務」處理）
- 封場仍為單一時段格；整段多格封場、整面場地停用屬 Phase 3
- 目前所有角色都有 `bookings` 權限，電話與金額的權限遮蔽實務上不會觸發

### 修改檔案（6 個，+363／−104）
src/app/admin/schedule/page.tsx、schedule/schedule-client.tsx、src/server/schedule-admin.ts（新）、src/app/admin/maintenance/page.tsx、maintenance/block-form.tsx（新）、src/server/admin-actions.ts

### 測試結果
- Type Check：通過
- Lint：不適用（專案未設定 ESLint）
- Build：通過（Dropbox 外副本，435813c）
- 功能／API 測試：專案無對應的 verify 腳本（verify:schedule 為活動場次週期，與本次無關）；以瀏覽器測試涵蓋伺服器動作
- 瀏覽器測試：26／26（建置版本＋本機暫時 SQLite＋種子資料＋Phase 2 測試資料，測完刪除）
  - 各狀態格顯示、當日統計（已預約 6、付款中 1、封場／維護 4，含種子示範資料，已逐筆核對）
  - 預約詳情、查看訂單、付款中與封場詳情
  - 捷徑預填 → 新增封場 → 清單與智慧排程同步 → 解除封場 → 恢復可預約
  - 伺服器拒絕：已有預約的時段、非營業時段格、已結束時段
  - 檢視者（VIEWER）看不到新增封場捷徑、表單與解除按鈕
  - 1180、1366、1024、390 無水平捲動
- 測試中修正：捷徑預填時段的正規表示式缺反斜線（已修正後重測）

### 截圖
桌面 `V8_Phase2_智慧排程_截圖`（8 張）

### Git／部署
- Commit：`435813c` feat(admin): V8-BC Phase 2 智慧排程
- 備份點：標籤 `v8-phase2-start` → a57a8eb
- Preview：https://pickle-heaven-c9eag9wi3-karajankuo-7123s-projects.vercel.app（/api/health ok，連開發庫）
- Preview 與 Commit 一致性：以 Vercel API 取得部署上傳的原始檔清單，6 個修改檔案的 SHA-1 與 435813c 逐一相同
- Production：未部署（仍為 pickle-heaven-1bq34943y）

### 回復方法
- 程式：`git revert 435813c`，或 `git switch -c restore v8-phase2-start`
- 無資料庫結構變更

### 下一階段
Phase 3（已完成，見下方）。

---

## Phase 3：場地設定與維護 — ✅ 完成（2026-11-15）

### 範圍決定
使用者未另行指定，依建議：營業時間以 `Venue.openMinute／closeMinute` 為唯一來源，編輯入口統一到「場地設定」。電力控制排程（`scheduling-service` 讀 `OperatingHours`）改讀 Venue 屬控制邏輯，延到 Phase 6 處理。

### 已完成
- 場地設定新增「營業時間與預約規則」區塊：營業時間、可預約天數、購物車保留、預約截止（時段長度維持唯讀）
  - 沿用 `PATCH /api/admin/settings/venue/[id]`（權限 `settings`），無權限者只能檢視
- 系統設定的「營運規則」改為唯讀摘要「營業時間與預約規則」，附「到場地設定修改 →」，不再能在兩處編輯
- 球場新增與編輯完成（原為停用的「Phase 2 實作」佔位）
  - 欄位：名稱（同場館不可重複）、容納人數、排序、室內／室外、雨棚、地面材質
  - 新 API：`POST /api/admin/courts`、`PATCH /api/admin/courts/[id]`（權限 `courts.manage`，寫入 COURT_CREATE／COURT_UPDATE 稽核）
  - 欄位驗證集中於 `src/lib/court-input.ts`
  - 無 `courts.manage` 時隱藏新增、編輯、狀態按鈕
- 維護與封場：沒有場館時顯示「尚未建立場館」，不再整頁錯誤（Phase 1 測試發現的既有問題）
- 球場卡片狀態標籤不再被擠成兩行

### 未完成
- 電力控制排程仍讀 `OperatingHours`（Phase 6）
- 時租仍由「定價與會員折扣」的 PriceRule 決定，PriceRule 編輯仍未開放
- 時段長度（slotMinutes）不開放修改
- 手機版球場卡片的設備欄位（照明／風扇／門禁）擠成兩行，屬既有排版，未在本階段處理

### 修改檔案（10 個，+372／−92）
src/app/admin/courts/page.tsx、courts/courts-client.tsx、courts/venue-rules.tsx（新）、src/app/api/admin/courts/route.ts、api/admin/courts/[id]/route.ts（新）、src/lib/court-input.ts（新）、src/lib/api-service.ts、src/lib/models.ts、src/app/admin/settings/settings-client.tsx、src/app/admin/maintenance/page.tsx

### 測試結果
- Type Check：通過
- Lint：不適用（專案未設定 ESLint）
- Build：通過
- 瀏覽器＋API 測試：29／29（建置版本＋本機暫時 SQLite＋種子資料，測完刪除）
  - 營業規則：顯示、伺服器拒絕超出範圍值、修改後資料庫更新、智慧排程時段同步減少、前台訂場頁正常、還原
  - 球場：新增（含室外／雨棚／材質）、智慧排程出現新球場、同名拒絕、空白名稱無法送出、編輯帶入與儲存、狀態切換、維護頁顯示維護中球場
  - 稽核紀錄：VENUE_UPDATE、COURT_CREATE、COURT_UPDATE、COURT_STATUS
  - 系統設定改為唯讀連結
  - 檢視者：看不到新增／編輯／狀態按鈕；直接呼叫 POST／PATCH API 皆回 401
  - 無場館時：維護與封場、場地設定、智慧排程皆顯示提示而非錯誤頁
  - 1366、1024、390 無水平捲動

### 截圖
桌面 `V8_Phase3_場地設定與維護_截圖`（7 張）

### Git／部署
- Commit：`cb67cab` feat(admin): V8-BC Phase 3 場地設定與維護
- 備份點：標籤 `v8-phase3-start` → 00caf1a
- Preview：https://pickle-heaven-cylmnv9fx-karajankuo-7123s-projects.vercel.app（/api/health ok，連開發庫）
- Preview 與 Commit 一致性：Vercel API 檔案清單比對，10／10 個修改檔案 SHA-1 相同
- Production：未部署（仍為 pickle-heaven-1bq34943y）

### 回復方法
- 程式：`git revert cb67cab`，或 `git switch -c restore v8-phase3-start`
- 無資料庫結構變更

### 下一階段
Phase 4 設備總覽：只保留設備與 18 路迴路配置，排程編輯（ControlSchedulePanel）移出，待 Phase 6 放進自動化策略。
