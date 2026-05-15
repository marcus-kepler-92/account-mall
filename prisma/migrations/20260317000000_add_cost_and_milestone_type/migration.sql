-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('INVITATION', 'SALES');

-- AlterTable
ALTER TABLE "InvitationMilestone" ADD COLUMN     "type" "MilestoneType" NOT NULL DEFAULT 'INVITATION';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "costSnapshot" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costPerUnit" DECIMAL(10,2);
