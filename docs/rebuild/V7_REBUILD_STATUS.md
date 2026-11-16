# Pickle Heaven V7-R 重建状态报告

**报告日期**：2026-11-14 13:08 UTC+8
**阶段**：Phase R0 - 完整备份与现况调查
**状态**：✅ 完成

---

## 现况调查结果

### Git 仓库状态
- **项目路径**：C:/Users/hmai.ecomm/Dropbox/顧好AI智慧場館平台
- **当前分支**：main
- **远端分支**：origin/main
- **本地分支**：main, backup/r0-before-recovery-20261114_130842
- **工作区**：干净（仅有未跟踪文件 production-deployment-guide.html）
- **最新 Commit**：9d8ccf0 (fix(monitor): 直接使用全部TABS强制显示四个分页标签)

### 最近提交历史（30 天内）
- **9d8ccf0**：监控分页标签修复尝试 (2026-11-14)
- **8afc5d7**：版本标记 v2.0.0 (2026-11-14)
- **42c5991**：权限过滤保险 (2026-11-14)
- **0b0e29b**：审计报告 (2026-11-14)
- **fe15422**：自动化规则种子数据 (2026-11-13)
- **822ea4a**：Phase 7 即时监控 (2026-11-12)

### Vercel 部署状态
- **当前 Production URL**：https://pickle-heaven.vercel.app/
- **后台 URL**：https://pickle-heaven.vercel.app/admin
- **已确认问题**：Phase 9 监控四个分页标签不显示

### 数据库状态
- **迁移文件**：5 个
  1. add_admin_auth_system
  2. add_admin_models
  3. add_circuit_schedule
  4. add_schedule_audit
  5. add_automation_rules
- **Prisma 模型**：62 个
- **Schema 大小**：2344 行
- **数据库连接**：已配置 Turso (libSQL)

### 已知问题
1. **Phase 9 分页显示失败**
   - 四个分页标签（即時影像、歷史回放、事件紀錄、攝影機管理）不显示
   - 尝试过多次修复但 Vercel 部署无效
   - 根本原因：Vercel 可能未部署最新代码或部署失败

2. **Vercel 部署可靠性**
   - 最近三个提交都未能在 Production 生效
   - GitHub 与 Vercel 同步可能有问题

---

## 备份情况

### A. 完整备份
- **备份位置**：.backup-r0/
- **备份大小**：144 KB
- **备份时间**：2026-11-14 13:08

### B. 备份内容清单
1. ✅ Git 状态快照
2. ✅ 未提交修改备份
3. ✅ Git 日志（50 条提交）
4. ✅ Git 分支图
5. ✅ Git Tags
6. ✅ Git Reflog
7. ✅ Commit-Deployment 对照表
8. ✅ Prisma Schema 副本
9. ✅ 迁移历史清单
10. ✅ 未跟踪文件备份

### C. 保护性分支
- **分支名**：backup/r0-before-recovery-20261114_130842
- **指向**：9d8ccf0 (当前 HEAD)
- **目的**：如果恢复失败可快速回到当前状态

### D. 环境信息
- ✅ Node.js 版本信息可用
- ✅ 依赖项清单（package.json）可用
- ✅ 环境变量已备份（不含秘密值）

### E. 未备份项目
- ❌ 生产数据库（应使用 Turso 官方备份）
- ❌ 环境变量秘密值（安全考虑）

---

## 候选稳定版本

基于诊断结果，以下是重建的候选版本（从最稳定到较稳定）：

### 第一候选：fe15422
- **名称**：feat(seed): 自動化規則範例種子數據
- **日期**：2026-11-13
- **阶段**：Phase 4 自动化规则 API
- **已实现功能**：
  - Phase 1: 首頁六宮格
  - Phase 2: 智慧設備管理
  - Phase 3: 五大控制模式排程
  - Phase 4: 自動化規則 API
- **已知问题**：
  - Phase 5-10 未实现
- **风险**：低
- **建议**：作为 V7 重建的安全起点

### 第二候选：daa0699
- **名称**：docs(phase-10): 完整系統驗收報告——95% 功能就緒
- **日期**：2026-11-13
- **声称完成度**：95%
- **已知问题**：
  - 文档声称完成但实际代码状态不确定
- **风险**：中
- **建议**：需要先验证此版本的实际完成度

### 第三候选：822ea4a
- **名称**：feat(admin): Phase 7 即時監控（平面圖、Camera 1–6、Demo Mode）
- **日期**：2026-11-12
- **阶段**：Phase 7 即时监控
- **已知问题**：
  - 四个分页标签显示问题（导致后续重复修复）
- **风险**：中
- **建议**：如果 fe15422 有问题时考虑

---

## ⚠️ R1 更正（2026-11-14，R2 前核實）

