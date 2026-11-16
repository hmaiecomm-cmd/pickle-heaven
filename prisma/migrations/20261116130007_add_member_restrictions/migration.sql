/*
  Warnings:

  - You are about to drop the `DoorAccessSchedule` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "MemberRestriction_userId_revokedAt_idx";

-- AlterTable
ALTER TABLE "MemberRestriction" ADD COLUMN "metadata" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DoorAccessSchedule";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "DeviceAnomaly" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "circuitId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReportedAt" DATETIME NOT NULL,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" DATETIME,
    "resolvedBy" TEXT,
    "resolvedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeviceAnomaly_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DeviceAnomaly_circuitId_idx" ON "DeviceAnomaly"("circuitId");

-- CreateIndex
CREATE INDEX "DeviceAnomaly_status_idx" ON "DeviceAnomaly"("status");

-- CreateIndex
CREATE INDEX "DeviceAnomaly_severity_idx" ON "DeviceAnomaly"("severity");

-- CreateIndex
CREATE INDEX "DeviceAnomaly_occurredAt_idx" ON "DeviceAnomaly"("occurredAt");

-- CreateIndex
CREATE INDEX "MemberRestriction_userId_revokedAt_expiresAt_idx" ON "MemberRestriction"("userId", "revokedAt", "expiresAt");
