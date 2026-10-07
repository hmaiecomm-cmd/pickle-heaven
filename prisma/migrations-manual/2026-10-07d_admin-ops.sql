-- 後台營運：帳號與 session、登入限制、逐項退款、發票異動、設備指令、異常事件、會員限制
-- 只新增資料表與欄位，不重建既有資料表。可重複執行（ADD COLUMN 重複時由 apply-sql 略過）。
--   node scripts/apply-sql.mjs prisma/migrations-manual/2026-10-07d_admin-ops.sql
-- 正式庫請於同一行先指定 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN，且要在部署前執行。

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "provider" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "providerStatus" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "recipientEmail" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "replacedById" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "usernameKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tenant" TEXT NOT NULL DEFAULT 'main',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "ip" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "AdminSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdminAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminLoginAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usernameKey" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Refund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "cashAmount" INTEGER NOT NULL,
    "pointsAmount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "cancelItems" BOOLEAN NOT NULL,
    "provider" TEXT,
    "providerRef" TEXT,
    "failReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "note" TEXT,
    CONSTRAINT "Refund_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RefundItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refundId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cashAmount" INTEGER NOT NULL,
    "pointsAmount" INTEGER NOT NULL,
    CONSTRAINT "RefundItem_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InvoiceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "detail" JSONB,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "newInvoiceId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "error" TEXT,
    CONSTRAINT "InvoiceEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DeviceCommand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reason" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "requestedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "ackAt" DATETIME,
    "error" TEXT,
    CONSTRAINT "DeviceCommand_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dedupeKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "link" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "note" TEXT
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MemberRestriction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "revokedBy" TEXT,
    "revokeReason" TEXT,
    CONSTRAINT "MemberRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);



-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdminAccount_usernameKey_key" ON "AdminAccount"("usernameKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminSession_accountId_idx" ON "AdminSession"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminLoginAttempt_usernameKey_createdAt_idx" ON "AdminLoginAttempt"("usernameKey", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminLoginAttempt_ip_createdAt_idx" ON "AdminLoginAttempt"("ip", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Refund_bookingId_idx" ON "Refund"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RefundItem_refundId_idx" ON "RefundItem"("refundId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RefundItem_itemId_idx" ON "RefundItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceEvent_idempotencyKey_key" ON "InvoiceEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvoiceEvent_invoiceId_idx" ON "InvoiceEvent"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceCommand_idempotencyKey_key" ON "DeviceCommand"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeviceCommand_deviceId_createdAt_idx" ON "DeviceCommand"("deviceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Incident_dedupeKey_key" ON "Incident"("dedupeKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Incident_status_createdAt_idx" ON "Incident"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MemberRestriction_userId_revokedAt_idx" ON "MemberRestriction"("userId", "revokedAt");

-- 訂單明細的退款累計與取消狀態
ALTER TABLE "BookingItem" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "BookingItem" ADD COLUMN "refundedAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookingItem" ADD COLUMN "refundedPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookingActivityItem" ADD COLUMN "refundedAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookingActivityItem" ADD COLUMN "refundedPoints" INTEGER NOT NULL DEFAULT 0;

-- 訂單層級的退款彙總（列表篩選用）
ALTER TABLE "Booking" ADD COLUMN "refundedAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "refundStatus" TEXT NOT NULL DEFAULT 'NONE';
CREATE INDEX IF NOT EXISTS "Booking_refundStatus_idx" ON "Booking"("refundStatus");
