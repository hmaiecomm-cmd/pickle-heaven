-- CreateTable
CREATE TABLE "DoorAccessSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "doorId" TEXT NOT NULL,
    "scheduleName" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cancelledBy" TEXT,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "notes" TEXT,
    "lastStatusUpdate" DATETIME,
    "executionLog" TEXT,
    CONSTRAINT "DoorAccessSchedule_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DuprPlayerLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "duprPlayerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" DATETIME NOT NULL,
    "singlesRating" REAL,
    "doublesRating" REAL,
    "ratingUpdatedAt" DATETIME,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinkedAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DuprPlayerLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DuprApiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "requestAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMsg" TEXT,
    "requestSize" INTEGER,
    "responseSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AutomationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "triggerType" TEXT NOT NULL,
    "triggerConfig" TEXT NOT NULL,
    "circuitNumbers" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionConfig" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "exceptDates" TEXT,
    "weekdays" TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pauseReason" TEXT,
    "note" TEXT,
    "lastTriggeredAt" DATETIME,
    "lastResult" TEXT,
    "lastError" TEXT,
    "createdBy" TEXT NOT NULL,
    "modifiedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AutomationRule" ("actionConfig", "actionType", "circuitNumbers", "createdAt", "createdBy", "enabled", "exceptDates", "id", "lastError", "lastResult", "lastTriggeredAt", "modifiedBy", "name", "note", "pauseReason", "paused", "priority", "triggerConfig", "triggerType", "updatedAt", "venueId", "weekdays") SELECT "actionConfig", "actionType", "circuitNumbers", "createdAt", "createdBy", "enabled", "exceptDates", "id", "lastError", "lastResult", "lastTriggeredAt", "modifiedBy", "name", "note", "pauseReason", "paused", "priority", "triggerConfig", "triggerType", "updatedAt", "venueId", "weekdays" FROM "AutomationRule";
DROP TABLE "AutomationRule";
ALTER TABLE "new_AutomationRule" RENAME TO "AutomationRule";
CREATE INDEX "AutomationRule_venueId_enabled_idx" ON "AutomationRule"("venueId", "enabled");
CREATE INDEX "AutomationRule_triggerType_idx" ON "AutomationRule"("triggerType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DoorAccessSchedule_venueId_doorId_status_idx" ON "DoorAccessSchedule"("venueId", "doorId", "status");

-- CreateIndex
CREATE INDEX "DoorAccessSchedule_startAt_endAt_idx" ON "DoorAccessSchedule"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "DoorAccessSchedule_createdBy_idx" ON "DoorAccessSchedule"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "DoorAccessSchedule_doorId_startAt_endAt_key" ON "DoorAccessSchedule"("doorId", "startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "DuprPlayerLink_userId_key" ON "DuprPlayerLink"("userId");

-- CreateIndex
CREATE INDEX "DuprPlayerLink_duprPlayerId_idx" ON "DuprPlayerLink"("duprPlayerId");

-- CreateIndex
CREATE INDEX "DuprPlayerLink_linkedAt_idx" ON "DuprPlayerLink"("linkedAt");

-- CreateIndex
CREATE INDEX "DuprPlayerLink_unlinkedAt_idx" ON "DuprPlayerLink"("unlinkedAt");

-- CreateIndex
CREATE INDEX "DuprApiLog_endpoint_requestAt_idx" ON "DuprApiLog"("endpoint", "requestAt");

-- CreateIndex
CREATE INDEX "DuprApiLog_userId_requestAt_idx" ON "DuprApiLog"("userId", "requestAt");

-- CreateIndex
CREATE INDEX "DuprApiLog_statusCode_idx" ON "DuprApiLog"("statusCode");

-- CreateIndex
CREATE INDEX "DuprApiLog_requestAt_idx" ON "DuprApiLog"("requestAt");
