-- 2026-11-17 時段共用密碼（版本三：共用時段密碼＋有效訂單控制）
-- 新增 SlotPasswordRule / SlotPassword / BookingSlotPassword / SlotPasswordLog 四張表
-- 套用：node scripts/apply-sql.mjs prisma/migrations-manual/2026-11-17b_slot_passwords.sql
CREATE TABLE "SlotPasswordRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "generationMode" TEXT NOT NULL DEFAULT 'SPLIT_DAY',
    "generateAheadDays" INTEGER NOT NULL DEFAULT 7,
    "passwordOpenTime" TEXT NOT NULL DEFAULT '10_MIN_BEFORE',
    "passwordOpenCustomMinutes" INTEGER,
    "passwordExpireTime" TEXT NOT NULL DEFAULT '30_MIN_AFTER',
    "passwordExpireCustomMinutes" INTEGER,
    "lockWhenNoOrders" BOOLEAN NOT NULL DEFAULT true,
    "allowSharedPassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SlotPasswordRule_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SlotPassword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "slotDate" TEXT NOT NULL,
    "slotType" TEXT NOT NULL,
    "slotStartAt" DATETIME NOT NULL,
    "slotEndAt" DATETIME NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeCiphertext" TEXT NOT NULL,
    "maskedCode" TEXT NOT NULL,
    "openAt" DATETIME NOT NULL,
    "expireAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "activeOrderCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" DATETIME,
    "expiredAt" DATETIME,
    "revokedAt" DATETIME,
    "revokeReason" TEXT,
    CONSTRAINT "SlotPassword_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "SlotPasswordRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SlotPassword_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BookingSlotPassword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "slotPasswordId" TEXT NOT NULL,
    "itemStartAt" DATETIME NOT NULL,
    "itemEndAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingSlotPassword_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingSlotPassword_slotPasswordId_fkey" FOREIGN KEY ("slotPasswordId") REFERENCES "SlotPassword" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SlotPasswordLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slotPasswordId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sendStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" DATETIME,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SlotPasswordLog_slotPasswordId_fkey" FOREIGN KEY ("slotPasswordId") REFERENCES "SlotPassword" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SlotPasswordLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SlotPasswordLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SlotPasswordRule_venueId_key" ON "SlotPasswordRule"("venueId");

CREATE INDEX "SlotPassword_venueId_slotDate_idx" ON "SlotPassword"("venueId", "slotDate");

CREATE INDEX "SlotPassword_status_idx" ON "SlotPassword"("status");

CREATE INDEX "SlotPassword_slotStartAt_slotEndAt_idx" ON "SlotPassword"("slotStartAt", "slotEndAt");

CREATE INDEX "SlotPassword_codeHash_idx" ON "SlotPassword"("codeHash");

CREATE UNIQUE INDEX "SlotPassword_venueId_slotDate_slotType_key" ON "SlotPassword"("venueId", "slotDate", "slotType");

CREATE INDEX "BookingSlotPassword_bookingId_idx" ON "BookingSlotPassword"("bookingId");

CREATE INDEX "BookingSlotPassword_slotPasswordId_idx" ON "BookingSlotPassword"("slotPasswordId");

CREATE UNIQUE INDEX "BookingSlotPassword_bookingId_slotPasswordId_key" ON "BookingSlotPassword"("bookingId", "slotPasswordId");

CREATE INDEX "SlotPasswordLog_bookingId_idx" ON "SlotPasswordLog"("bookingId");

CREATE INDEX "SlotPasswordLog_sendStatus_idx" ON "SlotPasswordLog"("sendStatus");

CREATE INDEX "SlotPasswordLog_userId_idx" ON "SlotPasswordLog"("userId");

CREATE UNIQUE INDEX "SlotPasswordLog_slotPasswordId_bookingId_key" ON "SlotPasswordLog"("slotPasswordId", "bookingId");

