-- 費用與收據：拍照／上傳附件（私有）、支出日期、商家、單據號碼、幣別、退回說明、防重複提交鍵、更正歷史
-- 全部為新增欄位與資料表，可逆；不動既有費用資料
ALTER TABLE "Expense" ADD COLUMN "expenseDate" DATETIME;
ALTER TABLE "Expense" ADD COLUMN "vendorName" TEXT;
ALTER TABLE "Expense" ADD COLUMN "docNumber" TEXT;
ALTER TABLE "Expense" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'TWD';
ALTER TABLE "Expense" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "Expense" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "Expense" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Expense_idempotencyKey_key" ON "Expense"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "Expense_docNumber_idx" ON "Expense"("docNumber");
CREATE TABLE IF NOT EXISTS "ExpenseAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseId" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "bytes" BLOB NOT NULL,
    "thumbBytes" BLOB,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT,
    "sha256" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseAttachment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ExpenseAttachment_expenseId_idx" ON "ExpenseAttachment"("expenseId");
CREATE INDEX IF NOT EXISTS "ExpenseAttachment_uploadedBy_createdAt_idx" ON "ExpenseAttachment"("uploadedBy", "createdAt");
CREATE INDEX IF NOT EXISTS "ExpenseAttachment_sha256_idx" ON "ExpenseAttachment"("sha256");
CREATE TABLE IF NOT EXISTS "ExpenseRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseId" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "note" TEXT,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseRevision_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ExpenseRevision_expenseId_createdAt_idx" ON "ExpenseRevision"("expenseId", "createdAt");
