-- AlterTable Order: add discountPercentApplied (discount % applied when order used distributor promo code)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountPercentApplied" DECIMAL(5,2);
