-- Phase 2 第 2 步：球場狀態／容量欄位，以及 Device 裝置表
--
-- 執行方式同前一支：
--   node scripts/apply-sql.mjs prisma/migrations-manual/2026-10-06b_court-status-capacity_device.sql
-- 正式庫請於同一行先指定 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN。
-- 可重複執行：duplicate column 會被略過，CREATE 皆為 IF NOT EXISTS。
--
-- 執行後請再跑 node scripts/seed-devices.mjs 為每面球場建立標準裝置組。

ALTER TABLE "Court" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Court" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 4;
UPDATE "Court" SET "status" = 'INACTIVE' WHERE "active" = 0 AND "status" = 'ACTIVE';

CREATE TABLE IF NOT EXISTS "Device" (
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
CREATE INDEX IF NOT EXISTS "Device_courtId_idx" ON "Device"("courtId");
