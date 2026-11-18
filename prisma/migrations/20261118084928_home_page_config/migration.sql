-- CreateTable
CREATE TABLE "MarketingBanner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "imageAssetId" TEXT,
    "buttonText" TEXT,
    "buttonUrl" TEXT,
    "displayPages" TEXT NOT NULL DEFAULT 'HOMEPAGE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startAt" DATETIME,
    "endAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "MarketingBanner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketingBanner_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketingBanner_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "MediaAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromotionCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageAssetId" TEXT,
    "buttonText" TEXT,
    "buttonUrl" TEXT,
    "displayPages" TEXT NOT NULL DEFAULT 'HOMEPAGE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startAt" DATETIME,
    "endAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "PromotionCard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromotionCard_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromotionCard_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "MediaAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageAssetId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "color" TEXT NOT NULL DEFAULT 'BLUE',
    "displayPages" TEXT NOT NULL DEFAULT 'HOMEPAGE',
    "startAt" DATETIME,
    "endAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Announcement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Announcement_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Announcement_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "MediaAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PageConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "activitiesCount" INTEGER NOT NULL DEFAULT 6,
    "activitiesSortBy" TEXT NOT NULL DEFAULT 'LATEST',
    "showPopularActivities" BOOLEAN NOT NULL DEFAULT true,
    "showLatestActivities" BOOLEAN NOT NULL DEFAULT true,
    "showVIPActivities" BOOLEAN NOT NULL DEFAULT true,
    "showShopEntrance" BOOLEAN NOT NULL DEFAULT true,
    "showBookingEntrance" BOOLEAN NOT NULL DEFAULT true,
    "showMembersArea" BOOLEAN NOT NULL DEFAULT true,
    "themePrimaryColor" TEXT NOT NULL DEFAULT '#2f7d3b',
    "heroHeading" TEXT DEFAULT '歡迎來到我們的球館',
    "heroSubheading" TEXT DEFAULT '享受最佳的羽毛球體驗',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PageConfiguration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PageConfiguration_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CUSTOM',
    "targetAudience" TEXT NOT NULL DEFAULT 'ALL',
    "channels" TEXT NOT NULL DEFAULT 'LINE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketingCampaign_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LINENotificationSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "channelId" TEXT,
    "channelSecret" TEXT,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "enableBookingConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "enableActivityReminder" BOOLEAN NOT NULL DEFAULT true,
    "enablePromotionNotification" BOOLEAN NOT NULL DEFAULT true,
    "lastVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LINENotificationSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "HomePageConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftConfig" TEXT NOT NULL,
    "publishedConfig" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'PURPLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "draftUpdatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    "publishedBy" TEXT
);

-- CreateTable
CREATE TABLE "HomePageVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "homePageConfigId" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "versionType" TEXT NOT NULL,
    "operatedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeNote" TEXT,
    CONSTRAINT "HomePageVersion_homePageConfigId_fkey" FOREIGN KEY ("homePageConfigId") REFERENCES "HomePageConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Venue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "openMinute" INTEGER NOT NULL DEFAULT 600,
    "closeMinute" INTEGER NOT NULL DEFAULT 1440,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "bookAheadDays" INTEGER NOT NULL DEFAULT 14,
    "holdMinutes" INTEGER NOT NULL DEFAULT 10,
    "bookingCutoffMinutes" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notice" TEXT,
    "policy" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Taipei',
    "passwordGenerationMode" TEXT NOT NULL DEFAULT 'DAILY',
    "passwordBookAheadDaysOverride" INTEGER,
    "passwordOpenTime" TEXT NOT NULL DEFAULT '10_MINUTES_BEFORE',
    CONSTRAINT "Venue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Venue" ("active", "address", "bookAheadDays", "bookingCutoffMinutes", "closeMinute", "coverUrl", "description", "holdMinutes", "id", "name", "notice", "openMinute", "organizationId", "passwordBookAheadDaysOverride", "passwordGenerationMode", "phone", "policy", "slotMinutes", "slug", "timezone") SELECT "active", "address", "bookAheadDays", "bookingCutoffMinutes", "closeMinute", "coverUrl", "description", "holdMinutes", "id", "name", "notice", "openMinute", "organizationId", "passwordBookAheadDaysOverride", "passwordGenerationMode", "phone", "policy", "slotMinutes", "slug", "timezone" FROM "Venue";
