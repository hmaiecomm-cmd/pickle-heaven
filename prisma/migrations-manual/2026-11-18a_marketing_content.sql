-- 2026-11-18 前台行銷設計：MarketingBanner / PromotionCard / Announcement / PageConfiguration / MarketingCampaign / LINENotificationSetting
-- 由 prisma migrate diff --from-empty 依 schema.prisma 產生；全部 IF NOT EXISTS，可重複執行、不動既有資料。
-- 正式主庫 pickle-heaven 與展示庫 pickle-heaven-db 已於 2026-11-18 套用（與本檔內容相同）。
-- 套用：node scripts/apply-sql.mjs prisma/migrations-manual/2026-11-18a_marketing_content.sql

CREATE TABLE IF NOT EXISTS "MarketingBanner" (
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

CREATE INDEX IF NOT EXISTS "MarketingBanner_venueId_active_startAt_endAt_idx" ON "MarketingBanner"("venueId", "active", "startAt", "endAt");

CREATE INDEX IF NOT EXISTS "MarketingBanner_displayPages_idx" ON "MarketingBanner"("displayPages");

CREATE TABLE IF NOT EXISTS "PromotionCard" (
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

CREATE INDEX IF NOT EXISTS "PromotionCard_venueId_active_startAt_endAt_idx" ON "PromotionCard"("venueId", "active", "startAt", "endAt");

CREATE INDEX IF NOT EXISTS "PromotionCard_displayPages_idx" ON "PromotionCard"("displayPages");

CREATE TABLE IF NOT EXISTS "Announcement" (
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

CREATE INDEX IF NOT EXISTS "Announcement_venueId_active_startAt_endAt_idx" ON "Announcement"("venueId", "active", "startAt", "endAt");

CREATE INDEX IF NOT EXISTS "Announcement_pinned_type_idx" ON "Announcement"("pinned", "type");

CREATE TABLE IF NOT EXISTS "PageConfiguration" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "PageConfiguration_pageType_key" ON "PageConfiguration"("pageType");

CREATE INDEX IF NOT EXISTS "PageConfiguration_venueId_idx" ON "PageConfiguration"("venueId");

CREATE TABLE IF NOT EXISTS "MarketingCampaign" (
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

CREATE INDEX IF NOT EXISTS "MarketingCampaign_venueId_status_idx" ON "MarketingCampaign"("venueId", "status");

CREATE INDEX IF NOT EXISTS "MarketingCampaign_scheduledAt_idx" ON "MarketingCampaign"("scheduledAt");

CREATE TABLE IF NOT EXISTS "LINENotificationSetting" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "LINENotificationSetting_organizationId_key" ON "LINENotificationSetting"("organizationId");

CREATE INDEX IF NOT EXISTS "LINENotificationSetting_isConnected_idx" ON "LINENotificationSetting"("isConnected");
