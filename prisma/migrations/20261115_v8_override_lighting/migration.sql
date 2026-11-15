-- V8-BC：手動操作維持方式、封場／維護照明（只新增欄位，皆有預設值或可為空）
ALTER TABLE "Circuit" ADD COLUMN "overrideMode" TEXT;
ALTER TABLE "Circuit" ADD COLUMN "overrideState" TEXT;
ALTER TABLE "Circuit" ADD COLUMN "overrideBaseline" TEXT;
ALTER TABLE "Circuit" ADD COLUMN "overrideUntil" DATETIME;
ALTER TABLE "Circuit" ADD COLUMN "overrideBy" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "lighting" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MaintenancePlan" ADD COLUMN "lighting" BOOLEAN NOT NULL DEFAULT true;
