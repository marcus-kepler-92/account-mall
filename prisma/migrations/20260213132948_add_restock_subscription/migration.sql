-- CreateEnum
CREATE TYPE "RestockSubscriptionStatus" AS ENUM ('PENDING', 'NOTIFIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "RestockSubscription" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "RestockSubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestockSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestockSubscription_productId_status_idx" ON "RestockSubscription"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RestockSubscription_productId_email_key" ON "RestockSubscription"("productId", "email");

-- AddForeignKey
ALTER TABLE "RestockSubscription" ADD CONSTRAINT "RestockSubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
