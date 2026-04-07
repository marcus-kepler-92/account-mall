-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentChannelId" TEXT;

-- CreateTable
CREATE TABLE "PaymentChannel" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "pid" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "submitUrl" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "annualLimit" DECIMAL(10,2) NOT NULL DEFAULT 65000,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelWithdrawal" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentChannel_type_isActive_sortOrder_idx" ON "PaymentChannel"("type", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ChannelWithdrawal_channelId_idx" ON "ChannelWithdrawal"("channelId");

-- CreateIndex
CREATE INDEX "Order_paymentChannelId_idx" ON "Order"("paymentChannelId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentChannelId_fkey" FOREIGN KEY ("paymentChannelId") REFERENCES "PaymentChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelWithdrawal" ADD CONSTRAINT "ChannelWithdrawal_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "PaymentChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
