-- AlterTable: drop type column
ALTER TABLE "InvitationMilestone" DROP COLUMN "type";

-- DropEnum
DROP TYPE "MilestoneType";
