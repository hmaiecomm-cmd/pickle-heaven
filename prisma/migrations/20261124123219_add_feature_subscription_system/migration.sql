-- CreateTable
CREATE TABLE "FeatureModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" INTEGER NOT NULL,
    "yearlyPrice" INTEGER NOT NULL,
    "features" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "launchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FeatureSubscription" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeatureSubscription_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeatureSubscription_featureModuleId_fkey" FOREIGN KEY ("featureModuleId") REFERENCES "FeatureModule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeatureSubscription_platformPaymentId_fkey" FOREIGN KEY ("platformPaymentId") REFERENCES "PlatformPayment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerRef" TEXT,
    "subscriptionIds" TEXT NOT NULL DEFAULT '',
    "rawResponse" JSONB,
    "failReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "refundedAt" DATETIME,
    CONSTRAINT "PlatformPayment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureModule_slug_key" ON "FeatureModule"("slug");

-- CreateIndex
CREATE INDEX "FeatureModule_slug_idx" ON "FeatureModule"("slug");

-- CreateIndex
CREATE INDEX "FeatureModule_tier_idx" ON "FeatureModule"("tier");

-- CreateIndex
CREATE INDEX "FeatureSubscription_venueId_idx" ON "FeatureSubscription"("venueId");

-- CreateIndex
CREATE INDEX "FeatureSubscription_featureModuleId_idx" ON "FeatureSubscription"("featureModuleId");

-- CreateIndex
CREATE INDEX "FeatureSubscription_status_idx" ON "FeatureSubscription"("status");

-- CreateIndex
CREATE INDEX "FeatureSubscription_expiresAt_idx" ON "FeatureSubscription"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureSubscription_venueId_featureModuleId_key" ON "FeatureSubscription"("venueId", "featureModuleId");

-- CreateIndex
CREATE INDEX "PlatformPayment_venueId_idx" ON "PlatformPayment"("venueId");

-- CreateIndex
CREATE INDEX "PlatformPayment_status_idx" ON "PlatformPayment"("status");

-- CreateIndex
CREATE INDEX "PlatformPayment_providerRef_idx" ON "PlatformPayment"("providerRef");

-- CreateIndex
CREATE INDEX "PlatformPayment_createdAt_idx" ON "PlatformPayment"("createdAt");
