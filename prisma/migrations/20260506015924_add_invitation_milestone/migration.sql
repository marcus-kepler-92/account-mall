-- CreateTable
CREATE TABLE "InvitationMilestone" (
    "id" TEXT NOT NULL,
    "thresholdAmount" DECIMAL(12,2) NOT NULL,
    "bonusAmount" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitationMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationMilestoneBonus" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "thresholdSnapshot" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationMilestoneBonus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvitationMilestone_sortOrder_idx" ON "InvitationMilestone"("sortOrder");

-- CreateIndex
CREATE INDEX "InvitationMilestone_thresholdAmount_idx" ON "InvitationMilestone"("thresholdAmount");

-- CreateIndex
CREATE INDEX "InvitationMilestoneBonus_inviterId_idx" ON "InvitationMilestoneBonus"("inviterId");

-- CreateIndex
CREATE INDEX "InvitationMilestoneBonus_inviteeId_idx" ON "InvitationMilestoneBonus"("inviteeId");

-- CreateIndex
CREATE INDEX "InvitationMilestoneBonus_milestoneId_idx" ON "InvitationMilestoneBonus"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationMilestoneBonus_inviteeId_milestoneId_key" ON "InvitationMilestoneBonus"("inviteeId", "milestoneId");

-- AddForeignKey
ALTER TABLE "InvitationMilestoneBonus" ADD CONSTRAINT "InvitationMilestoneBonus_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationMilestoneBonus" ADD CONSTRAINT "InvitationMilestoneBonus_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationMilestoneBonus" ADD CONSTRAINT "InvitationMilestoneBonus_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "InvitationMilestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
