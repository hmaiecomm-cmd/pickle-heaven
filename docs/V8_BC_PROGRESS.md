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
Phase 4（已完成，見下方）。

---

## Phase 4：設備總覽 — ✅ 完成（2026-11-15）

### 範圍決定
排程編輯不在本階段刪除或改寫，而是原封不動移到「自動化策略」，避免功能空窗（規則「不得為了精簡畫面而刪除既有功能」）。排程儲存的 403 錯誤與後端分類檢查仍留到 Phase 6。

### 已完成
- 設備總覽詳情面板改為「迴路配置」：分類與規則、位置、數量、電壓、負載、說明、遠端控制、排程控制、連線狀態（Demo）
  - 24 小時供電迴路（12–16）加註「不受預約與排程控制」，且不提供排程連結
  - 可排程迴路提供「查看控制時間排程 →」連到自動化策略並帶入迴路
- 平面配置圖、18 路清單、Demo Mode、設備圖示全部保留
- 從迴路清單選取時自動捲動到詳情面板（橫式平板詳情在上方，原本看不到變化）
- 自動化策略：
  - 新增「控制時間排程」：迴路選單＋原有 ControlSchedulePanel；選單只列可排程迴路（01–11），網址 `?circuit=` 指定不可排程迴路時改用 01
  - 明示「排程儲存功能維修中，目前僅供檢視」（儲存 API 角色檢查錯誤，所有人都會 403）
  - 「自動化規則（尚未開放）」說明完整保留，含「開放前需要」清單
  - 檢視權限由 `device.automation` 改為 `device`，操作員、檢視者仍看得到原本在設備總覽看得到的排程；選單仍標「未開放」

### 未完成
- 排程儲存 403、夜間排程欄位不符、後端未檢查迴路分類（Phase 6）
- 共用常數 `CIRCUIT_NUMBERS` 以 `Object.keys` 產生，順序為 10–18、01–09（整數鍵優先）；本階段只在自動化策略頁排序，未改共用常數

### 修改檔案（4 個，+136／−24）
src/components/admin/device-manager.tsx、src/app/admin/automation/page.tsx、src/app/admin/automation/schedule-picker.tsx（新）、src/app/admin/admin-nav.ts

### 測試結果
- Type Check：通過
- Lint：不適用（專案未設定 ESLint）
- Build：通過
- 瀏覽器測試：25／25（建置版本＋本機暫時 SQLite＋種子資料＋18 路迴路，測完刪除）
  - 設備總覽：無錯誤、Demo Mode、平面圖、18 路清單、不再有排程編輯、01／12／17 詳情、清單選取後詳情可見
  - 自動化策略：從設備總覽帶入迴路、面板顯示對應迴路、選單只有 01–11、切換更新網址、維修中提示、規則說明、`?circuit=12` 改用 01
  - 檢視者：可看設備總覽、選單看得到自動化策略、可檢視排程
  - 1366、1024、390 無水平捲動
- 測試中修正：預設迴路因 `Object.keys` 排序變成 10（已排序後重測）

### 截圖
桌面 `V8_Phase4_設備總覽_截圖`（7 張）

### Git／部署
- Commit：`8810daf` feat(admin): V8-BC Phase 4 設備總覽
- 備份點：標籤 `v8-phase4-start` → 43cb4d9
- Preview：https://pickle-heaven-34a4mt5uo-karajankuo-7123s-projects.vercel.app（/api/health ok，連開發庫）
- Preview 與 Commit 一致性：Vercel API 檔案清單比對，4／4 相同
- Production：未部署（仍為 pickle-heaven-1bq34943y）

### 回復方法
- 程式：`git revert 8810daf`，或 `git switch -c restore v8-phase4-start`
- 無資料庫結構變更

### 下一階段
Phase 5（已完成，見下方）。

---

## Phase 5：控制中心 — ✅ 完成（2026-11-15）

### 範圍決定
依 Phase 4 回報時提出、使用者回覆「繼續下一階段」的四點進行：18 路迴路人工操作、24 小時迴路防護、門禁指令移出控制中心、合併執行紀錄。

