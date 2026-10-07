-- 前台場館名稱：大新店森林匹克球（後台系統名稱「匹克精靈」不變，Organization 不動）
-- 1. 場館名稱改為對外名稱；公告與規章裡的系統名稱一併改為場館名稱
-- 2. 種子示範用的地址、電話、介紹（未經確認）清空；只清與示範值完全相同的資料，後台已改過的不受影響
-- 3. 球敘與範本名稱的「大興店」更正為「大新店」
-- 可重複執行。
--   node scripts/apply-sql.mjs prisma/migrations-manual/2026-10-07b_public-venue-name.sql
-- 正式庫請於同一行先指定 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN，且要在部署前執行。

UPDATE "Venue" SET "name" = '大新店森林匹克球' WHERE "name" LIKE '%匹克精靈%' OR "name" LIKE '%大興店%';
UPDATE "Venue" SET "notice" = REPLACE("notice", '匹克精靈', '大新店森林匹克球') WHERE "notice" LIKE '%匹克精靈%';
UPDATE "Venue" SET "policy" = REPLACE("policy", '匹克精靈', '大新店森林匹克球') WHERE "policy" LIKE '%匹克精靈%';
UPDATE "Venue" SET "address" = '' WHERE "address" = '台北市中山區敬業三路 128 號（頂樓雨棚球場）';
UPDATE "Venue" SET "phone" = '' WHERE "phone" = '02-2532-8888';
UPDATE "Venue" SET "description" = NULL WHERE "description" = '2 面標準匹克球場，室外雨棚全遮蔽、下雨照常開打，專業 PU 地墊與獨立更衣淋浴間，捷運劍南路站步行 5 分鐘。';
UPDATE "SessionTemplate" SET "title" = REPLACE("title", '大興店', '大新店') WHERE "title" LIKE '%大興店%';
UPDATE "Session" SET "title" = REPLACE("title", '大興店', '大新店') WHERE "title" LIKE '%大興店%';
UPDATE "Session" SET "description" = REPLACE("description", '大興店', '大新店') WHERE "description" LIKE '%大興店%';
