-- AlterTable User: add discountCodeEnabled and discountPercent (used by distributor promo codes)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "discountCodeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5,2);
