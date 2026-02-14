-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "clientIp" TEXT;

-- CreateIndex
CREATE INDEX "Order_clientIp_status_idx" ON "Order"("clientIp", "status");
