-- AlterTable
ALTER TABLE "DistributorInvitation" ADD COLUMN     "maxUses" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "usedCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: existing accepted single-use invitations count as 1 use
UPDATE "DistributorInvitation" SET "usedCount" = 1 WHERE "acceptedAt" IS NOT NULL;
