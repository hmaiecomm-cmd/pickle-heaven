-- 品牌更名：匹克天堂 → 匹克精靈
-- 只更新資料庫裡顯示用的名稱欄位；slug、網址、環境變數不變。
-- 可重複執行。
--   node scripts/apply-sql.mjs prisma/migrations-manual/2026-10-06c_rebrand-names.sql
-- 正式庫請於同一行先指定 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN。

UPDATE "Organization" SET "name" = REPLACE("name", '匹克天堂', '匹克精靈') WHERE "name" LIKE '%匹克天堂%';
UPDATE "Venue" SET "name" = REPLACE("name", '匹克天堂', '匹克精靈') WHERE "name" LIKE '%匹克天堂%';
UPDATE "Venue" SET "notice" = REPLACE("notice", '匹克天堂', '匹克精靈') WHERE "notice" LIKE '%匹克天堂%';
UPDATE "Venue" SET "policy" = REPLACE("policy", '匹克天堂', '匹克精靈') WHERE "policy" LIKE '%匹克天堂%';
