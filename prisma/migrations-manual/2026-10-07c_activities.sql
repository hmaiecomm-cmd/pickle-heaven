-- 活動與場地預約整合
--   1. 新表：Activity（活動／系列）、SessionCourt（場次使用的場地）、BookingActivityItem（訂單中的活動報名）、
--            SessionWatch（有名額通知我）、MediaAsset（上傳圖片）
--   2. 既有表只「新增欄位」，不重建資料表，既有訂單、報名紀錄不受影響
--   3. 既有週期球敘範本轉為活動系列，已產生的場次掛到該活動；範本停止自動延伸（改由後台預覽後建立）
--
--   node scripts/apply-sql.mjs prisma/migrations-manual/2026-10-07c_activities.sql
-- 正式庫請於同一行先指定 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN，且要在部署前執行。
-- 可重複執行：CREATE 皆為 IF NOT EXISTS，ADD COLUMN 重複時由 apply-sql 略過，資料轉換以 NOT EXISTS 判斷。

CREATE TABLE IF NOT EXISTS "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mime" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "bytes" BLOB NOT NULL,
    "thumbBytes" BLOB NOT NULL,
    "thumbWidth" INTEGER NOT NULL,
    "thumbHeight" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "originalName" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "MediaAsset_sha256_key" ON "MediaAsset"("sha256");

CREATE TABLE IF NOT EXISTS "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OPEN_PLAY',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "description" TEXT,
    "levelLabel" TEXT,
    "requirements" TEXT,
    "includes" TEXT,
    "refundNote" TEXT,
    "coverAssetId" TEXT,
    "coverFocusX" INTEGER NOT NULL DEFAULT 50,
    "coverFocusY" INTEGER NOT NULL DEFAULT 50,
    "price" INTEGER NOT NULL DEFAULT 0,
    "priceUnit" TEXT NOT NULL DEFAULT 'PER_PERSON',
    "capacity" INTEGER NOT NULL DEFAULT 8,
    "maxPerOrder" INTEGER NOT NULL DEFAULT 4,
    "repeatKind" TEXT NOT NULL DEFAULT 'ONCE',
    "weekdays" TEXT NOT NULL DEFAULT '',
    "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "seriesStartDate" TEXT NOT NULL,
    "seriesEndDate" TEXT,
    "occurrenceCount" INTEGER,
    "skipDates" TEXT NOT NULL DEFAULT '',
    "courtIds" TEXT NOT NULL DEFAULT '',
    "openDaysBefore" INTEGER NOT NULL DEFAULT 7,
    "openMinute" INTEGER,
    "closeMinutesBefore" INTEGER NOT NULL DEFAULT 60,
    "holdUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Activity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "MediaAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Activity_venueId_status_idx" ON "Activity"("venueId", "status");

