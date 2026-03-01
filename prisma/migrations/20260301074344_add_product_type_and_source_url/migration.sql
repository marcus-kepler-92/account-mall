-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('NORMAL', 'FREE_SHARED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "productType" "ProductType" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "sourceUrl" TEXT;
