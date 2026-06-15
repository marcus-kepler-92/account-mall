-- ChannelWithdrawal -> Payout: drop channelId FK/index/column, rename table
ALTER TABLE "ChannelWithdrawal" DROP CONSTRAINT "ChannelWithdrawal_channelId_fkey";
DROP INDEX "ChannelWithdrawal_channelId_idx";
ALTER TABLE "ChannelWithdrawal" DROP COLUMN "channelId";
ALTER TABLE "ChannelWithdrawal" RENAME TO "Payout";
ALTER TABLE "Payout" RENAME CONSTRAINT "ChannelWithdrawal_pkey" TO "Payout_pkey";
CREATE INDEX "Payout_createdAt_idx" ON "Payout"("createdAt");

-- Order: drop paymentChannelId
ALTER TABLE "Order" DROP CONSTRAINT "Order_paymentChannelId_fkey";
DROP INDEX "Order_paymentChannelId_idx";
ALTER TABLE "Order" DROP COLUMN "paymentChannelId";

-- drop PaymentChannel
DROP TABLE "PaymentChannel";
