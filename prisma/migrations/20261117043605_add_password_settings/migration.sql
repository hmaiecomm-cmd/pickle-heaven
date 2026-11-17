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
    CONSTRAINT "Venue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Venue" ("active", "address", "bookAheadDays", "bookingCutoffMinutes", "closeMinute", "coverUrl", "description", "holdMinutes", "id", "name", "notice", "openMinute", "organizationId", "phone", "policy", "slotMinutes", "slug", "timezone") SELECT "active", "address", "bookAheadDays", "bookingCutoffMinutes", "closeMinute", "coverUrl", "description", "holdMinutes", "id", "name", "notice", "openMinute", "organizationId", "phone", "policy", "slotMinutes", "slug", "timezone" FROM "Venue";
DROP TABLE "Venue";
ALTER TABLE "new_Venue" RENAME TO "Venue";
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
