-- 人員管理：最近登入、內部備註、教練身分、員工／教練對應會員、黑名單內部備註、使用券欄位、點數帳本
ALTER TABLE "User" ADD COLUMN "lastLoginAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "adminNote" TEXT;
ALTER TABLE "User" ADD COLUMN "isCoach" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdminAccount" ADD COLUMN "userId" TEXT;
ALTER TABLE "Coach" ADD COLUMN "userId" TEXT;
ALTER TABLE "MemberRestriction" ADD COLUMN "internalNote" TEXT;
ALTER TABLE "Voucher" ADD COLUMN "ticketKind" TEXT;
ALTER TABLE "Voucher" ADD COLUMN "units" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Voucher" ADD COLUMN "courtIds" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Voucher" ADD COLUMN "issuedBy" TEXT;
ALTER TABLE "Voucher" ADD COLUMN "issueReason" TEXT;
ALTER TABLE "Voucher" ADD COLUMN "revokedAt" DATETIME;
ALTER TABLE "Voucher" ADD COLUMN "revokedBy" TEXT;
ALTER TABLE "Voucher" ADD COLUMN "revokeReason" TEXT;
CREATE TABLE IF NOT EXISTS "PointsLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "bookingId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointsLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PointsLedger_idempotencyKey_key" ON "PointsLedger"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PointsLedger_userId_createdAt_idx" ON "PointsLedger"("userId", "createdAt");
