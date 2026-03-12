-- Unique constraint on orderId for one-to-one Order <-> InvitationReward
CREATE UNIQUE INDEX IF NOT EXISTS "InvitationReward_orderId_key" ON "InvitationReward"("orderId");

-- AddForeignKey: InvitationReward.orderId -> Order.id (for listing orderNo in 邀请奖励明细)
ALTER TABLE "InvitationReward" ADD CONSTRAINT "InvitationReward_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: InvitationReward.inviteeId -> User.id (for listing invitee name/email)
ALTER TABLE "InvitationReward" ADD CONSTRAINT "InvitationReward_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
