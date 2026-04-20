-- CreateTable
CREATE TABLE "ProductCardFormat" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCardFormat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCardFormat_productId_sortOrder_idx" ON "ProductCardFormat"("productId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ProductCardFormat" ADD CONSTRAINT "ProductCardFormat_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
