-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "purchaseLimitEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "purchaseLimitQuantity" INTEGER NOT NULL DEFAULT 1;
