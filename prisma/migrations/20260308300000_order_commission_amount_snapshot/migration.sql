-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "commissionAmountSnapshot" DECIMAL(10,2);
