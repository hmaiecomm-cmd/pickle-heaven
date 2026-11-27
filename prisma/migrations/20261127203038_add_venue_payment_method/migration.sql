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

-- CreateIndex
CREATE INDEX "VenuePaymentMethod_venueId_idx" ON "VenuePaymentMethod"("venueId");

-- CreateIndex
CREATE INDEX "VenuePaymentMethod_isDefault_idx" ON "VenuePaymentMethod"("isDefault");

-- CreateIndex
CREATE INDEX "VenuePaymentMethod_isActive_idx" ON "VenuePaymentMethod"("isActive");
