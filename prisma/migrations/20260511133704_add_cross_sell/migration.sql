-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "crossSellSourceOrderId" TEXT;

-- CreateTable
CREATE TABLE "ProductCrossSell" (
    "id" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCrossSell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossSellSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "ttlMinutes" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossSellSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossSellUsage" (
    "id" TEXT NOT NULL,
    "sourceOrderId" TEXT NOT NULL,
    "targetOrderId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrossSellUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCrossSell_sourceProductId_sortOrder_idx" ON "ProductCrossSell"("sourceProductId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCrossSell_sourceProductId_targetProductId_key" ON "ProductCrossSell"("sourceProductId", "targetProductId");

-- CreateIndex
CREATE UNIQUE INDEX "CrossSellUsage_targetOrderId_key" ON "CrossSellUsage"("targetOrderId");

-- CreateIndex
CREATE INDEX "CrossSellUsage_sourceOrderId_idx" ON "CrossSellUsage"("sourceOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "CrossSellUsage_sourceOrderId_targetProductId_key" ON "CrossSellUsage"("sourceOrderId", "targetProductId");

-- AddForeignKey
ALTER TABLE "ProductCrossSell" ADD CONSTRAINT "ProductCrossSell_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCrossSell" ADD CONSTRAINT "ProductCrossSell_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossSellUsage" ADD CONSTRAINT "CrossSellUsage_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossSellUsage" ADD CONSTRAINT "CrossSellUsage_targetOrderId_fkey" FOREIGN KEY ("targetOrderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
