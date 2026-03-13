-- Add AUTO_FETCH validity, expiry, and refresh fields
ALTER TABLE "Product" ADD COLUMN "validityHours" INTEGER;
ALTER TABLE "Card" ADD COLUMN "lastRefreshedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "promoCode" TEXT;
