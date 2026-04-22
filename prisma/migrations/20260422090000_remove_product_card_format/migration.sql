-- DropForeignKey
ALTER TABLE "ProductCardFormat" DROP CONSTRAINT "ProductCardFormat_productId_fkey";

-- DropIndex
DROP INDEX "ProductCardFormat_productId_sortOrder_idx";

-- DropTable
DROP TABLE "ProductCardFormat";
