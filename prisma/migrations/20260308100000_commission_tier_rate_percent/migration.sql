-- CommissionTier: add ratePercent (commission %), remove amountPerOrder
ALTER TABLE "CommissionTier" ADD COLUMN "ratePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "CommissionTier" DROP COLUMN "amountPerOrder";