下方原 R1 分析有誤，以此節為準：
- fe15422 已包含 Phase 1–7（含監控頁四分頁程式碼），不是「只有 Phase 1–4」。
- fe15422 → HEAD 只差 `src/app/admin/monitor/page.tsx`（15 行）與一份稽核文件。回到 fe15422 等於沒有回復。
- `vercel ls` / `vercel inspect`：最後一次「新建置」的 Production 是 2026-11-12 16:03；今天 12:31 那次是舊部署的 Redeploy。之後的 push（含 822ea4a 監控、11-13 全部、今天三次修正）**都沒有觸發任何部署**。
- 推論：GitHub → Vercel 自動部署沒有連上（過去部署都是用 CLI 手動上傳的），正式站跑的是 11-12 16:00 前的程式碼，所以看不到監控四分頁。程式碼本身不是問題根源。

## Preview 驗證（2026-11-14 13:18）

- 來源：Dropbox 外的乾淨副本 `C:\Users\hmai.ecomm\ph-preview-build`（git clone 9d8ccf0）
- Preview：https://pickle-heaven-56hcbye1b-karajankuo-7123s-projects.vercel.app — 建置成功（Compiled successfully，含 `/admin/monitor` 路由）
- `/` 200、`/admin/login` 200、`/admin/monitor` 307 → 登入頁
- 限制：Preview 環境沒有 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN，無法登入後台，四分頁畫面尚未目視確認
- 正式站未變動

## 正式資料庫唯讀檢查（2026-11-14 13:30）

- 正式站使用 `pickle-heaven`（.env 的 PRODUCTION_DATABASE_URL）：46 張表，AdminAccount 2、Court 2、Booking 0
- 比 schema 少 16 張：CancellationLog, Circuit, CircuitSchedule, CircuitScheduleAudit, ControlCommand, OperatingHours, DeviceAdapter, ControlEvent, WatchdogAlert, AccessSession, DoorAccessCommand, AccessLog, CredentialAlert, MonitorCamera, AutomationRule, AutomationLog
- 監控頁對 MonitorCamera 缺表有容錯（顯示「資料表尚未建立」），不會整頁壞掉
- .env 第 88–90 行（今天 12:24 新增）把 TURSO_DATABASE_URL 覆寫成新建的空庫 `pickle-heaven-prod`（0 張表），本機開發目前連到空庫

## 補表與正式部署（2026-11-14 13:31，使用者確認後執行）

- 正式庫 `pickle-heaven`：單一交易新增 16 張表 + 57 個索引（只有 CREATE），46 → 62 張表，與 schema 完全一致；原有資料未變
- 正式部署：9d8ccf0 → https://pickle-heaven-a288py4j3-karajankuo-7123s-projects.vercel.app（已綁定 pickle-heaven.vercel.app）
- 檢查：/api/health ok、/ 200、/booking 200、/admin/login 200、/admin/monitor 307 → 登入
- 回退用前一版：pickle-heaven-iz7hpfnzu（`vercel promote` 或 Vercel 後台 Instant Rollback）
- 待使用者登入確認監控四分頁

## Phase R1 - 稳定版本分析（原始版本，已過時）

### 已完成分析的版本

#### 🏆 推荐方案：fe15422（最安全）
- **完成度**：Phase 1-4 完整
- **日期**：2026-11-13 14:19:48
- **提交**：feat(seed): 自動化規則範例種子數據
- **后续问题**：无 ✓
- **风险**：低 ✅
- **回复时长**：最快（5-10 分钟）

#### 📋 备选方案 1：6f48edc
- **完成度**：Phase 1-4（缺种子数据）
- **日期**：2026-11-13 14:10:18
- **风险**：中等
- **建议**：仅在 fe15422 失败时考虑

#### ❌ 不推荐：822ea4a
- **完成度**：Phase 1-7
- **已知问题**：包含 Phase 9 分页问题
- **风险**：高
- **建议**：避免使用

---

## 待决事项

✅ 1. 备份是否完整（已验证）
✅ 2. Phase R1 版本分析完成
⏳ 3. **是否同意使用 fe15422 作为重建起点？**

---

## 后续步骤

收到确认后的流程：
1. ✅ **Phase R1**：寻找最稳定的版本（已完成）
2. **Phase R2**：建立安全重建分支（等待您确认版本选择）
3. **Phase R3**：基础部署验证
4. **Phase R4**：重新执行 V7 开发（按阶段）

---

**当前阶段状态**：✅ R1 COMPLETE - 等待版本确认
**下一步操作**：输入版本选择确认

## 後台品牌與監控選單（2026-11-14 22:00 正式部署，使用者確認）

- 監控四分頁移至 Sidebar「即時監控」下；內容區上方分頁移除；「異常警示與處理紀錄」不再列於選單（使用者確認）
- 後台品牌改為「大新店森林匹克球 / DAXINDIAN PICKLEBALL CLUB」；Logo 為品牌展示圖裁切去背的臨時素材 `public/images/brand/dxd-logo-temp.png`
- Preview：pickle-heaven-a8ciholgx（連 pickle-heaven-dev；修正 Preview 的 TURSO 變數 Invalid URL 後正常）
- Production：pickle-heaven-1bq34943y；前一版 pickle-heaven-a288py4j3 可回退
- 修改尚未 git commit
