-- CreateTable
CREATE TABLE "CircuitScheduleAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT,
    "circuitNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "modifiedBy" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "CircuitScheduleAudit_circuitNumber_idx" ON "CircuitScheduleAudit"("circuitNumber");

-- CreateIndex
CREATE INDEX "CircuitScheduleAudit_operation_idx" ON "CircuitScheduleAudit"("operation");

-- CreateIndex
CREATE INDEX "CircuitScheduleAudit_createdAt_idx" ON "CircuitScheduleAudit"("createdAt");

-- CreateIndex
CREATE INDEX "CircuitScheduleAudit_modifiedBy_idx" ON "CircuitScheduleAudit"("modifiedBy");
