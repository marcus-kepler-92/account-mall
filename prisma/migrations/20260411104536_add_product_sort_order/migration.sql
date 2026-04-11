/*
  Warnings:

  - You are about to drop the column `pinnedAt` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable: add sortOrder first, keep pinnedAt temporarily
ALTER TABLE "Product" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill sortOrder based on original ordering (pinnedAt DESC NULLS LAST, createdAt DESC)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    ORDER BY "pinnedAt" DESC NULLS LAST, "createdAt" DESC
  ) - 1 AS rn
  FROM "Product"
)
UPDATE "Product" p SET "sortOrder" = r.rn FROM ranked r WHERE p.id = r.id;

-- AlterTable: now safe to drop pinnedAt
ALTER TABLE "Product" DROP COLUMN "pinnedAt";

-- CreateIndex
CREATE INDEX "Product_sortOrder_idx" ON "Product"("sortOrder");
