-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lineUserId" TEXT,
    "googleSub" TEXT,
    "lastLoginAt" DATETIME,
    "adminNote" TEXT,
    "isCoach" BOOLEAN NOT NULL DEFAULT false,
    "consentVersion" TEXT,
    "consentAt" DATETIME,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "marketingOptInAt" DATETIME,
    "displayName" TEXT NOT NULL,
    "pictureUrl" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "points" INTEGER NOT NULL DEFAULT 0,
    "membershipLevel" TEXT NOT NULL DEFAULT 'BASIC',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sessionsJoined" INTEGER NOT NULL DEFAULT 0,
    "sessionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "normalCancelCount" INTEGER NOT NULL DEFAULT 0,
    "lateCancelCount" INTEGER NOT NULL DEFAULT 0,
    "noShowCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "siteCode" TEXT,
    "iotTarget" TEXT NOT NULL DEFAULT 'LIVE',
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

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "indoor" BOOLEAN NOT NULL DEFAULT true,
    "covered" BOOLEAN NOT NULL DEFAULT false,
    "surface" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "capacity" INTEGER NOT NULL DEFAULT 4,
    CONSTRAINT "Court_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courtId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAction" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "approvedBy" TEXT,
    "submittedBy" TEXT,
    "expenseDate" DATETIME,
    "vendorName" TEXT,
    "docNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "reviewNote" TEXT,
    "reviewedAt" DATETIME,
    "idempotencyKey" TEXT,
    "receiptId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "ocrStatus" TEXT,
    "ocrFields" JSONB,
    "ocrConfidence" REAL,
    "imageUrl" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "userId" TEXT,
    "bookingId" TEXT,
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "items" JSONB NOT NULL,
    "provider" TEXT,
    "providerStatus" TEXT,
    "recipientEmail" TEXT,
    "replacedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MembershipTier" (
    "level" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "specialties" JSONB NOT NULL,
    "hourlyRate" INTEGER NOT NULL DEFAULT 0,
    "bio" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CoachAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coachId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    CONSTRAINT "CoachAvailability_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OFFPEAK',
    "dayType" TEXT NOT NULL DEFAULT 'ALL',
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PriceRule_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courtId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "holdExpiresAt" DATETIME,
    "cartToken" TEXT,
    "bookingId" TEXT,
    "sessionId" TEXT,
    "maintenanceEventId" TEXT,
    "note" TEXT,
    "lighting" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reservation_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reservation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Reservation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reservation_maintenanceEventId_fkey" FOREIGN KEY ("maintenanceEventId") REFERENCES "MaintenanceEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "playDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "pointsUsed" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "note" TEXT,
    "voucherCode" TEXT,
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "refundStatus" TEXT NOT NULL DEFAULT 'NONE',
    "expiresAt" DATETIME,
    "paidAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "termsAckedAt" DATETIME,
    "termsVersion" TEXT,
    "lastCancelAttempt" DATETIME,
    "cancelAttemptReason" TEXT,
    "checkedInAt" DATETIME,
    "noShowReason" TEXT,
    "cancelDeadlineAt" DATETIME,
    "refundEligible" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "courtName" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "price" INTEGER NOT NULL,
    "rateName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "refundedPoints" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingItem_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CREDIT_CARD',
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "cardLast4" TEXT,
    "cardBrand" TEXT,
    "rawResponse" JSONB,
    "failReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "refundedAt" DATETIME,
    CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'AMOUNT',
    "value" INTEGER NOT NULL,
    "minSpend" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "expiresAt" DATETIME,
    "usedAt" DATETIME,
    "bookingId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticketKind" TEXT,
    "units" INTEGER NOT NULL DEFAULT 1,
    "courtIds" TEXT NOT NULL DEFAULT '',
    "issuedBy" TEXT,
    "issueReason" TEXT,
    "revokedAt" DATETIME,
    "revokedBy" TEXT,
    "revokeReason" TEXT,
    CONSTRAINT "Voucher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Voucher_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SessionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "courtId" TEXT,
    "title" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "weekdays" TEXT NOT NULL DEFAULT '',
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 8,
    "reservedCapacity" INTEGER NOT NULL DEFAULT 0,
    "skillLevelMin" REAL,
    "skillLevelMax" REAL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "bookingOpenDaysBefore" INTEGER NOT NULL DEFAULT 7,
    "bookingOpenHourOffset" INTEGER NOT NULL DEFAULT 1,
    "cancellationMode" TEXT NOT NULL DEFAULT 'PREVIOUS_DAY_MIDNIGHT',
    "cancellationHoursBefore" INTEGER,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoPromote" BOOLEAN NOT NULL DEFAULT true,
    "allowPostLockReplacement" BOOLEAN NOT NULL DEFAULT false,
    "generateWeeksAhead" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SessionTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionTemplate_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionTemplate_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT,
    "venueId" TEXT NOT NULL,
    "courtId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "bookingOpenAt" DATETIME NOT NULL,
    "bookingCloseAt" DATETIME NOT NULL,
    "cancelDeadline" DATETIME NOT NULL,
    "finalizeAt" DATETIME NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 8,
    "reservedCapacity" INTEGER NOT NULL DEFAULT 0,
    "skillLevelMin" REAL,
    "skillLevelMax" REAL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoPromote" BOOLEAN NOT NULL DEFAULT true,
    "allowPostLockReplacement" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "cancelReason" TEXT,
    "lockedAt" DATETIME,
    "deletedAt" DATETIME,
    "activityId" TEXT,
    "coverAssetId" TEXT,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "coverFocusX" INTEGER,
    "coverFocusY" INTEGER,
    "seriesIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Session_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "MediaAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Session_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SessionTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Session_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "waitlistPosition" INTEGER,
    "addedByOrganizer" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER,
    "holdExpiresAt" DATETIME,
    "cartToken" TEXT,
    "bookingId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" DATETIME,
    "promotedAt" DATETIME,
    "checkedInAt" DATETIME,
    CONSTRAINT "SessionRegistration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionRosterSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "snapshotType" TEXT NOT NULL DEFAULT 'FINAL_ROSTER',
    "rosterJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionRosterSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "sessionId" TEXT,
    "registrationId" TEXT,
    "dedupeKey" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'LINE',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "error" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NotificationLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationLog_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "SessionRegistration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OPEN_PLAY',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "description" TEXT,
    "levelLabel" TEXT,
    "requirements" TEXT,
    "includes" TEXT,
    "refundNote" TEXT,
    "coverAssetId" TEXT,
    "coverFocusX" INTEGER NOT NULL DEFAULT 50,
    "coverFocusY" INTEGER NOT NULL DEFAULT 50,
    "price" INTEGER NOT NULL DEFAULT 0,
    "priceUnit" TEXT NOT NULL DEFAULT 'PER_PERSON',
    "capacity" INTEGER NOT NULL DEFAULT 8,
    "reservedCapacity" INTEGER NOT NULL DEFAULT 0,
    "maxPerOrder" INTEGER NOT NULL DEFAULT 4,
    "repeatKind" TEXT NOT NULL DEFAULT 'ONCE',
    "weekdays" TEXT NOT NULL DEFAULT '',
    "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "seriesStartDate" TEXT NOT NULL,
    "seriesEndDate" TEXT,
    "occurrenceCount" INTEGER,
    "skipDates" TEXT NOT NULL DEFAULT '',
    "courtIds" TEXT NOT NULL DEFAULT '',
    "openDaysBefore" INTEGER NOT NULL DEFAULT 7,
    "openMinute" INTEGER,
    "closeMinutesBefore" INTEGER NOT NULL DEFAULT 60,
    "holdUntil" DATETIME,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "customTypeLabel" TEXT,
    "locationNote" TEXT,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "hostId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Activity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "MediaAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionCourt" (
    "sessionId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,

    PRIMARY KEY ("sessionId", "courtId"),
    CONSTRAINT "SessionCourt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionCourt_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingActivityItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "courtNames" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "seats" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "priceUnit" TEXT NOT NULL DEFAULT 'PER_PERSON',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "refundedPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingActivityItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingActivityItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionWatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" DATETIME,
    "cancelledAt" DATETIME,
    CONSTRAINT "SessionWatch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mime" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "bytes" BLOB NOT NULL,
    "thumbBytes" BLOB NOT NULL,
    "thumbWidth" INTEGER NOT NULL,
    "thumbHeight" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "originalName" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
CREATE TABLE "AdminAccount" (
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
    "userId" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "venueId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminSession" (
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
CREATE TABLE "AdminLoginAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usernameKey" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Refund" (
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
    "fullRefundEligible" BOOLEAN NOT NULL DEFAULT false,
    "cancelDeadlineAt" DATETIME,
    "actualCancelledAt" DATETIME,
    "isLateRefund" BOOLEAN NOT NULL DEFAULT false,
    "refundBreakdown" JSONB,
    CONSTRAINT "Refund_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CancellationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "attemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "minutesBeforeStart" INTEGER,
    "operatedBy" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CancellationLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefundItem" (
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
CREATE TABLE "InvoiceEvent" (
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
CREATE TABLE "DeviceCommand" (
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
CREATE TABLE "Incident" (
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
CREATE TABLE "MemberRestriction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "internalNote" TEXT,
    "metadata" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "revokedBy" TEXT,
    "revokeReason" TEXT,
    CONSTRAINT "MemberRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Host" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoAssetId" TEXT,
    "bio" TEXT,
    "publicContact" TEXT,
    "internalPhone" TEXT,
    "internalEmail" TEXT,
    "internalNote" TEXT,
    "userId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Host_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Host_photoAssetId_fkey" FOREIGN KEY ("photoAssetId") REFERENCES "MediaAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenancePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CLEANING',
    "courtIds" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "repeatKind" TEXT NOT NULL DEFAULT 'ONCE',
    "weekdays" TEXT NOT NULL DEFAULT '',
    "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
    "seriesStartDate" TEXT NOT NULL,
    "seriesEndDate" TEXT,
    "occurrenceCount" INTEGER,
    "skipDates" TEXT NOT NULL DEFAULT '',
    "assignee" TEXT,
    "description" TEXT,
    "checklist" TEXT,
    "lighting" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenancePlan_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "courtIds" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "note" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "releasedAt" DATETIME,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MaintenancePlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PointsLedger" (
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

-- CreateTable
CREATE TABLE "TopUpPlan" (
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

-- CreateTable
CREATE TABLE "TopUpOrder" (
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

-- CreateTable
CREATE TABLE "ExpenseAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseId" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "bytes" BLOB NOT NULL,
    "thumbBytes" BLOB,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT,
    "sha256" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseAttachment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpenseRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseId" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "note" TEXT,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseRevision_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Circuit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "circuitNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "remoteControlEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scheduleControlEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deviceMapping" JSONB,
    "reservationAdvanceMinutes" INTEGER,
    "reservationDelayMinutes" INTEGER,
    "expectedState" TEXT,
    "actualState" TEXT,
    "lastStateChange" DATETIME,
    "lastDeviceReport" DATETIME,
    "lastCommandStatus" TEXT,
    "lastCommandAt" DATETIME,
    "lastCommandError" TEXT,
    "overrideMode" TEXT,
    "overrideState" TEXT,
    "overrideBaseline" TEXT,
    "overrideUntil" DATETIME,
    "overrideBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Circuit_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
CREATE TABLE "CircuitScheduleAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT,
    "circuitNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "modifiedBy" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ControlCommand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commandId" TEXT NOT NULL,
    "circuitId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SCHEDULE',
    "targetState" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduleId" TEXT,
    "reservationId" TEXT,
    "requestedBy" TEXT,
    "mqttTopic" TEXT,
    "mqttPayload" JSONB,
    "sentAt" DATETIME,
    "ackedAt" DATETIME,
    "error" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControlCommand_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControlCommand_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperatingHours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "businessStartMinute" INTEGER NOT NULL DEFAULT 480,
    "businessEndMinute" INTEGER NOT NULL DEFAULT 1320,
    "nightStartMinute" INTEGER NOT NULL DEFAULT 1080,
    "nightEndMinute" INTEGER NOT NULL DEFAULT 1320,
    "disabledDates" TEXT NOT NULL DEFAULT '',
    "applicableWeekdays" TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OperatingHours_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceAdapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "macId" TEXT NOT NULL,
    "mqttBrokerUrl" TEXT,
    "mqttPort" INTEGER NOT NULL DEFAULT 1883,
    "mqttUseTls" BOOLEAN NOT NULL DEFAULT false,
    "mqttUsername" TEXT,
    "mqttPassword" TEXT,
    "mqttTopicPrefix" TEXT NOT NULL,
    "totalChannels" INTEGER NOT NULL DEFAULT 18,
    "mqttControlTopic" TEXT NOT NULL,
    "mqttStatusTopic" TEXT NOT NULL,
    "deviceStateMapping" JSONB,
    "connectionStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastHeartbeat" DATETIME,
    "tlsCertReference" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeviceAdapter_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ControlEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "circuitId" TEXT,
    "commandId" TEXT,
    "reservationId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB,
    "correlationId" TEXT,
    "syncedToNeon" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControlEvent_circuitId_fkey" FOREIGN KEY ("circuitId") REFERENCES "Circuit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ControlEvent_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "ControlCommand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ControlEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ControlEvent_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchdogAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "component" TEXT,
    "componentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "detectionSource" TEXT,
    "detectionCount" INTEGER NOT NULL DEFAULT 1,
    "expectedValue" TEXT,
    "actualValue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" DATETIME,
    "acknowledgedNote" TEXT,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "resolveNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WatchdogAlert_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "bookingVersion" INTEGER NOT NULL DEFAULT 1,
    "credentialState" TEXT NOT NULL DEFAULT 'CREATED',
    "controllerMacId" TEXT NOT NULL,
    "userSlotNumber" INTEGER,
    "credentialHash" TEXT,
    "credentialType" TEXT NOT NULL DEFAULT 'PIN',
    "validFromUtc" DATETIME NOT NULL,
    "validUntilUtc" DATETIME NOT NULL,
    "lastAppliedAt" DATETIME,
    "lastRevokedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccessSession_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessSession_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DoorAccessCommand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commandId" TEXT NOT NULL,
    "accessSessionId" TEXT NOT NULL,
    "bookingVersion" INTEGER NOT NULL,
    "commandSequence" INTEGER NOT NULL,
    "commandType" TEXT NOT NULL DEFAULT 'PROVISION_CREDENTIAL',
    "issuedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "targetState" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "mqttTopic" TEXT,
    "mqttPayload" JSONB,
    "sentAt" DATETIME,
    "ackedAt" DATETIME,
    "deviceResponse" JSONB,
    "deviceStatus" TEXT,
    "error" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DoorAccessCommand_accessSessionId_fkey" FOREIGN KEY ("accessSessionId") REFERENCES "AccessSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accessSessionId" TEXT NOT NULL,
    "commandId" TEXT,
    "venueId" TEXT NOT NULL,
    "controllerMacId" TEXT NOT NULL,
    "attemptAt" DATETIME NOT NULL,
    "accessStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "accessMethod" TEXT NOT NULL DEFAULT 'PIN_ENTRY',
    "resultCode" TEXT,
    "resultDescription" TEXT,
    "doorState" TEXT,
    "doorOpenAt" DATETIME,
    "doorClosedAt" DATETIME,
    "clockDriftSeconds" INTEGER,
    "details" JSONB,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessLog_accessSessionId_fkey" FOREIGN KEY ("accessSessionId") REFERENCES "AccessSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessLog_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "DoorAccessCommand" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CredentialAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "accessSessionId" TEXT,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "affectedResource" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "triggeredBy" TEXT NOT NULL DEFAULT 'WATCHDOG',
    "detectionCount" INTEGER NOT NULL DEFAULT 1,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" DATETIME,
    "acknowledgedNote" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" DATETIME,
    "resolveNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CredentialAlert_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CredentialAlert_accessSessionId_fkey" FOREIGN KEY ("accessSessionId") REFERENCES "AccessSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE TABLE "SlotPasswordRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "generationMode" TEXT NOT NULL DEFAULT 'SPLIT_DAY',
    "passwordLength" INTEGER NOT NULL DEFAULT 6,
    "generateAheadDays" INTEGER NOT NULL DEFAULT 7,
    "passwordOpenTime" TEXT NOT NULL DEFAULT '10_MIN_BEFORE',
    "passwordOpenCustomMinutes" INTEGER,
    "passwordExpireTime" TEXT NOT NULL DEFAULT '30_MIN_AFTER',
    "passwordExpireCustomMinutes" INTEGER,
    "lockWhenNoOrders" BOOLEAN NOT NULL DEFAULT true,
    "allowSharedPassword" BOOLEAN NOT NULL DEFAULT true,
    "basicMemberBookAheadDays" INTEGER,
    "pointsMemberBookAheadDays" INTEGER,
    "vipMemberBookAheadDays" INTEGER,
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

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "triggerType" TEXT NOT NULL,
    "triggerConfig" TEXT NOT NULL,
    "circuitNumbers" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionConfig" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "exceptDates" TEXT,
    "weekdays" TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pauseReason" TEXT,
    "note" TEXT,
    "lastTriggeredAt" DATETIME,
    "lastResult" TEXT,
    "lastError" TEXT,
    "createdBy" TEXT NOT NULL,
    "modifiedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "triggeredAt" DATETIME NOT NULL,
    "result" TEXT NOT NULL,
    "action" TEXT,
    "errorMessage" TEXT,
    "affectedCircuits" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DoorRemoteCommand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "pulseSeconds" INTEGER NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "ackAt" DATETIME
);

-- CreateTable
CREATE TABLE "DuprPlayerLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "duprPlayerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" DATETIME NOT NULL,
    "singlesRating" REAL,
    "doublesRating" REAL,
    "ratingUpdatedAt" DATETIME,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinkedAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DuprPlayerLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DuprApiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "requestAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMsg" TEXT,
    "requestSize" INTEGER,
    "responseSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductInventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "currentQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductInventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inventoryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "orderReference" TEXT,
    "vendor" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryTransaction_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "ProductInventory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "shippingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "recipientAddress" TEXT NOT NULL,
    "shippingMethod" TEXT,
    "trackingNumber" TEXT,
    "paidAt" DATETIME,
    "shippedAt" DATETIME,
    "deliveredAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductOrder_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductRefund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CartProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartToken" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CartProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "gracePeriodDays" INTEGER DEFAULT 7,
    "nextRenewalAt" DATETIME,
    "nextRetryAt" DATETIME,
    "renewalAttempts" INTEGER NOT NULL DEFAULT 0,
    "renewalFailReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeatureSubscription_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeatureSubscription_featureModuleId_fkey" FOREIGN KEY ("featureModuleId") REFERENCES "FeatureModule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeatureSubscription_platformPaymentId_fkey" FOREIGN KEY ("platformPaymentId") REFERENCES "PlatformPayment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VenuePaymentMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "venueId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "cardTokenResult" TEXT,
    "cardLastFour" TEXT,
    "cardholderName" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VenuePaymentMethod_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "webhookSecret" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" DATETIME,
    "nextRetryAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "refundedAt" DATETIME,
    CONSTRAINT "PlatformPayment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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

-- CreateIndex
CREATE UNIQUE INDEX "User_lineUserId_key" ON "User"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Venue_siteCode_key" ON "Venue"("siteCode");

-- CreateIndex
CREATE INDEX "Court_venueId_sortOrder_idx" ON "Court"("venueId", "sortOrder");

-- CreateIndex
CREATE INDEX "Device_courtId_idx" ON "Device"("courtId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_expenseNumber_key" ON "Expense"("expenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_idempotencyKey_key" ON "Expense"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_receiptId_key" ON "Expense"("receiptId");

-- CreateIndex
CREATE INDEX "Expense_status_submittedAt_idx" ON "Expense"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_submittedBy_idx" ON "Expense"("submittedBy");

-- CreateIndex
CREATE INDEX "Expense_docNumber_idx" ON "Expense"("docNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "Receipt_issueDate_idx" ON "Receipt"("issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE INDEX "Coach_status_idx" ON "Coach"("status");

-- CreateIndex
CREATE INDEX "CoachAvailability_coachId_idx" ON "CoachAvailability"("coachId");

-- CreateIndex
CREATE INDEX "PriceRule_venueId_dayType_idx" ON "PriceRule"("venueId", "dayType");

-- CreateIndex
CREATE INDEX "Reservation_startsAt_idx" ON "Reservation"("startsAt");

-- CreateIndex
CREATE INDEX "Reservation_bookingId_idx" ON "Reservation"("bookingId");

-- CreateIndex
CREATE INDEX "Reservation_sessionId_idx" ON "Reservation"("sessionId");

-- CreateIndex
CREATE INDEX "Reservation_maintenanceEventId_idx" ON "Reservation"("maintenanceEventId");

-- CreateIndex
CREATE INDEX "Reservation_holdExpiresAt_idx" ON "Reservation"("holdExpiresAt");

-- CreateIndex
CREATE INDEX "Reservation_cartToken_idx" ON "Reservation"("cartToken");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_courtId_startsAt_key" ON "Reservation"("courtId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_code_key" ON "Booking"("code");

-- CreateIndex
CREATE INDEX "Booking_userId_createdAt_idx" ON "Booking"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_venueId_playDate_idx" ON "Booking"("venueId", "playDate");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_checkedInAt_idx" ON "Booking"("checkedInAt");

-- CreateIndex
CREATE INDEX "Booking_cancelDeadlineAt_idx" ON "Booking"("cancelDeadlineAt");

-- CreateIndex
CREATE INDEX "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");

-- CreateIndex
CREATE INDEX "BookingItem_startsAt_idx" ON "BookingItem"("startsAt");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_providerRef_idx" ON "Payment"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_bookingId_key" ON "Voucher"("bookingId");

-- CreateIndex
CREATE INDEX "Voucher_userId_idx" ON "Voucher"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_active_idx" ON "Organization"("active");

-- CreateIndex
CREATE INDEX "SessionTemplate_organizationId_active_idx" ON "SessionTemplate"("organizationId", "active");

-- CreateIndex
CREATE INDEX "SessionTemplate_venueId_active_idx" ON "SessionTemplate"("venueId", "active");

-- CreateIndex
CREATE INDEX "SessionTemplate_active_weekday_idx" ON "SessionTemplate"("active", "weekday");

-- CreateIndex
CREATE INDEX "Session_status_bookingOpenAt_idx" ON "Session"("status", "bookingOpenAt");

-- CreateIndex
CREATE INDEX "Session_status_finalizeAt_idx" ON "Session"("status", "finalizeAt");

-- CreateIndex
CREATE INDEX "Session_status_startAt_idx" ON "Session"("status", "startAt");

-- CreateIndex
CREATE INDEX "Session_venueId_startAt_idx" ON "Session"("venueId", "startAt");

-- CreateIndex
CREATE INDEX "Session_activityId_startAt_idx" ON "Session"("activityId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_templateId_startAt_key" ON "Session"("templateId", "startAt");

-- CreateIndex
CREATE INDEX "SessionRegistration_sessionId_status_idx" ON "SessionRegistration"("sessionId", "status");

-- CreateIndex
CREATE INDEX "SessionRegistration_cartToken_idx" ON "SessionRegistration"("cartToken");

-- CreateIndex
CREATE INDEX "SessionRegistration_bookingId_idx" ON "SessionRegistration"("bookingId");

-- CreateIndex
CREATE INDEX "SessionRegistration_sessionId_status_waitlistPosition_idx" ON "SessionRegistration"("sessionId", "status", "waitlistPosition");

-- CreateIndex
CREATE INDEX "SessionRegistration_userId_status_idx" ON "SessionRegistration"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionRegistration_sessionId_userId_key" ON "SessionRegistration"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "SessionRosterSnapshot_sessionId_snapshotType_idx" ON "SessionRosterSnapshot"("sessionId", "snapshotType");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_dedupeKey_key" ON "NotificationLog"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationLog_status_createdAt_idx" ON "NotificationLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_sessionId_type_idx" ON "NotificationLog"("sessionId", "type");

-- CreateIndex
CREATE INDEX "Activity_venueId_status_idx" ON "Activity"("venueId", "status");

-- CreateIndex
CREATE INDEX "SessionCourt_courtId_idx" ON "SessionCourt"("courtId");

-- CreateIndex
CREATE INDEX "BookingActivityItem_bookingId_idx" ON "BookingActivityItem"("bookingId");

-- CreateIndex
CREATE INDEX "BookingActivityItem_sessionId_idx" ON "BookingActivityItem"("sessionId");

-- CreateIndex
CREATE INDEX "BookingActivityItem_registrationId_idx" ON "BookingActivityItem"("registrationId");

-- CreateIndex
CREATE INDEX "SessionWatch_sessionId_cancelledAt_idx" ON "SessionWatch"("sessionId", "cancelledAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionWatch_sessionId_userId_key" ON "SessionWatch"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_sha256_key" ON "MediaAsset"("sha256");

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
CREATE UNIQUE INDEX "AdminAccount_usernameKey_key" ON "AdminAccount"("usernameKey");

-- CreateIndex
CREATE INDEX "AdminSession_accountId_idx" ON "AdminSession"("accountId");

-- CreateIndex
CREATE INDEX "AdminLoginAttempt_usernameKey_createdAt_idx" ON "AdminLoginAttempt"("usernameKey", "createdAt");

-- CreateIndex
CREATE INDEX "AdminLoginAttempt_ip_createdAt_idx" ON "AdminLoginAttempt"("ip", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_bookingId_idx" ON "Refund"("bookingId");

-- CreateIndex
CREATE INDEX "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CancellationLog_bookingId_attemptAt_idx" ON "CancellationLog"("bookingId", "attemptAt");

-- CreateIndex
CREATE INDEX "CancellationLog_status_idx" ON "CancellationLog"("status");

-- CreateIndex
CREATE INDEX "RefundItem_refundId_idx" ON "RefundItem"("refundId");

-- CreateIndex
CREATE INDEX "RefundItem_itemId_idx" ON "RefundItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceEvent_idempotencyKey_key" ON "InvoiceEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "InvoiceEvent_invoiceId_idx" ON "InvoiceEvent"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCommand_idempotencyKey_key" ON "DeviceCommand"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DeviceCommand_deviceId_createdAt_idx" ON "DeviceCommand"("deviceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_dedupeKey_key" ON "Incident"("dedupeKey");

-- CreateIndex
CREATE INDEX "Incident_status_createdAt_idx" ON "Incident"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MemberRestriction_userId_revokedAt_expiresAt_idx" ON "MemberRestriction"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "Host_venueId_active_idx" ON "Host"("venueId", "active");

-- CreateIndex
CREATE INDEX "MaintenancePlan_venueId_status_idx" ON "MaintenancePlan"("venueId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceEvent_planId_startAt_idx" ON "MaintenanceEvent"("planId", "startAt");

-- CreateIndex
CREATE INDEX "MaintenanceEvent_venueId_startAt_idx" ON "MaintenanceEvent"("venueId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "PointsLedger_idempotencyKey_key" ON "PointsLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PointsLedger_userId_createdAt_idx" ON "PointsLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TopUpPlan_active_sortOrder_idx" ON "TopUpPlan"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TopUpOrder_code_key" ON "TopUpOrder"("code");

-- CreateIndex
CREATE INDEX "TopUpOrder_userId_createdAt_idx" ON "TopUpOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TopUpOrder_status_createdAt_idx" ON "TopUpOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TopUpOrder_providerRef_idx" ON "TopUpOrder"("providerRef");

-- CreateIndex
CREATE INDEX "ExpenseAttachment_expenseId_idx" ON "ExpenseAttachment"("expenseId");

-- CreateIndex
CREATE INDEX "ExpenseAttachment_uploadedBy_createdAt_idx" ON "ExpenseAttachment"("uploadedBy", "createdAt");

-- CreateIndex
CREATE INDEX "ExpenseAttachment_sha256_idx" ON "ExpenseAttachment"("sha256");

-- CreateIndex
CREATE INDEX "ExpenseRevision_expenseId_createdAt_idx" ON "ExpenseRevision"("expenseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Circuit_circuitNumber_key" ON "Circuit"("circuitNumber");

-- CreateIndex
CREATE INDEX "Circuit_venueId_idx" ON "Circuit"("venueId");

-- CreateIndex
CREATE INDEX "Circuit_category_idx" ON "Circuit"("category");

-- CreateIndex
CREATE INDEX "Circuit_enabled_idx" ON "Circuit"("enabled");

-- CreateIndex
CREATE INDEX "DeviceAnomaly_circuitId_idx" ON "DeviceAnomaly"("circuitId");

-- CreateIndex
CREATE INDEX "DeviceAnomaly_status_idx" ON "DeviceAnomaly"("status");

-- CreateIndex
CREATE INDEX "DeviceAnomaly_severity_idx" ON "DeviceAnomaly"("severity");

-- CreateIndex
CREATE INDEX "DeviceAnomaly_occurredAt_idx" ON "DeviceAnomaly"("occurredAt");

-- CreateIndex
CREATE INDEX "CircuitSchedule_circuitId_idx" ON "CircuitSchedule"("circuitId");

-- CreateIndex
CREATE INDEX "CircuitSchedule_category_idx" ON "CircuitSchedule"("category");

-- CreateIndex
CREATE INDEX "CircuitSchedule_enabled_idx" ON "CircuitSchedule"("enabled");

-- CreateIndex
CREATE INDEX "CircuitScheduleAudit_circuitNumber_idx" ON "CircuitScheduleAudit"("circuitNumber");

-- CreateIndex
CREATE INDEX "CircuitScheduleAudit_operation_idx" ON "CircuitScheduleAudit"("operation");

-- CreateIndex
CREATE INDEX "CircuitScheduleAudit_createdAt_idx" ON "CircuitScheduleAudit"("createdAt");

-- CreateIndex
CREATE INDEX "CircuitScheduleAudit_modifiedBy_idx" ON "CircuitScheduleAudit"("modifiedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ControlCommand_commandId_key" ON "ControlCommand"("commandId");

-- CreateIndex
CREATE INDEX "ControlCommand_circuitId_createdAt_idx" ON "ControlCommand"("circuitId", "createdAt");

-- CreateIndex
CREATE INDEX "ControlCommand_status_createdAt_idx" ON "ControlCommand"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ControlCommand_commandId_idx" ON "ControlCommand"("commandId");

-- CreateIndex
CREATE INDEX "ControlCommand_expiresAt_idx" ON "ControlCommand"("expiresAt");

-- CreateIndex
CREATE INDEX "ControlCommand_reservationId_idx" ON "ControlCommand"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "OperatingHours_venueId_key" ON "OperatingHours"("venueId");

-- CreateIndex
CREATE INDEX "OperatingHours_venueId_idx" ON "OperatingHours"("venueId");

-- CreateIndex
CREATE INDEX "DeviceAdapter_venueId_idx" ON "DeviceAdapter"("venueId");

-- CreateIndex
CREATE INDEX "DeviceAdapter_macId_idx" ON "DeviceAdapter"("macId");

-- CreateIndex
CREATE INDEX "DeviceAdapter_enabled_idx" ON "DeviceAdapter"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ControlEvent_eventId_key" ON "ControlEvent"("eventId");

-- CreateIndex
CREATE INDEX "ControlEvent_venueId_createdAt_idx" ON "ControlEvent"("venueId", "createdAt");

-- CreateIndex
CREATE INDEX "ControlEvent_eventType_createdAt_idx" ON "ControlEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "ControlEvent_severity_idx" ON "ControlEvent"("severity");

-- CreateIndex
CREATE INDEX "ControlEvent_environment_idx" ON "ControlEvent"("environment");

-- CreateIndex
CREATE INDEX "ControlEvent_syncedToNeon_idx" ON "ControlEvent"("syncedToNeon");

-- CreateIndex
CREATE INDEX "ControlEvent_correlationId_idx" ON "ControlEvent"("correlationId");

-- CreateIndex
CREATE INDEX "WatchdogAlert_venueId_status_idx" ON "WatchdogAlert"("venueId", "status");

-- CreateIndex
CREATE INDEX "WatchdogAlert_alertType_idx" ON "WatchdogAlert"("alertType");

-- CreateIndex
CREATE INDEX "WatchdogAlert_severity_idx" ON "WatchdogAlert"("severity");

-- CreateIndex
CREATE INDEX "WatchdogAlert_createdAt_idx" ON "WatchdogAlert"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccessSession_reservationId_key" ON "AccessSession"("reservationId");

-- CreateIndex
CREATE INDEX "AccessSession_venueId_reservationId_idx" ON "AccessSession"("venueId", "reservationId");

-- CreateIndex
CREATE INDEX "AccessSession_controllerMacId_userSlotNumber_idx" ON "AccessSession"("controllerMacId", "userSlotNumber");

-- CreateIndex
CREATE INDEX "AccessSession_validFromUtc_validUntilUtc_idx" ON "AccessSession"("validFromUtc", "validUntilUtc");

-- CreateIndex
CREATE INDEX "AccessSession_status_idx" ON "AccessSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DoorAccessCommand_commandId_key" ON "DoorAccessCommand"("commandId");

-- CreateIndex
CREATE INDEX "DoorAccessCommand_accessSessionId_commandType_idx" ON "DoorAccessCommand"("accessSessionId", "commandType");

-- CreateIndex
CREATE INDEX "DoorAccessCommand_status_createdAt_idx" ON "DoorAccessCommand"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DoorAccessCommand_commandId_idx" ON "DoorAccessCommand"("commandId");

-- CreateIndex
CREATE INDEX "DoorAccessCommand_expiresAt_idx" ON "DoorAccessCommand"("expiresAt");

-- CreateIndex
CREATE INDEX "AccessLog_accessSessionId_attemptAt_idx" ON "AccessLog"("accessSessionId", "attemptAt");

-- CreateIndex
CREATE INDEX "AccessLog_venueId_attemptAt_idx" ON "AccessLog"("venueId", "attemptAt");

-- CreateIndex
CREATE INDEX "AccessLog_accessStatus_idx" ON "AccessLog"("accessStatus");

-- CreateIndex
CREATE INDEX "AccessLog_controllerMacId_attemptAt_idx" ON "AccessLog"("controllerMacId", "attemptAt");

-- CreateIndex
CREATE INDEX "CredentialAlert_venueId_status_idx" ON "CredentialAlert"("venueId", "status");

-- CreateIndex
CREATE INDEX "CredentialAlert_alertType_severity_idx" ON "CredentialAlert"("alertType", "severity");

-- CreateIndex
CREATE INDEX "CredentialAlert_createdAt_idx" ON "CredentialAlert"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DoorAccessGrant_bookingId_key" ON "DoorAccessGrant"("bookingId");

-- CreateIndex
CREATE INDEX "DoorAccessGrant_venueId_validFrom_validUntil_idx" ON "DoorAccessGrant"("venueId", "validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "DoorAccessGrant_userId_idx" ON "DoorAccessGrant"("userId");

-- CreateIndex
CREATE INDEX "DoorAccessGrant_status_idx" ON "DoorAccessGrant"("status");

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
CREATE INDEX "AutomationRule_venueId_enabled_idx" ON "AutomationRule"("venueId", "enabled");

-- CreateIndex
CREATE INDEX "AutomationRule_triggerType_idx" ON "AutomationRule"("triggerType");

-- CreateIndex
CREATE INDEX "AutomationLog_ruleId_idx" ON "AutomationLog"("ruleId");

-- CreateIndex
CREATE INDEX "AutomationLog_venueId_idx" ON "AutomationLog"("venueId");

-- CreateIndex
CREATE INDEX "AutomationLog_triggeredAt_idx" ON "AutomationLog"("triggeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "DoorRemoteCommand_idempotencyKey_key" ON "DoorRemoteCommand"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DoorRemoteCommand_doorId_createdAt_idx" ON "DoorRemoteCommand"("doorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DuprPlayerLink_userId_key" ON "DuprPlayerLink"("userId");

-- CreateIndex
CREATE INDEX "DuprPlayerLink_duprPlayerId_idx" ON "DuprPlayerLink"("duprPlayerId");

-- CreateIndex
CREATE INDEX "DuprPlayerLink_linkedAt_idx" ON "DuprPlayerLink"("linkedAt");

-- CreateIndex
CREATE INDEX "DuprPlayerLink_unlinkedAt_idx" ON "DuprPlayerLink"("unlinkedAt");

-- CreateIndex
CREATE INDEX "DuprApiLog_endpoint_requestAt_idx" ON "DuprApiLog"("endpoint", "requestAt");

-- CreateIndex
CREATE INDEX "DuprApiLog_userId_requestAt_idx" ON "DuprApiLog"("userId", "requestAt");

-- CreateIndex
CREATE INDEX "DuprApiLog_statusCode_idx" ON "DuprApiLog"("statusCode");

-- CreateIndex
CREATE INDEX "DuprApiLog_requestAt_idx" ON "DuprApiLog"("requestAt");

-- CreateIndex
CREATE INDEX "HomePageVersion_homePageConfigId_createdAt_idx" ON "HomePageVersion"("homePageConfigId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_venueId_idx" ON "Product"("venueId");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_published_idx" ON "Product"("published");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductInventory_productId_key" ON "ProductInventory"("productId");

-- CreateIndex
CREATE INDEX "ProductInventory_productId_idx" ON "ProductInventory"("productId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_inventoryId_createdAt_idx" ON "InventoryTransaction"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_type_idx" ON "InventoryTransaction"("type");

-- CreateIndex
CREATE INDEX "InventoryTransaction_orderReference_idx" ON "InventoryTransaction"("orderReference");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOrder_code_key" ON "ProductOrder"("code");

-- CreateIndex
CREATE INDEX "ProductOrder_userId_createdAt_idx" ON "ProductOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductOrder_venueId_idx" ON "ProductOrder"("venueId");

-- CreateIndex
CREATE INDEX "ProductOrder_status_idx" ON "ProductOrder"("status");

-- CreateIndex
CREATE INDEX "ProductOrder_paymentStatus_idx" ON "ProductOrder"("paymentStatus");

-- CreateIndex
CREATE INDEX "ProductOrder_shippingStatus_idx" ON "ProductOrder"("shippingStatus");

-- CreateIndex
CREATE INDEX "ProductOrderItem_orderId_idx" ON "ProductOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "ProductOrderItem_productId_idx" ON "ProductOrderItem"("productId");

-- CreateIndex
CREATE INDEX "ProductPayment_orderId_createdAt_idx" ON "ProductPayment"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductPayment_status_idx" ON "ProductPayment"("status");

-- CreateIndex
CREATE INDEX "ProductRefund_orderId_createdAt_idx" ON "ProductRefund"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductRefund_status_idx" ON "ProductRefund"("status");

-- CreateIndex
CREATE INDEX "CartProduct_cartToken_idx" ON "CartProduct"("cartToken");

-- CreateIndex
CREATE INDEX "CartProduct_productId_idx" ON "CartProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CartProduct_cartToken_productId_key" ON "CartProduct"("cartToken", "productId");

-- CreateIndex
CREATE INDEX "AIConversation_userId_idx" ON "AIConversation"("userId");

-- CreateIndex
CREATE INDEX "AIConversation_updatedAt_idx" ON "AIConversation"("updatedAt");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_idx" ON "AIMessage"("conversationId");

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
CREATE INDEX "FeatureSubscription_nextRenewalAt_idx" ON "FeatureSubscription"("nextRenewalAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureSubscription_venueId_featureModuleId_key" ON "FeatureSubscription"("venueId", "featureModuleId");

-- CreateIndex
CREATE INDEX "VenuePaymentMethod_venueId_idx" ON "VenuePaymentMethod"("venueId");

-- CreateIndex
CREATE INDEX "VenuePaymentMethod_isDefault_idx" ON "VenuePaymentMethod"("isDefault");

-- CreateIndex
CREATE INDEX "VenuePaymentMethod_isActive_idx" ON "VenuePaymentMethod"("isActive");

-- CreateIndex
CREATE INDEX "PlatformPayment_venueId_idx" ON "PlatformPayment"("venueId");

-- CreateIndex
CREATE INDEX "PlatformPayment_status_idx" ON "PlatformPayment"("status");

-- CreateIndex
CREATE INDEX "PlatformPayment_providerRef_idx" ON "PlatformPayment"("providerRef");

-- CreateIndex
CREATE INDEX "PlatformPayment_nextRetryAt_idx" ON "PlatformPayment"("nextRetryAt");

-- CreateIndex
CREATE INDEX "PlatformPayment_createdAt_idx" ON "PlatformPayment"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformWebhookLog_paymentId_idx" ON "PlatformWebhookLog"("paymentId");

-- CreateIndex
CREATE INDEX "PlatformWebhookLog_venueId_createdAt_idx" ON "PlatformWebhookLog"("venueId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformWebhookLog_provider_signatureValid_idx" ON "PlatformWebhookLog"("provider", "signatureValid");

