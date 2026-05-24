-- AlterTable
ALTER TABLE "Order" ADD COLUMN "passwordFingerprint" VARCHAR(64);

-- CreateIndex
CREATE INDEX "Order_email_passwordFingerprint_createdAt_idx" ON "Order"("email", "passwordFingerprint", "createdAt");
