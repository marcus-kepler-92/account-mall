-- CreateEnum
CREATE TYPE "AutomationCategory" AS ENUM ('APPLE');

-- CreateEnum
CREATE TYPE "AutomationPresetType" AS ENUM ('STATUS_TEST', 'CHANGE_PASSWORD', 'CHANGE_REGION');

-- CreateEnum
CREATE TYPE "AutomationTaskStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "AutomationTaskItemStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "secretCode" VARCHAR(64);

-- CreateTable
CREATE TABLE "ProductAutomationPreset" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "category" "AutomationCategory" NOT NULL DEFAULT 'APPLE',
    "presetKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "presetType" "AutomationPresetType" NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "configJson" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAutomationPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationTask" (
    "id" TEXT NOT NULL,
    "category" "AutomationCategory" NOT NULL DEFAULT 'APPLE',
    "productId" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "status" "AutomationTaskStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT NOT NULL,
    "inputConfig" JSONB,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationTaskItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "status" "AutomationTaskItemStatus" NOT NULL DEFAULT 'PENDING',
    "resultJson" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationTaskItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductAutomationPreset_productId_category_isEnabled_idx" ON "ProductAutomationPreset"("productId", "category", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAutomationPreset_productId_presetKey_key" ON "ProductAutomationPreset"("productId", "presetKey");

-- CreateIndex
CREATE INDEX "AutomationTask_category_status_createdAt_idx" ON "AutomationTask"("category", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationTask_productId_createdAt_idx" ON "AutomationTask"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationTask_presetId_idx" ON "AutomationTask"("presetId");

-- CreateIndex
CREATE INDEX "AutomationTaskItem_taskId_status_idx" ON "AutomationTaskItem"("taskId", "status");

-- CreateIndex
CREATE INDEX "AutomationTaskItem_cardId_idx" ON "AutomationTaskItem"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationTaskItem_taskId_cardId_key" ON "AutomationTaskItem"("taskId", "cardId");

-- AddForeignKey
ALTER TABLE "ProductAutomationPreset" ADD CONSTRAINT "ProductAutomationPreset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTask" ADD CONSTRAINT "AutomationTask_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTask" ADD CONSTRAINT "AutomationTask_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "ProductAutomationPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTaskItem" ADD CONSTRAINT "AutomationTaskItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AutomationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTaskItem" ADD CONSTRAINT "AutomationTaskItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
