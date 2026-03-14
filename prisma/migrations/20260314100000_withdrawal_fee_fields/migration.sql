-- Withdrawal: add fee fields for platform service charge
ALTER TABLE "Withdrawal" ADD COLUMN "feePercent" DECIMAL(5,2);
ALTER TABLE "Withdrawal" ADD COLUMN "feeAmount" DECIMAL(10,2);
