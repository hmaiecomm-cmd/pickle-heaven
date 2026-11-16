-- 一鍵開啟大門：遠端開門指令紀錄（只新增資料表）
CREATE TABLE "DoorRemoteCommand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "pulseSeconds" INTEGER NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "ackAt" DATETIME
);
CREATE UNIQUE INDEX "DoorRemoteCommand_idempotencyKey_key" ON "DoorRemoteCommand"("idempotencyKey");
CREATE INDEX "DoorRemoteCommand_doorId_createdAt_idx" ON "DoorRemoteCommand"("doorId", "createdAt");
