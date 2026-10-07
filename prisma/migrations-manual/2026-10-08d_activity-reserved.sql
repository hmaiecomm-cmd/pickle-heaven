-- 活動：保留名額（總名額 − 保留 = 對外開放名額）
ALTER TABLE "Activity" ADD COLUMN "reservedCapacity" INTEGER NOT NULL DEFAULT 0;
