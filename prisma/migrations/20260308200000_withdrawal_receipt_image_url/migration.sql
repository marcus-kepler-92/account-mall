-- Add receipt image URL to Withdrawal (收款码)
ALTER TABLE "Withdrawal" ADD COLUMN IF NOT EXISTS "receiptImageUrl" TEXT;
