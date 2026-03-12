-- AlterTable User: add inviterId for distributor-invite-distributor relationship
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviterId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_inviterId_idx" ON "User"("inviterId");

-- AddForeignKey (self-reference: User.inviterId -> User.id)
ALTER TABLE "User" ADD CONSTRAINT "User_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable InvitationReward: one record per invitee when their first order completes
CREATE TABLE "InvitationReward" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'SETTLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitationReward_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one reward per invitee
CREATE UNIQUE INDEX "InvitationReward_inviteeId_key" ON "InvitationReward"("inviteeId");

CREATE INDEX "InvitationReward_inviterId_idx" ON "InvitationReward"("inviterId");

-- AddForeignKey
ALTER TABLE "InvitationReward" ADD CONSTRAINT "InvitationReward_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