### 已完成
- **24 小時迴路防護（修正 Phase 0 高風險問題 1）**：`src/lib/circuit-guard.ts`
  - 24 小時供電（12–16）與預留（17–18）迴路：排程、人工、緊急任何來源都不可開關
  - 以程式定義為準，資料庫分類被改成其他類別仍擋下
  - 停用、未開放遠端控制（人工）、未開放排程控制（排程）的迴路依來源擋下
  - `sendCircuitCommand` 送出前檢查，被攔截者寫入 ControlEvent（COMMAND_FAILED，data.blocked=true）
  - 每分鐘 `checkAndUpdateSchedules` 略過不可排程迴路，不再改寫其預期狀態
- **控制中心 18 路電力迴路**（`circuit-panel.tsx`、`src/server/circuit-control.ts`）
  - 依分類列出 18 路；24 小時與預留迴路只顯示標示，沒有按鈕
  - 開啟／關閉需先預覽、必填原因；同一操作以 idempotencyKey 防重複送出
  - 未串接設備（正式環境）時停用並說明原因；展示環境產生模擬結果（直接記為設備已確認並標示模擬，避免 Watchdog 誤判未回報）
  - 寫入 ControlCommand、ControlEvent（MANUAL_OVERRIDE）、AuditLog（CIRCUIT_COMMAND）
- **手動控制 API** `POST /api/admin/control/command` 改用同一服務：同樣的防護、串接檢查、必填原因、選填 idempotencyKey（原本未串接時也會記錄模擬指令）
- **門禁**：開門／上鎖自 `ACTIONS_BY_TYPE` 移除，控制中心不再顯示，伺服器端預覽也會拒絕；改為說明並連到門禁權限管理
- **指令紀錄**：合併設備指令（DeviceCommand）與迴路指令（ControlCommand），標示手動／排程與模擬

### 未完成
- 門禁權限管理目前沒有遠端開門功能（移除後系統內無遠端開門入口）
- 排程儲存 403、夜間排程欄位、排程 API 分類檢查、cron 驗證方式、`scheduling-service` 改讀 Venue 營業時間（Phase 6）
- `/api/remote-control/watchdog` 無登入驗證（Phase 0 高風險問題 3，尚未處理）
- 正式庫 Circuit 為 0 筆，正式站控制中心的迴路區塊會顯示停用（迴路資料尚未建立）

### 修改檔案（9 個，+410／−134）
src/lib/circuit-guard.ts（新）、src/server/circuit-control.ts（新）、src/app/admin/control/circuit-panel.tsx（新）、control/page.tsx、control/control-client.tsx、src/app/api/admin/control/command/route.ts、src/server/scheduling-service.ts、src/server/admin-ops-actions.ts、src/server/monitor-service.ts

### 測試結果
- Type Check：通過
- Lint：不適用（專案未設定 ESLint）
- Build：通過
- 防護與排程服務測試：11／11（本機暫時 SQLite＋18 路迴路）
  - 18 路 × 3 種來源；資料庫分類竄改；停用；未開放遠端；未定義編號
  - 每分鐘排程對 12–18 路 0 筆指令且不改預期狀態；`sendCircuitCommand` 只為 01 建立；被攔截者留下事件；緊急來源也擋
  - 對照：同一測試在舊版（Phase 4，8810daf）重現問題——每分鐘排程對 12–18 路送出 7 筆 OFF
- 瀏覽器＋API 測試：27／27（正式環境帳號、展示帳號 DEMO＋本機展示資料庫、檢視者）
  - 未串接：18 列、12／17 無按鈕、按鈕停用與原因、無開門／上鎖、門禁連結、API 拒絕（未串接／24 小時／缺原因）、無指令產生
  - 展示環境：預覽、未填原因不能確認、送出成功（模擬）、狀態更新、紀錄合併、關閉提醒、idempotencyKey 只建一筆、24 小時迴路仍拒、稽核紀錄
  - 檢視者：只能檢視、API 403
  - 1180、1366、1024、390 無水平捲動

### 截圖
桌面 `V8_Phase5_控制中心_截圖`（6 張）

