-- 正式庫補欄位：Session.deletedAt、SessionTemplate.weekdays
--
-- 背景：正式庫於 2026-09-22 以舊版 turso-init.sql 建表，schema.prisma 在
-- 2026-09-23 新增這兩個欄位（球敘軟刪除、範本多天重複）。開發庫已補過，
-- 正式庫在部署新版程式碼「之前」必須先執行這兩行，否則後台球敘／範本頁會 500。
--
-- 執行方式（擇一）：
--   A. Turso Dashboard → 選正式庫 → SQL console，貼上執行。
--   B. 本機暫時指定正式庫連線後執行：
--      $env:TURSO_DATABASE_URL='libsql://正式庫'; $env:TURSO_AUTH_TOKEN='正式庫token'; `
--        node scripts/apply-sql.mjs prisma/migrations-manual/2026-10-06_session-deletedAt_template-weekdays.sql
--
-- 若回應 "duplicate column name"，代表該欄位已存在，可忽略。
-- 這兩句來自 prisma migrate diff（舊建表 SQL → 現行 schema），已簡化為
-- SQLite 直接支援的 ADD COLUMN，不需重建資料表。

ALTER TABLE "Session" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "SessionTemplate" ADD COLUMN "weekdays" TEXT NOT NULL DEFAULT '';
