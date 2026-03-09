-- Remove per-item commission (元/件): Product.commissionAmount, Order.commissionAmountSnapshot
-- Commission is now tier-only (percentage of order amount).

ALTER TABLE "Product" DROP COLUMN IF EXISTS "commissionAmount";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "commissionAmountSnapshot";
