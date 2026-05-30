-- CreateEnum
CREATE TYPE "CommissionMode" AS ENUM ('NONE', 'GLOBAL', 'FIXED_AMOUNT', 'FIXED_PERCENT');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "commissionMode" "CommissionMode" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN     "commissionValue" DECIMAL(10,2);

-- Data migration: carry over the old boolean. excludeFromAttribution=true means
-- "never attributed / no commission", which is exactly the new NONE mode.
UPDATE "Product" SET "commissionMode" = 'NONE' WHERE "excludeFromAttribution" = true;