DROP TABLE "Venue";
ALTER TABLE "new_Venue" RENAME TO "Venue";
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MarketingBanner_venueId_active_startAt_endAt_idx" ON "MarketingBanner"("venueId", "active", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "MarketingBanner_displayPages_idx" ON "MarketingBanner"("displayPages");

-- CreateIndex
CREATE INDEX "PromotionCard_venueId_active_startAt_endAt_idx" ON "PromotionCard"("venueId", "active", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "PromotionCard_displayPages_idx" ON "PromotionCard"("displayPages");

-- CreateIndex
CREATE INDEX "Announcement_venueId_active_startAt_endAt_idx" ON "Announcement"("venueId", "active", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Announcement_pinned_type_idx" ON "Announcement"("pinned", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PageConfiguration_pageType_key" ON "PageConfiguration"("pageType");

-- CreateIndex
CREATE INDEX "PageConfiguration_venueId_idx" ON "PageConfiguration"("venueId");

-- CreateIndex
CREATE INDEX "MarketingCampaign_venueId_status_idx" ON "MarketingCampaign"("venueId", "status");

-- CreateIndex
CREATE INDEX "MarketingCampaign_scheduledAt_idx" ON "MarketingCampaign"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "LINENotificationSetting_organizationId_key" ON "LINENotificationSetting"("organizationId");

-- CreateIndex
CREATE INDEX "LINENotificationSetting_isConnected_idx" ON "LINENotificationSetting"("isConnected");

-- CreateIndex
CREATE UNIQUE INDEX "SlotPasswordRule_venueId_key" ON "SlotPasswordRule"("venueId");

-- CreateIndex
CREATE INDEX "SlotPassword_venueId_slotDate_idx" ON "SlotPassword"("venueId", "slotDate");

-- CreateIndex
CREATE INDEX "SlotPassword_status_idx" ON "SlotPassword"("status");

-- CreateIndex
CREATE INDEX "SlotPassword_slotStartAt_slotEndAt_idx" ON "SlotPassword"("slotStartAt", "slotEndAt");

-- CreateIndex
CREATE INDEX "SlotPassword_codeHash_idx" ON "SlotPassword"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "SlotPassword_venueId_slotDate_slotType_key" ON "SlotPassword"("venueId", "slotDate", "slotType");

-- CreateIndex
CREATE INDEX "BookingSlotPassword_bookingId_idx" ON "BookingSlotPassword"("bookingId");

-- CreateIndex
CREATE INDEX "BookingSlotPassword_slotPasswordId_idx" ON "BookingSlotPassword"("slotPasswordId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSlotPassword_bookingId_slotPasswordId_key" ON "BookingSlotPassword"("bookingId", "slotPasswordId");

-- CreateIndex
CREATE INDEX "SlotPasswordLog_bookingId_idx" ON "SlotPasswordLog"("bookingId");

-- CreateIndex
CREATE INDEX "SlotPasswordLog_sendStatus_idx" ON "SlotPasswordLog"("sendStatus");

-- CreateIndex
CREATE INDEX "SlotPasswordLog_userId_idx" ON "SlotPasswordLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SlotPasswordLog_slotPasswordId_bookingId_key" ON "SlotPasswordLog"("slotPasswordId", "bookingId");

-- CreateIndex
CREATE INDEX "HomePageVersion_homePageConfigId_createdAt_idx" ON "HomePageVersion"("homePageConfigId", "createdAt");
