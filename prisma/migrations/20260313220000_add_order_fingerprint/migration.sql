ALTER TABLE "Order" ADD COLUMN "fingerprintHash" TEXT;
CREATE INDEX "Order_fingerprintHash_idx" ON "Order"("fingerprintHash");
