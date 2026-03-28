-- Change default value of discountCodeEnabled from false to true
-- New distributors will have discount enabled by default (base 5% platform discount)
ALTER TABLE "User" ALTER COLUMN "discountCodeEnabled" SET DEFAULT true;
