-- 2026-11-19 官網首頁編輯器：HomePageConfig / HomePageVersion
-- 只新增這兩張表與一個索引；全部 IF NOT EXISTS，可重複執行，不動任何既有資料表。
-- 取代 prisma/migrations/20261118084928_home_page_config（該檔會重建 Venue 等既有表，不可對正式庫執行）。
-- 套用：node scripts/apply-sql.mjs prisma/migrations-manual/2026-11-19a_home_page_config.sql

CREATE TABLE IF NOT EXISTS "HomePageConfig" (
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

CREATE TABLE IF NOT EXISTS "HomePageVersion" (
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

CREATE INDEX IF NOT EXISTS "HomePageVersion_homePageConfigId_createdAt_idx" ON "HomePageVersion"("homePageConfigId", "createdAt");