### Git／部署
- Commit：`ef80320` feat(control): V8-BC Phase 5 控制中心與 24 小時迴路防護
- 備份點：標籤 `v8-phase5-start` → 1a4ffda
- Preview：https://pickle-heaven-if0xf0ffg-karajankuo-7123s-projects.vercel.app（/api/health ok，連開發庫）
- Preview 與 Commit 一致性：Vercel API 檔案清單比對，9／9 相同
- Production：未部署（仍為 pickle-heaven-1bq34943y）

### 回復方法
- 程式：`git revert ef80320`，或 `git switch -c restore v8-phase5-start`
- 無資料庫結構變更

### 下一階段
Phase 6（已完成，見下方）。

---

## Phase 6：自動化策略 — ✅ 完成（2026-11-15）

### 範圍決定
依 Phase 5 回報時提出、使用者回覆「繼續下一階段」的四點進行；自動化規則（AutomationRule）需要真實硬體，維持「尚未開放」。

### 已完成
- **排程儲存 API**（`/api/admin/circuits/schedule` POST）
  - 修正一律 403（原本檢查不存在的 ADMIN／SUPERVISOR 角色）→ 改為 `device.automation`（擁有者、經理）
  - 以迴路程式定義的分類為準；分類不符、24 小時、預留、不可排程迴路一律拒絕
  - 修正夜間排程存不進去（原本只讀 `operatingHours`）
  - 改為「整組取代」：修正自訂時段假 id 造成錯誤、刪除的時段不會刪除、沒有備註的自訂時段被當成主時段刪掉、可用他路排程 id 改到別路等問題
  - 驗證時間範圍、星期格式、自訂時段不重疊、提前／延遲 0–120 分鐘；寫入 CircuitScheduleAudit
  - 改用 `$transaction(async (tx) => …)`（專案資料範圍保護不支援陣列寫法；陣列寫法會先寫入一部分再報錯）
- **排程面板**：只顯示迴路自己的分類；無 `device.automation` 時唯讀；未存排程時營業迴路預設帶入場地設定營業時間；24:00 以 00:00 顯示並存回 1440
- **每分鐘排程計算**（`calculateCircuitStates`）
  - 改用台北時間與台北星期（原本直接取 UTC 時分）
  - 營業迴路（05–09）：已存主時段，否則場地設定營業時間；另加自訂時段（原本讀空的 OperatingHours，正式站永遠不會開）
  - 夜間迴路（10–11）：已存主時段，否則預設 18:00–22:00；另加自訂時段
  - 預約迴路（01–04）：依球場排序先後對應（第 1 面 01、02；第 2 面 03、04），套用每路提前／延遲分鐘數
  - 不可排程迴路不納入；每個場館只計算一次（原本每路迴路重算一次）
- **cron** `check-schedules`：改用 `Authorization: Bearer`（與其他 cron 一致；原本讀 `?secret=`，Vercel Cron 會被 401）
- **`/api/remote-control/watchdog`（Phase 0 高風險問題 3）**：GET 需 `monitor`、POST 需 `device.control`；頁面需 `monitor`
- 自動化策略選單移除「未開放」；分類說明改為「預設依場地設定的營業時間」，不再寫死 08:00–22:00

### 未完成
- 自動化規則（AutomationRule）UI 與執行引擎仍未開放（需真實硬體）
- OperatingHours 資料表已不再被排程使用（未刪除，無資料庫結構變更）
- 開發庫（Preview 使用）仍缺 Circuit 等 15 張表：Preview 的控制中心、自動化策略可能因缺表出錯；正式庫已補齊
- `recalculateReservationSchedule` 未被呼叫，仍沿用舊的球場對應（未修改）

### 修改檔案（10 個，+205／−347）
src/app/api/admin/circuits/schedule/route.ts、src/server/scheduling-service.ts、src/components/admin/control-schedule-panel.tsx、src/app/admin/automation/page.tsx、automation/schedule-picker.tsx、src/app/api/cron/check-schedules/route.ts、src/app/api/remote-control/watchdog/route.ts、src/app/admin/remote-control-watchdog/page.tsx、src/lib/venue-layout.ts、src/app/admin/admin-nav.ts

