-- Rename ProductType enum value FREE_SHARED → AUTO_FETCH
-- PostgreSQL does not support ALTER TYPE ... RENAME VALUE directly (only available in PG 10+).
-- Strategy: add new value → migrate data → rebuild type without old value.

-- Step 1: Add the new enum value
ALTER TYPE "ProductType" ADD VALUE 'AUTO_FETCH';

-- Step 2: Migrate existing data
UPDATE "Product" SET "productType" = 'AUTO_FETCH' WHERE "productType" = 'FREE_SHARED';

-- Step 3: Rebuild the enum type without FREE_SHARED
-- (PostgreSQL does not support DROP VALUE, so we must recreate the type)
-- Temporarily change the column type to text, drop old enum, create new, change back.
ALTER TABLE "Product" ALTER COLUMN "productType" TYPE text;
DROP TYPE "ProductType";
CREATE TYPE "ProductType" AS ENUM ('NORMAL', 'AUTO_FETCH');
ALTER TABLE "Product" ALTER COLUMN "productType" TYPE "ProductType" USING "productType"::"ProductType";

-- Step 4: Restore the default value
ALTER TABLE "Product" ALTER COLUMN "productType" SET DEFAULT 'NORMAL';
