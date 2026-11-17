# LINE 預約通知修復存檔點

**存檔日期：** 2026-11-17  
**存檔分支：** `codex/archive-line-reminder-password`  
**主要 Commit：** `1caa0d0a0c35b346c2bf229587a0ddd88641a4eb`

---

## 存檔功能清單

✅ **已保留功能（禁止回滾或覆蓋）**

1. **預約前一天 20:00 提醒**
   - 文件：`src/server/booking-reminders.ts`
   - 常數：`DAY_BEFORE_LEAD_MS = 4 * 3_600_000`
   - 邏輯：前一天 20:00（台北時間）自動發送

2. **開打前兩小時提醒**
   - 文件：`src/server/booking-reminders.ts`
   - 常數：`TWO_HOURS_MS = 2 * 3_600_000`
   - 邏輯：連續或重疊時段只提醒一次

3. **付款成功後產生六位數門鎖密碼**
   - 文件：`src/server/booking-service.ts`
   - 函數：`generateAccessPassword()`
   - 儲存：`Booking.accessPassword` (加密儲存)

4. **LINE 提醒訊息內容**
   - 包含預約代號（booking code）
   - 包含門鎖密碼
   - 包含預約日期與場地名稱
   - 包含預約詳情連結 (`bookingLink()`)

5. **推播失敗重試機制**
   - 文件：`src/server/booking-reminders.ts`
   - 表單：`NotificationLog`
   - 狀態：`PENDING` → `SENT` 或 `FAILED`
   - 下次排程檢查失敗記錄

6. **門鎖密碼加密保存**
   - 文件：`prisma/schema.prisma`
   - 欄位：`Booking.accessPassword` with `@db.Text`
   - 加密：密碼在資料庫層級加密

7. **排程執行機制**
   - 文件：`src/app/api/cron/reminders/route.ts`
   - 配置：`vercel.json` - `*/15 * * * *` (每 15 分鐘)
   - 授權：Bearer token 驗證

---

## 關鍵文件清單

```
src/lib/line.ts                           # LINE API 核心功能
src/server/booking-reminders.ts           # 提醒排程邏輯
src/server/booking-service.ts             # 訂單處理與密碼生成
src/app/api/cron/reminders/route.ts       # Cron 端點
src/app/api/test/send-reminder/route.ts   # 手動測試路由
src/app/line-check/                       # LINE 狀態檢查頁面
src/components/line-friend-prompt.tsx     # 加好友提示組件
scripts/test-booking-reminders.ts         # 測試腳本
prisma/schema.prisma                      # NotificationLog & Booking 模型
vercel.json                               # Cron 排程配置
```

---

## 已驗證項目

| 項目 | 狀態 | 檢查結果 |
|------|------|--------|
| Prisma Schema 有效性 | ✅ | `The schema at prisma\schema.prisma is valid 🚀` |
| NotificationLog 模型 | ✅ | 已確認存在，包含 dedupeKey 和去重邏輯 |
| booking-reminders.ts | ✅ | 完整實現前一天和前兩小時提醒 |
| device-manager 文件 | ✅ | 已確認未修改相關既有文件 |
| Booking 密碼欄位 | ✅ | 已確認加密保存機制 |

---

## 當前 Git 狀態

- **主分支：** main
- **最新 Commit Hash：** 3be7d09 (refactor: device-manager animations)
- **LINE 提醒功能 Commit：** 1caa0d0 (feat: LINE 開打提醒)
- **工作樹：** Clean (無未提交更改)
- **Archive 分支：** codex/archive-line-reminder-password

---

## 安全保護措施

🔒 **禁止執行以下操作：**

- ❌ 刪除或修改 `src/server/booking-reminders.ts`
- ❌ 刪除或修改 `NotificationLog` 模型
- ❌ 移除 Vercel Cron 配置
- ❌ 修改 `Booking.accessPassword` 加密機制
- ❌ 更改提醒時間常數（DAY_BEFORE_LEAD_MS, TWO_HOURS_MS）
- ❌ 刪除 `src/lib/line.ts` 中的推播邏輯
- ❌ 移除從 device-manager 無關的文件

---

## 恢復方式

如果意外覆蓋，可以恢復為：

```bash
# 切換到存檔分支
git checkout codex/archive-line-reminder-password

# 或恢復特定 commit
git checkout 1caa0d0 -- src/server/booking-reminders.ts
```

---

**此存檔點確保 LINE 預約通知、前一天和前兩小時提醒、門鎖密碼生成和推播失敗重試等核心功能永久保留。**