### 測試結果
- Type Check：通過
- Lint：不適用（專案未設定 ESLint）
- Build：通過
- 排程計算邏輯：15／15（固定時間點：營業前後、台北 18:30、12–18 永遠 OFF、A／B 場對應、提前／延遲、已存排程覆蓋、星期限制、自訂時段、錯掛在 12 路的排程無效）
  - 對照舊版（Phase 5，ef80320）：台北 18:30 營業與夜間迴路全部 OFF。球場對應在種子資料與正式庫（A=1、B=2）下舊版碰巧正確，本次修正為預防排序值變更
- Phase 5 防護測試重跑：11／11
- 瀏覽器＋API 測試：29／29
  - 擁有者儲存營業、夜間、預約動態；整組取代；6 種錯誤輸入皆 400；稽核 4 筆
  - 介面：選單無「未開放」、只顯示自身分類、載入已存值、畫面儲存成功、未存排程預設 10:00–24:00 且存成 1440
  - 檢視者：唯讀、無儲存按鈕、欄位停用、儲存 API 403、監控 POST 401
  - 未登入：監控 API GET／POST 401、監控頁導向登入
  - cron：無驗證 401、`?secret=` 401、Bearer 200；執行後 12–18 路 0 筆指令
  - 1366、1024、390 無水平捲動
- 測試中修正：陣列交易造成 500 與部分寫入；錯誤訊息顯示英文分類代碼；面板未存排程時預設 08:00–22:00

### 截圖
桌面 `V8_Phase6_自動化策略_截圖`（6 張）

### Git／部署
- Commit：`4293efd` feat(automation): V8-BC Phase 6 自動化策略
- 備份點：標籤 `v8-phase6-start` → a397ac5
- Preview：https://pickle-heaven-1xpf17cjy-karajankuo-7123s-projects.vercel.app（/api/health ok，連開發庫）
- Preview 與 Commit 一致性：Vercel API 檔案清單比對，10／10 相同
- Production：未部署（仍為 pickle-heaven-1bq34943y）

### 部署注意
- 部署到正式站後，每分鐘 cron 會開始真正執行（原本一直 401）。正式庫目前 Circuit 0 筆，執行結果為不動作；建立迴路資料後才會產生模擬指令

### 回復方法
- 程式：`git revert 4293efd`，或 `git switch -c restore v8-phase6-start`
- 無資料庫結構變更

### 下一階段
Phase 7（已完成，見下方）。

---

## Phase 7：跨系統整合測試 — ✅ 完成（2026-11-15）

### 範圍
只做測試，不修改程式。測出的問題列為「待決定」，不在本階段修。

### 1. 回歸對照（現有 verify 腳本）
同一份全新本機資料庫，分別在 V8 開始前的基準版本（fdcdc09）與目前版本（4293efd）執行；不讀 `.env`，不提供任何外部服務金鑰（LINE、LINE Pay、AI）。

| 腳本 | 基準 | 目前 |
|---|---|---|
| test-permissions | 22／22 | 22／22 |
| test-mock-payment-access | 10／10 | 10／10 |
| test-ai-guide | 21／21 | 21／21 |
| test-people | 18／18 | 18／18 |
| test-expenses | 22／22 | 22／22 |
| test-topup | 16／16 | 16／16 |
| test-booking-reminders | 19／19 | 19／19 |
| test-activities | 中止（腳本限定開發庫） | 中止（同左） |

結論：兩個版本結果完全相同，無回歸。test-door-grants、test-camera-monitor、test-finance-metrics 腳本限定開發庫，未執行（開發庫仍缺 15 張表）。

### 2. 跨系統瀏覽器測試：23／23
建置版本＋本機暫時 SQLite（種子資料＋18 路迴路＋四種角色帳號），測完刪除。
- 營業時間連動：場地設定改營業結束 22:00 → 前台訂場頁最後一格 21:00、智慧排程 12 格 → 還原
- 預約連動：客人已付款預約 → 前台「已預約」不可再訂、智慧排程顯示預約人
- 封場連動：維護與封場新增封場 → 前台「封場」、智慧排程顯示原因 → 解除後前台恢復可預約
- 場地狀態連動：場地設定設為維護中 → 前台與智慧排程不再提供該場、維護與封場顯示提示 → 恢復營運
- 預約 → 每分鐘排程 → 迴路：B 場使用中 → 03、04 開啟；營業迴路依目前時間開啟；12–18 路 0 筆；來源 SCHEDULE；控制中心紀錄顯示「（排程）」
- 手動覆寫與排程的互動（見待決定 1）
- 角色權限矩陣：經理、操作員、櫃台、檢視者在 6 個 V8 頁面的進入權限與操作按鈕（新增球場、編輯營業規則、封場表單、迴路控制說明、排程儲存）全部符合權限設定
- 全站巡覽：擁有者開啟選單 44 頁，0 個錯誤頁

