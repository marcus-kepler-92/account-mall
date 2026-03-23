-- DropForeignKey (tables may already be gone via 20250307000000_remove_automation_tables)
DO $$ BEGIN
  ALTER TABLE "AutomationTask" DROP CONSTRAINT "AutomationTask_presetId_fkey";
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AutomationTask" DROP CONSTRAINT "AutomationTask_productId_fkey";
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AutomationTaskItem" DROP CONSTRAINT "AutomationTaskItem_cardId_fkey";
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AutomationTaskItem" DROP CONSTRAINT "AutomationTaskItem_taskId_fkey";
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AutomationTaskLog" DROP CONSTRAINT "AutomationTaskLog_itemId_fkey";
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AutomationTaskLog" DROP CONSTRAINT "AutomationTaskLog_taskId_fkey";
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductAutomationPreset" DROP CONSTRAINT "ProductAutomationPreset_productId_fkey";
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL; END $$;

-- AlterTable
ALTER TABLE "CommissionTier" ALTER COLUMN "ratePercent" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "hasSwitchedAccount" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE IF EXISTS "AutomationTask";
DROP TABLE IF EXISTS "AutomationTaskItem";
DROP TABLE IF EXISTS "AutomationTaskLog";
DROP TABLE IF EXISTS "ProductAutomationPreset";

-- DropEnum
DROP TYPE IF EXISTS "AutomationCategory";
DROP TYPE IF EXISTS "AutomationPresetType";
DROP TYPE IF EXISTS "AutomationTaskItemStatus";
DROP TYPE IF EXISTS "AutomationTaskStatus";

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