CREATE TABLE IF NOT EXISTS "SessionCourt" (
    "sessionId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    PRIMARY KEY ("sessionId", "courtId"),
    CONSTRAINT "SessionCourt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionCourt_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SessionCourt_courtId_idx" ON "SessionCourt"("courtId");

CREATE TABLE IF NOT EXISTS "BookingActivityItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "courtNames" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "seats" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "priceUnit" TEXT NOT NULL DEFAULT 'PER_PERSON',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingActivityItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingActivityItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DROP INDEX IF EXISTS "BookingActivityItem_registrationId_key";
CREATE INDEX IF NOT EXISTS "BookingActivityItem_registrationId_idx" ON "BookingActivityItem"("registrationId");
CREATE INDEX IF NOT EXISTS "BookingActivityItem_bookingId_idx" ON "BookingActivityItem"("bookingId");
CREATE INDEX IF NOT EXISTS "BookingActivityItem_sessionId_idx" ON "BookingActivityItem"("sessionId");

CREATE TABLE IF NOT EXISTS "SessionWatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" DATETIME,
    "cancelledAt" DATETIME,
    CONSTRAINT "SessionWatch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SessionWatch_sessionId_userId_key" ON "SessionWatch"("sessionId", "userId");
CREATE INDEX IF NOT EXISTS "SessionWatch_sessionId_cancelledAt_idx" ON "SessionWatch"("sessionId", "cancelledAt");

-- 既有表新增欄位
ALTER TABLE "Reservation" ADD COLUMN "sessionId" TEXT REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Reservation_sessionId_idx" ON "Reservation"("sessionId");

ALTER TABLE "Session" ADD COLUMN "activityId" TEXT REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Session" ADD COLUMN "coverAssetId" TEXT REFERENCES "MediaAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Session" ADD COLUMN "coverFocusX" INTEGER;
ALTER TABLE "Session" ADD COLUMN "coverFocusY" INTEGER;
ALTER TABLE "Session" ADD COLUMN "seriesIndex" INTEGER;
CREATE INDEX IF NOT EXISTS "Session_activityId_startAt_idx" ON "Session"("activityId", "startAt");

ALTER TABLE "SessionRegistration" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SessionRegistration" ADD COLUMN "seats" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SessionRegistration" ADD COLUMN "unitPrice" INTEGER;
ALTER TABLE "SessionRegistration" ADD COLUMN "holdExpiresAt" DATETIME;
ALTER TABLE "SessionRegistration" ADD COLUMN "cartToken" TEXT;
ALTER TABLE "SessionRegistration" ADD COLUMN "bookingId" TEXT;
CREATE INDEX IF NOT EXISTS "SessionRegistration_cartToken_idx" ON "SessionRegistration"("cartToken");
CREATE INDEX IF NOT EXISTS "SessionRegistration_bookingId_idx" ON "SessionRegistration"("bookingId");

-- 既有週期範本 → 活動系列（id 以 act_ 加範本 id，可重複執行）
INSERT INTO "Activity" ("id", "organizationId", "venueId", "title", "type", "status", "price", "priceUnit", "capacity", "maxPerOrder",
  "repeatKind", "weekdays", "intervalWeeks", "startMinute", "endMinute", "seriesStartDate", "seriesEndDate", "occurrenceCount",
  "courtIds", "openDaysBefore", "openMinute", "closeMinutesBefore", "createdAt", "updatedAt")
SELECT 'act_' || t."id", t."organizationId", t."venueId", t."title", 'OPEN_PLAY', 'PUBLISHED', t."price", 'PER_PERSON', t."capacity", 1,
  'WEEKLY', CASE WHEN t."weekdays" = '' THEN CAST(t."weekday" AS TEXT) ELSE t."weekdays" END, 1, t."startMinute", t."endMinute",
  COALESCE((SELECT date(MIN(s."startAt"), '+8 hours') FROM "Session" s WHERE s."templateId" = t."id"), date('now', '+8 hours')),
  (SELECT date(MAX(s."startAt"), '+8 hours') FROM "Session" s WHERE s."templateId" = t."id"),
  NULL,
  COALESCE(t."courtId", ''), t."bookingOpenDaysBefore", t."startMinute" + t."bookingOpenHourOffset" * 60, 0,
  strftime('%Y-%m-%dT%H:%M:%S.000+00:00', 'now'), strftime('%Y-%m-%dT%H:%M:%S.000+00:00', 'now')
FROM "SessionTemplate" t
WHERE NOT EXISTS (SELECT 1 FROM "Activity" a WHERE a."id" = 'act_' || t."id");

UPDATE "Session" SET "activityId" = 'act_' || "templateId" WHERE "templateId" IS NOT NULL AND "activityId" IS NULL;

-- 沒有範本的單次球敘 → 各自一個單次活動
INSERT INTO "Activity" ("id", "organizationId", "venueId", "title", "type", "status", "price", "priceUnit", "capacity", "maxPerOrder",
  "repeatKind", "weekdays", "intervalWeeks", "startMinute", "endMinute", "seriesStartDate", "occurrenceCount",
  "courtIds", "openDaysBefore", "closeMinutesBefore", "createdAt", "updatedAt")
SELECT 'act_' || s."id", s."organizationId", s."venueId", s."title", 'OPEN_PLAY', 'PUBLISHED', s."price", 'PER_PERSON', s."capacity", 1,
  'ONCE', '', 1,
  (strftime('%s', s."startAt") - strftime('%s', date(s."startAt", '+8 hours'), '-8 hours')) / 60,
  (strftime('%s', s."endAt") - strftime('%s', date(s."startAt", '+8 hours'), '-8 hours')) / 60,
  date(s."startAt", '+8 hours'), 1,
  COALESCE(s."courtId", ''), 7, 0,
  strftime('%Y-%m-%dT%H:%M:%S.000+00:00', 'now'), strftime('%Y-%m-%dT%H:%M:%S.000+00:00', 'now')
FROM "Session" s
WHERE s."templateId" IS NULL AND s."activityId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Activity" a WHERE a."id" = 'act_' || s."id");

UPDATE "Session" SET "activityId" = 'act_' || "id" WHERE "templateId" IS NULL AND "activityId" IS NULL;

-- 場次使用的場地
INSERT OR IGNORE INTO "SessionCourt" ("sessionId", "courtId")
SELECT "id", "courtId" FROM "Session" WHERE "courtId" IS NOT NULL;

-- 範本停止自動延伸；之後由後台「活動」預覽衝突後建立場次
UPDATE "SessionTemplate" SET "active" = 0 WHERE "active" = 1;
