-- CreateTable
CREATE TABLE "PlatformWebhookLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "signature" TEXT,
    "rawPayload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" DATETIME,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlatformWebhookLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "PlatformPayment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FeatureSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "featureModuleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startsAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "platformPaymentId" TEXT,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "activatedAt" DATETIME,
    "gracePeriodDays" INTEGER DEFAULT 7,
    "nextRenewalAt" DATETIME,
    "renewalAttempts" INTEGER NOT NULL DEFAULT 0,
    "renewalFailReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeatureSubscription_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeatureSubscription_featureModuleId_fkey" FOREIGN KEY ("featureModuleId") REFERENCES "FeatureModule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeatureSubscription_platformPaymentId_fkey" FOREIGN KEY ("platformPaymentId") REFERENCES "PlatformPayment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FeatureSubscription" ("activatedAt", "autoRenew", "createdAt", "expiresAt", "featureModuleId", "id", "notes", "platformPaymentId", "startsAt", "status", "updatedAt", "venueId") SELECT "activatedAt", "autoRenew", "createdAt", "expiresAt", "featureModuleId", "id", "notes", "platformPaymentId", "startsAt", "status", "updatedAt", "venueId" FROM "FeatureSubscription";
DROP TABLE "FeatureSubscription";
ALTER TABLE "new_FeatureSubscription" RENAME TO "FeatureSubscription";
CREATE INDEX "FeatureSubscription_venueId_idx" ON "FeatureSubscription"("venueId");
CREATE INDEX "FeatureSubscription_featureModuleId_idx" ON "FeatureSubscription"("featureModuleId");
CREATE INDEX "FeatureSubscription_status_idx" ON "FeatureSubscription"("status");
CREATE INDEX "FeatureSubscription_expiresAt_idx" ON "FeatureSubscription"("expiresAt");
CREATE INDEX "FeatureSubscription_nextRenewalAt_idx" ON "FeatureSubscription"("nextRenewalAt");
CREATE UNIQUE INDEX "FeatureSubscription_venueId_featureModuleId_key" ON "FeatureSubscription"("venueId", "featureModuleId");
CREATE TABLE "new_PlatformPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerRef" TEXT,
    "subscriptionIds" TEXT NOT NULL DEFAULT '',
    "rawResponse" JSONB,
    "failReason" TEXT,
    "webhookSecret" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" DATETIME,
    "nextRetryAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "refundedAt" DATETIME,
    CONSTRAINT "PlatformPayment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlatformPayment" ("amount", "createdAt", "failReason", "id", "paidAt", "provider", "providerRef", "rawResponse", "refundedAt", "status", "subscriptionIds", "venueId") SELECT "amount", "createdAt", "failReason", "id", "paidAt", "provider", "providerRef", "rawResponse", "refundedAt", "status", "subscriptionIds", "venueId" FROM "PlatformPayment";
DROP TABLE "PlatformPayment";
ALTER TABLE "new_PlatformPayment" RENAME TO "PlatformPayment";
CREATE INDEX "PlatformPayment_venueId_idx" ON "PlatformPayment"("venueId");
CREATE INDEX "PlatformPayment_status_idx" ON "PlatformPayment"("status");
CREATE INDEX "PlatformPayment_providerRef_idx" ON "PlatformPayment"("providerRef");
CREATE INDEX "PlatformPayment_nextRetryAt_idx" ON "PlatformPayment"("nextRetryAt");
CREATE INDEX "PlatformPayment_createdAt_idx" ON "PlatformPayment"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PlatformWebhookLog_paymentId_idx" ON "PlatformWebhookLog"("paymentId");

-- CreateIndex
CREATE INDEX "PlatformWebhookLog_venueId_createdAt_idx" ON "PlatformWebhookLog"("venueId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformWebhookLog_provider_signatureValid_idx" ON "PlatformWebhookLog"("provider", "signatureValid");
