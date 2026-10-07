-- Phase 2 第 5 步：教練（Coach）與每週可授課時段（CoachAvailability）
-- 活動直接重用既有的球敘（Session），不需新表。
--
--   node scripts/apply-sql.mjs prisma/migrations-manual/2026-10-07a_coach.sql
-- 正式庫請於同一行先指定 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN。
-- 可重複執行：CREATE 皆為 IF NOT EXISTS。

CREATE TABLE IF NOT EXISTS "Coach" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "specialties" JSONB NOT NULL,
    "hourlyRate" INTEGER NOT NULL DEFAULT 0,
    "bio" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "Coach_status_idx" ON "Coach"("status");

CREATE TABLE IF NOT EXISTS "CoachAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    CONSTRAINT "CoachAvailability_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CoachAvailability_coachId_idx" ON "CoachAvailability"("coachId");
