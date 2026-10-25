-- 個資告知事項與服務條款同意紀錄、行銷同意（另行勾選）
-- 全部為新增欄位，可逆；既有會員皆為「尚未同意」，下次登入時會出現同意畫面
-- 正式庫與展示庫（DEMO_DATABASE_URL）都要套用
ALTER TABLE "User" ADD COLUMN "consentVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "consentAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "marketingOptInAt" DATETIME;
