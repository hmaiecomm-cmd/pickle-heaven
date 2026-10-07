-- 大新店森林匹克球只有兩面球場：依既有 ID 把「1號場地／2號場地」改名為「A 場／B 場」（不新建、不刪除場地）
UPDATE "Court" SET "name" = 'A 場' WHERE "name" = '1號場地' AND "venueId" IN (SELECT "id" FROM "Venue" WHERE "name" = '大新店森林匹克球');
UPDATE "Court" SET "name" = 'B 場' WHERE "name" = '2號場地' AND "venueId" IN (SELECT "id" FROM "Venue" WHERE "name" = '大新店森林匹克球');
