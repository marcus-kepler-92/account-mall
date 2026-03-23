/*
  Warnings:

  - You are about to drop the `AutomationTask` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AutomationTaskItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AutomationTaskLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductAutomationPreset` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AutomationTask" DROP CONSTRAINT "AutomationTask_presetId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationTask" DROP CONSTRAINT "AutomationTask_productId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationTaskItem" DROP CONSTRAINT "AutomationTaskItem_cardId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationTaskItem" DROP CONSTRAINT "AutomationTaskItem_taskId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationTaskLog" DROP CONSTRAINT "AutomationTaskLog_itemId_fkey";

-- DropForeignKey
ALTER TABLE "AutomationTaskLog" DROP CONSTRAINT "AutomationTaskLog_taskId_fkey";

-- DropForeignKey
ALTER TABLE "ProductAutomationPreset" DROP CONSTRAINT "ProductAutomationPreset_productId_fkey";

-- AlterTable
ALTER TABLE "CommissionTier" ALTER COLUMN "ratePercent" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "hasSwitchedAccount" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "AutomationTask";

-- DropTable
DROP TABLE "AutomationTaskItem";

-- DropTable
DROP TABLE "AutomationTaskLog";

-- DropTable
DROP TABLE "ProductAutomationPreset";

-- DropEnum
DROP TYPE "AutomationCategory";

-- DropEnum
DROP TYPE "AutomationPresetType";

-- DropEnum
DROP TYPE "AutomationTaskItemStatus";

-- DropEnum
DROP TYPE "AutomationTaskStatus";

-- CreateTable
CREATE TABLE "AccountBlacklist" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "reason" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountBlacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountBlacklist_productId_idx" ON "AccountBlacklist"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountBlacklist_productId_account_key" ON "AccountBlacklist"("productId", "account");

-- AddForeignKey
ALTER TABLE "AccountBlacklist" ADD CONSTRAINT "AccountBlacklist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