### 待決定（測試發現，未修改）
1. **手動操作只維持到下一分鐘**：控制中心手動關閉營業時間內的迴路後，下一次每分鐘排程會重新開啟。未接硬體前不會實際發生；接硬體前需決定手動操作要維持多久（例如到下一個排程切換點，或指定分鐘數）。
2. **封場與維護也會開啟球場燈與風扇**：預約迴路（01–04）把「封場／清潔維護」占用視同使用中（沿用原本設計）。若封場時不需要開燈，需調整。
3. **未串接設備時排程仍產生模擬指令**：正式站一旦建立迴路資料，每分鐘排程會產生 PENDING 的模擬指令，Watchdog 可能將過期未送出的指令判為異常。
4. **檢視者看得到但選單沒有「維護與封場」**：頁面檢視權限為 `courts`，選單項目卻要求 `courts.manage`，檢視者需直接輸入網址才進得去。
5. **開發庫缺 15 張表**：Preview 的控制中心、自動化策略可能出錯；開發庫限定的 3 支 verify 腳本無法執行。

### 截圖
桌面 `V8_Phase7_整合測試_截圖`（2 張：智慧排程顯示預約、控制中心排程紀錄）

### Git／部署
- 本階段無程式修改；只更新本文件
- 備份點：標籤 `v8-phase7-start` → c1a0cd6
- Preview：不適用（程式與 Phase 6 Preview 相同：pickle-heaven-1xpf17cjy）
- Production：未部署（仍為 pickle-heaven-1bq34943y）

### 回復方法
- 無程式變更，不需回復

### 下一階段
待決定事項修正（已完成，見下方），之後進入 Phase 8。

---

## 待決定事項修正 — ✅ 完成（2026-11-15）

### 使用者決定
1. 手動操作維持方式：C（到下一個排程時間點＋指定分鐘數），並增加「一直維持」
2. 照明：D（每次自己勾選），人工封場與清潔維護排程都要
3. 未串接時：A（只記錄預期狀態、不產生指令）
4. 檢視者選單：A（看得到維護與封場）
5. 開發庫：A（補齊缺表）

### 已完成
- **手動維持方式**：預覽視窗選擇「到下一個排程時間點」（預設，記錄當下排程狀態，排程結果改變即結束）、「維持指定時間」（15 分鐘～8 小時）、「一直維持」；控制中心顯示「手動・維持至…／一直維持／維持到下一個排程時間點」與「恢復排程」；每分鐘排程在維持期間不改變該路，結束時清除並記錄 OVERRIDE_EXPIRED；API 支援 `hold` 參數並驗證
- **需要照明**：人工封場表單（預設不勾）、清潔維護排程表單（預設勾選）；預約迴路只在需要照明的封場／維護期間開啟；封場清單標示「開燈／不開燈」，智慧排程詳情顯示照明設定
- **未串接不產生指令**：每分鐘排程只更新迴路預期狀態；控制中心顯示「排程預期：開啟／關閉」；接上設備（非 NOT_CONNECTED）後才送出指令
- **選單**：維護與封場改為 `courts` 權限，與頁面一致
- **開發庫**：補 15 張表與 2 個照明欄位（49 → 64 張表；既有資料 AdminAccount 7、Court 2、Booking 0、Reservation 8 前後相同）

### 資料庫結構變更（V8 第一次）
- migration `prisma/migrations/20261115_v8_override_lighting/migration.sql`：只新增欄位
  - Circuit：overrideMode、overrideState、overrideBaseline、overrideUntil、overrideBy（皆可為空）
  - Reservation.lighting、MaintenancePlan.lighting（BOOLEAN NOT NULL DEFAULT true）
