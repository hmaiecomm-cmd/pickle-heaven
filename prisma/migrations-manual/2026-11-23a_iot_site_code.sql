-- IoT Gateway 串接：場館代碼
--
-- 執行方式：
--   node scripts/apply-sql.mjs prisma/migrations-manual/2026-11-23a_iot_site_code.sql
-- 正式庫請於同一行先指定 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN；展示庫也要套用。
-- 可重複執行：duplicate column 會被略過，CREATE 皆為 IF NOT EXISTS。
--
-- 套用後在後台或用 SQL 設定場館代碼，例如：
--   UPDATE "Venue" SET "siteCode" = 'xindian001' WHERE "slug" = 'taipei-dazhi';

ALTER TABLE "Venue" ADD COLUMN "siteCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Venue_siteCode_key" ON "Venue"("siteCode");
