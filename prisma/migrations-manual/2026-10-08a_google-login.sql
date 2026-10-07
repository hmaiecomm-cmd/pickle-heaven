-- 前台改用 Google 登入；場館新增預約截止分鐘數
ALTER TABLE "User" ADD COLUMN "googleSub" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User"("googleSub");
ALTER TABLE "Venue" ADD COLUMN "bookingCutoffMinutes" INTEGER NOT NULL DEFAULT 0;
