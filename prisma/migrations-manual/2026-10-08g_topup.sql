-- 儲值方案與儲值單（新增資料表，可逆；不動既有會員、訂單、點數帳本）
CREATE TABLE IF NOT EXISTS "TopUpPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "scopeNote" TEXT,
    "validityNote" TEXT,
    "refundNote" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "TopUpPlan_active_sortOrder_idx" ON "TopUpPlan"("active", "sortOrder");
CREATE TABLE IF NOT EXISTS "TopUpOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "method" TEXT,
    "providerRef" TEXT,
    "cardLast4" TEXT,
    "cardBrand" TEXT,
    "rawResponse" JSONB,
    "failReason" TEXT,
    "paidAt" DATETIME,
    "creditedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TopUpOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TopUpOrder_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TopUpPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TopUpOrder_code_key" ON "TopUpOrder"("code");
CREATE INDEX IF NOT EXISTS "TopUpOrder_userId_createdAt_idx" ON "TopUpOrder"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "TopUpOrder_status_createdAt_idx" ON "TopUpOrder"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "TopUpOrder_providerRef_idx" ON "TopUpOrder"("providerRef");
