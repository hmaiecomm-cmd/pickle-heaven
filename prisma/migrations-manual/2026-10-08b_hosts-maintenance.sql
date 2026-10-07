-- 活動主持人、公開方式、緩衝；清潔／維護排程；場次備註
ALTER TABLE "Activity" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "Activity" ADD COLUMN "customTypeLabel" TEXT;
ALTER TABLE "Activity" ADD COLUMN "locationNote" TEXT;
ALTER TABLE "Activity" ADD COLUMN "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Activity" ADD COLUMN "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Activity" ADD COLUMN "hostId" TEXT;
ALTER TABLE "Session" ADD COLUMN "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Session" ADD COLUMN "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Session" ADD COLUMN "note" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "maintenanceEventId" TEXT;
CREATE INDEX IF NOT EXISTS "Reservation_maintenanceEventId_idx" ON "Reservation"("maintenanceEventId");
CREATE TABLE IF NOT EXISTS "Host" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoAssetId" TEXT,
    "bio" TEXT,
    "publicContact" TEXT,
    "internalPhone" TEXT,
    "internalEmail" TEXT,
    "internalNote" TEXT,
    "userId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Host_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Host_photoAssetId_fkey" FOREIGN KEY ("photoAssetId") REFERENCES "MediaAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Host_venueId_active_idx" ON "Host"("venueId", "active");
CREATE TABLE IF NOT EXISTS "MaintenancePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CLEANING',
    "courtIds" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "repeatKind" TEXT NOT NULL DEFAULT 'ONCE',
    "weekdays" TEXT NOT NULL DEFAULT '',
    "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
    "seriesStartDate" TEXT NOT NULL,
    "seriesEndDate" TEXT,
    "occurrenceCount" INTEGER,
    "skipDates" TEXT NOT NULL DEFAULT '',
    "assignee" TEXT,
    "description" TEXT,
    "checklist" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenancePlan_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MaintenancePlan_venueId_status_idx" ON "MaintenancePlan"("venueId", "status");
CREATE TABLE IF NOT EXISTS "MaintenanceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "courtIds" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "note" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "releasedAt" DATETIME,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MaintenancePlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MaintenanceEvent_planId_startAt_idx" ON "MaintenanceEvent"("planId", "startAt");
CREATE INDEX IF NOT EXISTS "MaintenanceEvent_venueId_startAt_idx" ON "MaintenanceEvent"("venueId", "startAt");
