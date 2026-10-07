-- 後台帳號：首次登入更換密碼、授權場館；費用與收據：申請人（本人僅能看自己的申請）
-- 全部為新增欄位，可逆（不刪改既有資料）
ALTER TABLE "AdminAccount" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdminAccount" ADD COLUMN "venueId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "submittedBy" TEXT;
ALTER TABLE "Receipt" ADD COLUMN "createdBy" TEXT;
CREATE INDEX IF NOT EXISTS "Expense_submittedBy_idx" ON "Expense"("submittedBy");
