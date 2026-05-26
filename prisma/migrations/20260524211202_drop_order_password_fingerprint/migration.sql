-- DropIndex
DROP INDEX IF EXISTS "Order_email_passwordFingerprint_createdAt_idx";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "passwordFingerprint";

-- CreateIndex
CREATE INDEX "Order_email_createdAt_idx" ON "Order"("email", "createdAt");
