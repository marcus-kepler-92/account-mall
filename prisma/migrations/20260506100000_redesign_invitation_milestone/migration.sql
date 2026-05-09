-- AlterTable: add thresholdCount to InvitationMilestone
-- Existing rows (dev data) get a placeholder value of 0 during migration; admin should update via UI.
ALTER TABLE "InvitationMilestone" ADD COLUMN "thresholdCount" INTEGER NOT NULL DEFAULT 0;

-- Remove DEFAULT after backfill so future inserts require an explicit value
ALTER TABLE "InvitationMilestone" ALTER COLUMN "thresholdCount" DROP DEFAULT;

-- AlterTable: drop inviteeId column and its foreign key from InvitationMilestoneBonus
ALTER TABLE "InvitationMilestoneBonus" DROP CONSTRAINT IF EXISTS "InvitationMilestoneBonus_inviteeId_fkey";

-- DropIndex: old unique constraint and inviteeId index
DROP INDEX IF EXISTS "InvitationMilestoneBonus_inviteeId_milestoneId_key";
DROP INDEX IF EXISTS "InvitationMilestoneBonus_inviteeId_idx";

-- Drop inviteeId column
ALTER TABLE "InvitationMilestoneBonus" DROP COLUMN "inviteeId";

-- AddColumn: countSnapshot
ALTER TABLE "InvitationMilestoneBonus" ADD COLUMN "countSnapshot" INTEGER NOT NULL DEFAULT 0;

-- Remove DEFAULT after backfill (no existing rows expected in prod, but safe either way)
ALTER TABLE "InvitationMilestoneBonus" ALTER COLUMN "countSnapshot" DROP DEFAULT;

-- CreateIndex: new unique constraint (one bonus per inviter per milestone)
CREATE UNIQUE INDEX "InvitationMilestoneBonus_inviterId_milestoneId_key" ON "InvitationMilestoneBonus"("inviterId", "milestoneId");