- 開發庫：已套用
- **正式庫：尚未套用。部署正式站前必須先套用這 7 個 ALTER TABLE（需使用者同意），否則新程式查詢新欄位會出錯**
- 展示環境的資料庫（若正式站有設定 DEMO_DATABASE_URL）也需要同樣處理

### 修改檔案（16 個，+235／−34）
prisma/schema.prisma、prisma/migrations/20261115_v8_override_lighting/migration.sql（新）、src/server/scheduling-service.ts、src/server/circuit-control.ts、src/server/admin-ops-actions.ts、src/server/admin-actions.ts、src/server/maintenance-admin.ts、src/server/schedule-admin.ts、src/app/api/admin/control/command/route.ts、src/app/admin/control/page.tsx、control/circuit-panel.tsx、src/app/admin/maintenance/page.tsx、maintenance/block-form.tsx、maintenance/maintenance-client.tsx、src/app/admin/schedule/schedule-client.tsx、src/app/admin/admin-nav.ts

### 測試結果
- Type Check、Build：通過（Dropbox 內的 Prisma 引擎檔被鎖住無法重新產生，於 Dropbox 外副本執行）
- Lint：不適用（專案未設定 ESLint）
- 邏輯測試 15／15：維持方式判斷、人工封場／清潔維護照明、未串接 0 筆指令、三種維持方式與每分鐘排程的互動
- 本次瀏覽器測試 18／18：預覽三種維持方式、30 分鐘維持寫入與顯示、恢復排程、一直維持、預設維持記錄排程狀態、API 驗證分鐘數、未串接顯示排程預期、兩種照明勾選的預設值與寫入、清單與智慧排程顯示、檢視者選單
- 回歸：Phase 5 防護 11／11、Phase 5 控制中心 27／27、Phase 6 自動化策略 29／29、Phase 7 跨系統 24／24（更新為新設計的預期：未串接看預期狀態、手動維持期間不改回）、全站 44 頁 0 錯誤
- 開發庫限定腳本（補表後首次可執行）：門禁授權 25／25、即時監控 30／30、財務數字 21／21

### 截圖
桌面 `V8_待決定事項修正_截圖`（6 張）、`V8_Phase7_整合測試_截圖`（已更新）

### Git／部署
- Commit：`4f2a9fb` feat(v8): 手動維持方式、封場照明勾選、未串接不產生指令
- 備份點：標籤 `v8-phase8a-start` → 9264c73
- Preview：https://pickle-heaven-eo388zbxh-karajankuo-7123s-projects.vercel.app（連開發庫，已補齊，/api/health ok）
- Preview 與 Commit 一致性：16／16 檔案相同
- Production：未部署（仍為 pickle-heaven-1bq34943y）

### 回復方法
- 程式：`git revert 4f2a9fb`
- 資料庫：新增的欄位與表不影響舊版程式（舊版不讀取），回復程式時不需移除

### 下一階段
Phase 8 最終驗收與 Preview 部署（已完成，見下方）。

---

## Phase 8：最終驗收與 Preview 部署 — ✅ 完成（2026-11-15）

### 最終版本
- Commit：`c98998a`（V8 基準 `fdcdc09` 之後共修改 43 個 src／prisma 檔案）
- Preview：https://pickle-heaven-li03vn8tk-karajankuo-7123s-projects.vercel.app（連開發庫，/api/health ok）
- Preview 與 Commit 一致性：V8 全部 43 個修改檔案的 SHA-1 與 c98998a 相同
- Production：未部署（仍為 pickle-heaven-1bq34943y）

### 驗收中發現並修正
- 控制中心缺少 Demo Mode 橫幅（規格四：未串接真實硬體時必須顯示 Demo Mode）→ 已補上（c98998a）

