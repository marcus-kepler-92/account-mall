/*
  Warnings:

  - You are about to drop the column `usedAt` on the `CrossSellUsage` table. All the data in the column will be lost.
  - You are about to drop the column `crossSellSourceOrderId` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CrossSellSetting" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "CrossSellUsage" DROP COLUMN "usedAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "crossSellSourceOrderId";

-- CreateIndex
CREATE INDEX "CrossSellUsage_targetProductId_idx" ON "CrossSellUsage"("targetProductId");
