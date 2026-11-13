/*
  Warnings:

  - You are about to drop the `AdminInvitation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AdminLineBinding` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AdminUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `adminId` on the `AuditLog` table. All the data in the column will be lost.
  - Made the column `actor` on table `AuditLog` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "AdminInvitation_createdByAdminId_idx";

-- DropIndex
DROP INDEX "AdminInvitation_expiresAt_idx";

-- DropIndex
DROP INDEX "AdminInvitation_token_idx";

-- DropIndex
DROP INDEX "AdminInvitation_email_idx";

-- DropIndex
DROP INDEX "AdminInvitation_token_key";

-- DropIndex
DROP INDEX "AdminLineBinding_lineUserId_idx";

-- DropIndex
DROP INDEX "AdminLineBinding_lineUserId_key";

-- DropIndex
DROP INDEX "AdminLineBinding_adminId_key";

-- DropIndex
DROP INDEX "AdminUser_username_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AdminInvitation";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AdminLineBinding";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AdminUser";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "CircuitSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "circuitId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "weekdays" TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    "note" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "modifiedBy" TEXT,
    "modifiedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CircuitSchedule_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DoorAccessGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "bookingId" TEXT,
    "userId" TEXT,
    "holderName" TEXT NOT NULL,
    "holderPhone" TEXT,
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "revokedAt" DATETIME,
    "revokedBy" TEXT,
    "revokeReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonitorCamera" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "facing" INTEGER NOT NULL DEFAULT 0,
    "coverage" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "protocol" TEXT,
    "host" TEXT,
    "port" INTEGER,
    "channel" TEXT,
    "credentialEnv" TEXT,
    "viewRoles" TEXT NOT NULL DEFAULT 'OWNER,MANAGER,OPERATOR,VIEWER',
    "lastTestAt" DATETIME,
    "lastTestResult" TEXT,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_AuditLog" ("action", "actor", "createdAt", "detail", "id", "target") SELECT "action", "actor", "createdAt", "detail", "id", "target" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CircuitSchedule_circuitId_idx" ON "CircuitSchedule"("circuitId");

-- CreateIndex
CREATE INDEX "CircuitSchedule_category_idx" ON "CircuitSchedule"("category");

-- CreateIndex
CREATE INDEX "CircuitSchedule_enabled_idx" ON "CircuitSchedule"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "DoorAccessGrant_bookingId_key" ON "DoorAccessGrant"("bookingId");

-- CreateIndex
CREATE INDEX "DoorAccessGrant_venueId_validFrom_validUntil_idx" ON "DoorAccessGrant"("venueId", "validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "DoorAccessGrant_userId_idx" ON "DoorAccessGrant"("userId");

-- CreateIndex
CREATE INDEX "DoorAccessGrant_status_idx" ON "DoorAccessGrant"("status");
