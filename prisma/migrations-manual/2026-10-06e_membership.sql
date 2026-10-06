-- Phase 2 第 4 步：會員等級欄位與會員折扣設定表
--
--   node scripts/apply-sql.mjs prisma/migrations-manual/2026-10-06e_membership.sql
-- 正式庫請於同一行先指定 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN。
-- 可重複執行：duplicate column 略過、CREATE IF NOT EXISTS、INSERT OR IGNORE。

ALTER TABLE "User" ADD COLUMN "membershipLevel" TEXT NOT NULL DEFAULT 'BASIC';

CREATE TABLE IF NOT EXISTS "MembershipTier" (
    "level" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT OR IGNORE INTO "MembershipTier" ("level", "label", "discountPct", "sortOrder", "updatedAt") VALUES ('BASIC', '一般', 0, 0, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "MembershipTier" ("level", "label", "discountPct", "sortOrder", "updatedAt") VALUES ('PREMIUM', '進階', 10, 1, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "MembershipTier" ("level", "label", "discountPct", "sortOrder", "updatedAt") VALUES ('VIP', 'VIP', 20, 2, CURRENT_TIMESTAMP);
