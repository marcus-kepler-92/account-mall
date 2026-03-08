-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DISTRIBUTOR');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'SETTLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED');

-- AlterTable "User": add role and distributorCode
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'DISTRIBUTOR';
ALTER TABLE "User" ADD COLUMN "distributorCode" VARCHAR(64);

-- Existing users (admin) get ADMIN role
UPDATE "User" SET "role" = 'ADMIN';

CREATE UNIQUE INDEX "User_distributorCode_key" ON "User"("distributorCode");

-- AlterTable "Order": add distributorId
ALTER TABLE "Order" ADD COLUMN "distributorId" TEXT;

-- AlterTable "Product": remove secretCode, add commissionAmount
ALTER TABLE "Product" DROP COLUMN IF EXISTS "secretCode";
ALTER TABLE "Product" ADD COLUMN "commissionAmount" DECIMAL(10,2);

-- CreateTable CommissionTier
CREATE TABLE "CommissionTier" (
    "id" TEXT NOT NULL,
    "minAmount" DECIMAL(12,2) NOT NULL,
    "maxAmount" DECIMAL(12,2) NOT NULL,
    "amountPerOrder" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionTier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommissionTier_sortOrder_idx" ON "CommissionTier"("sortOrder");

-- CreateTable Commission
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Commission_distributorId_idx" ON "Commission"("distributorId");
CREATE INDEX "Commission_orderId_idx" ON "Commission"("orderId");

-- CreateTable Withdrawal
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Withdrawal_distributorId_idx" ON "Withdrawal"("distributorId");
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");

-- AddForeignKey Order -> User (distributor)
ALTER TABLE "Order" ADD CONSTRAINT "Order_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Order_distributorId_idx" ON "Order"("distributorId");

-- AddForeignKey Commission -> Order, User
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey Withdrawal -> User
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
