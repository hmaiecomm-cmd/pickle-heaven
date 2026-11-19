-- 2026-11-19 時段密碼設定增強：密碼長度、會員分級預約天數
-- 套用：node scripts/apply-sql.mjs prisma/migrations-manual/2026-11-19_slot_password_enhancements.sql

-- 為 SlotPasswordRule 添加新欄位
ALTER TABLE "SlotPasswordRule" ADD COLUMN "passwordLength" INTEGER NOT NULL DEFAULT 6;

-- 會員分級預約提前天數
ALTER TABLE "SlotPasswordRule" ADD COLUMN "basicMemberBookAheadDays" INTEGER;
ALTER TABLE "SlotPasswordRule" ADD COLUMN "pointsMemberBookAheadDays" INTEGER;
ALTER TABLE "SlotPasswordRule" ADD COLUMN "vipMemberBookAheadDays" INTEGER;

-- 添加欄位說明註解（SQLite 無法添加註解，但記錄在此）
-- passwordLength: 密碼長度（4/6/8/10，預設 6）
-- basicMemberBookAheadDays: 普通會員可提前預約天數（null 表示沿用 Venue.bookAheadDays）
-- pointsMemberBookAheadDays: 點數會員可提前預約天數
-- vipMemberBookAheadDays: VIP會員可提前預約天數
