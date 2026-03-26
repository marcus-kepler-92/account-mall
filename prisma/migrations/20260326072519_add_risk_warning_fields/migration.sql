-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "riskWarningConfirmText" VARCHAR(50),
ADD COLUMN     "riskWarningContent" TEXT,
ADD COLUMN     "riskWarningCountdown" INTEGER,
ADD COLUMN     "riskWarningEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "riskWarningTitle" VARCHAR(100);
