-- IoT 連線對象切換：LIVE（實體場館電腦，siteCode）／SIMULATOR（網頁模擬器，siteCode-sim）
--
-- 執行方式（同 2026-11-23a）：node scripts/apply-sql.mjs prisma/migrations-manual/2026-11-23b_iot_target.sql
-- 可重複執行：duplicate column 會被略過。

ALTER TABLE "Venue" ADD COLUMN "iotTarget" TEXT NOT NULL DEFAULT 'LIVE';
