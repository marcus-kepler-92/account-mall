-- Add exitDiscountMeta column to Order table
ALTER TABLE "Order" ADD COLUMN "exitDiscountMeta" TEXT;

-- CreateTable ExitDiscountUsage
CREATE TABLE "ExitDiscountUsage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExitDiscountUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExitDiscountUsage_orderId_key" ON "ExitDiscountUsage"("orderId");

-- CreateIndex
CREATE INDEX "ExitDiscountUsage_productId_visitorId_idx" ON "ExitDiscountUsage"("productId", "visitorId");

-- CreateIndex
CREATE INDEX "ExitDiscountUsage_productId_fingerprintHash_idx" ON "ExitDiscountUsage"("productId", "fingerprintHash");

-- CreateIndex
CREATE INDEX "ExitDiscountUsage_productId_ip_idx" ON "ExitDiscountUsage"("productId", "ip");

-- AddForeignKey
ALTER TABLE "ExitDiscountUsage" ADD CONSTRAINT "ExitDiscountUsage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitDiscountUsage" ADD CONSTRAINT "ExitDiscountUsage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
