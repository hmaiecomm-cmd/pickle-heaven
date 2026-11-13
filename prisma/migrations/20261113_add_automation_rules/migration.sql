-- CreateTable "AutomationRule"
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT 0,
    "triggerType" TEXT NOT NULL,
    "triggerConfig" TEXT NOT NULL,
    "circuitNumbers" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionConfig" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "exceptDates" TEXT,
    "weekdays" TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    "paused" BOOLEAN NOT NULL DEFAULT 0,
    "pauseReason" TEXT,
    "note" TEXT,
    "lastTriggeredAt" DATETIME,
    "lastResult" TEXT,
    "lastError" TEXT,
    "createdBy" TEXT NOT NULL,
    "modifiedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex on AutomationRule
CREATE INDEX "AutomationRule_venueId_enabled_idx" ON "AutomationRule"("venueId", "enabled");
CREATE INDEX "AutomationRule_triggerType_idx" ON "AutomationRule"("triggerType");

-- CreateTable "AutomationLog"
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "triggeredAt" DATETIME NOT NULL,
    "result" TEXT NOT NULL,
    "action" TEXT,
    "errorMessage" TEXT,
    "affectedCircuits" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex on AutomationLog
CREATE INDEX "AutomationLog_ruleId_idx" ON "AutomationLog"("ruleId");
CREATE INDEX "AutomationLog_venueId_idx" ON "AutomationLog"("venueId");
CREATE INDEX "AutomationLog_triggeredAt_idx" ON "AutomationLog"("triggeredAt");