### 最終測試
| 項目 | 結果 |
|---|---|
| Type Check | 通過 |
| Build | 通過 |
| Lint | 不適用（專案未設定 ESLint） |
| 瀏覽器測試 P1 導覽選單 | 42／42 |
| P2 智慧排程 | 26／26 |
| P3 場地設定 | 29／29 |
| P4 設備總覽 | 25／25 |
| P5 控制中心 | 29／29 |
| P6 自動化策略 | 29／29 |
| P7 跨系統整合（含 44 頁巡覽 0 錯誤） | 24／24 |
| P8A 待決定事項修正 | 18／18 |
| 驗證腳本（本機，最終版） | 128／128（與 V8 前基準相同） |
| 驗證腳本（開發庫） | 活動 19／19、門禁 25／25、監控 30／30、財務 21／21 |

- 每組瀏覽器測試都使用全新的本機暫時資料庫，測完刪除；測試不讀 `.env`、不提供 LINE／LINE Pay／AI 金鑰
- P1、P4 首次執行各有 1 項失敗，原因是測試仍檢查 Phase 6 已依設計移除的「未開放」標示與「排程儲存維修中」提示；更新預期後通過

### 規格逐條驗收
| 規格 | 狀態 | 說明 |
|---|---|---|
| 一、場地與預約：智慧排程／場地設定／維護與封場 | ✅ | Phase 1–3 |
| 一、智慧設備管理：設備總覽／控制中心／自動化策略 | ✅ | Phase 1、4–6 |
| 一、其餘主分類保留 | ✅ | 即時監控、門禁、訂單與財務、會員與活動、營運總覽、系統設定 |
| 二、綠色品牌、Apple 風格、每頁一個主要任務 | ✅ | |
| 二、優先支援橫式平板 | ✅ | 每階段 1180×820 主要測試，另測 1366、1024、390 |
| 二、保留平面圖與設備圖示 | ✅ | 設備總覽 |
| 二、不刪除既有功能 | ✅ | 排程編輯移到自動化策略而非刪除；未開放項目說明保留 |
| 二、不在不同頁面重複編輯同一資料 | ✅ | 營業時間只在場地設定；封場只在維護與封場；排程只在自動化策略 |
| 三、資料責任 | ✅ | 智慧排程＝預約；場地設定＝規則；維護與封場＝占用；設備總覽＝配置；控制中心＝操作與紀錄；自動化策略＝時間與策略 |
| 三、一致的資料來源 | ✅ | 營業迴路改讀場地設定營業時間（原讀空的 OperatingHours） |
| 四、18 路迴路與五大分類保留 | ✅ | |
| 四、未串接顯示 Demo Mode | ✅ | 設備總覽、控制中心、自動化策略 |
| 四、24 小時迴路不因預約結束斷電 | ✅ | 統一防護，任何來源都擋；修正前每分鐘排程會送出 7 筆 OFF |
| 四、門禁由獨立系統負責 | ✅ | 控制中心移除開門／上鎖，伺服器端同步拒絕 |
| 四、設備控制經後端權限驗證 | ✅ | 控制、排程、遠端連線監控 API 皆有伺服器端權限檢查 |

### 上正式站需要使用者同意的步驟
1. **正式庫新增 7 個欄位**（migration `20261115_v8_override_lighting`，只新增、皆有預設值或可為空）
2. 從 Dropbox 外的乾淨副本以 `c98998a` 執行 `vercel deploy --prod`
3. 驗證：/api/health、前台訂場頁、後台登入與六個 V8 頁面
4. 回復：Vercel Instant Rollback 到 `pickle-heaven-1bq34943y`；新增的欄位不影響舊版程式，不需移除
- 注意：部署後每分鐘排程會開始執行；正式庫迴路資料 0 筆，實際不會有動作

### 尚未處理（V8 範圍外或需另行決定）
- 自動化規則（AutomationRule）UI 與執行引擎（需真實硬體）
- PriceRule 費率編輯仍未開放
- 門禁權限管理沒有遠端開門
- 專案未設定 ESLint
- Commit 只在本機，尚未推送 GitHub；Vercel 未連 GitHub
- Dropbox 內的 Prisma Client 未更新（引擎檔被鎖住），本機開發前需停掉 node 程序後執行 `npm run db:generate`
- `.env` 尾端重複的 TURSO_DATABASE_URL（指向空庫）；三組已出現在對話中的金鑰建議更換
- 正式 Logo 仍為臨時裁切素材
